import { Paper, Box, Typography, Grid } from '@mui/material';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import MedicationIcon from '@mui/icons-material/Medication';
import SensorsIcon from '@mui/icons-material/Sensors';
import PersonIcon from '@mui/icons-material/Person';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../LanguageContext';

export default function QuickActions() {
  const { lang } = useLanguage();
  const isEnglish = lang === 'en';
  const navigate = useNavigate();

  // Actiunile rapide sunt configuratie de navigare, nu logica separata pe butoane.
  const actions = [
    {
      icon: <CalendarMonthIcon />,
      title: isEnglish ? 'My appointments' : 'Programările mele',
      description: isEnglish ? 'See your consultations' : 'Vezi consultațiile tale',
      color: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      action: () => navigate('/dashboard/programari')
    },
    {
      icon: <MedicationIcon />,
      title: isEnglish ? 'Medications' : 'Medicamente',
      description: isEnglish ? 'See your medications' : 'Vezi medicamentele tale',
      color: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      action: () => navigate('/dashboard/medicamente')
    },
    {
      icon: <SensorsIcon />,
      title: isEnglish ? 'Live sensors' : 'Senzori live',
      description: isEnglish ? 'Your real-time data' : 'Datele tale în timp real',
      color: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      action: () => navigate('/dashboard/senzori')
    },
    {
      icon: <PersonIcon />,
      title: isEnglish ? 'Profile' : 'Profil',
      description: isEnglish ? 'Account settings' : 'Setări cont',
      color: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
      action: () => navigate('/dashboard/profil')
    }
  ];

  // Gridul se construieste din configuratie ca sa ramana usor de extins.
  // Culorile gradientelor diferentiaza actiunile fara state suplimentar.
  return (
    <Paper sx={{ p: 3, height: '100%' }} elevation={0}>
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
        {isEnglish ? 'Quick actions' : 'Acțiuni rapide'}
      </Typography>

      <Grid container spacing={2}>
        {actions.map((action, index) => (
          <Grid size={{ xs: 12, sm: 6 }} key={index} sx={{ display: 'flex' }}>
            <Paper
              onClick={action.action}
              sx={{
                p: 2.5,
                width: '100%',
                minHeight: 190,
                cursor: 'pointer',
                transition: 'all 0.3s',
                background: action.color,
                color: 'white',
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'stretch',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 6
                }
              }}
              elevation={2}
            >
              <Box sx={{
                position: 'absolute',
                right: -15,
                bottom: -15,
                width: 80,
                height: 80,
                borderRadius: '50%',
                bgcolor: 'rgba(255,255,255,0.1)',
              }} />

              <Box sx={{ position: 'relative', zIndex: 1 }}>
                <Box sx={{ 
                  display: 'inline-flex',
                  p: 1.5, 
                  borderRadius: 2, 
                  bgcolor: 'rgba(255,255,255,0.2)',
                  mb: 1.5
                }}>
                  {action.icon}
                </Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
                  {action.title}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  {action.description}
                </Typography>
              </Box>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Paper>
  );
}
