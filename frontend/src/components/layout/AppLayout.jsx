import { Box, AppBar, Toolbar, Typography, IconButton, Avatar } from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import Sidebar, { drawerWidth } from './Sidebar';
import ThemeToggle from './ThemeToggle';
import { useNavigate } from 'react-router-dom';

export default function AppLayout({ children }) {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user'));

  const handleLogout = () => {
    localStorage.removeItem('user');
    window.dispatchEvent(new Event('storage'));
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
            <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32 }}>
              {user?.nume?.[0]?.toUpperCase()}
            </Avatar>
          </IconButton>
          <IconButton color="primary" onClick={handleLogout} aria-label="logout">
            <LogoutIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Sidebar />

      <Box component="main" sx={{ flexGrow: 1, p: 3, ml: `${drawerWidth}px` }}>
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
}


