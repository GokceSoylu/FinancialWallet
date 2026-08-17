# 1. Aşama: SDK ile Derleme
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Sadece csproj kopyala ve restore et (Cache optimizasyonu)
COPY ["FinancialWallet.Api.csproj", "./"]
RUN dotnet restore "FinancialWallet.Api.csproj"

# Kalan dosyaları kopyala ve publish et
COPY . .
RUN dotnet publish "FinancialWallet.Api.csproj" -c Release -o /app/publish /p:UseAppHost=false

# 2. Aşama: Hafif Runtime İmajı
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .

ENV ASPNETCORE_URLS=http://+:5000
EXPOSE 5000

ENTRYPOINT ["dotnet", "FinancialWallet.Api.dll"]