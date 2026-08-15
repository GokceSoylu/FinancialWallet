namespace FinancialWallet.Api.Entities;

public enum TransactionType
{
    Deposit = 1,
    Withdrawal = 2,
    Transfer = 3
}

public class Transaction
{
    public Guid Id { get; set; }
    public Guid WalletId { get; set; }
    public decimal Amount { get; set; }
    public TransactionType Type { get; set; }
    public string Description { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation property
    public Wallet Wallet { get; set; } = null!;
}