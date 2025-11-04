import { Box, Typography, Container, Grid, Paper, LinearProgress, Divider } from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import HealthAndSafetyIcon from '@mui/icons-material/HealthAndSafety';
import AppLayout from './layout/AppLayout';
import StatCard from './dashboard/StatCard';

export default function Dashboard() {
  const user = JSON.parse(localStorage.getItem('user'));

  const menuItems = [
    { icon: <DashboardIcon />, title: 'Tablou de bord', description: 'Vedere de ansamblu' },
    { icon: <PeopleIcon />, title: 'Pacienți', description: 'Gestionare pacienți' },
    { icon: <CalendarMonthIcon />, title: 'Programări', description: 'Calendar și programări' },
    { icon: <HealthAndSafetyIcon />, title: 'Analize', description: 'Rezultate și istoric' },
  ];

  return (
    <AppLayout>
      <Container maxWidth="lg" sx={{ mt: 2, mb: 4 }}>
        <Typography variant="h4" sx={{ mb: 3, fontWeight: 700 }}>
          Bun venit, {user?.nume}!
        </Typography>

        <Grid container spacing={3}>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard icon={<PeopleIcon />} label="Pacienți activi" value="1,248" trend="+4.2%" />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard icon={<CalendarMonthIcon />} label="Programări azi" value="32" trend="+1.1%" />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard icon={<HealthAndSafetyIcon />} label="Analize în curs" value="76" trend="-0.5%" />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard icon={<DashboardIcon />} label="Satisfacție" value="92%" trend="+0.9%" />
          </Grid>

          <Grid item xs={12} md={8}>
            <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>Activitate săptămânală</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Vizite, programări și analize</Typography>
              <Box sx={{ display: 'grid', gap: 1.5 }}>
                {[60, 72, 45, 80, 55, 68, 75].map((v, i) => (
                  <Box key={i}>
                    <Typography variant="caption" color="text.secondary">Ziua {i + 1}</Typography>
                    <LinearProgress variant="determinate" value={v} sx={{ height: 8, borderRadius: 6 }} />
                  </Box>
                ))}
              </Box>
            </Paper>
          </Grid>

          <Grid item xs={12} md={4}>
            <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>Acțiuni rapide</Typography>
              <Divider sx={{ mb: 2 }} />
              <Box sx={{ display: 'grid', gap: 1.5 }}>
                {menuItems.map((item, idx) => (
                  <Paper key={idx} variant="outlined" sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer' }}>
                    <Box sx={{ p: 1, borderRadius: '10px', bgcolor: 'primary.light', color: 'primary.main', display: 'inline-flex' }}>{item.icon}</Box>
                    <Box>
                      <Typography variant="body1" sx={{ fontWeight: 600 }}>{item.title}</Typography>
                      <Typography variant="body2" color="text.secondary">{item.description}</Typography>
                    </Box>
                  </Paper>
                ))}
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </Container>
    </AppLayout>
  );
}