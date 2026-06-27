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
import { useLanguage } from '../LanguageContext';

export default function Dashboard() {
  const { lang } = useLanguage();
  const isEnglish = lang === 'en';
  const user = JSON.parse(sessionStorage.getItem('user') || 'null');
  
  // Adminul are panou dedicat si nu foloseste dashboardul medical.
  if (user?.role === 'admin') {
    window.location.href = '/dashboard/admin';
    return null;
  }
  
  const userEmail = (user?.email || '').toLowerCase();
  // Domeniul intern este folosit si in frontend pentru mesajele specifice doctorului.
  const isDoctor = userEmail.endsWith('@newmed.ro');
  const displayName = isDoctor ? user?.nume?.split(' ')[1] || user?.nume : user?.prenume;
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // Endpoint-ul intoarce deja structuri diferite pentru doctor si pacient.
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
      <Container maxWidth={false} disableGutters sx={{ mt: 2, mb: 4, px: { xs: 2, md: 3 } }}>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
            {isDoctor
              ? `${isEnglish ? 'Welcome, Dr.' : 'Bun venit, Dr.'} ${displayName}! 👋`
              : `${isEnglish ? 'Welcome,' : 'Bun venit,'} ${displayName}! 👋`}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {isDoctor 
              ? (isEnglish ? 'Here is an overview of your activity today' : 'Iată o privire de ansamblu asupra activității tale de astăzi') 
              : (isEnglish ? 'Manage your appointments and medications' : 'Gestionează programările și medicamentele tale')}
          </Typography>
        </Box>

        {isDoctor ? (
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }} sx={{ display: 'flex' }}>
              <StatCardModern
                icon={<PeopleIcon sx={{ fontSize: 28 }} />}
                label={isEnglish ? 'Total patients' : 'Total pacienți'}
                value={dashboardData?.stats?.totalPacienti || 0}
                subtitle={isEnglish ? 'Unique patients' : 'Pacienți unici'}
                color="primary"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }} sx={{ display: 'flex' }}>
              <StatCardModern
                icon={<CalendarMonthIcon sx={{ fontSize: 28 }} />}
                label={isEnglish ? 'Appointments today' : 'Programări astăzi'}
                value={dashboardData?.stats?.programariAzi || 0}
                subtitle={isEnglish ? 'Today’s consultations' : 'Consultații de azi'}
                color="success"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }} sx={{ display: 'flex' }}>
              <StatCardModern
                icon={<PendingActionsIcon sx={{ fontSize: 28 }} />}
                label={isEnglish ? 'Pending requests' : 'Cereri în așteptare'}
                value={dashboardData?.stats?.cereriPending || 0}
                subtitle={isEnglish ? 'Medication requests' : 'Cereri medicamente'}
                color="warning"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }} sx={{ display: 'flex' }}>
              <StatCardModern
                icon={<MedicationIcon sx={{ fontSize: 28 }} />}
                label={isEnglish ? 'Active medications' : 'Medicamente active'}
                value={dashboardData?.stats?.medicamenteActive || 0}
                subtitle={isEnglish ? 'In treatment' : 'În tratament'}
                color="info"
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <UpcomingAppointments appointments={dashboardData?.programariDeAzi || []} />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <RecentActivity activities={dashboardData?.activitateRecenta || []} />
            </Grid>

            <Grid size={12}>
              <AppointmentsChart 
                data={dashboardData?.programariSaptamanala || []} 
                allAppointments={dashboardData?.programariSaptamanaDetalii || []}
              />
            </Grid>
          </Grid>
        ) : (
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }} sx={{ display: 'flex' }}>
              <StatCardModern
                icon={<CalendarMonthIcon sx={{ fontSize: 28 }} />}
                label={isEnglish ? 'Total appointments' : 'Total programări'}
                value={dashboardData?.stats?.totalProgramari || 0}
                subtitle={isEnglish ? 'All appointments' : 'Toate programările'}
                color="primary"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }} sx={{ display: 'flex' }}>
              <StatCardModern
                icon={<PendingActionsIcon sx={{ fontSize: 28 }} />}
                label={isEnglish ? 'Future appointments' : 'Programări viitoare'}
                value={dashboardData?.stats?.programariViitoare || 0}
                subtitle={isEnglish ? 'Awaiting' : 'În așteptare'}
                color="success"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }} sx={{ display: 'flex' }}>
              <StatCardModern
                icon={<MedicationIcon sx={{ fontSize: 28 }} />}
                label={isEnglish ? 'Active medications' : 'Medicamente active'}
                value={dashboardData?.stats?.medicamenteActive || 0}
                subtitle={isEnglish ? 'In treatment' : 'În tratament'}
                color="info"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }} sx={{ display: 'flex' }}>
              <StatCardModern
                icon={<PendingActionsIcon sx={{ fontSize: 28 }} />}
                label={isEnglish ? 'Pending requests' : 'Cereri în așteptare'}
                value={dashboardData?.stats?.cereriPending || 0}
                subtitle={isEnglish ? 'Not approved' : 'Neaprobate'}
                color="warning"
              />
            </Grid>

            <Grid size={{ xs: 12, md: 8 }}>
              <NextAppointmentCard appointment={dashboardData?.urmatoareaProgramare} />
            </Grid>

            <Grid size={{ xs: 12, md: 4 }}>
              <QuickActions />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <MyMedications medications={dashboardData?.medicamentele || []} />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <AppointmentHistory appointments={dashboardData?.istoricProgramari || []} />
            </Grid>
          </Grid>
        )}
      </Container>
    </AppLayout>
  );
}
