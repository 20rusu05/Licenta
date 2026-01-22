import { Paper, Box, Typography, List, ListItem, ListItemText, Chip, Divider } from '@mui/material';
import HistoryIcon from '@mui/icons-material/History';
import EventIcon from '@mui/icons-material/Event';

export default function AppointmentHistory({ appointments = [] }) {
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
    const date = new Date(dateString);
    return date.toLocaleDateString('ro-RO', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isPast = (dateString) => {
    return new Date(dateString) < new Date();
  };

  return (
    <Paper sx={{ p: 3, height: '100%' }} elevation={0}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <HistoryIcon color="primary" />
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Istoric programări
        </Typography>
      </Box>

      {appointments.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <EventIcon sx={{ fontSize: 60, color: 'text.disabled', mb: 2 }} />
          <Typography color="text.secondary">
            Nu există programări în istoric
          </Typography>
        </Box>
      ) : (
        <List sx={{ 
          p: 0, 
          maxHeight: 400, 
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
              <ListItem alignItems="flex-start" sx={{ px: 0, py: 2 }}>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                        Dr. {apt.doctor_nume} {apt.doctor_prenume}
                      </Typography>
                      <Chip 
                        label={apt.status} 
                        size="small" 
                        color={getStatusColor(apt.status)}
                        sx={{ textTransform: 'capitalize' }}
                      />
                    </Box>
                  }
                  secondary={
                    <Typography variant="caption" color="text.disabled" sx={{ mt: 1, display: 'block' }}>
                      {formatDate(apt.data_programare)}
                    </Typography>
                  }
                />
              </ListItem>
              {index < appointments.length - 1 && <Divider />}
            </Box>
          ))}
        </List>
      )}
    </Paper>
  );
}
