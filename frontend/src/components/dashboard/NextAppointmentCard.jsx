import { Paper, Box, Typography, Button, Chip, Dialog, DialogTitle, DialogContent, DialogActions, IconButton } from '@mui/material';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import PersonIcon from '@mui/icons-material/Person';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import CloseIcon from '@mui/icons-material/Close';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

export default function NextAppointmentCard({ appointment }) {
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleOpenDialog = () => {
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
  };
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ro-RO', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
  };

  const getDaysUntil = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const diffTime = date - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Astăzi';
    if (diffDays === 1) return 'Mâine';
    if (diffDays < 7) return `În ${diffDays} zile`;
    return `În ${Math.floor(diffDays / 7)} săptămâni`;
  };

  const getStatusColor = (status) => {
    const colors = {
      'programata': 'primary',
      'confirmata': 'success',
      'completata': 'info',
      'anulata': 'error'
    };
    return colors[status] || 'default';
  };

  if (!appointment) {
    return (
      <Paper 
        sx={{ 
          p: 4, 
          height: '100%',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white'
        }} 
        elevation={3}
      >
        <Box sx={{ textAlign: 'center' }}>
          <CalendarMonthIcon sx={{ fontSize: 80, mb: 2, opacity: 0.7 }} />
          <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
            Nu ai programări viitoare
          </Typography>
          <Typography variant="body2" sx={{ mb: 3, opacity: 0.9 }}>
            Programează o consultație pentru a primi îngrijire medicală
          </Typography>
          <Button 
            variant="contained"
            onClick={() => navigate('/dashboard/programari')}
            sx={{ 
              bgcolor: 'white', 
              color: 'primary.main',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.9)' }
            }}
          >
            Programează acum
          </Button>
        </Box>
      </Paper>
    );
  }

  return (
    <Paper 
      sx={{ 
        p: 3, 
        height: '100%',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        position: 'relative',
        overflow: 'hidden'
      }} 
      elevation={3}
    >
      {/* Background decoration */}
      <Box sx={{
        position: 'absolute',
        right: -40,
        top: -40,
        width: 150,
        height: 150,
        borderRadius: '50%',
        bgcolor: 'rgba(255,255,255,0.1)',
      }} />

      <Box sx={{ position: 'relative', zIndex: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <EventAvailableIcon sx={{ fontSize: 28 }} />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Următoarea programare
            </Typography>
          </Box>
          <Chip 
            label={appointment.status} 
            size="small"
            sx={{ 
              bgcolor: 'rgba(255,255,255,0.2)',
              color: 'white',
              textTransform: 'capitalize',
              fontWeight: 600
            }}
          />
        </Box>

        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
            {getDaysUntil(appointment.data_programare)}
          </Typography>
          <Typography variant="body1" sx={{ opacity: 0.9, mb: 0.5 }}>
            {formatDate(appointment.data_programare)}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <AccessTimeIcon fontSize="small" />
            <Typography variant="body1">
              {formatTime(appointment.data_programare)}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ 
          p: 2, 
          borderRadius: 2, 
          bgcolor: 'rgba(255,255,255,0.15)',
          backdropFilter: 'blur(10px)',
          mb: 2
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PersonIcon fontSize="small" />
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Dr. {appointment.doctor_nume} {appointment.doctor_prenume}
            </Typography>
          </Box>
        </Box>

        <Button 
          fullWidth
          variant="contained"
          onClick={handleOpenDialog}
          sx={{ 
            bgcolor: 'white', 
            color: 'primary.main',
            fontWeight: 600,
            '&:hover': { bgcolor: 'rgba(255,255,255,0.9)' }
          }}
        >
          Vezi detalii
        </Button>
      </Box>

      {/* Dialog cu detalii programare */}
      <Dialog 
        open={dialogOpen} 
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          pb: 2
        }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
              Detalii programare
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.9 }}>
              {getDaysUntil(appointment.data_programare)}
            </Typography>
          </Box>
          <IconButton onClick={handleCloseDialog} sx={{ color: 'white' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        
        <DialogContent sx={{ mt: 3 }}>
          {/* Status */}
          <Box sx={{ mb: 3, textAlign: 'center' }}>
            <Chip 
              label={appointment.status} 
              color={getStatusColor(appointment.status)}
              sx={{ 
                textTransform: 'capitalize',
                fontWeight: 600,
                fontSize: '0.9rem',
                px: 2,
                py: 0.5
              }}
            />
          </Box>

          {/* Data și ora */}
          <Box sx={{ mb: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 2,
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <CalendarMonthIcon sx={{ color: 'white', fontSize: 22 }} />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Data programării
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  {formatDate(appointment.data_programare)}
                </Typography>
              </Box>
            </Box>
          </Box>

          <Box sx={{ mb: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 2,
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <AccessTimeIcon sx={{ color: 'white', fontSize: 22 }} />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Ora programării
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  {formatTime(appointment.data_programare)}
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* Doctor */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 2,
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <PersonIcon sx={{ color: 'white', fontSize: 22 }} />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Doctor
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  Dr. {appointment.doctor_nume} {appointment.doctor_prenume}
                </Typography>
              </Box>
            </Box>
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={handleCloseDialog} variant="outlined">
            Închide
          </Button>
          <Button 
            onClick={() => {
              handleCloseDialog();
              navigate('/dashboard/programari');
            }}
            variant="contained"
            sx={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            }}
          >
            Toate programările
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
