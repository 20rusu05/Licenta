import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box, Container, Typography, Grid, Card, CardContent, Chip,
  ToggleButton, ToggleButtonGroup, CircularProgress, Alert, IconButton,
  Tooltip, Paper, useTheme
} from '@mui/material';
import FavoriteIcon from '@mui/icons-material/Favorite';
import ThermostatIcon from '@mui/icons-material/Thermostat';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, AreaChart, Area, ReferenceLine
} from 'recharts';
import { io } from 'socket.io-client';
import AppLayout from '../layout/AppLayout';
import { api } from '../../services/api';

const SOCKET_URL = `http://${window.location.hostname}:3001`;
const MAX_ECG_POINTS = 300;
const MAX_VITAL_POINTS = 60;

export default function SenzoriLive() {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState('ecg');
  const [connected, setConnected] = useState(false);
  const [sensorStatus, setSensorStatus] = useState({});
  const [ecgData, setEcgData] = useState([]);
  const [pulseData, setPulseData] = useState([]);
  const [tempData, setTempData] = useState([]);
  const [latestPulse, setLatestPulse] = useState({ hr: '--' });
  const [latestTemp, setLatestTemp] = useState('--');
  const socketRef = useRef(null);
  const ecgBufferRef = useRef([]);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 2000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('subscribe_sensor', 'ecg');
      socket.emit('subscribe_sensor', 'pulsoximetru');
      socket.emit('subscribe_sensor', 'temperatura');
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('sensor_connected', (data) => {
      setSensorStatus(prev => ({
        ...prev,
        [data.sensor_type]: { ...data, online: true }
      }));
    });

    socket.on('sensor_disconnected', (data) => {
      setSensorStatus(prev => ({
        ...prev,
        [data.sensor_type]: { ...prev[data.sensor_type], online: false }
      }));
    });

    socket.on('sensor_update', (data) => {
      if (data.sensor_type === 'pulsoximetru') {
        setLatestPulse({ hr: data.value_1 });
        setPulseData(prev => {
          const next = [...prev, {
            time: new Date(data.timestamp).toLocaleTimeString('ro-RO'),
            hr: data.value_1,
          }];
          return next.slice(-MAX_VITAL_POINTS);
        });
      } else if (data.sensor_type === 'temperatura') {
        setLatestTemp(data.value_1);
        setTempData(prev => {
          const next = [...prev, {
            time: new Date(data.timestamp).toLocaleTimeString('ro-RO'),
            temp: data.value_1,
          }];
          return next.slice(-MAX_VITAL_POINTS);
        });
      }
    });

    socket.on('sensor_batch_update', (data) => {
      if (data.sensor_type === 'ecg') {
        const newPoints = data.readings.map((r, i) => ({
          idx: ecgBufferRef.current.length + i,
          value: r.value_1,
          leads_ok: r.leads_ok,
        }));
        ecgBufferRef.current = [...ecgBufferRef.current, ...newPoints].slice(-MAX_ECG_POINTS);
        setEcgData([...ecgBufferRef.current]);
      }
    });

    api.get('/sensors/status').then(res => {
      const statusMap = {};
      (res.data.sensors || []).forEach(s => {
        statusMap[s.sensor_type] = { ...s, online: true };
      });
      setSensorStatus(statusMap);
    }).catch(() => {});

    return () => {
      socket.emit('unsubscribe_sensor', 'ecg');
      socket.emit('unsubscribe_sensor', 'pulsoximetru');
      socket.emit('unsubscribe_sensor', 'temperatura');
      socket.disconnect();
    };
  }, []);

  const isSensorOnline = (type) => sensorStatus[type]?.online;

  const handleRefresh = () => {
    setEcgData([]);
    setPulseData([]);
    setTempData([]);
    ecgBufferRef.current = [];
    setLatestPulse({ hr: '--' });
    setLatestTemp('--');
  };

  return (
    <AppLayout>
      <Container maxWidth="xl" sx={{ mt: 2, mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
              Monitorizare Senzori Live
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Date în timp real de la Raspberry Pi 5
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              icon={<FiberManualRecordIcon sx={{ fontSize: 12 }} />}
              label={connected ? 'Conectat' : 'Deconectat'}
              color={connected ? 'success' : 'error'}
              variant="outlined"
              size="small"
            />
            <Tooltip title="Resetează datele">
              <IconButton onClick={handleRefresh} size="small">
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={4}>
            <SensorStatusCard
              icon={<MonitorHeartIcon sx={{ fontSize: 28 }} />}
              label="ECG (AD8232)"
              online={isSensorOnline('ecg')}
              color="#f44336"
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <SensorStatusCard
              icon={<FavoriteIcon sx={{ fontSize: 28 }} />}
              label="Senzor puls analogic"
              online={isSensorOnline('pulsoximetru')}
              color="#e91e63"
              extra={latestPulse.hr !== '--' ? `${latestPulse.hr} BPM` : null}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <SensorStatusCard
              icon={<ThermostatIcon sx={{ fontSize: 28 }} />}
              label="Temperatură (DS18B20)"
              online={isSensorOnline('temperatura')}
              color="#ff9800"
              extra={latestTemp !== '--' ? `${latestTemp}°C` : null}
            />
          </Grid>
        </Grid>

        <ToggleButtonGroup
          value={activeTab}
          exclusive
          onChange={(e, val) => val && setActiveTab(val)}
          sx={{ mb: 3 }}
        >
          <ToggleButton value="ecg">
            <MonitorHeartIcon sx={{ mr: 1 }} /> ECG
          </ToggleButton>
          <ToggleButton value="pulsoximetru">
            <FavoriteIcon sx={{ mr: 1 }} /> Pulsoximetru
          </ToggleButton>
          <ToggleButton value="temperatura">
            <ThermostatIcon sx={{ mr: 1 }} /> Temperatură
          </ToggleButton>
        </ToggleButtonGroup>

        {activeTab === 'ecg' && <ECGChart data={ecgData} theme={theme} />}
        {activeTab === 'pulsoximetru' && <PulseChart data={pulseData} latest={latestPulse} theme={theme} />}
        {activeTab === 'temperatura' && <TempChart data={tempData} latest={latestTemp} theme={theme} />}
      </Container>
    </AppLayout>
  );
}

function SensorStatusCard({ icon, label, online, color, extra }) {
  return (
    <Card sx={{
      borderLeft: `4px solid ${online ? color : '#9e9e9e'}`,
      opacity: online ? 1 : 0.6,
      transition: 'all 0.3s',
    }}>
      <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Box sx={{ color: online ? color : 'text.disabled' }}>{icon}</Box>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{label}</Typography>
          {extra && (
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
              {extra}
            </Typography>
          )}
        </Box>
        <Chip
          size="small"
          label={online ? 'Online' : 'Offline'}
          color={online ? 'success' : 'default'}
          variant={online ? 'filled' : 'outlined'}
          sx={{ fontSize: '0.7rem' }}
        />
      </CardContent>
    </Card>
  );
}

function ECGChart({ data, theme }) {
  const isDark = theme.palette.mode === 'dark';

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
          <MonitorHeartIcon sx={{ mr: 1, verticalAlign: 'middle', color: '#f44336' }} />
          Electrocardiogramă (ECG) - Timp Real
        </Typography>
        {data.length === 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 8 }}>
            <CircularProgress size={40} sx={{ mb: 2 }} />
            <Typography color="text.secondary">
              Se așteaptă date ECG de la senzor...
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
              Pornește scriptul: <code>python sensors/ekg.py</code>
            </Typography>
          </Box>
        ) : (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={data} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)'}
              />
              <XAxis dataKey="idx" tick={false} />
              <YAxis
                domain={[0, 3300]}
                label={{ value: 'mV', angle: -90, position: 'insideLeft' }}
                tick={{ fill: theme.palette.text.secondary, fontSize: 12 }}
              />
              <ReferenceLine y={1650} stroke="#666" strokeDasharray="5 5" label="Baseline" />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#f44336"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

