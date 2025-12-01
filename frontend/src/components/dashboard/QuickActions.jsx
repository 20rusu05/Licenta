import { Paper, Box, Typography, Button, Grid } from '@mui/material';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import MedicationIcon from '@mui/icons-material/Medication';
import HistoryIcon from '@mui/icons-material/History';
import PersonIcon from '@mui/icons-material/Person';
import { useNavigate } from 'react-router-dom';

export default function QuickActions() {
  const navigate = useNavigate();

  const actions = [
    {
      icon: <CalendarMonthIcon />,
      title: 'Programare nouă',
      description: 'Solicită o consultație',
      color: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      action: () => navigate('/dashboard/programari')
    },
    {
      icon: <MedicationIcon />,
      title: 'Medicamente',
      description: 'Vezi medicamentele tale',
      color: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      action: () => navigate('/dashboard/medicamente')
    },
    {
      icon: <HistoryIcon />,
      title: 'Istoric',
      description: 'Programări anterioare',
      color: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      action: () => navigate('/dashboard/programari')
    },
    {
      icon: <PersonIcon />,
      title: 'Profil',
      description: 'Setări cont',
      color: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
      action: () => {} // Disabled pentru moment
    }
  ];

  return (
    <Paper sx={{ p: 3, height: '100%' }} elevation={0}>
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
        Acțiuni rapide
      </Typography>

      <Grid container spacing={2}>
        {actions.map((action, index) => (
          <Grid item xs={12} sm={6} key={index}>
            <Paper
              onClick={action.action}
              sx={{
                p: 2.5,
                cursor: 'pointer',
                transition: 'all 0.3s',
                background: action.color,
                color: 'white',
                position: 'relative',
                overflow: 'hidden',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 6
                }
              }}
              elevation={2}
            >
              {/* Background decoration */}
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
