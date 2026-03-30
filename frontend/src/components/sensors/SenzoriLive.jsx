import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box, Container, Typography, Grid, Card, CardContent, Chip,
  ToggleButton, ToggleButtonGroup, CircularProgress, Alert, IconButton, Button,
  Tooltip, Paper, useTheme, Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material';
import FavoriteIcon from '@mui/icons-material/Favorite';
import ThermostatIcon from '@mui/icons-material/Thermostat';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import RefreshIcon from '@mui/icons-material/Refresh';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
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
const ECG_INVERT_DISPLAY = false;
const ECG_LEADOFF_THRESHOLD = 1;
const ECG_SHOW_AC_ONLY = true;
const ECG_SMOOTH_WINDOW = 7;
const ECG_TARGET_HALF_SPAN_MV = 85;
const ECG_MAX_GAIN = 12;
const ECG_MIN_USEFUL_HALF_SPAN_MV = 6;

function normalizeEcgValue(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  if (numeric <= ECG_LEADOFF_THRESHOLD) return null;

  const clamped = Math.max(0, Math.min(3300, numeric));
  return ECG_INVERT_DISPLAY ? (3300 - clamped) : clamped;
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function smoothSeries(values, windowSize) {
  const w = Math.max(1, windowSize | 0);
  if (w === 1 || values.length <= 2) return values;

  const out = [];
  const half = Math.floor(w / 2);
  for (let i = 0; i < values.length; i += 1) {
    const start = Math.max(0, i - half);
    const end = Math.min(values.length, i + half + 1);
    const chunk = values.slice(start, end);
    out.push(chunk.reduce((acc, v) => acc + v, 0) / chunk.length);
  }
  return out;
}

function buildEcgDisplay(data) {
  if (!data.length) {
    return {
      chartData: [],
      yDomain: [0, 3300],
      yLabel: 'mV',
      baseline: 1650,
      quality: 'N/A',
      gain: 1,
      halfSpan: 0,
    };
  }

  if (!ECG_SHOW_AC_ONLY) {
    return {
      chartData: data,
      yDomain: [0, 3300],
      yLabel: 'mV',
      baseline: 1650,
      quality: 'RAW',
      gain: 1,
      halfSpan: 1650,
    };
  }

  const rawValues = data.map((p) => p.value);
  const baseline = median(rawValues);
  const acValues = rawValues.map((v) => v - baseline);
  const smoothed = smoothSeries(acValues, ECG_SMOOTH_WINDOW);

  const halfSpan = Math.max(...smoothed.map((v) => Math.abs(v)), 0);
  const computedGain = halfSpan > 0
    ? Math.min(ECG_MAX_GAIN, Math.max(1, ECG_TARGET_HALF_SPAN_MV / halfSpan))
    : 1;

  const quality = halfSpan < ECG_MIN_USEFUL_HALF_SPAN_MV ? 'Semnal slab' : 'Semnal util';
  const amplified = smoothed.map((v) => v * computedGain);

  const chartData = data.map((p, i) => ({
    ...p,
    value: amplified[i],
  }));

  const absMax = Math.max(20, ...amplified.map((v) => Math.abs(v)));
  const margin = Math.max(8, Math.round(absMax * 0.15));
  const limit = Math.round(absMax + margin);

  return {
    chartData,
    yDomain: [-limit, limit],
    yLabel: 'mV (AC)',
    baseline: 0,
    quality,
    gain: computedGain,
    halfSpan,
  };
}

export default function SenzoriLive() {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState('ecg');
  const [connected, setConnected] = useState(false);
  const [sensorStatus, setSensorStatus] = useState({});
  const [ecgData, setEcgData] = useState([]);
  const [ecgPaused, setEcgPaused] = useState(false);
  const [pulseData, setPulseData] = useState([]);
  const [tempData, setTempData] = useState([]);
  const [latestPulse, setLatestPulse] = useState({ hr: '--' });
  const [latestTemp, setLatestTemp] = useState('--');
  const [sensorsRunning, setSensorsRunning] = useState({
    ecg: false,
    puls: false,
    temperatura: false
  });
  const [loadingControl, setLoadingControl] = useState({});
  const socketRef = useRef(null);
  const ecgBufferRef = useRef([]);
  const ecgPausedRef = useRef(false);

  useEffect(() => {
    ecgPausedRef.current = ecgPaused;
  }, [ecgPaused]);

  const handleStartSensors = async (sensorType) => {
    try {
      setLoadingControl(prev => ({ ...prev, [sensorType]: true }));
      const response = await api.post('/sensors/start', {
        sensorType
      });
      if (response.data.success) {
        setSensorsRunning(prev => ({ ...prev, [sensorType]: true }));
      }
    } catch (err) {
      console.error(`Eroare pornire ${sensorType}:`, err);
      alert(`Eroare la pornirea senzorului ${sensorType}`);
    } finally {
      setLoadingControl(prev => ({ ...prev, [sensorType]: false }));
    }
  };

  const handleStopSensors = async (sensorType) => {
    try {
      setLoadingControl(prev => ({ ...prev, [sensorType]: true }));
      const response = await api.post('/sensors/stop', {
        sensorType
      });
      if (response.data.success) {
        setSensorsRunning(prev => ({ ...prev, [sensorType]: false }));
      }
    } catch (err) {
      console.error(`Eroare oprire ${sensorType}:`, err);
      alert(`Eroare la oprirea senzorului ${sensorType}`);
    } finally {
      setLoadingControl(prev => ({ ...prev, [sensorType]: false }));
    }
  };

  const checkSensorsRunning = async () => {
    try {
      const response = await api.get('/sensors/running');
      setSensorsRunning(response.data.running);
    } catch (err) {
      console.error('Eroare verificare status:', err);
    }
  };

  useEffect(() => {
    ecgPausedRef.current = ecgPaused;
    checkSensorsRunning();
  }, [ecgPaused]);

  const appendEcgPoint = useCallback((value, leadsOk = true) => {
    if (ecgPausedRef.current) return;

    const nextPoint = {
      idx: ecgBufferRef.current.length,
      value,
      leads_ok: leadsOk,
    };
    ecgBufferRef.current = [...ecgBufferRef.current, nextPoint].slice(-MAX_ECG_POINTS);
    setEcgData([...ecgBufferRef.current]);
  }, []);

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
      socket.emit('subscribe_sensor', 'puls');
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
      if (data.sensor_type === 'ecg') {
        const ecgValue = normalizeEcgValue(data.value_1);
        if (ecgValue === null) return;
        appendEcgPoint(ecgValue, data.value_1 > 0);
      } else if (data.sensor_type === 'puls') {
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
        data.readings
          .map((r) => ({ value: normalizeEcgValue(r.value_1), leads_ok: r.leads_ok }))
          .filter((r) => r.value !== null)
          .forEach((r) => appendEcgPoint(r.value, r.leads_ok));
      } else if (data.sensor_type === 'puls') {
        setPulseData(prev => {
          const next = [...prev];
          data.readings.forEach(r => {
            next.push({
              time: new Date(r.timestamp).toLocaleTimeString('ro-RO'),
              hr: r.value_1,
            });
          });
          return next.slice(-MAX_VITAL_POINTS);
        });
        if (data.readings.length > 0) {
          setLatestPulse({ hr: data.readings[data.readings.length - 1].value_1 });
        }
      } else if (data.sensor_type === 'temperatura') {
        setTempData(prev => {
          const next = [...prev];
          data.readings.forEach(r => {
            next.push({
              time: new Date(r.timestamp).toLocaleTimeString('ro-RO'),
              temp: r.value_1,
            });
          });
          return next.slice(-MAX_VITAL_POINTS);
        });
        if (data.readings.length > 0) {
          setLatestTemp(data.readings[data.readings.length - 1].value_1);
        }
      }
    });
    return () => {
      socket.emit('unsubscribe_sensor', 'ecg');
      socket.emit('unsubscribe_sensor', 'puls');
      socket.emit('unsubscribe_sensor', 'temperatura');
      socket.disconnect();
    };
  }, [appendEcgPoint]);

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
      <Box sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
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
            <Tooltip title={Object.values(sensorsRunning).some(v => v) ? 'Ceva senzori rulează' : 'Niciun senzor activ'}>
              <Chip
                icon={<FiberManualRecordIcon sx={{ fontSize: 12 }} />}
                label={Object.values(sensorsRunning).some(v => v) ? 'Senzori Activi' : 'Senzori Inactivi'}
                color={Object.values(sensorsRunning).some(v => v) ? 'success' : 'default'}
                variant="outlined"
                size="small"
              />
            </Tooltip>
            <Tooltip title="Resetează datele">
              <IconButton onClick={handleRefresh} size="small">
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        <Grid container spacing={1.5} sx={{ mb: 2 }}>
          <Grid item xs={12} sm={4}>
            <SensorStatusCard
              icon={<MonitorHeartIcon sx={{ fontSize: 28 }} />}
              label="ECG (AD8232)"
              online={isSensorOnline('ecg')}
              color="#f44336"
              sensorType="ecg"
              onStart={handleStartSensors}
              onStop={handleStopSensors}
              running={sensorsRunning.ecg}
              loading={loadingControl.ecg}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <SensorStatusCard
              icon={<FavoriteIcon sx={{ fontSize: 28 }} />}
              label="Senzor puls analogic"
              online={isSensorOnline('puls')}
              color="#e91e63"
              sensorType="puls"
              onStart={handleStartSensors}
              onStop={handleStopSensors}
              running={sensorsRunning.puls}
              loading={loadingControl.puls}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <SensorStatusCard
              icon={<ThermostatIcon sx={{ fontSize: 28 }} />}
              label="Temperatură (DS18B20)"
              online={isSensorOnline('temperatura')}
              color="#ff9800"
              sensorType="temperatura"
              onStart={handleStartSensors}
              onStop={handleStopSensors}
              running={sensorsRunning.temperatura}
              loading={loadingControl.temperatura}
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
          <ToggleButton value="puls">
            <FavoriteIcon sx={{ mr: 1 }} /> Puls
          </ToggleButton>
          <ToggleButton value="temperatura">
            <ThermostatIcon sx={{ mr: 1 }} /> Temperatură
          </ToggleButton>
        </ToggleButtonGroup>

        {activeTab === 'ecg' && (
          <ECGChart
            data={ecgData}
            theme={theme}
            paused={ecgPaused}
            onTogglePause={() => setEcgPaused((prev) => !prev)}
          />
        )}
        {activeTab === 'puls' && <PulseChart data={pulseData} latest={latestPulse} theme={theme} />}
        {activeTab === 'temperatura' && <TempChart data={tempData} latest={latestTemp} theme={theme} />}
      </Box>
    </AppLayout>
  );
}

