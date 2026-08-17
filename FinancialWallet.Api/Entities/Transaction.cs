namespace FinancialWallet.Api.Entities;

public enum TransactionType
{
    Deposit = 1,
    Withdraw = 2,
    Transfer = 3
}

public class Transaction
{
    public Guid Id { get; set; }
    public Guid SourceWalletId { get; set; }
    public Guid? TargetWalletId { get; set; }
    public decimal Amount { get; set; }
    public TransactionType Type { get; set; }
    public string Description { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Wallet SourceWallet { get; set; } = null!;
}