function PulseChart({ data, latest, theme }) {
  const isDark = theme.palette.mode === 'dark';

  return (
    <Grid container spacing={3}>
      <Grid item xs={12} sm={6} md={4}>
        <Card sx={{ textAlign: 'center', background: 'linear-gradient(135deg, #e91e63 0%, #f44336 100%)', color: '#fff' }}>
          <CardContent>
            <FavoriteIcon sx={{ fontSize: 40, mb: 1, opacity: 0.9 }} />
            <Typography variant="h3" sx={{ fontWeight: 700 }}>
              {latest.hr !== '--' ? Math.round(latest.hr) : '--'}
            </Typography>
            <Typography variant="subtitle1" sx={{ opacity: 0.9 }}>BPM</Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12} md={8}>
        <Card>
          <CardContent>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
              Frecvență cardiacă (BPM)
            </Typography>
            {data.length === 0 ? (
              <Box sx={{ py: 4, textAlign: 'center' }}>
                <Typography color="text.secondary">Se așteaptă date...</Typography>
              </Box>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)'} />
                  <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                  <YAxis domain={[40, 140]} tick={{ fontSize: 11 }} />
                  <RechartsTooltip />
                  <ReferenceLine y={60} stroke="#ff9800" strokeDasharray="3 3" />
                  <ReferenceLine y={100} stroke="#ff9800" strokeDasharray="3 3" />
                  <Area type="monotone" dataKey="hr" stroke="#e91e63" fill="#e91e6330" strokeWidth={2} dot={false} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}

function TempChart({ data, latest, theme }) {
  const isDark = theme.palette.mode === 'dark';

  const getTemperatureColor = (temp) => {
    if (temp === '--') return '#9e9e9e';
    const t = parseFloat(temp);
    if (t < 36.0) return '#2196F3';      // Hipotermie
    if (t <= 37.2) return '#4caf50';    // Normal
    if (t <= 38.0) return '#ff9800';    // Subfebril
    return '#f44336';                    // Febră
  };

  const getTemperatureLabel = (temp) => {
    if (temp === '--') return 'Necunoscut';
    const t = parseFloat(temp);
    if (t < 36.0) return 'Hipotermie';
    if (t <= 37.2) return 'Normal';
    if (t <= 38.0) return 'Subfebril';
    return 'Febră';
  };

  return (
    <Grid container spacing={3}>
      <Grid item xs={12} sm={4}>
        <Card sx={{
          textAlign: 'center',
          background: `linear-gradient(135deg, ${getTemperatureColor(latest)}CC 0%, ${getTemperatureColor(latest)} 100%)`,
          color: '#fff',
        }}>
          <CardContent>
            <ThermostatIcon sx={{ fontSize: 48, mb: 1, opacity: 0.9 }} />
            <Typography variant="h2" sx={{ fontWeight: 700 }}>
              {latest !== '--' ? latest : '--'}
            </Typography>
            <Typography variant="h6" sx={{ opacity: 0.9 }}>°C</Typography>
            <Chip
              label={getTemperatureLabel(latest)}
              sx={{ mt: 1, backgroundColor: 'rgba(255,255,255,0.2)', color: '#fff' }}
              size="small"
            />
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12} sm={8}>
        <Card>
          <CardContent>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
              Evoluție temperatură
            </Typography>
            {data.length === 0 ? (
              <Box sx={{ py: 6, textAlign: 'center' }}>
                <Typography color="text.secondary">Se așteaptă date de la senzor...</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                  Pornește: <code>python sensors/temperatura.py</code>
                </Typography>
              </Box>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)'} />
                  <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                  <YAxis domain={[35, 40]} tick={{ fontSize: 11 }} />
                  <RechartsTooltip formatter={(val) => [`${val}°C`, 'Temperatură']} />
                  <ReferenceLine y={37.2} stroke="#ff9800" strokeDasharray="3 3" label="37.2°C" />
                  <ReferenceLine y={36.0} stroke="#2196F3" strokeDasharray="3 3" label="36.0°C" />
                  <Area type="monotone" dataKey="temp" stroke="#ff9800" fill="#ff980030" strokeWidth={2} dot={{ r: 2 }} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}
