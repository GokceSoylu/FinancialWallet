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

        // Finansal verilerde precision ve scale zorunludur!
        builder.Property(w => w.Balance)
            .HasPrecision(18, 2)
            .HasDefaultValue(0.00m);

        // 1 Wallet -> N Transaction ilişkisi
        builder.HasMany(w => w.Transactions)
            .WithOne(t => t.Wallet)
            .HasForeignKey(t => t.WalletId)
            .OnDelete(DeleteBehavior.Restrict); // Cüzdan silinirse geçmiş transfer kayıtları silinmesin, korunsun!
    }
}