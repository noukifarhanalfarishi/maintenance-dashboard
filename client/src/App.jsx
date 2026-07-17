import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ConfirmProvider } from './contexts/ConfirmContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import DailyLog from './pages/DailyLog'
import PMSchedule from './pages/PMSchedule'
import Machines from './pages/Machines'
import SpareParts from './pages/SpareParts'
import Reports from './pages/Reports'
import Users from './pages/Users'
// NOTE: "Perbaikan"/"Problems" (konsep lama) sudah tidak ada di codebase —
// digantikan Daily Maintenance Activity Log (DailyLog.jsx) + PM Schedule.

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login/>}/>
      <Route path="/" element={
        <ProtectedRoute>
          <Layout/>
        </ProtectedRoute>
      }>
        <Route index element={<Navigate to="/dashboard" replace/>}/>
        <Route path="dashboard"   element={<ProtectedRoute route="dashboard">  <Dashboard/> </ProtectedRoute>}/>
        <Route path="daily-log"   element={<ProtectedRoute route="daily-log"> <DailyLog/>  </ProtectedRoute>}/>
        <Route path="pm-schedule" element={<ProtectedRoute route="pm-schedule"><PMSchedule/></ProtectedRoute>}/>
        <Route path="machines"    element={<ProtectedRoute route="machines">   <Machines/>  </ProtectedRoute>}/>
        <Route path="spare-parts" element={<ProtectedRoute route="spare-parts"><SpareParts/></ProtectedRoute>}/>
        <Route path="reports"     element={<ProtectedRoute route="reports">    <Reports/>   </ProtectedRoute>}/>
        <Route path="users"       element={<ProtectedRoute route="users">      <Users/>     </ProtectedRoute>}/>
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace/>}/>
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ConfirmProvider>
          <AppRoutes/>
        </ConfirmProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
