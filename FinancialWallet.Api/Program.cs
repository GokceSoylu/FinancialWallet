using System.Threading.Channels;
using FinancialWallet.Api.Context;
using FinancialWallet.Api.Entities;
using Microsoft.EntityFrameworkCore;
using Npgsql;

var builder = WebApplication.CreateBuilder(args);

// 1. PostgreSQL & AppDbContext Bağlantısı (Standart veya Render URL Desteği)
var rawConn = builder.Configuration.GetConnectionString("DefaultConnection")
              ?? Environment.GetEnvironmentVariable("DATABASE_URL");

builder.Services.AddDbContext<AppDbContext>(options =>
{
    if (!string.IsNullOrWhiteSpace(rawConn))
    {
        // Render postgresql:// formatındaysa Npgsql formatına çevir
        if (rawConn.StartsWith("postgres://") || rawConn.StartsWith("postgresql://"))
        {
            var uri = new Uri(rawConn);
            var userInfo = uri.UserInfo.Split(':');
            var npgsqlBuilder = new NpgsqlConnectionStringBuilder
            {
                Host = uri.Host,
                Port = uri.Port > 0 ? uri.Port : 5432,
                Username = userInfo[0],
                Password = userInfo.Length > 1 ? userInfo[1] : string.Empty,
                Database = uri.AbsolutePath.TrimStart('/'),
                SslMode = SslMode.Require,
                TrustServerCertificate = true
            };
            options.UseNpgsql(npgsqlBuilder.ConnectionString);
        }
        else
        {
            options.UseNpgsql(rawConn);
        }
    }
    else
    {
        options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection"));
    }
});

// 2. CORS Yapılandırması
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// 3. Event-Driven Dekont Kuyruğu (Asenkron Background Worker)
builder.Services.AddSingleton(Channel.CreateUnbounded<ReceiptEvent>());
builder.Services.AddHostedService<ReceiptWorkerService>();

var app = builder.Build();

// Swagger'ı Production dahil her ortamda aç
app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "FinancialWallet API v1");
    c.RoutePrefix = string.Empty; // Sitenin ana adresine girince (/) doğrudan Swagger açılsın
});

app.UseCors("AllowAll");

// 4. Tablo ve Demo Veri Oluşturma (Korumalı Blok)
try
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

    db.Database.EnsureCreated();

    if (!db.Users.Any())
    {
        var user1 = new User { Id = Guid.NewGuid(), FullName = "Gökçe Soylu", Email = "gokce@apexwallet.com" };
        var user2 = new User { Id = Guid.NewGuid(), FullName = "Ahmet Yılmaz", Email = "ahmet@apexwallet.com" };

        var w1 = new Wallet { Id = Guid.NewGuid(), UserId = user1.Id, Currency = "TRY", Balance = 25000.00m, Version = Guid.NewGuid() };
        var w2 = new Wallet { Id = Guid.NewGuid(), UserId = user1.Id, Currency = "USD", Balance = 1500.00m, Version = Guid.NewGuid() };
        var w3 = new Wallet { Id = Guid.NewGuid(), UserId = user2.Id, Currency = "TRY", Balance = 3500.00m, Version = Guid.NewGuid() };

        db.Users.AddRange(user1, user2);
        db.Wallets.AddRange(w1, w2, w3);

        db.Transactions.Add(new Transaction
        {
            Id = Guid.NewGuid(),
            SourceWalletId = w1.Id,
            Amount = 25000.00m,
            Type = TransactionType.Deposit,
            Description = "İlk Bakiye Yüklemesi",
            CreatedAt = DateTime.UtcNow
        });

        db.SaveChanges();
    }
}
catch (Exception ex)
{
    Console.WriteLine($"[UYARI] Veritabanı başlatma hatası: {ex.Message}");
}

// 5. Endpoint'ler

// Health Check
app.MapGet("/api/health/db", async (AppDbContext db) =>
{
    var canConnect = await db.Database.CanConnectAsync();
    return canConnect ? Results.Ok(new { Status = "Healthy" }) : Results.Problem("DB Bağlantı Hatası");
});

// Cüzdanları ve Hareketleri Listeleme
app.MapGet("/api/wallets", async (AppDbContext db) =>
{
    var wallets = await db.Wallets
        .Include(w => w.Transactions.OrderByDescending(t => t.CreatedAt).Take(20))
        .Select(w => new
        {
            w.Id,
            w.UserId,
            w.Currency,
            w.Balance,
            w.Version,
            Transactions = w.Transactions.Select(t => new
            {
                t.Id,
                t.SourceWalletId,
                t.TargetWalletId,
                t.Amount,
                Type = (int)t.Type,
                t.Description,
                t.CreatedAt
            })
        }).ToListAsync();

    return Results.Ok(wallets);
});

