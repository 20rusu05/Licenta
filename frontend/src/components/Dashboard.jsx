import { 
  Box, 
  Typography, 
  Button, 
  AppBar, 
  Toolbar, 
  Container,
  Paper,
  Grid,
  IconButton,
  Avatar
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import LogoutIcon from '@mui/icons-material/Logout';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import HealthAndSafetyIcon from '@mui/icons-material/HealthAndSafety';

export default function Dashboard() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user'));

  const handleLogout = () => {
    localStorage.removeItem('user');
    // Declanșăm evenimentul storage pentru a notifica App.jsx
    window.dispatchEvent(new Event('storage'));
    // Așteptăm puțin să se proceseze evenimentul
    setTimeout(() => {
      navigate('/login');
    }, 100);
  };

  const menuItems = [
    { icon: <DashboardIcon />, title: 'Tablou de bord', description: 'Vedere de ansamblu' },
    { icon: <PeopleIcon />, title: 'Pacienți', description: 'Gestionare pacienți' },
    { icon: <CalendarMonthIcon />, title: 'Programări', description: 'Calendar și programări' },
    { icon: <HealthAndSafetyIcon />, title: 'Analize', description: 'Rezultate și istoric' },
  ];

  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="fixed" elevation={1} sx={{ backgroundColor: 'background.paper' }}>
        <Toolbar>
          <Typography
            variant="h5"
            component="div"
            sx={{ flexGrow: 1, color: 'primary.main', fontWeight: 600 }}
          >
            NewMed
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="subtitle1" sx={{ color: 'text.primary' }}>
              {user?.nume}
            </Typography>
            <Avatar sx={{ bgcolor: 'primary.main' }}>
              {user?.nume?.[0]?.toUpperCase()}
            </Avatar>
            <IconButton color="primary" onClick={handleLogout}>
              <LogoutIcon />
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>
      <Toolbar /> {/* Spacer pentru AppBar */}
      
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Typography variant="h4" sx={{ mb: 4, color: 'text.primary', fontWeight: 500 }}>
          Bun venit în NewMed!
        </Typography>
        
        <Grid container spacing={3}>
          {menuItems.map((item, index) => (
            <Grid item xs={12} sm={6} md={3} key={index}>
              <Paper
                sx={{
                  p: 3,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.3s',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                  },
                }}
              >
                <Box
                  sx={{
                    p: 2,
                    borderRadius: '50%',
                    backgroundColor: 'primary.light',
                    color: 'primary.main',
                    mb: 2,
                  }}
                >
                  {item.icon}
                </Box>
                <Typography variant="h6" gutterBottom>
                  {item.title}
                </Typography>
                <Typography variant="body2" color="text.secondary" align="center">
                  {item.description}
                </Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
}