import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './components/auth/Login'
import Register from './components/auth/Register'
import Dashboard from './components/Dashboard'
import { Box } from '@mui/material'

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
    window.addEventListener('storage', handleStorageChange)
    document.addEventListener('storage', handleStorageChange)
    
    return () => {
      window.removeEventListener('storage', handleStorageChange)
      document.removeEventListener('storage', handleStorageChange)
    }
  }, [])

  return (
    <Box sx={{ minHeight: '100vh' }}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={!user ? <Login /> : <Navigate to="/dashboard" />} />
          <Route path="/register" element={!user ? <Register /> : <Navigate to="/dashboard" />} />
          <Route path="/dashboard" element={user ? <Dashboard /> : <Navigate to="/login" />} />
          <Route path="/" element={<Navigate to={user ? "/dashboard" : "/login"} />} />
        </Routes>
      </BrowserRouter>
    </Box>
  )
}

export default App