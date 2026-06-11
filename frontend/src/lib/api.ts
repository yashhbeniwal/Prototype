import axios, { AxiosInstance, AxiosError } from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const api: AxiosInstance = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor — inject auth token
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor — handle 401 refresh
api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    // ... we will keep the original response interceptor code intact but we bypass it with our mocks anyway
    return Promise.reject(error);
  }
);

// MOCK ALL METHODS FOR THE PROTOTYPE
const createMockResponse = (mockData: any, config: any) => {
  return { 
    data: { 
      data: mockData, 
      success: true,
      pagination: { total: Array.isArray(mockData) ? mockData.length : 0, page: 1, limit: 20 }
    }, 
    status: 200, 
    statusText: 'OK', 
    headers: {}, 
    config: config || {} 
  } as any;
};

api.get = async (url: string, config?: any) => {
  let mockData: any = [];
  if (url.includes('/stats')) mockData = { totalAnimals: 150, sick: 5, pregnant: 12, milking: 45 };
  else if (url.includes('/dashboard')) mockData = { revenue: 150000, expenses: 80000, profit: 70000 };
  else if (url.includes('/customers/top-debtors')) mockData = [];
  else if (url.includes('/auth/me')) mockData = { id: '1', name: 'Farmer', role: 'OWNER', email: 'farmerp@pashuvaani.com' };
  
  return createMockResponse(mockData, config);
};

api.post = async (url: string, data?: any, config?: any) => {
  return createMockResponse({}, config);
};

api.patch = async (url: string, data?: any, config?: any) => {
  return createMockResponse({}, config);
};

api.put = async (url: string, data?: any, config?: any) => {
  return createMockResponse({}, config);
};

api.delete = async (url: string, config?: any) => {
  return createMockResponse({}, config);
};

// Response interceptor — handle 401 refresh
api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const res = await axios.post(`${API_BASE_URL}/api/v1/auth/refresh`, { refreshToken });
          const { accessToken, refreshToken: newRefresh } = res.data.data;
          localStorage.setItem('accessToken', accessToken);
          localStorage.setItem('refreshToken', newRefresh);
          if (error.config) {
            error.config.headers.Authorization = `Bearer ${accessToken}`;
            return api(error.config);
          }
        } catch {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          window.location.href = '/login';
        }
      } else {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) => api.post('/auth/login', { email, password }),
  me: () => api.get('/auth/me'),
  refresh: (refreshToken: string) => api.post('/auth/refresh', { refreshToken }),
  register: (data: any) => api.post('/auth/register', data),
  changePassword: (data: any) => api.patch('/auth/change-password', data),
};

// ─── Animals ──────────────────────────────────────────────────────────────────
export const animalApi = {
  list: (params?: any) => api.get('/animals', { params }),
  stats: (params?: any) => api.get('/animals/stats', { params }),
  get: (id: string) => api.get(`/animals/${id}`),
  create: (data: any) => api.post('/animals', data),
  update: (id: string, data: any) => api.patch(`/animals/${id}`, data),
  archive: (id: string, data: any) => api.patch(`/animals/${id}/archive`, data),
  transfer: (id: string, data: any) => api.patch(`/animals/${id}/transfer`, data),
  uploadMedia: (id: string, file: File, mediaType: 'images' | 'videos') => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/animals/${id}/media?mediaType=${mediaType}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

// ─── Vaccinations ─────────────────────────────────────────────────────────────
export const vaccinationApi = {
  list: (params?: any) => api.get('/vaccinations', { params }),
  due: (params?: any) => api.get('/vaccinations/due', { params }),
  calendar: (month: number, year: number) => api.get('/vaccinations/calendar', { params: { month, year } }),
  create: (data: any) => api.post('/vaccinations', data),
  update: (id: string, data: any) => api.patch(`/vaccinations/${id}`, data),
  remind: (id: string, phone: string) => api.post(`/vaccinations/${id}/remind`, { phone }),
};

// ─── Medical ──────────────────────────────────────────────────────────────────
export const medicalApi = {
  list: (params?: any) => api.get('/medical', { params }),
  get: (id: string) => api.get(`/medical/${id}`),
  create: (data: any) => api.post('/medical', data),
  update: (id: string, data: any) => api.patch(`/medical/${id}`, data),
  uploadAttachment: (id: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/medical/${id}/attachments`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
};

// ─── Feed ─────────────────────────────────────────────────────────────────────
export const feedApi = {
  inventory: () => api.get('/feed/inventory'),
  createInventory: (data: any) => api.post('/feed/inventory', data),
  updateInventory: (id: string, data: any) => api.patch(`/feed/inventory/${id}`, data),
  consumption: (params?: any) => api.get('/feed/consumption', { params }),
  recordConsumption: (data: any) => api.post('/feed/consumption', data),
  costReport: (params?: any) => api.get('/feed/cost-report', { params }),
};

// ─── Customers ────────────────────────────────────────────────────────────────
export const customerApi = {
  list: (params?: any) => api.get('/customers', { params }),
  topDebtors: (limit?: number) => api.get('/customers/top-debtors', { params: { limit } }),
  get: (id: string) => api.get(`/customers/${id}`),
  ledger: (id: string, params?: any) => api.get(`/customers/${id}/ledger`, { params }),
  create: (data: any) => api.post('/customers', data),
  update: (id: string, data: any) => api.patch(`/customers/${id}`, data),
};

// ─── Billing ──────────────────────────────────────────────────────────────────
export const billingApi = {
  invoices: (params?: any) => api.get('/billing/invoices', { params }),
  dashboard: () => api.get('/billing/dashboard'),
  getInvoice: (id: string) => api.get(`/billing/invoices/${id}`),
  downloadPDF: (id: string) => api.get(`/billing/invoices/${id}/pdf`, { responseType: 'blob' }),
  createInvoice: (data: any) => api.post('/billing/invoices', data),
  recordPayment: (data: any) => api.post('/billing/payments', data),
  createRazorpayOrder: (invoiceId: string) => api.post('/billing/razorpay/order', { invoiceId }),
};

// ─── Voice ────────────────────────────────────────────────────────────────────
export const voiceApi = {
  query: (audioBlob: Blob) => {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'voice.webm');
    return api.post('/voice/query', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  queryText: (text: string) => api.post('/voice/query', { text }),
};

// ─── Reports ──────────────────────────────────────────────────────────────────
export const reportApi = {
  animals: (params?: any) => api.get('/reports/animals', { params, responseType: params?.format !== 'json' ? 'blob' : 'json' }),
  vaccinations: (params?: any) => api.get('/reports/vaccinations', { params, responseType: params?.format !== 'json' ? 'blob' : 'json' }),
  outstanding: (params?: any) => api.get('/reports/customers/outstanding', { params, responseType: params?.format !== 'json' ? 'blob' : 'json' }),
  profitability: (params?: any) => api.get('/reports/profitability', { params }),
};

// ─── Farms ────────────────────────────────────────────────────────────────────
export const farmApi = {
  list: () => api.get('/farms'),
  create: (data: any) => api.post('/farms', data),
  update: (id: string, data: any) => api.patch(`/farms/${id}`, data),
};

export default api;
