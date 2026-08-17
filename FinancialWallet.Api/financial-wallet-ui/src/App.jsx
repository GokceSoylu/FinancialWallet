import React, { useState, useEffect } from 'react';
import { getWallets, depositOrWithdraw, transferMoney, getHealth } from './services/api';
import {
  Wallet, ArrowUpRight, ArrowDownRight, RefreshCw,
  PlusCircle, MinusCircle, Send, AlertCircle, CheckCircle2, ShieldCheck
} from 'lucide-react';

export default function App() {
  const [wallets, setWallets] = useState([]);
  const [activeWallet, setActiveWallet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dbStatus, setDbStatus] = useState('Kontrol Ediliyor...');
  const [filterType, setFilterType] = useState('ALL');

  // Modal Durumları
  const [modalMode, setModalMode] = useState(null); // 'DEPOSIT', 'WITHDRAW', 'TRANSFER'
  const [amount, setAmount] = useState('');
  const [targetWalletId, setTargetWalletId] = useState('');
  const [description, setDescription] = useState('');
  const [statusMessage, setStatusMessage] = useState({ type: '', text: '' });
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      await getHealth();
      setDbStatus('PostgreSQL Bağlı');

      const res = await getWallets();
      setWallets(res.data);
      if (res.data.length > 0) {
        setActiveWallet((prev) => res.data.find(w => w.id === prev?.id) || res.data[0]);
      }
    } catch (err) {
      setDbStatus('Backend Erişilemez');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openModal = (mode) => {
    setModalMode(mode);
    setAmount('');
    setDescription('');
    setTargetWalletId('');
    setStatusMessage({ type: '', text: '' });
  };

  const handleActionSubmit = async (e) => {
    e.preventDefault();
    setStatusMessage({ type: '', text: '' });
    setSubmitting(true);

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setStatusMessage({ type: 'error', text: 'Geçerli bir tutar girin.' });
      setSubmitting(false);
      return;
    }

    try {
      if (modalMode === 'TRANSFER') {
        if (!targetWalletId) {
          setStatusMessage({ type: 'error', text: 'Hedef cüzdan seçilmelidir.' });
          setSubmitting(false);
          return;
        }
        await transferMoney({
          sourceWalletId: activeWallet.id,
          targetWalletId: targetWalletId,
          amount: numericAmount,
          description: description
        });
      } else {
        await depositOrWithdraw({
          walletId: activeWallet.id,
          amount: numericAmount,
          type: modalMode === 'DEPOSIT' ? 1 : 2,
          description: description
        });
      }

      setStatusMessage({ type: 'success', text: 'İşlem başarıyla tamamlandı!' });
      setTimeout(() => {
        setModalMode(null);
        fetchData();
      }, 1000);
    } catch (err) {
      const errText = err.response?.data?.title || err.response?.data || 'İşlem başarısız.';
      setStatusMessage({ type: 'error', text: typeof errText === 'string' ? errText : 'Bir hata oluştu.' });
    } finally {
      setSubmitting(false);
    }
  };

  const currencySymbols = { TRY: '₺', USD: '$', EUR: '€' };

  const filteredTransactions = activeWallet?.transactions?.filter(tx => {
    if (filterType === 'DEPOSIT') return tx.type === 1;
    if (filterType === 'WITHDRAW') return tx.type === 2;
    if (filterType === 'TRANSFER') return tx.type === 3;
    return true;
  }) || [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 flex flex-col items-center">
      <div className="w-full max-w-4xl space-y-6">

        {/* Üst Bar */}
        <header className="flex justify-between items-center bg-slate-900/60 backdrop-blur border border-slate-800 p-4 rounded-2xl">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600/20 text-indigo-400 rounded-xl border border-indigo-500/30">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight flex items-center gap-2">
                ApexWallet <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full">CQRS & ACID</span>
              </h1>
              <p className="text-xs text-slate-400">Optimistic Locking & Background Worker</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs bg-slate-800/80 px-3 py-1.5 rounded-full border border-slate-700">
              <span className={`w-2 h-2 rounded-full ${dbStatus.includes('Bağlı') ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
              <span className="text-slate-300">{dbStatus}</span>
            </div>
            <button
              onClick={fetchData}
              className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition"
              title="Yenile"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </header>

        {/* Cüzdan Kartları */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {wallets.map((w) => {
            const isSelected = activeWallet?.id === w.id;
            return (
              <button
                key={w.id}
                onClick={() => setActiveWallet(w)}
                className={`p-4 rounded-xl text-left border transition-all relative overflow-hidden ${isSelected
                    ? 'bg-indigo-600/10 border-indigo-500/50 shadow-lg shadow-indigo-500/10 ring-1 ring-indigo-500'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700 opacity-70'
                  }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-semibold text-slate-400">{w.currency} Hesabı</span>
                  <span className="text-xs font-mono font-bold text-indigo-400">{w.currency}</span>
                </div>
                <p className="text-xl font-bold text-white">
                  {currencySymbols[w.currency] || ''}{w.balance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                </p>
                <div className="mt-2 text-[10px] text-slate-500 font-mono truncate">
                  ID: {w.id}
                </div>
              </button>
            );
          })}
        </div>

        {/* Aktif Cüzdan & Aksiyon Butonları */}
        {activeWallet && (
          <div className="bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-900 border border-indigo-500/30 p-6 rounded-2xl shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-indigo-300">Aktif Cüzdan Bakiyesi</p>
                <span className="flex items-center gap-1 text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                  <ShieldCheck className="w-3 h-3" /> Concurrency Korumalı
                </span>
              </div>
              <h2 className="text-4xl font-black mt-2 text-white tracking-tight">
                {currencySymbols[activeWallet.currency]} {activeWallet.balance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
              </h2>
            </div>

            <div className="flex flex-wrap gap-2.5 w-full md:w-auto">
              <button
                onClick={() => openModal('DEPOSIT')}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-4 py-2.5 rounded-xl transition shadow-lg shadow-emerald-900/20"
              >
                <PlusCircle className="w-4 h-4" />
                Yatır
              </button>
              <button
                onClick={() => openModal('WITHDRAW')}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-500 text-white font-medium px-4 py-2.5 rounded-xl transition shadow-lg shadow-rose-900/20"
              >
                <MinusCircle className="w-4 h-4" />
                Çek
              </button>
              <button
                onClick={() => openModal('TRANSFER')}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-4 py-2.5 rounded-xl transition shadow-lg shadow-indigo-900/20"
              >
                <Send className="w-4 h-4" />
                Transfer Et
              </button>
            </div>
          </div>
        )}

        {/* Hesap Hareketleri */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <h3 className="text-base font-semibold text-slate-200">Hesap Hareketleri</h3>

            <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
              {['ALL', 'DEPOSIT', 'WITHDRAW', 'TRANSFER'].map((type) => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`px-3 py-1.5 rounded-md font-medium transition ${filterType === type ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                >
                  {type === 'ALL' ? 'Tümü' : type === 'DEPOSIT' ? 'Yatırma' : type === 'WITHDRAW' ? 'Çekim' : 'Transfer'}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-slate-800">
            {filteredTransactions.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-6">Bu cüzdanda henüz işlem kaydı bulunmuyor.</p>
            ) : (
              filteredTransactions.map((tx) => (
                <div key={tx.id} className="py-3.5 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${tx.type === 1 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                        tx.type === 2 ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                          'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                      }`}>
                      {tx.type === 1 && <ArrowDownRight className="w-4 h-4" />}
                      {tx.type === 2 && <ArrowUpRight className="w-4 h-4" />}
                      {tx.type === 3 && <Send className="w-4 h-4" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-200">{tx.description}</p>
                      <p className="text-xs text-slate-500">
                        {new Date(tx.createdAt).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  <span className={`text-sm font-bold font-mono ${tx.type === 1 ? 'text-emerald-400' : tx.type === 2 ? 'text-rose-400' : 'text-indigo-400'
                    }`}>
                    {tx.type === 1 ? '+' : '-'}{currencySymbols[activeWallet?.currency]} {tx.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* İşlem Modalı */}
      {modalMode && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white">
              {modalMode === 'DEPOSIT' && 'Para Yatır'}
              {modalMode === 'WITHDRAW' && 'Para Çek'}
              {modalMode === 'TRANSFER' && 'Başka Cüzdana Transfer'}
              <span className="text-xs text-slate-400 ml-2 font-normal">({activeWallet?.currency})</span>
            </h3>

            {statusMessage.text && (
              <div className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${statusMessage.type === 'error'
                  ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                  : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                }`}>
                {statusMessage.type === 'error' ? <AlertCircle className="w-4 h-4 flex-shrink-0" /> : <CheckCircle2 className="w-4 h-4 flex-shrink-0" />}
                <span>{statusMessage.text}</span>
              </div>
            )}

            <form onSubmit={handleActionSubmit} className="space-y-4">
              {modalMode === 'TRANSFER' && (
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Hedef Cüzdan Seçin</label>
                  <select
                    value={targetWalletId}
                    onChange={(e) => setTargetWalletId(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 text-sm"
                  >
                    <option value="">Cüzdan Seçiniz...</option>
                    {wallets
                      .filter(w => w.id !== activeWallet?.id && w.currency === activeWallet?.currency)
                      .map(w => (
                        <option key={w.id} value={w.id}>
                          {w.currency} Cüzdanı - ID: {w.id.substring(0, 8)}... (Bakiye: {w.balance})
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Tutar ({activeWallet?.currency})</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Açıklama</label>
                <input
                  type="text"
                  placeholder="İşlem açıklaması girin..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalMode(null)}
                  disabled={submitting}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium py-2.5 rounded-xl text-sm transition"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`flex-1 font-medium py-2.5 rounded-xl text-sm transition ${modalMode === 'DEPOSIT' ? 'bg-emerald-600 hover:bg-emerald-500 text-white' :
                      modalMode === 'WITHDRAW' ? 'bg-rose-600 hover:bg-rose-500 text-white' :
                        'bg-indigo-600 hover:bg-indigo-500 text-white'
                    }`}
                >
                  {submitting ? 'İşleniyor...' : 'Onayla'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}