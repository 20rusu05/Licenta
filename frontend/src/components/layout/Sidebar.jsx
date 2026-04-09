import { useEffect, useMemo, useState, useCallback } from 'react';
import { Drawer, List, ListItemButton, ListItemIcon, ListItemText, Toolbar, Box, Typography, Chip, Stack, Button, Divider, CircularProgress, useTheme } from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import HealthAndSafetyIcon from '@mui/icons-material/HealthAndSafety';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import SensorsIcon from '@mui/icons-material/Sensors';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import GroupsIcon from '@mui/icons-material/Groups';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../../services/api';

const drawerWidth = 240;
const MONITORING_STATUS_KEY = 'monitoringStatus';

export default function Sidebar() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(() => {
    try {
      const rawUser = sessionStorage.getItem('user');
      return rawUser ? JSON.parse(rawUser) : null;
    } catch {
      return null;
    }
  });
  const isAdmin = user?.role === 'admin';
  const [monitoringInfo, setMonitoringInfo] = useState({
    connected: false,
    patientName: 'Niciun pacient selectat',
    patientId: null,
  });
  const [runningSensors, setRunningSensors] = useState({ ecg: false, puls: false, temperatura: false });
  const [actionLoading, setActionLoading] = useState({ startAll: false, stopAll: false });

  useEffect(() => {
    const handleAuthChange = () => {
      try {
        const rawUser = sessionStorage.getItem('user');
        setUser(rawUser ? JSON.parse(rawUser) : null);
      } catch {
        setUser(null);
      }
    };
    window.addEventListener('auth-changed', handleAuthChange);
    return () => window.removeEventListener('auth-changed', handleAuthChange);
  }, []);
  const items = useMemo(() => {
    if (isAdmin) {
      return [
        { label: 'Panou Administrare', icon: <AdminPanelSettingsIcon />, path: '/dashboard/admin' },
      ];
    }

    const base = [
      { label: 'Tablou de bord', icon: <DashboardIcon />, path: '/dashboard' },
      { label: 'Programări', icon: <CalendarMonthIcon />, path: '/dashboard/programari' },
      { label: 'Medicamente', icon: <HealthAndSafetyIcon />, path: '/dashboard/medicamente' },
    ];
    base.push({ label: 'Senzori Live', icon: <SensorsIcon />, path: '/dashboard/senzori' });
    if (user?.role === 'doctor') {
      base.splice(1, 0, { label: 'Pacienți', icon: <PeopleIcon />, path: '/dashboard/pacienti' });
    }
    return base;
  }, [isAdmin, user?.role]);

  useEffect(() => {
    const readMonitoringStatus = () => {
      try {
        const sessionRaw = sessionStorage.getItem(MONITORING_STATUS_KEY);
        const raw = sessionRaw || localStorage.getItem(MONITORING_STATUS_KEY);
        if (!raw) {
          setMonitoringInfo({ connected: false, patientName: 'Niciun pacient selectat', patientId: null });
          return;
        }

        const parsed = JSON.parse(raw);
        if (!sessionRaw) {
          sessionStorage.setItem(MONITORING_STATUS_KEY, raw);
          localStorage.removeItem(MONITORING_STATUS_KEY);
        }
        setMonitoringInfo({
          connected: Boolean(parsed?.connected),
          patientName: parsed?.selectedPatient?.name || 'Niciun pacient selectat',
          patientId: parsed?.selectedPatient?.id || null,
        });
      } catch {
        setMonitoringInfo({ connected: false, patientName: 'Niciun pacient selectat', patientId: null });
      }
    };

    readMonitoringStatus();
    window.addEventListener('monitoring-status-changed', readMonitoringStatus);

    return () => {
      window.removeEventListener('monitoring-status-changed', readMonitoringStatus);
    };
  }, []);

  const refreshRunningSensors = useCallback(async () => {
    try {
      const response = await api.get('/sensors/running');
      setRunningSensors(response?.data?.running || { ecg: false, puls: false, temperatura: false });
    } catch {
      setRunningSensors({ ecg: false, puls: false, temperatura: false });
    }
  }, []);

  useEffect(() => {
    refreshRunningSensors();
    const intervalId = setInterval(refreshRunningSensors, 4000);
    return () => clearInterval(intervalId);
  }, [refreshRunningSensors]);

  const handleStartAllSensors = async () => {
    if (!monitoringInfo.patientId) {
      navigate('/dashboard/senzori');
      return;
    }

    setActionLoading((prev) => ({ ...prev, startAll: true }));
    try {
      await Promise.all(
        ['ecg', 'puls', 'temperatura'].map((sensorType) =>
          api.post('/sensors/start', {
            sensorType,
            pacient_id: monitoringInfo.patientId,
          })
        )
      );
      await refreshRunningSensors();
    } finally {
      setActionLoading((prev) => ({ ...prev, startAll: false }));
    }
  };

  const handleStopAllSensors = async () => {
    setActionLoading((prev) => ({ ...prev, stopAll: true }));
    try {
      await Promise.all(
        ['ecg', 'puls', 'temperatura'].map((sensorType) =>
          api.post('/sensors/stop', { sensorType })
        )
      );
      await refreshRunningSensors();
    } finally {
      setActionLoading((prev) => ({ ...prev, stopAll: false }));
    }
  };

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          boxSizing: 'border-box',
          borderRight: '1px solid',
          borderColor: 'divider',
          background: isDark
            ? 'linear-gradient(180deg, rgba(17,24,39,1) 0%, rgba(15,23,42,1) 100%)'
            : 'linear-gradient(180deg, rgba(248,250,252,1) 0%, rgba(241,245,249,1) 100%)',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      <Toolbar />
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <List
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 0.75,
            px: 1,
            py: 1,
          }}
        >
          {items.map((item) => {
            const selected = item.path === '/dashboard'
              ? location.pathname === '/dashboard'
              : location.pathname.startsWith(item.path);
            return (
              <ListItemButton
                key={item.path}
                selected={selected}
                onClick={() => navigate(item.path)}
                sx={{
                  minHeight: 56,
                  px: 1.25,
                  borderRadius: 2,
                  transition: 'all 0.2s ease',
                  '& .MuiListItemIcon-root': {
                    color: selected ? 'primary.main' : 'text.secondary',
                    transition: 'color 0.2s ease',
                  },
                  '& .MuiListItemText-primary': {
                    fontWeight: selected ? 700 : 500,
                    color: selected ? 'primary.main' : 'text.primary',
                  },
                  '&.Mui-selected': {
                    backgroundColor: isDark ? 'rgba(96, 165, 250, 0.18)' : 'rgba(25, 118, 210, 0.12)',
                  },
                  '&.Mui-selected:hover': {
                    backgroundColor: isDark ? 'rgba(96, 165, 250, 0.26)' : 'rgba(25, 118, 210, 0.18)',
                  },
                  '&:hover': {
                    backgroundColor: isDark ? 'rgba(148, 163, 184, 0.10)' : 'rgba(15, 23, 42, 0.06)',
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 42 }}>{item.icon}</ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItemButton>
            );
          })}
        </List>

        {isAdmin ? (
          <Box sx={{ flex: 1, px: 1.5, pb: 1.5, pt: 0.5, display: 'flex' }}>
            <Box
              sx={{
                width: '100%',
                borderRadius: 3,
                p: 1.75,
                border: '1px solid',
                borderColor: isDark ? 'rgba(96, 165, 250, 0.22)' : 'rgba(25, 118, 210, 0.16)',
                background: isDark
                  ? 'linear-gradient(160deg, rgba(15,23,42,0.96) 0%, rgba(30,41,59,0.92) 100%)'
                  : 'linear-gradient(160deg, rgba(255,255,255,0.95) 0%, rgba(241,245,249,0.98) 100%)',
                display: 'flex',
                flexDirection: 'column',
                gap: 1.25,
                boxShadow: isDark
                  ? '0 18px 40px rgba(15, 23, 42, 0.28)'
                  : '0 18px 40px rgba(15, 23, 42, 0.08)',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.1 }}>
                <Box
                  sx={{
                    width: 42,
                    height: 42,
                    borderRadius: '50%',
                    display: 'grid',
                    placeItems: 'center',
                    background: isDark ? 'rgba(59, 130, 246, 0.16)' : 'rgba(37, 99, 235, 0.12)',
                    color: 'primary.main',
                    flexShrink: 0,
                  }}
                >
                  <AdminPanelSettingsIcon />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
                    Administrare conturi
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.4 }}>
                    Control rapid pentru doctori și pacienți.
                  </Typography>
                </Box>
              </Box>

              <Stack spacing={0.9}>
                <Box
                  sx={{
                    px: 1,
                    py: 0.9,
                    borderRadius: 2,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.12)' : 'rgba(37, 99, 235, 0.08)',
                  }}
                >
                  <DeleteOutlineIcon sx={{ fontSize: 18, color: 'error.main' }} />
                  <Box>
                    <Typography variant="caption" sx={{ display: 'block', fontWeight: 700, lineHeight: 1.2 }}>
                      Ștergere conturi
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.2 }}>
                      Din panoul principal.
                    </Typography>
                  </Box>
                </Box>
                <Box
                  sx={{
                    px: 1,
                    py: 0.9,
                    borderRadius: 2,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    backgroundColor: isDark ? 'rgba(148, 163, 184, 0.10)' : 'rgba(15, 23, 42, 0.05)',
                  }}
                >
                  <GroupsIcon sx={{ fontSize: 18, color: 'primary.main' }} />
                  <Box>
                    <Typography variant="caption" sx={{ display: 'block', fontWeight: 700, lineHeight: 1.2 }}>
                      Gestionare utilizatori
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.2 }}>
                      Doctori și pacienți.
                    </Typography>
                  </Box>
                </Box>
              </Stack>

              <Divider sx={{ borderColor: isDark ? 'rgba(148, 163, 184, 0.20)' : 'rgba(15, 23, 42, 0.10)' }} />

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                <Chip
                  size="small"
                  label={user?.role === 'admin' ? 'Rol: Admin' : 'Rol necunoscut'}
                  variant="outlined"
                  sx={{ alignSelf: 'flex-start', fontWeight: 600 }}
                />
                <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.5 }}>
                  {user?.nume ? `Conectat ca ${user.nume}` : 'Cont administrativ conectat.'}
                </Typography>
              </Box>
            </Box>
          </Box>
        ) : (
          <Box sx={{ flex: 1, px: 1.5, pb: 1.5, pt: 0.5 }}>
            <Box
              sx={{
                height: '100%',
                minHeight: 140,
                borderRadius: 3,
                p: 1.5,
                border: '1px solid',
                borderColor: isDark ? 'rgba(96, 165, 250, 0.28)' : 'rgba(25, 118, 210, 0.18)',
                background: isDark
                  ? 'linear-gradient(160deg, rgba(37,99,235,0.20) 0%, rgba(8,47,73,0.35) 100%)'
                  : 'linear-gradient(160deg, rgba(37,99,235,0.12) 0%, rgba(14,116,144,0.10) 100%)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'primary.dark', mb: 0.5 }}>
                  Panou Monitorizare
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.45 }}>
                  Acces rapid la date live ECG, puls și temperatură.
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                <Chip
                  size="small"
                  icon={<FiberManualRecordIcon sx={{ fontSize: 10 }} />}
                  label={monitoringInfo.connected ? 'Conectat' : 'Deconectat'}
                  color={monitoringInfo.connected ? 'success' : 'default'}
                  variant="outlined"
                />
                <Chip size="small" label={monitoringInfo.patientName} variant="outlined" />
              </Box>

              <Divider sx={{ my: 1.25, borderColor: isDark ? 'rgba(148, 163, 184, 0.30)' : 'rgba(15, 23, 42, 0.15)' }} />


              <Stack spacing={0.7}>
                {[
                  { key: 'ecg', label: 'ECG' },
                  { key: 'puls', label: 'Puls' },
                  { key: 'temperatura', label: 'Temperatură' },
                ].map((sensor) => (
                  <Box
                    key={sensor.key}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      px: 0.8,
                      py: 0.45,
                      borderRadius: 1.5,
                      backgroundColor: isDark ? 'rgba(15, 23, 42, 0.45)' : 'rgba(255, 255, 255, 0.45)',
                    }}
                  >
                    <Typography variant="caption" sx={{ fontWeight: 600 }}>{sensor.label}</Typography>
                    <Chip
                      size="small"
                      label={runningSensors[sensor.key] ? 'Pornit' : 'Oprit'}
                      color={runningSensors[sensor.key] ? 'success' : 'default'}
                      variant="outlined"
                      sx={{ height: 21, '& .MuiChip-label': { px: 0.85 } }}
                    />
                  </Box>
                ))}
              </Stack>

              <Stack direction="row" spacing={0.8} sx={{ mt: 1.1 }}>
                <Button
                  size="small"
                  variant="contained"
                  color="success"
                  fullWidth
                  startIcon={actionLoading.startAll ? <CircularProgress size={13} color="inherit" /> : <PlayArrowIcon />}
                  onClick={handleStartAllSensors}
                  disabled={actionLoading.startAll || actionLoading.stopAll || !monitoringInfo.patientId}
                  sx={{ textTransform: 'none', fontWeight: 700 }}
                >
                  Start all
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  color="error"
                  fullWidth
                  startIcon={actionLoading.stopAll ? <CircularProgress size={13} color="inherit" /> : <StopIcon />}
                  onClick={handleStopAllSensors}
                  disabled={actionLoading.startAll || actionLoading.stopAll}
                  sx={{ textTransform: 'none', fontWeight: 700 }}
                >
                  Stop all
                </Button>
              </Stack>

              {!monitoringInfo.patientId && (
                <Typography variant="caption" sx={{ mt: 0.8, color: 'text.secondary', display: 'block' }}>
                  Pentru Start all, selectează mai întâi un pacient în pagina Senzori Live.
                </Typography>
              )}
            </Box>
          </Box>
        )}
      </Box>
    </Drawer>
  );
}

export { drawerWidth };


