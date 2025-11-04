import { Paper, Box, Typography } from '@mui/material';

export default function StatCard({ icon, label, value, trend }) {
  return (
    <Paper
      sx={{
        p: 2.5,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        border: '1px solid',
        borderColor: 'divider',
      }}
      elevation={0}
    >
      <Box sx={{ p: 1.2, borderRadius: '10px', bgcolor: 'primary.light', color: 'primary.main', display: 'inline-flex' }}>
        {icon}
      </Box>
      <Box sx={{ flex: 1 }}>
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          {value}
        </Typography>
        {trend && (
          <Typography variant="caption" color={trend.startsWith('+') ? 'success.main' : 'error.main'}>
            {trend} față de săptămâna trecută
          </Typography>
        )}
      </Box>
    </Paper>
  );
}


