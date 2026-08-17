import axios from 'axios';

// Backend portun 5220 ise:
const API_BASE_URL = 'http://localhost:5220/api';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: { 'Content-Type': 'application/json' },
});

export const getHealth = () => api.get('/health/db');
export const getWallets = () => api.get('/wallets');
export const depositOrWithdraw = (payload) => api.post('/transactions/deposit-withdraw', payload);
export const transferMoney = (payload) => api.post('/transactions/transfer', payload);

export default api;