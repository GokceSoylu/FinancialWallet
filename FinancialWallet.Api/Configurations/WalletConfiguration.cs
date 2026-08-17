using FinancialWallet.Api.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FinancialWallet.Api.Configurations;

public class WalletConfiguration : IEntityTypeConfiguration<Wallet>
{
    public void Configure(EntityTypeBuilder<Wallet> builder)
    {
        builder.HasKey(w => w.Id);

        builder.Property(w => w.Currency)
            .IsRequired()
            .HasMaxLength(3);

        builder.Property(w => w.Balance)
            .HasPrecision(18, 2)
            .HasDefaultValue(0.00m);

        // Optimistic Concurrency Token
        builder.Property(w => w.Version)
            .IsConcurrencyToken();

        // 1 Wallet -> N Transaction (Source Wallet ilişkisi)
        builder.HasMany(w => w.Transactions)
            .WithOne(t => t.SourceWallet)
            .HasForeignKey(t => t.SourceWalletId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}