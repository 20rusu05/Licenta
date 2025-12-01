import { Paper, Box, Typography, List, ListItem, ListItemText, Chip, Divider } from '@mui/material';
import MedicationIcon from '@mui/icons-material/Medication';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import CancelIcon from '@mui/icons-material/Cancel';

export default function MyMedications({ medications = [] }) {
  const getStatusInfo = (status) => {
    const info = {
      'acceptat': { 
        label: 'Acceptat', 
        color: 'success', 
        icon: <CheckCircleIcon fontSize="small" /> 
      },
      'pending': { 
        label: 'În așteptare', 
        color: 'warning', 
        icon: <HourglassEmptyIcon fontSize="small" /> 
      },
      'respins': { 
        label: 'Respins', 
        color: 'error', 
        icon: <CancelIcon fontSize="small" /> 
      }
    };
    return info[status] || info['pending'];
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <Paper sx={{ p: 3, height: '100%' }} elevation={0}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <MedicationIcon color="primary" />
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Medicamentele mele
        </Typography>
        {medications.length > 0 && (
          <Chip 
            label={medications.filter(m => m.status === 'acceptat').length} 
            size="small" 
            color="success"
            sx={{ ml: 'auto' }}
          />
        )}
      </Box>

      {medications.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <MedicationIcon sx={{ fontSize: 60, color: 'text.disabled', mb: 2 }} />
          <Typography color="text.secondary">
            Nu ai medicamente înregistrate
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
          {medications.map((med, index) => {
            const statusInfo = getStatusInfo(med.status);
            return (
              <Box key={med.id}>
                <ListItem
                  alignItems="flex-start"
                  sx={{ px: 0, py: 2 }}
                >
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                          {med.denumire}
                        </Typography>
                        <Chip
                          icon={statusInfo.icon}
                          label={statusInfo.label}
                          size="small"
                          color={statusInfo.color}
                          variant="outlined"
                        />
                      </Box>
                    }
                    secondary={
                      <Box sx={{ mt: 1 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          {med.descriere}
                        </Typography>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="caption" color="text.disabled">
                            Dr. {med.doctor_nume} {med.doctor_prenume}
                          </Typography>
                          <Typography variant="caption" color="text.disabled">
                            {formatDate(med.created_at)}
                          </Typography>
                        </Box>
                      </Box>
                    }
                  />
                </ListItem>
                {index < medications.length - 1 && <Divider />}
              </Box>
            );
          })}
        </List>
      )}
    </Paper>
  );
}
