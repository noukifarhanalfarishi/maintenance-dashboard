import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

// ── 401 interceptor: redirect to login on expired / invalid token ──────────
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && window.location.pathname !== '/login') {
      sessionStorage.removeItem('maint_token')
      sessionStorage.removeItem('maint_user')
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
  getSummaryV2:      (p) => api.get('/dashboard/summary-v2',      { params: p }),
  getWeeklyTrend:    (p) => api.get('/dashboard/weekly-trend',    { params: p }),
  getByCategory:     (p) => api.get('/dashboard/by-category',     { params: p }),
  getTopDowntime:    (p) => api.get('/dashboard/top-downtime',    { params: p }),
  getLowStock:       ()  => api.get('/dashboard/low-stock'),
  getRecentActivity: (p) => api.get('/dashboard/recent-activity', { params: p }),
  getPmSummary:      (p) => api.get('/dashboard/pm-summary',      { params: p }),
}

export const machinesApi = {
  getAll:       (p)     => api.get('/machines',              { params: p }),
  getMeta:      ()      => api.get('/machines/meta'),
  getById:      (id)    => api.get(`/machines/${id}`),
  getStats:     (id)    => api.get(`/machines/${id}/stats`),
  getChartData: (id)    => api.get(`/machines/${id}/chart-data`),
  getLogs:      (id, p) => api.get(`/machines/${id}/logs`, { params: p }),
  create:       (d)     => api.post('/machines', d),
  update:       (id, d) => api.put(`/machines/${id}`, d),
  delete:       (id)    => api.delete(`/machines/${id}`),
}

export const dailyLogsApi = {
  getAll:  (p)     => api.get('/daily-logs',        { params: p }),
  getById: (id)    => api.get(`/daily-logs/${id}`),
  create:  (d)     => api.post('/daily-logs', d),
  update:  (id, d) => api.put(`/daily-logs/${id}`, d),
  patch:   (id, d) => api.patch(`/daily-logs/${id}`, d),
  delete:  (id)    => api.delete(`/daily-logs/${id}`),
}

export const pmSchedulesApi = {
  getAll:    (p)     => api.get('/pm-schedules', { params: p }),
  getById:   (id)    => api.get(`/pm-schedules/${id}`),
  create:    (d)     => api.post('/pm-schedules', d),
  update:    (id, d) => api.put(`/pm-schedules/${id}`, d),
  complete:  (id, d) => api.patch(`/pm-schedules/${id}/complete`, d),
  delete:    (id)    => api.delete(`/pm-schedules/${id}`),
}

export const shiftsApi = {
  getAll: () => api.get('/shifts'),
  update: (id, d) => api.put(`/shifts/${id}`, d),
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
  getDaily:        (p)       => api.get('/reports/daily',         { params: p }),
  getMonthly:      (p)       => api.get('/reports/monthly',       { params: p }),
  getMachineReport:(id, p)   => api.get(`/reports/machine/${id}`, { params: p }),
}
