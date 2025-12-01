import { Box, Typography, Container, Grid, CircularProgress } from '@mui/material';
import { useEffect, useState } from 'react';
import PeopleIcon from '@mui/icons-material/People';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import MedicationIcon from '@mui/icons-material/Medication';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import AppLayout from './layout/AppLayout';
import StatCardModern from './dashboard/StatCardModern';
import UpcomingAppointments from './dashboard/UpcomingAppointments';
import RecentActivity from './dashboard/RecentActivity';
import AppointmentsChart from './dashboard/AppointmentsChart';
import NextAppointmentCard from './dashboard/NextAppointmentCard';
import MyMedications from './dashboard/MyMedications';
import QuickActions from './dashboard/QuickActions';
import AppointmentHistory from './dashboard/AppointmentHistory';
import { api } from '../services/api';

export default function Dashboard() {
  const user = JSON.parse(localStorage.getItem('user'));
  const userEmail = (user?.email || '').toLowerCase();
  const isDoctor = userEmail.endsWith('@newmed.ro');
  const displayName = isDoctor ? user?.nume?.split(' ')[1] || user?.nume : user?.prenume;
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const response = await api.get('/dashboard/stats');
      setDashboardData(response.data);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
          <CircularProgress size={60} />
        </Box>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Container maxWidth="xl" sx={{ mt: 2, mb: 4 }}>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
            Bun venit, {isDoctor ? `Dr. ${displayName}` : displayName}! 👋
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {isDoctor 
              ? 'Iată o privire de ansamblu asupra activității tale de astăzi' 
              : 'Gestionează programările și medicamentele tale'}
          </Typography>
        </Box>

        {isDoctor ? (
          // DASHBOARD DOCTOR
          <Grid container spacing={3}>
            {/* Statistici */}
            <Grid item xs={12} sm={6} md={3} sx={{ display: 'flex' }}>
              <StatCardModern
                icon={<PeopleIcon sx={{ fontSize: 28 }} />}
                label="Total pacienți"
                value={dashboardData?.stats?.totalPacienti || 0}
                subtitle="Pacienți unici"
                color="primary"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3} sx={{ display: 'flex' }}>
              <StatCardModern
                icon={<CalendarMonthIcon sx={{ fontSize: 28 }} />}
                label="Programări astăzi"
                value={dashboardData?.stats?.programariAzi || 0}
                subtitle="Consultații de azi"
                color="success"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3} sx={{ display: 'flex' }}>
              <StatCardModern
                icon={<PendingActionsIcon sx={{ fontSize: 28 }} />}
                label="Cereri în așteptare"
                value={dashboardData?.stats?.cereriPending || 0}
                subtitle="Cereri medicamente"
                color="warning"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3} sx={{ display: 'flex' }}>
              <StatCardModern
                icon={<MedicationIcon sx={{ fontSize: 28 }} />}
                label="Medicamente active"
                value={dashboardData?.stats?.medicamenteActive || 0}
                subtitle="În tratament"
                color="info"
              />
            </Grid>

            {/* Programări de azi */}
            <Grid item xs={12} md={6}>
              <UpcomingAppointments appointments={dashboardData?.programariDeAzi || []} />
            </Grid>

            {/* Activitate recentă */}
            <Grid item xs={12} md={6}>
              <RecentActivity activities={dashboardData?.activitateRecenta || []} />
            </Grid>

            {/* Grafic programări */}
            <Grid item xs={12}>
              <AppointmentsChart 
                data={dashboardData?.programariSaptamanala || []} 
                allAppointments={dashboardData?.programariSaptamanaDetalii || []}
              />
            </Grid>
          </Grid>
        ) : (
          // DASHBOARD PACIENT
          <Grid container spacing={3}>
            {/* Statistici pacient - 4 carduri egale */}
            <Grid item xs={12} sm={6} md={3} sx={{ display: 'flex' }}>
              <StatCardModern
                icon={<CalendarMonthIcon sx={{ fontSize: 28 }} />}
                label="Total programări"
                value={dashboardData?.stats?.totalProgramari || 0}
                subtitle="Toate programările"
                color="primary"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3} sx={{ display: 'flex' }}>
              <StatCardModern
                icon={<PendingActionsIcon sx={{ fontSize: 28 }} />}
                label="Programări viitoare"
                value={dashboardData?.stats?.programariViitoare || 0}
                subtitle="În așteptare"
                color="success"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3} sx={{ display: 'flex' }}>
              <StatCardModern
                icon={<MedicationIcon sx={{ fontSize: 28 }} />}
                label="Medicamente active"
                value={dashboardData?.stats?.medicamenteActive || 0}
                subtitle="În tratament"
                color="info"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3} sx={{ display: 'flex' }}>
              <StatCardModern
                icon={<PendingActionsIcon sx={{ fontSize: 28 }} />}
                label="Cereri în așteptare"
                value={dashboardData?.stats?.cereriPending || 0}
                subtitle="Neaprobate"
                color="warning"
              />
            </Grid>

            {/* Următoarea programare - card mare */}
            <Grid item xs={12} md={8}>
              <NextAppointmentCard appointment={dashboardData?.urmatoareaProgramare} />
            </Grid>

            {/* Acțiuni rapide */}
            <Grid item xs={12} md={4}>
              <QuickActions />
            </Grid>

            {/* Medicamentele mele */}
            <Grid item xs={12} md={6}>
              <MyMedications medications={dashboardData?.medicamentele || []} />
            </Grid>

            {/* Istoric programări */}
            <Grid item xs={12} md={6}>
              <AppointmentHistory appointments={dashboardData?.istoricProgramari || []} />
            </Grid>
          </Grid>
        )}
      </Container>
    </AppLayout>
  );
}