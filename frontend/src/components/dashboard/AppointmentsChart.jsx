import { Paper, Box, Typography, Dialog, DialogTitle, DialogContent, List, ListItem, ListItemText, IconButton } from '@mui/material';
import BarChartIcon from '@mui/icons-material/BarChart';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import CloseIcon from '@mui/icons-material/Close';
import { useState } from 'react';

export default function AppointmentsChart({ data = [], allAppointments = [] }) {
  const [selectedDate, setSelectedDate] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleBarClick = (date, value) => {
    if (value > 0) {
      setSelectedDate(date);
      setDialogOpen(true);
    }
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedDate(null);
  };

  const getAppointmentsForDate = () => {
    if (!selectedDate) return [];
    
    return allAppointments.filter(apt => {
      if (!apt.data_programare) return false;
      
      // Creează un obiect Date și extrage partea de dată în timezone local
      const date = new Date(apt.data_programare);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const aptDate = `${year}-${month}-${day}`;
      
      return aptDate === selectedDate;
    });
  };
  // Creează un array cu următoarele 7 zile
  const getNext7Days = () => {
    const days = [];
    for (let i = 0; i <= 6; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      days.push({
        date: date.toISOString().split('T')[0],
        label: date.toLocaleDateString('ro-RO', { weekday: 'short', day: 'numeric', month: 'short' })
      });
    }
    return days;
  };

  const days = getNext7Days();
  
  // Mapează datele primite cu zilele
  const chartData = days.map(day => {
    const found = data.find(d => d.data === day.date);
    return {
      label: day.label,
      date: day.date,
      value: found ? found.total : 0
    };
  });

  const maxValue = Math.max(...chartData.map(d => d.value), 5);
  const totalWeek = chartData.reduce((sum, item) => sum + item.value, 0);

  return (
    <Paper 
      sx={{ 
        p: 4, 
        height: '100%',
        background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%)',
        borderRadius: 3,
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '4px',
          background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
        }
      }} 
      elevation={0}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: 2,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
              }}
            >
              <BarChartIcon sx={{ color: 'white', fontSize: 28 }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Programări următoarea săptămână
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Activitate zilnică
              </Typography>
            </Box>
          </Box>
        </Box>
        <Box
          sx={{
            px: 2.5,
            py: 1.5,
            borderRadius: 2,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <TrendingUpIcon sx={{ color: 'white', fontSize: 20 }} />
            <Typography variant="h4" sx={{ fontWeight: 700, color: 'white' }}>
              {totalWeek}
            </Typography>
          </Box>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.9)', fontWeight: 500 }}>
            Total săptămână
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 280, px: 2 }}>
        {chartData.map((item, index) => {
          const heightPercentage = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
          const colors = [
            ['#667eea', '#764ba2'],
            ['#f093fb', '#f5576c'],
            ['#4facfe', '#00f2fe'],
            ['#43e97b', '#38f9d7'],
            ['#fa709a', '#fee140'],
            ['#30cfd0', '#330867'],
            ['#a8edea', '#fed6e3']
          ];
          const [color1, color2] = colors[index % colors.length];

          return (
            <Box
              key={index}
              sx={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2
              }}
            >
              <Box
                sx={{
                  position: 'relative',
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'flex-end'
                }}
              >
                <Box
                  onClick={() => handleBarClick(item.date, item.value)}
                  sx={{
                    width: '100%',
                    height: `${Math.max(heightPercentage, item.value > 0 ? 15 : 3)}%`,
                    background: item.value > 0 
                      ? `linear-gradient(180deg, ${color1} 0%, ${color2} 100%)`
                      : 'rgba(0,0,0,0.08)',
                    borderRadius: '12px 12px 0 0',
                    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                    position: 'relative',
                    boxShadow: item.value > 0 ? `0 4px 16px ${color1}40` : 'none',
                    cursor: item.value > 0 ? 'pointer' : 'default',
                    '&:hover': {
                      transform: item.value > 0 ? 'translateY(-8px) scaleY(1.05)' : 'none',
                      boxShadow: item.value > 0 ? `0 8px 24px ${color1}60` : 'none',
                    },
                    '&::before': item.value > 0 ? {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: '60%',
                      height: '40%',
                      background: 'rgba(255,255,255,0.2)',
                      borderRadius: '12px',
                      filter: 'blur(8px)',
                    } : {}
                  }}
                >
                  {item.value > 0 && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: -45,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        px: 2,
                        py: 1,
                        borderRadius: 2,
                        background: 'white',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        '&::after': {
                          content: '""',
                          position: 'absolute',
                          bottom: -6,
                          left: '50%',
                          transform: 'translateX(-50%)',
                          width: 0,
                          height: 0,
                          borderLeft: '6px solid transparent',
                          borderRight: '6px solid transparent',
                          borderTop: '6px solid white',
                        }
                      }}
                    >
                      <Typography
                        variant="h6"
                        sx={{
                          fontWeight: 700,
                          background: `linear-gradient(135deg, ${color1} 0%, ${color2} 100%)`,
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          backgroundClip: 'text'
                        }}
                      >
                        {item.value}
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Box>
              
              <Typography
                variant="body2"
                sx={{
                  textAlign: 'center',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  whiteSpace: 'nowrap'
                }}
              >
                {item.label}
              </Typography>
            </Box>
          );
        })}
      </Box>

      {/* Dialog cu programările din ziua selectată */}
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
          color: 'white'
        }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Programări - {selectedDate && new Date(selectedDate + 'T00:00:00').toLocaleDateString('ro-RO', { 
              weekday: 'long', 
              day: 'numeric', 
              month: 'long',
              year: 'numeric'
            })}
          </Typography>
          <IconButton onClick={handleCloseDialog} sx={{ color: 'white' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          {getAppointmentsForDate().length === 0 ? (
            <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
              Nu există programări pentru această zi
            </Typography>
          ) : (
            <List>
              {getAppointmentsForDate().map((apt, index) => (
                <ListItem 
                  key={apt.id}
                  sx={{ 
                    borderBottom: index < getAppointmentsForDate().length - 1 ? '1px solid' : 'none',
                    borderColor: 'divider',
                    px: 0
                  }}
                >
                  <ListItemText
                    primary={
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                        {apt.nume} {apt.prenume}
                      </Typography>
                    }
                    secondary={
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          📧 {apt.email}
                        </Typography>
                        <Typography variant="body2" color="primary" sx={{ mt: 0.5 }}>
                          🕐 {new Date(apt.data_programare).toLocaleTimeString('ro-RO', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </Typography>
                        <Typography 
                          variant="caption" 
                          sx={{ 
                            mt: 0.5,
                            px: 1,
                            py: 0.5,
                            borderRadius: 1,
                            background: apt.status === 'programata' ? 'primary.light' : 
                                       apt.status === 'completata' ? 'success.light' : 'error.light',
                            color: apt.status === 'programata' ? 'primary.main' : 
                                   apt.status === 'completata' ? 'success.main' : 'error.main',
                            textTransform: 'capitalize',
                            display: 'inline-block'
                          }}
                        >
                          {apt.status}
                        </Typography>
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
      </Dialog>
    </Paper>
  );
}
