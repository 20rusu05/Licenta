import { Paper, Box, Typography, Chip, Avatar, Divider } from '@mui/material';
import EventIcon from '@mui/icons-material/Event';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import PersonIcon from '@mui/icons-material/Person';
import { useLanguage } from '../../LanguageContext';

export default function UpcomingAppointments({ appointments = [] }) {
  const { lang, locale } = useLanguage();
  const isEnglish = lang === 'en';

  // Culorile statusurilor raman consistente cu restul cardurilor de dashboard.
  const getStatusColor = (status) => {
    const colors = {
      'programata': 'primary',
      'confirmata': 'success',
      'completata': 'info',
      'anulata': 'error'
    };
    return colors[status] || 'default';
  };

  const formatDate = (dateString) => {
    // Azi si maine primesc etichete scurte, restul folosesc format localizat.
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (date.toDateString() === today.toDateString()) {
      return isEnglish ? 'Today' : 'Astăzi';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return isEnglish ? 'Tomorrow' : 'Mâine';
    }
    return date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusLabel = (status) => {
    // Etichetele sunt localizate aici pentru cardul de programari de azi.
    const labels = {
      programata: isEnglish ? 'Scheduled' : 'Programată',
      confirmata: isEnglish ? 'Confirmed' : 'Confirmată',
      completata: isEnglish ? 'Completed' : 'Completată',
      anulata: isEnglish ? 'Cancelled' : 'Anulată',
    };

    return labels[status] || status;
  };

  return (
    <Paper sx={{ p: 3, height: '100%' }} elevation={0}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <EventIcon color="primary" />
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          {isEnglish ? 'Today’s appointments' : 'Programări de astăzi'}
        </Typography>
        {appointments.length > 0 && (
          <Chip 
            label={appointments.length} 
            size="small" 
            color="primary" 
            sx={{ ml: 'auto' }}
          />
        )}
      </Box>

      {appointments.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <EventIcon sx={{ fontSize: 60, color: 'text.disabled', mb: 2 }} />
          <Typography color="text.secondary">
            {isEnglish ? 'There are no appointments for today' : 'Nu există programări pentru astăzi'}
          </Typography>
        </Box>
      ) : (
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: 2,
          maxHeight: '400px',
          overflowY: 'auto',
          pr: 1,
          '&::-webkit-scrollbar': {
            width: '8px',
          },
          '&::-webkit-scrollbar-track': {
            background: '#f1f1f1',
            borderRadius: '10px',
          },
          '&::-webkit-scrollbar-thumb': {
            background: '#888',
            borderRadius: '10px',
            '&:hover': {
              background: '#555',
            },
          },
        }}>
          {appointments.map((apt, index) => (
            <Box key={apt.id}>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                <Avatar sx={{ bgcolor: 'primary.light', color: 'primary.main' }}>
                  <PersonIcon />
                </Avatar>
                
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      {apt.nume} {apt.prenume}
                    </Typography>
                    <Chip 
                      label={getStatusLabel(apt.status)} 
                      size="small" 
                      color={getStatusColor(apt.status)}
                      sx={{ textTransform: 'capitalize' }}
                    />
                  </Box>
                  
                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mt: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <AccessTimeIcon fontSize="small" color="action" />
                      <Typography variant="caption" color="text.secondary">
                        {formatTime(apt.data_programare)}
                      </Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {apt.email}
                    </Typography>
                  </Box>
                </Box>
              </Box>
              
              {index < appointments.length - 1 && <Divider sx={{ mt: 2 }} />}
            </Box>
          ))}
        </Box>
      )}
    </Paper>
  );
}
