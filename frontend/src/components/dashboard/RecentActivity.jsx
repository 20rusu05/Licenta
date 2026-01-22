import { Paper, Box, Typography, List, ListItem, ListItemAvatar, ListItemText, Avatar } from '@mui/material';
import TimelineIcon from '@mui/icons-material/Timeline';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import MedicationIcon from '@mui/icons-material/Medication';

export default function RecentActivity({ activities = [] }) {
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Acum';
    if (diffMins < 60) return `${diffMins} min în urmă`;
    if (diffHours < 24) return `${diffHours}h în urmă`;
    if (diffDays === 1) return 'Ieri';
    if (diffDays < 7) return `${diffDays} zile în urmă`;
    return date.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' });
  };

  const getActivityInfo = (activity) => {
    if (activity.tip === 'programare') {
      return {
        icon: <CalendarTodayIcon />,
        color: 'primary.main',
        bgcolor: 'primary.light',
        title: `Programare nouă - ${activity.nume} ${activity.prenume}`,
        subtitle: activity.detalii
      };
    } else {
      return {
        icon: <MedicationIcon />,
        color: 'success.main',
        bgcolor: 'success.light',
        title: `Cerere medicament - ${activity.nume} ${activity.prenume}`,
        subtitle: activity.detalii
      };
    }
  };

  return (
    <Paper sx={{ p: 3, height: '100%' }} elevation={0}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <TimelineIcon color="primary" />
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Activitate recentă
        </Typography>
      </Box>

      {activities.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <TimelineIcon sx={{ fontSize: 60, color: 'text.disabled', mb: 2 }} />
          <Typography color="text.secondary">
            Nu există activitate recentă
          </Typography>
        </Box>
      ) : (
        <List sx={{ 
          p: 0,
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
          {activities.map((activity, index) => {
            const info = getActivityInfo(activity);
            return (
              <ListItem
                key={`${activity.tip}-${activity.id}`}
                alignItems="flex-start"
                sx={{
                  px: 0,
                  py: 1.5,
                  borderBottom: index < activities.length - 1 ? '1px solid' : 'none',
                  borderColor: 'divider'
                }}
              >
                <ListItemAvatar>
                  <Avatar sx={{ bgcolor: info.bgcolor, color: info.color }}>
                    {info.icon}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {info.title}
                    </Typography>
                  }
                  secondary={
                    <Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                        {info.subtitle}
                      </Typography>
                      <Typography variant="caption" color="text.disabled">
                        {formatDate(activity.data)}
                      </Typography>
                    </Box>
                  }
                />
              </ListItem>
            );
          })}
        </List>
      )}
    </Paper>
  );
}
