import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box, Container, Typography, Grid, Card, CardContent, Chip,
  ToggleButton, ToggleButtonGroup, CircularProgress, Alert, IconButton, Button,
  Tooltip, Paper, useTheme, Snackbar, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, Select, FormControl, List, ListItem, ListItemButton,
  ListItemText
} from '@mui/material';
import FavoriteIcon from '@mui/icons-material/Favorite';
import ThermostatIcon from '@mui/icons-material/Thermostat';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import RefreshIcon from '@mui/icons-material/Refresh';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import SearchIcon from '@mui/icons-material/Search';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, AreaChart, Area, ReferenceLine
} from 'recharts';
import { io } from 'socket.io-client';
import AppLayout from '../layout/AppLayout';
import { api } from '../../services/api';

const SOCKET_URL = import.meta.env.VITE_BACKEND_URL || `https://${window.location.hostname}:3001`;
const MAX_ECG_POINTS = 300;
const MAX_VITAL_POINTS = 60;
const ECG_INVERT_DISPLAY = false;
const ECG_LEADOFF_THRESHOLD = 1;
const ECG_SHOW_AC_ONLY = true;
const ECG_SMOOTH_WINDOW = 7;
const ECG_TARGET_HALF_SPAN_MV = 85;
const ECG_MAX_GAIN = 12;
const ECG_MIN_USEFUL_HALF_SPAN_MV = 6;
const MONITORING_STATUS_KEY = 'monitoringStatus';

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
  const [activeTab, setActiveTab] = useState('all');
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
  
  // Pacienți și sesiuni
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [assignmentFilter, setAssignmentFilter] = useState('all');
  const [allPatients, setAllPatients] = useState([]);
  const [loadingAllPatients, setLoadingAllPatients] = useState(false);
  const [assigningDevice, setAssigningDevice] = useState(false);
  const [unassigningPatientId, setUnassigningPatientId] = useState(null);
  const [toast, setToast] = useState({ open: false, message: '', severity: 'info' });
  const [confirmUnassignOpen, setConfirmUnassignOpen] = useState(false);
  const [pendingUnassignPatientId, setPendingUnassignPatientId] = useState(null);
  const [confirmAssignOpen, setConfirmAssignOpen] = useState(false);
  const [pendingAssignPatientId, setPendingAssignPatientId] = useState(null);
  const [pendingAssignPatientName, setPendingAssignPatientName] = useState('');
  
  const socketRef = useRef(null);
  const ecgBufferRef = useRef([]);
  const ecgPausedRef = useRef(false);
  const selectedPatientRef = useRef(null);

  useEffect(() => {
    ecgPausedRef.current = ecgPaused;
  }, [ecgPaused]);

  const showToast = useCallback((message, severity = 'info') => {
    setToast({ open: true, message, severity });
  }, []);

  const handleStartSensors = async (sensorType) => {
    try {
      if (!selectedPatient?.id) {
        showToast('Selectează un pacient înainte de a porni senzorul', 'warning');
        return;
      }
      setLoadingControl(prev => ({ ...prev, [sensorType]: true }));
      const response = await api.post('/sensors/start', {
        sensorType,
        pacient_id: selectedPatient.id
      });
      if (response.data.success) {
        setSensorsRunning(prev => ({ ...prev, [sensorType]: true }));
        showToast(`Senzorul ${sensorType.toUpperCase()} a fost pornit`, 'success');
      }
    } catch (err) {
      console.error(`Eroare pornire ${sensorType}:`, err);
      showToast(`Eroare la pornirea senzorului ${sensorType}`, 'error');
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
        showToast(`Senzorul ${sensorType.toUpperCase()} a fost oprit`, 'success');
      }
    } catch (err) {
      console.error(`Eroare oprire ${sensorType}:`, err);
      showToast(`Eroare la oprirea senzorului ${sensorType}`, 'error');
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

  const loadHistoryForPatient = useCallback(async (pacientId) => {
    if (!pacientId) return;

    try {
      const [ecgRes, pulsRes, tempRes] = await Promise.all([
        api.get('/sensors/history/ecg', { params: { pacient_id: pacientId, limit: 300 } }),
        api.get('/sensors/history/puls', { params: { pacient_id: pacientId, limit: 60 } }),
        api.get('/sensors/history/temperatura', { params: { pacient_id: pacientId, limit: 60 } }),
      ]);

      const nextEcg = (ecgRes.data.readings || [])
        .map((r) => ({
          value: normalizeEcgValue(r.value_1),
          leads_ok: r.value_1 > 0,
        }))
        .filter((r) => r.value !== null)
        .map((r, idx) => ({
          idx,
          value: r.value,
          leads_ok: r.leads_ok,
        }))
        .slice(-MAX_ECG_POINTS);

      const nextPulse = (pulsRes.data.readings || []).map((r) => ({
        time: new Date(r.created_at).toLocaleTimeString('ro-RO'),
        hr: r.value_1,
      })).slice(-MAX_VITAL_POINTS);

      const nextTemp = (tempRes.data.readings || []).map((r) => ({
        time: new Date(r.created_at).toLocaleTimeString('ro-RO'),
        temp: r.value_1,
      })).slice(-MAX_VITAL_POINTS);

      ecgBufferRef.current = nextEcg;
      setEcgData(nextEcg);
      setPulseData(nextPulse);
      setTempData(nextTemp);
      setLatestPulse({ hr: nextPulse.length ? nextPulse[nextPulse.length - 1].hr : '--' });
      setLatestTemp(nextTemp.length ? nextTemp[nextTemp.length - 1].temp : '--');
    } catch (err) {
      console.error('Eroare încărcare istoric pacient:', err);
    }
  }, []);

  // Fetch pacienții doctorului cu sesiuni active
  const fetchPatients = async () => {
    try {
      setLoadingPatients(true);
      const response = await api.get('/sensors/doctor/patients');
      const rawPatients = response.data.patients || [];

      // Normalizează rezultatul pentru compatibilitate cu ambele variante de backend
      // (vechi: session_id/sensor_type pe rând, nou: session_ids/sensor_types agregate).
      const byPatientId = new Map();
      rawPatients.forEach((row) => {
        const key = Number(row.id);
        if (!Number.isFinite(key)) return;

        if (!byPatientId.has(key)) {
          byPatientId.set(key, {
            ...row,
            id: key,
            __sessionIds: new Set(),
            __sensorTypes: new Set(),
          });
        }

        const acc = byPatientId.get(key);

        if (row.session_id) {
          acc.__sessionIds.add(String(row.session_id));
        }
        if (row.session_ids) {
          String(row.session_ids)
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean)
            .forEach((v) => acc.__sessionIds.add(v));
        }

        if (row.sensor_type) {
          acc.__sensorTypes.add(String(row.sensor_type));
        }
        if (row.sensor_types) {
          String(row.sensor_types)
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean)
            .forEach((v) => acc.__sensorTypes.add(v));
        }

        if (row.started_at && (!acc.started_at || new Date(row.started_at) > new Date(acc.started_at))) {
          acc.started_at = row.started_at;
        }
      });

      const nextPatients = Array.from(byPatientId.values())
        .map((p) => {
          const sessionIds = Array.from(p.__sessionIds);
          const sensorTypes = Array.from(p.__sensorTypes);
          return {
            ...p,
            session_id: sessionIds[0] ? Number(sessionIds[0]) : null,
            session_ids: sessionIds.join(','),
            sensor_types: sensorTypes.join(','),
            active_sessions_count: sessionIds.length,
          };
        })
        .sort((a, b) => new Date(b.started_at || 0) - new Date(a.started_at || 0));

      setPatients(nextPatients);

      if (nextPatients.length === 0) {
        setSelectedPatient(null);
        return [];
      }

      if (selectedPatientRef.current) {
        const refreshedSelected = nextPatients.find((p) => p.id === selectedPatientRef.current.id);
        if (refreshedSelected) {
          setSelectedPatient(refreshedSelected);
          return nextPatients;
        }
      }

      setSelectedPatient(nextPatients[0]);
      return nextPatients;
    } catch (err) {
      console.error('Eroare fetch pacienți:', err);
      return [];
    } finally {
      setLoadingPatients(false);
    }
  };

  // Fetch toți pacienții pentru căutare și asignare
  const fetchAllPatients = async (search = '') => {
    try {
      setLoadingAllPatients(true);
      const response = await api.get('/sensors/doctor/all-patients', {
        params: { search }
      });
      setAllPatients(response.data.patients || []);
    } catch (err) {
      console.error('Eroare fetch toți pacienții:', err);
    } finally {
      setLoadingAllPatients(false);
    }
  };

  // Asignează dispozitiv la pacient
  const handleAssignDevice = async (pacient_id) => {
    const targetPatient = allPatients.find((p) => Number(p.id) === Number(pacient_id));
    setPendingAssignPatientId(pacient_id);
    setPendingAssignPatientName(targetPatient ? `${targetPatient.prenume} ${targetPatient.nume}` : 'pacient');
    setConfirmAssignOpen(true);
  };

  const confirmAssignDevice = async () => {
    if (!pendingAssignPatientId) return;

    const pacient_id = pendingAssignPatientId;
    const normalizedPacientId = Number(pacient_id);
    if (!Number.isFinite(normalizedPacientId) || normalizedPacientId <= 0) {
      showToast('Pacient invalid pentru asignare', 'error');
      setConfirmAssignOpen(false);
      setPendingAssignPatientId(null);
      setPendingAssignPatientName('');
      return;
    }

    try {
      setAssigningDevice(true);
      let response;
      try {
        response = await api.post('/sensors/doctor/assign-session', {
          pacient_id: normalizedPacientId
        });
      } catch (firstErr) {
        const maybeIncomplete = firstErr?.response?.status === 400
          && String(firstErr?.response?.data?.error || '').toLowerCase().includes('date incomplete');

        if (!maybeIncomplete) {
          throw firstErr;
        }

        // Compatibilitate cu backend vechi care cere și sensor_type.
        response = await api.post('/sensors/doctor/assign-session', {
          pacient_id: normalizedPacientId,
          sensor_type: 'ecg'
        });
      }
      
      if (response.data.success) {
        const refreshedPatients = await fetchPatients();
        await fetchAllPatients(searchQuery);
        const newlyAssigned = refreshedPatients.find((p) => Number(p.id) === normalizedPacientId);
        if (newlyAssigned) {
          setSelectedPatient(newlyAssigned);
        }
        const patientInfo = allPatients.find((p) => Number(p.id) === normalizedPacientId)
          || refreshedPatients.find((p) => Number(p.id) === normalizedPacientId);
        const patientName = patientInfo ? `${patientInfo.prenume} ${patientInfo.nume}` : 'pacient';
        showToast(`Dispozitiv asignat pacientului: ${patientName}`, 'success');
      }
    } catch (err) {
      console.error('Eroare asignare:', err);
      showToast('Eroare la asignare: ' + (err.response?.data?.error || err.message), 'error');
    } finally {
      setAssigningDevice(false);
      setConfirmAssignOpen(false);
      setPendingAssignPatientId(null);
      setPendingAssignPatientName('');
    }
  };

  const handleUnassignDevice = async (pacientId) => {
    setPendingUnassignPatientId(pacientId);
    setConfirmUnassignOpen(true);
  };

  const confirmUnassignDevice = async () => {
    if (!pendingUnassignPatientId) return;

    try {
      setUnassigningPatientId(pendingUnassignPatientId);
      let response;
      try {
        response = await api.put(`/sensors/doctor/end-patient-sessions/${pendingUnassignPatientId}`);
      } catch (firstErr) {
        // Compatibilitate cu backend vechi unde există doar end-session/:sessionId
        const activeSession = patients.find((p) => Number(p.id) === Number(pendingUnassignPatientId));
        if (!activeSession?.session_id) {
          throw firstErr;
        }
        response = await api.put(`/sensors/doctor/end-session/${activeSession.session_id}`);
      }
      
      if (response.data.success) {
        await fetchPatients();
        await fetchAllPatients(searchQuery);
        showToast('Dispozitive deasignate pentru pacient', 'success');
      }
    } catch (err) {
      console.error('Eroare deasignare:', err);
      showToast('Eroare la deasignare: ' + (err.response?.data?.error || err.message), 'error');
    } finally {
      setConfirmUnassignOpen(false);
      setPendingUnassignPatientId(null);
      setUnassigningPatientId(null);
    }
  };

  useEffect(() => {
    selectedPatientRef.current = selectedPatient;
  }, [selectedPatient]);

  useEffect(() => {
    const payload = {
      connected,
      selectedPatient: selectedPatient
        ? {
            id: selectedPatient.id,
            name: `${selectedPatient.prenume || ''} ${selectedPatient.nume || ''}`.trim(),
          }
        : null,
      updatedAt: Date.now(),
    };

    localStorage.setItem(MONITORING_STATUS_KEY, JSON.stringify(payload));
    window.dispatchEvent(new Event('monitoring-status-changed'));
  }, [connected, selectedPatient?.id, selectedPatient?.prenume, selectedPatient?.nume]);

  useEffect(() => {
    checkSensorsRunning();
    fetchPatients();
    fetchAllPatients();
  }, []);

  useEffect(() => {
    if (!selectedPatient?.id) {
      handleRefresh();
      return;
    }

    handleRefresh();
    loadHistoryForPatient(selectedPatient.id);
  }, [selectedPatient?.id, loadHistoryForPatient]);

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
      // Filtrează datele pentru pacientul selectat
      const selected = selectedPatientRef.current;
      if (selected && Number(data.pacient_id) !== Number(selected.id)) {
        return;
      }

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
      // Filtrează datele pentru pacientul selectat
      const selected = selectedPatientRef.current;
      if (selected && data.pacient_id && Number(data.pacient_id) !== Number(selected.id)) {
        return;
      }

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

  const isSensorOnline = (type) => Boolean(sensorStatus[type]?.online || sensorsRunning[type]);

  const handleRefresh = () => {
    setEcgData([]);
    setPulseData([]);
    setTempData([]);
    ecgBufferRef.current = [];
    setLatestPulse({ hr: '--' });
    setLatestTemp('--');
  };

  const isPatientAssigned = (patientId) => {
    const activeSession = patients.find((ap) => Number(ap.id) === Number(patientId));
    return Boolean(
      activeSession && (
        Number(activeSession.active_sessions_count) > 0
        || activeSession.session_id
        || (activeSession.session_ids && String(activeSession.session_ids).length > 0)
      )
    );
  };

  const filteredPatients = allPatients.filter((p) => {
    const assigned = isPatientAssigned(p.id);
    if (assignmentFilter === 'assigned') return assigned;
    if (assignmentFilter === 'unassigned') return !assigned;
    return true;
  });

  return (
    <AppLayout>
      <Box sx={{ p: 1.5 }}>
        {/* Secțiunea de selectare pacient și asignare dispozitiv */}
        <Card sx={{ mb: 2, bgcolor: theme.palette.mode === 'dark' ? '#1a1a1a' : '#f5f5f5' }}>
          <CardContent sx={{ py: 1.5, px: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 1.5 }}>
              Gestionare Sesiuni de Monitorizare
            </Typography>
            
            <Grid container spacing={1} sx={{ mb: 1.5 }}>
              <Grid size={{ xs: 12, md: 6 }}>
                <FormControl fullWidth size="small" sx={{ minWidth: 240 }}>
                  <Select
                    value={selectedPatient?.id || ''}
                    displayEmpty
                    onChange={(e) => {
                      const patient = patients.find((p) => Number(p.id) === Number(e.target.value));
                      setSelectedPatient(patient);
                    }}
                    renderValue={(selected) => {
                      if (!selected) {
                        return <Typography variant="body2" color="text.secondary">Selectează pacient</Typography>;
                      }
                      const patient = patients.find((p) => Number(p.id) === Number(selected));
                      if (!patient) return selected;
                      return `${patient.prenume} ${patient.nume}`;
                    }}
                    disabled={patients.length === 0}
                  >
                    {patients.map(p => (
                      <MenuItem key={p.id} value={p.id}>
                        {p.prenume} {p.nume}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <FormControl fullWidth size="small" sx={{ minWidth: 220 }}>
                  <Select
                    value={assignmentFilter}
                    onChange={(e) => setAssignmentFilter(e.target.value)}
                  >
                    <MenuItem value="all">Toți pacienții</MenuItem>
                    <MenuItem value="assigned">Doar pacienții asignați</MenuItem>
                    <MenuItem value="unassigned">Doar pacienții neasignați</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            <TextField
              fullWidth
              size="small"
              label="Caută pacient pentru asignare/deasignare"
              value={searchQuery}
              onChange={(e) => {
                const value = e.target.value;
                setSearchQuery(value);
                fetchAllPatients(value);
              }}
              InputProps={{
                startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
              }}
              sx={{ mb: 1.5 }}
            />

            <List dense sx={{ maxHeight: 200, overflowY: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper', mb: 1.5 }}>
              {filteredPatients.map((p) => {
                const activeSession = patients.find((ap) => Number(ap.id) === Number(p.id));
                const isAssigned = isPatientAssigned(p.id);

                return (
                  <ListItem
                    key={p.id}
                    disablePadding
                    secondaryAction={
                      <Button
                        size="small"
                        variant="contained"
                        color={isAssigned ? 'error' : 'success'}
                        disabled={assigningDevice || Number(unassigningPatientId) === Number(p.id)}
                        onClick={() => {
                          if (isAssigned) {
                            handleUnassignDevice(p.id);
                          } else {
                            handleAssignDevice(p.id);
                          }
                        }}
                      >
                        {isAssigned ? 'Deasignare' : 'Asignare'}
                      </Button>
                    }
                  >
                    <ListItemButton onClick={() => {
                      if (activeSession) {
                        setSelectedPatient(activeSession);
                      }
                    }}>
                      <ListItemText
                        primary={`${p.prenume} ${p.nume}`}
                        secondary={p.email}
                      />
                    </ListItemButton>
                  </ListItem>
                );
              })}
              {!loadingAllPatients && filteredPatients.length === 0 && (
                <ListItem>
                  <ListItemText
                    primary={allPatients.length === 0 ? 'Niciun pacient găsit' : 'Niciun pacient pentru filtrul selectat'}
                  />
                </ListItem>
              )}
            </List>

            {patients.length === 0 && !loadingPatients && (
              <Alert severity="info">
                Nu aveți sesiuni de monitorizare active. Asignați un dispozitiv unui pacient pentru a vedea datele senzorilor.
              </Alert>
            )}

            {loadingPatients && (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                <CircularProgress size={24} />
              </Box>
            )}

            {selectedPatient && (
              <Paper sx={{ p: 2, bgcolor: 'primary.light', mt: 2 }}>
                <Typography variant="body2">
                  <strong>Pacient selectat:</strong> {selectedPatient.prenume} {selectedPatient.nume}
                </Typography>
              </Paper>
            )}
          </CardContent>
        </Card>
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

        <Grid container spacing={1} sx={{ mb: 2 }}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <SensorStatusCard
              icon={<MonitorHeartIcon sx={{ fontSize: 28 }} />}
              label="ECG"
              online={isSensorOnline('ecg')}
              color="#f44336"
              sensorType="ecg"
              onStart={handleStartSensors}
              onStop={handleStopSensors}
              running={sensorsRunning.ecg}
              loading={loadingControl.ecg}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <SensorStatusCard
              icon={<FavoriteIcon sx={{ fontSize: 28 }} />}
              label="Puls"
              online={isSensorOnline('puls')}
              color="#e91e63"
              sensorType="puls"
              onStart={handleStartSensors}
              onStop={handleStopSensors}
              running={sensorsRunning.puls}
              loading={loadingControl.puls}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <SensorStatusCard
              icon={<ThermostatIcon sx={{ fontSize: 28 }} />}
              label="Temperatură"
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
          sx={{ mb: 2 }}
        >
          <ToggleButton value="all">
            <MonitorHeartIcon sx={{ mr: 1 }} /> Toate
          </ToggleButton>
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

        {activeTab === 'all' && (
          <>
            <Grid container spacing={1.5} alignItems="stretch">
            <Grid size={{ xs: 12, md: 6 }} sx={{ display: 'flex' }}>
              <PulseChart data={pulseData} latest={latestPulse} theme={theme} fullHeight />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }} sx={{ display: 'flex' }}>
              <TempChart data={tempData} latest={latestTemp} theme={theme} fullHeight />
            </Grid>
            </Grid>
            <Box sx={{ mt: 1.5, width: '100%' }}>
              <ECGChart
                data={ecgData}
                theme={theme}
                paused={ecgPaused}
                onTogglePause={() => setEcgPaused((prev) => !prev)}
              />
            </Box>
          </>
        )}

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

        <Dialog open={confirmAssignOpen} onClose={() => {
          setConfirmAssignOpen(false);
          setPendingAssignPatientId(null);
          setPendingAssignPatientName('');
        }}>
          <DialogTitle>Confirmare asignare</DialogTitle>
          <DialogContent>
            <Typography variant="body2">
              Sigur vrei să asignezi dispozitivul pacientului <strong>{pendingAssignPatientName}</strong>?
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => {
              setConfirmAssignOpen(false);
              setPendingAssignPatientId(null);
              setPendingAssignPatientName('');
            }}>
              Anulează
            </Button>
            <Button
              variant="contained"
              color="success"
              onClick={confirmAssignDevice}
              disabled={Boolean(assigningDevice)}
            >
              Confirmă
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={confirmUnassignOpen} onClose={() => setConfirmUnassignOpen(false)}>
          <DialogTitle>Confirmare deasignare</DialogTitle>
          <DialogContent>
            <Typography variant="body2">
              Sigur vrei să deasignezi dispozitivul de la pacient?
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => {
              setConfirmUnassignOpen(false);
              setPendingUnassignPatientId(null);
            }}>
              Anulează
            </Button>
            <Button
              variant="contained"
              color="error"
              onClick={confirmUnassignDevice}
              disabled={Boolean(unassigningPatientId)}
            >
              Confirmă
            </Button>
          </DialogActions>
        </Dialog>

        <Snackbar
          open={toast.open}
          autoHideDuration={3200}
          onClose={() => setToast((prev) => ({ ...prev, open: false }))}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert
            onClose={() => setToast((prev) => ({ ...prev, open: false }))}
            severity={toast.severity}
            variant="filled"
            sx={{ width: '100%' }}
          >
            {toast.message}
          </Alert>
        </Snackbar>
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
            Electrocardiogramă (ECG)
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
            <Typography color="text.secondary">
              Se așteaptă date ECG de la senzor...
            </Typography>
          </Box>
        ) : (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={display.chartData} margin={{ top: 10, right: 8, left: 0, bottom: 10 }}>
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

function PulseChart({ data, latest, theme, fullHeight = false }) {
  const isDark = theme.palette.mode === 'dark';

  return (
    <Box sx={{ width: '100%', display: 'flex' }}>
      <Card sx={{ width: '100%', display: 'flex', flexDirection: 'column', height: fullHeight ? '100%' : 'auto' }}>
        <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', px: 0, pt: 2, pb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, px: 2 }}>
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
            <Box sx={{ py: 6, textAlign: 'center', px: 2 }}>
              <Typography color="text.secondary">Se așteaptă date...</Typography>
            </Box>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={data} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)'} />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 10 }}
                  padding={{ left: 0, right: 0 }}
                  scale="point"
                />
                <YAxis domain={[40, 140]} tick={{ fontSize: 11 }} width={34} />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: isDark ? 'rgba(15, 23, 42, 0.96)' : '#ffffff',
                    border: isDark ? '1px solid rgba(148, 163, 184, 0.35)' : '1px solid #e2e8f0',
                    borderRadius: 10,
                    boxShadow: isDark ? '0 10px 30px rgba(2,6,23,0.45)' : '0 10px 25px rgba(15,23,42,0.12)',
                  }}
                  labelStyle={{
                    color: isDark ? '#e2e8f0' : '#334155',
                    fontWeight: 600,
                  }}
                  itemStyle={{
                    color: isDark ? '#f8fafc' : '#0f172a',
                  }}
                  cursor={{ stroke: isDark ? 'rgba(148,163,184,0.35)' : 'rgba(15,23,42,0.2)', strokeWidth: 1 }}
                />
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

function TempChart({ data, latest, theme, fullHeight = false }) {
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
    <Box sx={{ width: '100%', display: 'flex' }}>
      <Card sx={{ width: '100%', display: 'flex', flexDirection: 'column', height: fullHeight ? '100%' : 'auto' }}>
        <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', px: 0, pt: 2, pb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, px: 2 }}>
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
            <Box sx={{ py: 6, textAlign: 'center', px: 2 }}>
              <Typography color="text.secondary">Se așteaptă date de la senzor...</Typography>
            </Box>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={data} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)'} />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 10 }}
                  padding={{ left: 0, right: 0 }}
                  scale="point"
                />
                <YAxis domain={[35, 40]} tick={{ fontSize: 11 }} width={34} />
                <RechartsTooltip
                  formatter={(val) => [`${val}°C`, 'Temperatură']}
                  contentStyle={{
                    backgroundColor: isDark ? 'rgba(15, 23, 42, 0.96)' : '#ffffff',
                    border: isDark ? '1px solid rgba(148, 163, 184, 0.35)' : '1px solid #e2e8f0',
                    borderRadius: 10,
                    boxShadow: isDark ? '0 10px 30px rgba(2,6,23,0.45)' : '0 10px 25px rgba(15,23,42,0.12)',
                  }}
                  labelStyle={{
                    color: isDark ? '#e2e8f0' : '#334155',
                    fontWeight: 600,
                  }}
                  itemStyle={{
                    color: isDark ? '#f8fafc' : '#0f172a',
                  }}
                  cursor={{ stroke: isDark ? 'rgba(148,163,184,0.35)' : 'rgba(15,23,42,0.2)', strokeWidth: 1 }}
                />
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
