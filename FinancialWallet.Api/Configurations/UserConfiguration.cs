using FinancialWallet.Api.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FinancialWallet.Api.Configurations;

public class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.HasKey(u => u.Id);

        builder.Property(u => u.FullName)
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(u => u.Email)
            .IsRequired()
            .HasMaxLength(150);

        // Email benzersiz (unique) olmalı
        builder.HasIndex(u => u.Email)
            .IsUnique();

        // 1 User -> N Wallet ilişkisi
        builder.HasMany(u => u.Wallets)
            .WithOne(w => w.User)
            .HasForeignKey(w => w.UserId)
            .OnDelete(DeleteBehavior.Cascade); // Kullanıcı silinirse cüzdanları da silinsin
    }
}