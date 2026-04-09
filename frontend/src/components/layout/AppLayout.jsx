import { Box, AppBar, Toolbar, Typography, IconButton, Avatar } from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import Sidebar, { drawerWidth } from './Sidebar';
import ThemeToggle from './ThemeToggle';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getBackendAssetUrl } from '../../services/api';

function readAuthUser() {
  try {
    const rawUser = sessionStorage.getItem('user');
    return rawUser ? JSON.parse(rawUser) : null;
  } catch {
    return null;
  }
}

export default function AppLayout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(() => readAuthUser());
  const hideSidebar = location.pathname === '/dashboard/admin';

  useEffect(() => {
    const handleAuthChange = () => {
      setUser(readAuthUser());
    };

    window.addEventListener('auth-changed', handleAuthChange);
    return () => window.removeEventListener('auth-changed', handleAuthChange);
  }, []);

  const handleLogout = () => {
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('token');
    window.dispatchEvent(new Event('auth-changed'));
    setTimeout(() => navigate('/login'), 100);
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar
        position="fixed"
        elevation={1}
        sx={{
          backgroundColor: 'background.paper',
          color: 'text.primary',
          borderBottom: '1px solid',
          borderColor: 'divider',
          zIndex: (theme) => theme.zIndex.drawer + 1,
        }}
      >
        <Toolbar>
          <Typography variant="h6" noWrap sx={{ flexGrow: 1, fontWeight: 700, color: 'primary.main' }}>
            NewMed
          </Typography>
          <ThemeToggle />
          <Typography variant="subtitle1" sx={{ ml: 1, mr: 1 }}>
            {user?.nume}
          </Typography>
          <IconButton 
            onClick={() => navigate('/dashboard/profil')} 
            sx={{ mr: 1 }}
            aria-label="profil"
          >
            <Avatar src={getBackendAssetUrl(user?.avatar_url)} sx={{ bgcolor: 'primary.main', width: 32, height: 32 }}>
              {user?.nume?.[0]?.toUpperCase()}
            </Avatar>
          </IconButton>
          <IconButton color="primary" onClick={handleLogout} aria-label="logout">
            <LogoutIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      {!hideSidebar && <Sidebar />}

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: hideSidebar ? 3 : 0,
          width: hideSidebar ? '100%' : `calc(100% - ${drawerWidth}px)`,
          bgcolor: hideSidebar ? 'background.default' : 'transparent',
        }}
      >
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
}


