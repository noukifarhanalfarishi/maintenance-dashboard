import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

// ── 401 interceptor: redirect to login on expired / invalid token ──────────
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && window.location.pathname !== '/login') {
      localStorage.removeItem('maint_token')
      localStorage.removeItem('maint_user')
      window.location.replace('/login')
    }
    return Promise.reject(err)
  }
)

export default api

// ── Domain APIs ───────────────────────────────────────────────────────────
export const authApi = {
  login:  (d)  => api.post('/auth/login', d),
  me:     ()   => api.get('/auth/me'),
  logout: ()   => api.post('/auth/logout'),
}

export const dashboardApi = {
  getSummary:          ()    => api.get('/dashboard/summary'),
  getMonthlyTrend:     ()    => api.get('/dashboard/monthly-trend'),
  getTopMachines:      ()    => api.get('/dashboard/top-machines'),
  getDowntimeCategory: ()    => api.get('/dashboard/downtime-category'),
  getLowStock:         ()    => api.get('/dashboard/low-stock'),
  getSummaryV2:    (p) => api.get('/dashboard/summary-v2',      { params: p }),
  getWeeklyTrend:  ()  => api.get('/dashboard/weekly-trend'),
  getByCategory:   (p) => api.get('/dashboard/by-category',     { params: p }),
  getTopDowntime:  (p) => api.get('/dashboard/top-downtime',    { params: p }),
  getPareto:       (p) => api.get('/dashboard/pareto',          { params: p }),
  getRecentProblems:(p)=> api.get('/dashboard/recent-problems', { params: p }),
  getParetoLine:    (p) => api.get('/dashboard/pareto-line',    { params: p }),
  getParetoMachine: (p) => api.get('/dashboard/pareto-machine', { params: p }),
  getNewRepeat:     (p) => api.get('/dashboard/new-repeat',     { params: p }),
}

export const machinesApi = {
  getAll:       (p)     => api.get('/machines',              { params: p }),
  getMeta:      ()      => api.get('/machines/meta'),
  getById:      (id)    => api.get(`/machines/${id}`),
  getStats:     (id)    => api.get(`/machines/${id}/stats`),
  getChartData: (id)    => api.get(`/machines/${id}/chart-data`),
  create:       (d)     => api.post('/machines', d),
  update:       (id, d) => api.put(`/machines/${id}`, d),
  delete:       (id)    => api.delete(`/machines/${id}`),
}

export const problemsApi = {
  getAll:    (p)     => api.get('/problems',           { params: p }),
  getById:   (id)    => api.get(`/problems/${id}`),
  create:    (d)     => api.post('/problems', d),
  update:    (id, d) => api.put(`/problems/${id}`, d),
  patch:     (id, d) => api.patch(`/problems/${id}`, d),
  delete:    (id)    => api.delete(`/problems/${id}`),
  addRepair: (id, d) => api.post(`/problems/${id}/repairs`, d),
}

export const repairsApi = {
  getAll:   (p)     => api.get('/repairs',       { params: p }),
  getById:  (id)    => api.get(`/repairs/${id}`),
  create:   (d)     => api.post('/repairs', d),
  update:   (id, d) => api.put(`/repairs/${id}`, d),
  delete:   (id)    => api.delete(`/repairs/${id}`),
}

export const sparePartsApi = {
  getAll:      (p)     => api.get('/spare-parts',           { params: p }),
  getById:     (id)    => api.get(`/spare-parts/${id}`),
  create:      (d)     => api.post('/spare-parts', d),
  update:      (id, d) => api.put(`/spare-parts/${id}`, d),
  adjustStock: (id, a) => api.patch(`/spare-parts/${id}/stock`, { adjustment: a }),
  delete:      (id)    => api.delete(`/spare-parts/${id}`),
}

export const usersApi = {
  getAll:  ()       => api.get('/users'),
  create:  (d)      => api.post('/users', d),
  update:  (id, d)  => api.put(`/users/${id}`, d),
  login:   (d)      => api.post('/users/login', d),
}

export const reportsApi = {
  getSummary:      (p)       => api.get('/reports/summary',       { params: p }),
  getMachineReport:(id, p)   => api.get(`/reports/machine/${id}`, { params: p }),
}