function SensorStatusCard({ icon, label, online, color, extra, sensorType, onStart, onStop, running, loading }) {
  return (
    <Card sx={{
      borderLeft: `4px solid ${online ? color : '#9e9e9e'}`,
      opacity: online ? 1 : 0.6,
      transition: 'all 0.3s',
    }}>
      <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, py: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
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
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {running ? (
            <Button
              fullWidth
              size="small"
              variant="contained"
              color="error"
              startIcon={loading ? <CircularProgress size={16} /> : <StopIcon />}
              onClick={() => onStop(sensorType)}
              disabled={loading}
            >
              Stop
            </Button>
          ) : (
            <Button
              fullWidth
              size="small"
              variant="contained"
              color="success"
              startIcon={loading ? <CircularProgress size={16} /> : <PlayArrowIcon />}
              onClick={() => onStart(sensorType)}
              disabled={loading}
            >
              Start
            </Button>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}

function ECGChart({ data, theme, paused, onTogglePause }) {
  const isDark = theme.palette.mode === 'dark';
  const display = buildEcgDisplay(data);

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            <MonitorHeartIcon sx={{ mr: 1, verticalAlign: 'middle', color: '#f44336' }} />
            Electrocardiogramă (ECG) - Timp Real
          </Typography>
          <Button
            size="small"
            variant={paused ? 'contained' : 'outlined'}
            color={paused ? 'warning' : 'primary'}
            onClick={onTogglePause}
            startIcon={paused ? <PlayArrowIcon /> : <PauseIcon />}
          >
            {paused ? 'Resume' : 'Pauza'}
          </Button>
        </Box>
        {data.length > 0 && (
          <Box sx={{ display: 'flex', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
            <Chip
              size="small"
              label={`Calitate: ${display.quality}`}
              color={display.quality === 'Semnal util' ? 'success' : 'warning'}
              variant="outlined"
            />
            <Chip
              size="small"
              label={`Zoom x${display.gain.toFixed(1)}`}
              variant="outlined"
            />
            <Chip
              size="small"
              label={`Amplitudine ±${display.halfSpan.toFixed(1)} mV`}
              variant="outlined"
            />
          </Box>
        )}
        {data.length === 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 8 }}>
            <CircularProgress size={40} sx={{ mb: 2 }} />
            <Typography color="text.secondary">
              Se așteaptă date ECG de la senzor...
            </Typography>
          </Box>
        ) : (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={display.chartData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)'}
              />
              <XAxis dataKey="idx" tick={false} />
              <YAxis
                domain={display.yDomain}
                label={{ value: display.yLabel, angle: -90, position: 'insideLeft' }}
                tick={{ fill: theme.palette.text.secondary, fontSize: 12 }}
              />
              <ReferenceLine y={display.baseline} stroke="#666" strokeDasharray="5 5" label="Baseline" />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#f44336"
                strokeWidth={1.5}
                dot={false}
                activeDot={false}
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
    <Box>
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              <FavoriteIcon sx={{ mr: 1, verticalAlign: 'middle', color: '#e91e63' }} />
              Frecvență cardiacă (BPM)
            </Typography>
            <Box sx={{ textAlign: 'right' }}>
              <FavoriteIcon sx={{ fontSize: 28, color: '#e91e63' }} />
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#e91e63' }}>
                {latest.hr !== '--' ? Math.round(latest.hr) : '--'}
              </Typography>
            </Box>
          </Box>
          {data.length === 0 ? (
            <Box sx={{ py: 6, textAlign: 'center' }}>
              <Typography color="text.secondary">Se așteaptă date...</Typography>
            </Box>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
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
    </Box>
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
    <Box>
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              <ThermostatIcon sx={{ mr: 1, verticalAlign: 'middle', color: getTemperatureColor(latest) }} />
              Evoluție temperatură
            </Typography>
            <Box sx={{ textAlign: 'right' }}>
              <ThermostatIcon sx={{ fontSize: 28, color: getTemperatureColor(latest) }} />
              <Typography variant="h5" sx={{ fontWeight: 700, color: getTemperatureColor(latest) }}>
                {latest !== '--' ? latest : '--'}
              </Typography>
              <Chip
                label={getTemperatureLabel(latest)}
                size="small"
                sx={{ mt: 0.5, backgroundColor: getTemperatureColor(latest), color: '#fff' }}
              />
            </Box>
          </Box>
          {data.length === 0 ? (
            <Box sx={{ py: 6, textAlign: 'center' }}>
              <Typography color="text.secondary">Se așteaptă date de la senzor...</Typography>
            </Box>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
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
    </Box>
  );
}