// Para Yatırma / Çekme
app.MapPost("/api/transactions/deposit-withdraw", async (AppDbContext db, DepositWithdrawDto dto) =>
{
    if (dto.Amount <= 0) return Results.BadRequest("Tutar sıfırdan büyük olmalıdır.");

    var wallet = await db.Wallets.FindAsync(dto.WalletId);
    if (wallet == null) return Results.NotFound("Cüzdan bulunamadı.");

    if (dto.Type == TransactionType.Withdraw && wallet.Balance < dto.Amount)
        return Results.BadRequest("Yetersiz bakiye.");

    if (dto.Type == TransactionType.Deposit) wallet.Balance += dto.Amount;
    if (dto.Type == TransactionType.Withdraw) wallet.Balance -= dto.Amount;

    wallet.Version = Guid.NewGuid();

    var tx = new Transaction
    {
        Id = Guid.NewGuid(),
        SourceWalletId = wallet.Id,
        Amount = dto.Amount,
        Type = dto.Type,
        Description = string.IsNullOrWhiteSpace(dto.Description) ? $"{dto.Type} İşlemi" : dto.Description,
        CreatedAt = DateTime.UtcNow
    };

    db.Transactions.Add(tx);

    try
    {
        await db.SaveChangesAsync();
        return Results.Ok(new
        {
            tx.Id,
            tx.SourceWalletId,
            tx.Amount,
            Type = (int)tx.Type,
            tx.Description,
            tx.CreatedAt
        });
    }
    catch (DbUpdateConcurrencyException)
    {
        return Results.Conflict("Yarış durumu (Concurrency): Bakiye başka bir işlem tarafından güncellendi. Lütfen tekrar deneyin.");
    }
});

// Hesaplar Arası Para Transferi
app.MapPost("/api/transactions/transfer", async (AppDbContext db, Channel<ReceiptEvent> queue, TransferDto dto) =>
{
    if (dto.Amount <= 0) return Results.BadRequest("Transfer tutarı sıfırdan büyük olmalıdır.");
    if (dto.SourceWalletId == dto.TargetWalletId) return Results.BadRequest("Aynı cüzdana transfer yapılamaz.");

    await using var dbTx = await db.Database.BeginTransactionAsync();
    try
    {
        var sourceWallet = await db.Wallets.FindAsync(dto.SourceWalletId);
        var targetWallet = await db.Wallets.FindAsync(dto.TargetWalletId);

        if (sourceWallet == null || targetWallet == null)
            return Results.NotFound("Gönderici veya alıcı cüzdan bulunamadı.");

        if (sourceWallet.Currency != targetWallet.Currency)
            return Results.BadRequest("Farklı para birimleri arasında transfer yapılamaz.");

        if (sourceWallet.Balance < dto.Amount)
            return Results.BadRequest("Yetersiz bakiye.");

        sourceWallet.Balance -= dto.Amount;
        sourceWallet.Version = Guid.NewGuid();

        targetWallet.Balance += dto.Amount;
        targetWallet.Version = Guid.NewGuid();

        var tx = new Transaction
        {
            Id = Guid.NewGuid(),
            SourceWalletId = sourceWallet.Id,
            TargetWalletId = targetWallet.Id,
            Amount = dto.Amount,
            Type = TransactionType.Transfer,
            Description = string.IsNullOrWhiteSpace(dto.Description) ? $"Transfer -> {targetWallet.Id.ToString()[..8]}" : dto.Description,
            CreatedAt = DateTime.UtcNow
        };

        db.Transactions.Add(tx);
        await db.SaveChangesAsync();
        await dbTx.CommitAsync();

        await queue.Writer.WriteAsync(new ReceiptEvent(
            tx.Id, sourceWallet.Id, targetWallet.Id, dto.Amount, sourceWallet.Currency, DateTime.UtcNow
        ));

        return Results.Ok(new
        {
            tx.Id,
            tx.SourceWalletId,
            tx.TargetWalletId,
            tx.Amount,
            Type = (int)tx.Type,
            tx.Description,
            tx.CreatedAt
        });
    }
    catch (DbUpdateConcurrencyException)
    {
        await dbTx.RollbackAsync();
        return Results.Conflict("Yarış durumu engellendi. İşlem geri alındı.");
    }
    catch (Exception ex)
    {
        await dbTx.RollbackAsync();
        return Results.Problem($"Transfer başarısız: {ex.Message}");
    }
});

app.Run();

// DTO Modelleri ve Worker Sınıfı
public record DepositWithdrawDto(Guid WalletId, decimal Amount, TransactionType Type, string? Description);
public record TransferDto(Guid SourceWalletId, Guid TargetWalletId, decimal Amount, string? Description);
public record ReceiptEvent(Guid TransactionId, Guid FromWallet, Guid ToWallet, decimal Amount, string Currency, DateTime Date);

public class ReceiptWorkerService : BackgroundService
{
    private readonly Channel<ReceiptEvent> _queue;
    private readonly ILogger<ReceiptWorkerService> _logger;

    public ReceiptWorkerService(Channel<ReceiptEvent> queue, ILogger<ReceiptWorkerService> logger)
    {
        _queue = queue;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Receipt Worker Service kuyruğu dinliyor...");
        while (!stoppingToken.IsCancellationRequested && await _queue.Reader.WaitToReadAsync(stoppingToken))
        {
            while (_queue.Reader.TryRead(out var item))
            {
                await Task.Delay(500, stoppingToken);
                _logger.LogInformation("\n[DEKONT OLUŞTURULDU] İşlem ID: {TxId} | Gönderen: {From} -> Alıcı: {To} | Tutar: {Amount} {Currency} | Tarih: {Date}\n",
                    item.TransactionId, item.FromWallet, item.ToWallet, item.Amount, item.Currency, item.Date);
            }
        }
    }
}