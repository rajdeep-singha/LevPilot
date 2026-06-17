import { Routes, Route, Navigate } from 'react-router-dom'
import Home from '../pages/Home'
import Dashboard from '../pages/Dashboard'
import History from '../pages/History'

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/app" element={<Dashboard />} />
      <Route path="/app/history" element={<History />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
