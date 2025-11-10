import { useMemo } from 'react';
import { Drawer, List, ListItemButton, ListItemIcon, ListItemText, Toolbar, Box } from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import HealthAndSafetyIcon from '@mui/icons-material/HealthAndSafety';
import { useNavigate, useLocation } from 'react-router-dom';

const drawerWidth = 240;

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem('user'));

  const items = useMemo(() => {
    const base = [
      { label: 'Tablou de bord', icon: <DashboardIcon />, path: '/dashboard' },
      { label: 'Programări', icon: <CalendarMonthIcon />, path: '/dashboard/programari' },
      { label: 'Medicamente', icon: <HealthAndSafetyIcon />, path: '/dashboard/medicamente' },
      { label: 'Analize', icon: <HealthAndSafetyIcon />, path: '/dashboard/analize' },
    ];
    if (user?.role === 'doctor') {
      base.splice(1, 0, { label: 'Pacienți', icon: <PeopleIcon />, path: '/dashboard/pacienti' });
    }
    return base;
  }, [user?.role]);

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          boxSizing: 'border-box',
          borderRight: '1px solid',
          borderColor: 'divider',
        },
      }}
    >
      <Toolbar />
      <Box sx={{ overflow: 'auto' }}>
        <List>
          {items.map((item) => {
            const selected = item.path === '/dashboard'
              ? location.pathname === '/dashboard'
              : location.pathname.startsWith(item.path);
            return (
              <ListItemButton
                key={item.path}
                selected={selected}
                onClick={() => navigate(item.path)}
              >
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItemButton>
            );
          })}
        </List>
      </Box>
    </Drawer>
  );
}

export { drawerWidth };


