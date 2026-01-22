import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Box } from '@mui/material'
import Pacienti from './components/doctor/Pacienti'
import Medicamente from './components/shared/Medicamente'
import Login from './components/auth/Login'
import Register from './components/auth/Register'
import Dashboard from './components/Dashboard'
import ForgotPassword from './components/auth/ForgotPassword'
import ResetPassword from './components/auth/ResetPassword';
import Programari from './components/shared/Programari';
import LandingPage from './components/LandingPage';
import Profil from './components/shared/Profil';

function App() {
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem('user')
    return storedUser ? JSON.parse(storedUser) : null
  })

  useEffect(() => {
    const handleStorageChange = () => {
      const updatedUser = localStorage.getItem('user')
      console.log('Storage changed, new user:', updatedUser)
      setUser(updatedUser ? JSON.parse(updatedUser) : null)
    }

    // Adăugăm ambele evenimente pentru a prinde toate schimbările
    window.addEventListener('storage', handleStorageChange) // 1. Acesta e corect
    document.addEventListener('storage', handleStorageChange) // 2. Acesta este incorect
    
    return () => {
      window.removeEventListener('storage', handleStorageChange)
      document.removeEventListener('storage', handleStorageChange)
    }
  }, [])

  return (
    <Box sx={{ minHeight: '100vh' }}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={!user ? <LandingPage /> : <Navigate to="/dashboard" />} />
          <Route path="/login" element={!user ? <Login /> : <Navigate to="/dashboard" />} />
          <Route path="/register" element={!user ? <Register /> : <Navigate to="/dashboard" />} />
          <Route path="/dashboard" element={user ? <Dashboard /> : <Navigate to="/login" />} />
          <Route path="/dashboard/pacienti" element={user && user.role === 'doctor' ? <Pacienti /> : <Navigate to={user ? '/dashboard' : '/login'} />} />
          <Route path="/dashboard/medicamente" element={user ? <Medicamente /> : <Navigate to="/login" />} />
          <Route path="/forgot-password" element={!user ? <ForgotPassword /> : <Navigate to="/dashboard" />} />
          <Route path="/reset-password/:token" element={!user ? <ResetPassword /> : <Navigate to="/dashboard" />} />
          <Route 
  path="/dashboard/programari" 
  element={user ? <Programari /> : <Navigate to="/login" />} 
/>
          <Route path="/dashboard/profil" element={user ? <Profil /> : <Navigate to="/login" />} />
        </Routes>
      </BrowserRouter>
    </Box>
  )
}
export default App