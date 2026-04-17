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
import TermsAndConditions from './components/auth/TermsAndConditions';
import AdminPanel from './components/admin/AdminPanel';
import SenzoriLive from './components/sensors/SenzoriLive';
import Mesaje from './components/shared/Mesaje';

function migrateLegacyAuthToSessionStorage() {
  if (typeof window === 'undefined') {
    return null;
  }

  const sessionUser = sessionStorage.getItem('user');
  const sessionToken = sessionStorage.getItem('token');
  if (sessionUser || sessionToken) {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    return sessionUser;
  }

  const legacyUser = localStorage.getItem('user');
  const legacyToken = localStorage.getItem('token');

  if (legacyUser) {
    sessionStorage.setItem('user', legacyUser);
    localStorage.removeItem('user');
  }

  if (legacyToken) {
    sessionStorage.setItem('token', legacyToken);
    localStorage.removeItem('token');
  }

  return sessionStorage.getItem('user');
}

function readAuthUser() {
  try {
    const rawUser = migrateLegacyAuthToSessionStorage();
    return rawUser ? JSON.parse(rawUser) : null;
  } catch {
    return null;
  }
}

function App() {
  const [user, setUser] = useState(() => readAuthUser())

  useEffect(() => {
	  const handleAuthChange = () => {
	    setUser(readAuthUser())
	  }

    window.addEventListener('auth-changed', handleAuthChange)

	    return () => {
	      window.removeEventListener('auth-changed', handleAuthChange)
	    }
  }, [])

  return (
    <Box sx={{ minHeight: '100vh' }}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={!user ? <LandingPage /> : <Navigate to="/dashboard" />} />
          <Route path="/login" element={!user ? <Login /> : <Navigate to="/dashboard" />} />
          <Route path="/register" element={!user ? <Register /> : <Navigate to="/dashboard" />} />
          <Route path="/terms" element={<TermsAndConditions />} />
          <Route path="/dashboard" element={user ? <Dashboard /> : <Navigate to="/login" />} />
          <Route path="/dashboard/admin" element={user && user.role === 'admin' ? <AdminPanel /> : <Navigate to={user ? '/dashboard' : '/login'} />} />
          <Route path="/dashboard/pacienti" element={user && user.role === 'doctor' ? <Pacienti /> : <Navigate to={user ? '/dashboard' : '/login'} />} />
          <Route path="/dashboard/medicamente" element={user ? <Medicamente /> : <Navigate to="/login" />} />
          <Route path="/forgot-password" element={!user ? <ForgotPassword /> : <Navigate to="/dashboard" />} />
          <Route path="/reset-password/:token" element={!user ? <ResetPassword /> : <Navigate to="/dashboard" />} />
          <Route 
  path="/dashboard/programari" 
  element={user ? <Programari /> : <Navigate to="/login" />} 
/>
          <Route path="/dashboard/profil" element={user ? <Profil /> : <Navigate to="/login" />} />
          <Route path="/dashboard/senzori" element={user ? <SenzoriLive /> : <Navigate to="/login" />} />
          <Route path="/dashboard/mesaje" element={user ? <Mesaje /> : <Navigate to="/login" />} />
        </Routes>
      </BrowserRouter>
    </Box>
  )
}
export default App