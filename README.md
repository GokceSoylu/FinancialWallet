# FinancialWallet

Finansal cüzdan ve işlem yönetimini sağlayan backend/mimari projesi.

## 📁 Proje Yapısı

```text
FinancialWallet/
├── Configuration/          # Uygulama ve veritabanı konfigürasyonları
├── Context/                # Entity Framework DbContext ve veritabanı bağlamları
└── Entities/               # Veritabanı modelleri / Varlıklar
    ├── Transaction.cs      # Finansal işlem modeli
    ├── User.cs             # Kullanıcı modeli
    └── Wallet.cs           # Cüzdan modeli
```