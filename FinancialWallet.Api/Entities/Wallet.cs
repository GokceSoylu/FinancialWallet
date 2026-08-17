using System.ComponentModel.DataAnnotations;

namespace FinancialWallet.Api.Entities;

public class Wallet
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string Currency { get; set; } = "TRY";
    public decimal Balance { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Optimistic Concurrency Token
    [ConcurrencyCheck]
    public Guid Version { get; set; } = Guid.NewGuid();

    public User User { get; set; } = null!;
    public ICollection<Transaction> Transactions { get; set; } = new List<Transaction>();
}