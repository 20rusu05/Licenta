import { Paper, Box, Typography } from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';

export default function StatCardModern({ icon, label, value, subtitle, trend, color = 'primary' }) {
  const gradients = {
    primary: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    success: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    info: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    warning: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  };

  return (
    <Paper
      sx={{
        p: 3,
        height: '100%',
        minHeight: '180px',
        background: gradients[color],
        color: 'white',
        position: 'relative',
        overflow: 'hidden',
        transition: 'transform 0.2s',
        display: 'flex',
        flexDirection: 'column',
        '&:hover': {
          transform: 'translateY(-4px)',
        }
      }}
      elevation={3}
    >
      <Box sx={{ position: 'relative', zIndex: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box sx={{ 
            p: 1.5, 
            borderRadius: '12px', 
            bgcolor: 'rgba(255,255,255,0.2)',
            backdropFilter: 'blur(10px)',
            display: 'inline-flex' 
          }}>
            {icon}
          </Box>
          {trend && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {trend > 0 ? <TrendingUpIcon fontSize="small" /> : <TrendingDownIcon fontSize="small" />}
              <Typography variant="caption" sx={{ fontWeight: 600 }}>
                {Math.abs(trend)}%
              </Typography>
            </Box>
          )}
        </Box>
        
        <Typography variant="h3" sx={{ fontWeight: 700, mb: 0.5 }}>
          {value}
        </Typography>
        
        <Typography variant="body2" sx={{ opacity: 0.9, mb: 0.5 }}>
          {label}
        </Typography>
        
        {subtitle && (
          <Typography variant="caption" sx={{ opacity: 0.7 }}>
            {subtitle}
          </Typography>
        )}
      </Box>
      
      {/* Background decoration */}
      <Box sx={{
        position: 'absolute',
        right: -20,
        bottom: -20,
        width: 120,
        height: 120,
        borderRadius: '50%',
        bgcolor: 'rgba(255,255,255,0.1)',
      }} />
    </Paper>
  );
}
