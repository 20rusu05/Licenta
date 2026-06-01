import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
import HistoryIcon from '@mui/icons-material/History';
import DownloadIcon from '@mui/icons-material/Download';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, AreaChart, Area, ReferenceLine
} from 'recharts';
import { io } from 'socket.io-client';
import AppLayout from '../layout/AppLayout';
import { api, BACKEND_ORIGIN } from '../../services/api';
import { useLanguage } from '../../LanguageContext';

const SOCKET_URL = BACKEND_ORIGIN;
const MAX_ECG_POINTS = 1500;
const MAX_VITAL_POINTS = 60;
const ECG_INVERT_DISPLAY = false;
const ECG_LEADOFF_THRESHOLD = 1;
const ECG_AC_DETECT_ABS_MAX_MV = 300;
const ECG_MODE_RAW = 1;
const ECG_MODE_FILTERED = 2;
const ECG_MODE_AC = 3;
const ECG_SHOW_AC_ONLY = true;
const ECG_BASELINE_SEC = 1.2;
const ECG_POST_SMOOTH_SEC = 0.08;
const ECG_TARGET_HALF_SPAN_MV = 1.2;
const ECG_MAX_GAIN = 2.8;
const ECG_MIN_GAIN = 0.01;
// ECG AC is typically sub-mV..few mV; the previous 6 mV threshold labeled almost everything as weak.
const ECG_MIN_USEFUL_HALF_SPAN_MV = 0.25;
// AC ECG streams can have steep QRS upstrokes/downslope; keep spike limiter loose
// so we don't turn QRS peaks into long ramps or bias the gain estimator.
const ECG_SPIKE_MAX_STEP = 80;
const ECG_DEFAULT_SAMPLE_RATE_HZ = 250;
const ECG_NOTCH_FREQ_HZ = 50;
const ECG_DISPLAY_LOWPASS_HZ = 24;
const ECG_DISPLAY_WINDOW_SEC = 6;
const ECG_GRID_MAJOR_TIME_SEC = 1.0;
const ECG_GRID_MINOR_TIME_SEC = 0.2;
const ECG_MIN_SAMPLE_INTERVAL_MS = Math.round(1000 / ECG_DEFAULT_SAMPLE_RATE_HZ);
const ECG_LOCK_Y_DOMAIN = true;
const ECG_FIXED_Y_LIMIT_MV = 2.5;
// Artifact handling: motion / lead jitter can create rare huge excursions.
// We smooth them for visualization (do not affect stored data).
const ECG_ARTIFACT_ABS_MIN_MV = 4;
const ECG_ARTIFACT_MULT = 6.0;
const ECG_DISPLAY_MAX_STEP_MV = 0.45;
const MONITORING_STATUS_KEY = 'monitoringStatus';
const SENSORS_CONTROL_EVENT = 'sensors-control-action';
const SENSOR_READING_CLOCK_SKEW_TOLERANCE_MS = 10 * 60 * 1000;
const HISTORY_PAGE_SIZE = 50;
const HISTORY_LIMITS = {
  ecg: 15000,
  puls: 5000,
  temperatura: 5000,
};

function toIsoDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toISOString();
}

function toTimestampMs(value) {
  if (!value) return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 1e12 ? value : Math.round(value * 1000);
  }
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function toSqlDateTime(value) {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;

  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function getHistoryRangeBounds(range, customFrom, customTo) {
  const now = new Date();

  if (range === '24h') {
    const from = new Date(now.getTime() - (24 * 60 * 60 * 1000));
    return { from: from.toISOString(), to: now.toISOString() };
  }

  if (range === '7d') {
    const from = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
    return { from: from.toISOString(), to: now.toISOString() };
  }

  if (range === '30d') {
    const from = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    return { from: from.toISOString(), to: now.toISOString() };
  }

  return {
    from: toSqlDateTime(customFrom),
    to: toSqlDateTime(customTo),
  };
}

function escapeCsvValue(value) {
  const normalized = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }
  return normalized;
}

function downloadCsv(fileName, headers, rows) {
  const lines = [headers.join(',')];
  rows.forEach((row) => {
    lines.push(row.map(escapeCsvValue).join(','));
  });

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

function normalizeEcgValue(value, leadsOk = true, modeCode = null) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;

  // Treat lead-off / missing samples as null.
  if (leadsOk === false) return null;
  if (numeric === 0) return null;

  const mode = Number(modeCode);

  // If the sensor says it already sends filtered AC mV (centered around 0), keep it.
  if (mode === ECG_MODE_AC) {
    return numeric;
  }

  // Heuristic fallback (legacy streams without mode).
  if (numeric < 0) return numeric;
  if (Math.abs(numeric) <= ECG_AC_DETECT_ABS_MAX_MV && numeric !== 3300) return numeric;

  // Otherwise assume raw 0..3300mV from ADC.
  if (numeric <= ECG_LEADOFF_THRESHOLD) return null;
  const clamped = Math.max(0, Math.min(3300, numeric));
  // If the ADC/analog front-end saturates, treat it as an artifact.
  if (clamped <= 5 || clamped >= 3295) return null;
  return ECG_INVERT_DISPLAY ? (3300 - clamped) : clamped;
}

function normalizeTemperatureValue(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;

  // DS18B20 can briefly report 85.0°C on power-up or during bus glitches.
  // Keep only obvious sensor errors out of the chart; low ambient values are still valid.
  if (numeric === 85 || numeric === -127 || numeric < 5 || numeric > 45) return null;

  return Math.round(numeric * 10) / 10;
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function quantile(values, q) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * Math.max(0, Math.min(1, q));
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

function robustClipSeries(values) {
  if (!values.length) return values;
  const med = median(values);
  const absDeviations = values.map((v) => Math.abs(v - med));
  const mad = median(absDeviations);

  // Convert MAD to a robust sigma estimate; keep a minimum for very flat windows.
  const robustSigma = Math.max(1.5, mad * 1.4826);
  const limit = robustSigma * 4.5;
  const min = med - limit;
  const max = med + limit;

  return values.map((v) => Math.max(min, Math.min(max, v)));
}

function percentileClipSeries(values, lowQ = 0.005, highQ = 0.995) {
  if (!values.length) return values;
  const low = quantile(values, lowQ);
  const high = quantile(values, highQ);
  return values.map((v) => Math.max(low, Math.min(high, v)));
}

function toOddWindowBySeconds(sampleRateHz, seconds, minSize = 3, maxSize = 401) {
  const raw = Math.round(sampleRateHz * Math.max(0, seconds));
  const bounded = Math.max(minSize, Math.min(maxSize, raw));
  return bounded % 2 === 0 ? bounded + 1 : bounded;
}

function medianFilter3(values) {
  if (values.length < 3) return values;
  const out = [...values];
  for (let i = 1; i < values.length - 1; i += 1) {
    const a = values[i - 1];
    const b = values[i];
    const c = values[i + 1];
    out[i] = median([a, b, c]);
  }
  return out;
}

function estimateSamplingRateHz(data) {
  const ts = data
    .map((p) => toTimestampMs(p.ts))
    .filter((v) => Number.isFinite(v));

  if (ts.length < 6) return ECG_DEFAULT_SAMPLE_RATE_HZ;

  const diffs = [];
  for (let i = 1; i < ts.length; i += 1) {
    const dt = ts[i] - ts[i - 1];
    if (dt > 0 && dt < 1000) diffs.push(dt);
  }

  if (!diffs.length) return ECG_DEFAULT_SAMPLE_RATE_HZ;
  const dtMs = median(diffs);
  const hz = 1000 / dtMs;
  if (!Number.isFinite(hz)) return ECG_DEFAULT_SAMPLE_RATE_HZ;
  return Math.max(80, Math.min(500, hz));
}

function applyNotchFilter(values, sampleRateHz, notchHz = ECG_NOTCH_FREQ_HZ) {
  if (!values.length || sampleRateHz < (notchHz * 2.2)) return values;

  const w0 = (2 * Math.PI * notchHz) / sampleRateHz;
  const cosW0 = Math.cos(w0);
  const r = 0.985;

  const b0 = 1;
  const b1 = -2 * cosW0;
  const b2 = 1;
  const a1 = -2 * r * cosW0;
  const a2 = r * r;

  const out = new Array(values.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;

  for (let i = 0; i < values.length; i += 1) {
    const x0 = values[i];
    const y0 = (b0 * x0) + (b1 * x1) + (b2 * x2) - (a1 * y1) - (a2 * y2);
    out[i] = y0;

    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
  }

  return out;
}

function makeSteps(start, end, step) {
  if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(step) || step <= 0) {
    return [];
  }

  const out = [];
  const first = Math.ceil(start / step) * step;
  for (let v = first; v <= end + 1e-9; v += step) {
    out.push(Math.round(v * 1000) / 1000);
  }
  return out;
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

function applyLowpassFilter(values, sampleRateHz, cutoffHz = ECG_DISPLAY_LOWPASS_HZ) {
  if (!values.length || !Number.isFinite(sampleRateHz) || sampleRateHz <= 1) return values;
  if (!Number.isFinite(cutoffHz) || cutoffHz <= 0) return values;

  const dt = 1 / sampleRateHz;
  const rc = 1 / (2 * Math.PI * cutoffHz);
  const alpha = dt / (rc + dt);
  if (!Number.isFinite(alpha) || alpha <= 0 || alpha >= 1) return values;

  const out = new Array(values.length);
  out[0] = values[0];
  for (let i = 1; i < values.length; i += 1) {
    out[i] = out[i - 1] + (alpha * (values[i] - out[i - 1]));
  }
  return out;
}

function limitSeriesSlope(values, maxStep) {
  if (!values.length || !Number.isFinite(maxStep) || maxStep <= 0) return values;
  const out = [...values];
  for (let i = 1; i < out.length; i += 1) {
    const delta = out[i] - out[i - 1];
    if (delta > maxStep) {
      out[i] = out[i - 1] + maxStep;
    } else if (delta < -maxStep) {
      out[i] = out[i - 1] - maxStep;
    }
  }
  return out;
}

function clampSymmetric(value, limit) {
  if (!Number.isFinite(value) || !Number.isFinite(limit) || limit <= 0) return value;
  return Math.max(-limit, Math.min(limit, value));
}

function softClip(value, limit) {
  if (!Number.isFinite(value) || !Number.isFinite(limit) || limit <= 0) return value;
  // Smooth compression: keeps morphology but prevents hard saturation lines.
  return limit * Math.tanh(value / limit);
}

function despikeHold(values, limitAbs) {
  if (!values.length || !Number.isFinite(limitAbs) || limitAbs <= 0) return values;
  const out = new Array(values.length);
  let lastGood = 0;
  for (let i = 0; i < values.length; i += 1) {
    const v = values[i];
    if (!Number.isFinite(v)) {
      out[i] = lastGood;
      continue;
    }
    if (Math.abs(v) > limitAbs) {
      out[i] = lastGood;
      continue;
    }
    out[i] = v;
    lastGood = v;
  }
  return out;
}

function detectRPeaks(values, sampleRateHz) {
  if (!values.length || !Number.isFinite(sampleRateHz) || sampleRateHz <= 1) return [];
  const abs = values.map((v) => Math.abs(v));
  const robust = quantile(abs, 0.985);
  if (!Number.isFinite(robust) || robust <= 0) return [];

  // Peak threshold: high enough to prefer QRS over P/T.
  const thr = Math.max(robust * 1.8, 0.08);
  const refractory = Math.round(sampleRateHz * 0.25);
  const peaks = [];

  let i = 2;
  while (i < values.length - 2) {
    const v = values[i];
    if (v > thr && v >= values[i - 1] && v >= values[i + 1]) {
      // local max; refine to true max within a short neighborhood
      let bestI = i;
      let bestV = v;
      const end = Math.min(values.length - 1, i + Math.round(sampleRateHz * 0.04));
      for (let j = i + 1; j <= end; j += 1) {
        if (values[j] > bestV) {
          bestV = values[j];
          bestI = j;
        }
      }
      peaks.push(bestI);
      i = bestI + refractory;
      continue;
    }
    i += 1;
  }
  return peaks;
}

function synthEcgTemplate(phase01) {
  // phase01 in [0,1). A simple sum of gaussians resembling P-QRS-T.
  const p = phase01;
  const gauss = (x, mu, sigma) => {
    const z = (x - mu) / sigma;
    return Math.exp(-0.5 * z * z);
  };

  const pWave = 0.12 * gauss(p, 0.18, 0.035);
  const qWave = -0.15 * gauss(p, 0.30, 0.010);
  const rWave = 1.00 * gauss(p, 0.32, 0.008);
  const sWave = -0.25 * gauss(p, 0.35, 0.012);
  const tWave = 0.33 * gauss(p, 0.62, 0.060);
  return pWave + qWave + rWave + sWave + tWave;
}

function synthesizeEcgLike(valuesCount, sampleRateHz, xSecList, rrSec, alignXSec, amplitudeMv) {
  const rr = Math.max(0.45, Math.min(1.6, rrSec || 0.86));
  const amp = Math.max(0.2, Math.min(1.8, amplitudeMv || 1.0));
  const out = new Array(valuesCount);

  for (let i = 0; i < valuesCount; i += 1) {
    const x = Number.isFinite(xSecList?.[i]) ? xSecList[i] : (i / sampleRateHz);
    // alignXSec anchors an R-peak near its observed time.
    const t = (x - (alignXSec || 0));
    const phase = ((t % rr) + rr) % rr;
    const p = phase / rr;
    out[i] = amp * synthEcgTemplate(p);
  }
  return out;
}

function computeMixAmount({ robustHalfSpan, artifactRate }) {
  // 0..~0.35, higher when signal has usable amplitude and few artifacts.
  const ampScore = clamp((Number(robustHalfSpan) - 0.08) / 0.30, 0, 1);
  const cleanScore = clamp(1 - (Number(artifactRate) * 3.0), 0, 1);
  return 0.35 * ampScore * cleanScore;
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return value;
  return Math.max(min, Math.min(max, value));
}

function ewma(prev, next, alpha) {
  if (!Number.isFinite(next)) return prev;
  if (!Number.isFinite(prev)) return next;
  const a = clamp(alpha, 0, 1);
  return prev + (a * (next - prev));
}

function isLargeGapMs(prevTs, nextTs, gapMs) {
  if (!Number.isFinite(prevTs) || !Number.isFinite(nextTs)) return false;
  return (nextTs - prevTs) >= gapMs;
}

function preprocessRawEcgToAc(rawMvValues, sampleRateHz) {
  // Convert raw 0..3300mV stream into AC around 0:
  //  - slow baseline tracking (high-pass effect)
  //  - notch 50Hz
  //  - gentle low-pass for display
  if (!rawMvValues.length) return rawMvValues;

  const baseline = applyLowpassFilter(rawMvValues, sampleRateHz, 0.7);
  const centered = rawMvValues.map((v, i) => v - baseline[i]);
  const notched = applyNotchFilter(centered, sampleRateHz, ECG_NOTCH_FREQ_HZ);
  const bandLimited = applyLowpassFilter(notched, sampleRateHz, 28);

  // Very light post-smoothing to reduce quantization noise without killing QRS.
  const postWin = toOddWindowBySeconds(sampleRateHz, ECG_POST_SMOOTH_SEC, 3, 81);
  const smoothed = smoothSeries(bandLimited, postWin);
  return medianFilter3(smoothed);
}

function lockPolarityIfNeeded(state, centeredValues) {
  if (!state || state.polarityLocked) return;
  if (!centeredValues.length) return;

  const absValues = centeredValues.map((v) => Math.abs(v));
  const robustHalfSpan = quantile(absValues, 0.985);
  if (!Number.isFinite(robustHalfSpan) || robustHalfSpan < 0.08) return;

  const qHigh = quantile(centeredValues, 0.995);
  const qLow = quantile(centeredValues, 0.005);
  const shouldInvert = Math.abs(qLow) > (Math.abs(qHigh) * 1.15);
  state.invert = shouldInvert;
  state.polarityLocked = true;
}

function buildEcgDisplay(data, displayState = null) {
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

  const state = displayState || null;
  const sampleRateHz = estimateSamplingRateHz(data);
  const rawValues = data.map((p) => p.value);
  const minVal = rawValues.length ? Math.min(...rawValues) : 0;
  const maxVal = rawValues.length ? Math.max(...rawValues) : 0;
  const lastMode = Number(data[data.length - 1]?.mode);
  const inputLooksAc = lastMode === ECG_MODE_AC || minVal < 0 || (maxVal <= ECG_AC_DETECT_ABS_MAX_MV && minVal >= -ECG_AC_DETECT_ABS_MAX_MV);

  // Always render as AC mV (around 0). If stream is raw, compute AC in frontend.
  const acValues = inputLooksAc
    ? rawValues
    : preprocessRawEcgToAc(rawValues, sampleRateHz);

  const spikeLimited = limitSeriesSlope(acValues, ECG_SPIKE_MAX_STEP);
  const center = median(spikeLimited);
  const clippedCentered = spikeLimited.map((v) => v - center);

  if (state) {
    lockPolarityIfNeeded(state, clippedCentered);
  }
  const invert = state ? (state.invert === true) : false;
  const oriented = invert ? clippedCentered.map((v) => -v) : clippedCentered;

  const absValues = oriented.map((v) => Math.abs(v));
  // Use a high quantile (captures narrow QRS peaks) for stable gain.
  const robustHalfSpan = quantile(absValues, 0.985);
  // Use percentile peak estimate to avoid rare outliers collapsing zoom.
  const peakHalfSpan = quantile(absValues, 0.999);
  const displayLimit = ECG_FIXED_Y_LIMIT_MV;

  // Despike based on robust amplitude so frequent artifacts don't inflate the threshold.
  const artifactLimit = Math.max(ECG_ARTIFACT_ABS_MIN_MV, robustHalfSpan * ECG_ARTIFACT_MULT);
  const artifactCount = oriented.reduce((acc, v) => (Math.abs(v) > artifactLimit ? acc + 1 : acc), 0);
  const artifactRate = oriented.length ? (artifactCount / oriented.length) : 0;
  const cleaned = despikeHold(oriented, artifactLimit);

  // Auto-scale the display to keep the trace readable without needing manual zoom.
  const targetHalfSpan = ECG_TARGET_HALF_SPAN_MV;
  const effectiveGain = Math.max(0.002, Math.min(12, targetHalfSpan / Math.max(robustHalfSpan, 0.05)));
  if (state) {
    const nextTs = toTimestampMs(data[data.length - 1]?.ts) || Date.now();
    state.lastTs = nextTs;
  }

  const quality = robustHalfSpan < ECG_MIN_USEFUL_HALF_SPAN_MV ? 'Semnal slab' : 'Semnal util';
  const amplifiedRaw = cleaned.map((v) => v * effectiveGain);
  const amplifiedCenter = median(amplifiedRaw);
  const centeredAmplified = amplifiedRaw.map((v) => v - amplifiedCenter);
  const slopeLimited = limitSeriesSlope(centeredAmplified, ECG_DISPLAY_MAX_STEP_MV);
  const amplified = slopeLimited.map((v) => softClip(v, displayLimit));

  const withTime = data.map((p, i) => ({
    ...p,
    xSec: Number.isFinite(toTimestampMs(p.ts))
      ? ((toTimestampMs(p.ts) - (toTimestampMs(data[data.length - 1]?.ts) || toTimestampMs(p.ts))) / 1000)
      : -((data.length - 1 - i) / sampleRateHz),
    value: amplified[i],
  }));

  const chartDataBase = withTime
    .filter((p) => p.xSec >= -ECG_DISPLAY_WINDOW_SEC && p.xSec <= 0)
    .sort((a, b) => a.xSec - b.xSec);

  const chartData = chartDataBase.map((p, i) => ({
    ...p,
    value: p.value,
  }));

  const displayHalfSpan = Math.max(0.5, Math.min(10, peakHalfSpan * effectiveGain * 1.1));
  const margin = Math.max(0.25, displayHalfSpan * 0.15);
  const dynamicLimit = Math.max(1.0, Math.round((displayHalfSpan + margin) * 10) / 10);
  const limit = ECG_LOCK_Y_DOMAIN ? Math.min(displayLimit, dynamicLimit) : dynamicLimit;
  const ySpan = limit * 2;
  const majorY = ySpan / 8;
  const minorY = majorY / 5;

  return {
    chartData,
    yDomain: [-limit, limit],
    xDomain: [-ECG_DISPLAY_WINDOW_SEC, 0],
    sampleRateHz,
    yLabel: 'mV (AC)',
    baseline: 0,
    quality,
    gain: effectiveGain,
    halfSpan: limit,
    majorVerticals: makeSteps(-ECG_DISPLAY_WINDOW_SEC, 0, ECG_GRID_MAJOR_TIME_SEC),
    minorVerticals: makeSteps(-ECG_DISPLAY_WINDOW_SEC, 0, ECG_GRID_MINOR_TIME_SEC),
    majorHorizontals: makeSteps(-limit, limit, majorY),
    minorHorizontals: makeSteps(-limit, limit, minorY),
  };
}

export default function SenzoriLive() {
  const theme = useTheme();
  const currentUser = useMemo(() => {
    try {
      return JSON.parse(sessionStorage.getItem('user') || '{}');
    } catch {
      return {};
    }
  }, []);
  const isPacient = currentUser?.role === 'pacient';
  const ownPatient = useMemo(() => {
    if (!isPacient || !currentUser?.id) return null;
    return {
      id: Number(currentUser.id),
      prenume: currentUser.prenume || '',
      nume: currentUser.nume || '',
      email: currentUser.email || '',
      active_sessions_count: 1,
    };
  }, [isPacient, currentUser]);

  const [activeTab, setActiveTab] = useState('all');
  const [connected, setConnected] = useState(false);
  const [sensorStatus, setSensorStatus] = useState({});
  const { lang, locale } = useLanguage();
  const isEnglish = lang === 'en';
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
  const [sessionSensorsEnabled, setSessionSensorsEnabled] = useState({
    ecg: false,
    puls: false,
    temperatura: false,
  });
  const [sessionSensorStartAt, setSessionSensorStartAt] = useState({
    ecg: null,
    puls: null,
    temperatura: null,
  });
  const [loadingControl, setLoadingControl] = useState({});
  
  // Pacienți și sesiuni
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [patientHasAssignment, setPatientHasAssignment] = useState(false);
  const [patientAssignmentLoaded, setPatientAssignmentLoaded] = useState(false);
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
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historySnapshot, setHistorySnapshot] = useState({
    ecg: [],
    puls: [],
    temperatura: [],
  });
  const [historyVisibleCounts, setHistoryVisibleCounts] = useState({
    ecg: HISTORY_PAGE_SIZE,
    puls: HISTORY_PAGE_SIZE,
    temperatura: HISTORY_PAGE_SIZE,
  });
  const [historyRange, setHistoryRange] = useState('7d');
  const [historyFrom, setHistoryFrom] = useState('');
  const [historyTo, setHistoryTo] = useState('');
  
  const socketRef = useRef(null);
  const ecgBufferRef = useRef([]);
  const ecgSampleIndexRef = useRef(0);
  const ecgPausedRef = useRef(false);
  const selectedPatientRef = useRef(null);
  const sessionSensorsEnabledRef = useRef({ ecg: false, puls: false, temperatura: false });
  const sessionSensorStartAtRef = useRef({ ecg: null, puls: null, temperatura: null });
  const sensorsRunningRef = useRef({ ecg: false, puls: false, temperatura: false });

  useEffect(() => {
    ecgPausedRef.current = ecgPaused;
  }, [ecgPaused]);

  useEffect(() => {
    sessionSensorsEnabledRef.current = sessionSensorsEnabled;
  }, [sessionSensorsEnabled]);

  useEffect(() => {
    sessionSensorStartAtRef.current = sessionSensorStartAt;
  }, [sessionSensorStartAt]);

  useEffect(() => {
    sensorsRunningRef.current = sensorsRunning;
  }, [sensorsRunning]);

  const showToast = useCallback((message, severity = 'info') => {
    setToast({ open: true, message, severity });
  }, []);

  const beginCurrentSessionForSensor = useCallback((sensorType) => {
    const now = Date.now();
    setSessionSensorsEnabled((prev) => ({ ...prev, [sensorType]: true }));
    setSessionSensorStartAt((prev) => ({ ...prev, [sensorType]: now }));
  }, []);

  const isReadingAllowedForCurrentSession = useCallback((sensorType, readingTimestamp) => {
    const enabled = Boolean(sessionSensorsEnabledRef.current?.[sensorType]);
    const running = Boolean(sensorsRunningRef.current?.[sensorType]);
    if (!enabled && !running) return false;

    // ECG packets can carry device timestamps with drift/low precision.
    // Gate ECG only by current session state to avoid intermittent chart freeze.
    if (sensorType === 'ecg') return true;

    const startedAt = sessionSensorStartAtRef.current?.[sensorType];
    if (!startedAt) return true;

    if (!readingTimestamp) return true;

    const readingTime = new Date(readingTimestamp).getTime();
    if (!Number.isFinite(readingTime)) return true;
    return readingTime + SENSOR_READING_CLOCK_SKEW_TOLERANCE_MS >= startedAt;
  }, []);

  const handleStartSensors = async (sensorType) => {
    try {
      if (isPacient && !patientHasAssignment) {
        showToast('Nu puteți porni senzorii până când medicul nu vă asignează dispozitivul', 'warning');
        return;
      }
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
        beginCurrentSessionForSensor(sensorType);
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
        setSessionSensorsEnabled((prev) => ({ ...prev, [sensorType]: false }));
        setSessionSensorStartAt((prev) => ({ ...prev, [sensorType]: null }));
        setSensorStatus((prev) => ({
          ...prev,
          [sensorType]: {
            ...(prev[sensorType] || {}),
            online: false,
          },
        }));
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

  const checkSensorsRunning = useCallback(async () => {
    try {
      const response = await api.get('/sensors/running');
      const nextRunning = response?.data?.running || { ecg: false, puls: false, temperatura: false };
      setSensorsRunning(nextRunning);
      setSessionSensorsEnabled((prev) => ({
        ecg: Boolean(nextRunning.ecg),
        puls: Boolean(nextRunning.puls),
        temperatura: Boolean(nextRunning.temperatura),
      }));
      setSessionSensorStartAt((prev) => ({
        ecg: nextRunning.ecg ? (prev.ecg || Date.now()) : null,
        puls: nextRunning.puls ? (prev.puls || Date.now()) : null,
        temperatura: nextRunning.temperatura ? (prev.temperatura || Date.now()) : null,
      }));
    } catch (err) {
      console.error('Eroare verificare status:', err);
    }
  }, []);

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
          leads_ok: Number(r.value_1) !== 0,
          mode: Number(r.value_2),
          value: normalizeEcgValue(r.value_1, Number(r.value_1) !== 0, r.value_2),
          ts: toTimestampMs(r.created_at),
        }))
        .filter((r) => r.value !== null)
        .map((r, idx) => ({
          idx,
          value: r.value,
          leads_ok: r.leads_ok,
          ts: r.ts,
          mode: r.mode,
        }))
        .slice(-MAX_ECG_POINTS);

      const nextPulse = (pulsRes.data.readings || []).map((r) => ({
        time: new Date(r.created_at).toLocaleTimeString(locale),
        hr: r.value_1,
      })).slice(-MAX_VITAL_POINTS);

      const nextTemp = (tempRes.data.readings || []).map((r) => ({
        time: new Date(r.created_at).toLocaleTimeString(locale),
        temp: normalizeTemperatureValue(r.value_1),
      })).filter((r) => r.temp !== null).slice(-MAX_VITAL_POINTS);

      ecgBufferRef.current = nextEcg;
      ecgSampleIndexRef.current = nextEcg.length ? (nextEcg[nextEcg.length - 1].idx + 1) : 0;
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

    sessionStorage.setItem(MONITORING_STATUS_KEY, JSON.stringify(payload));
    localStorage.removeItem(MONITORING_STATUS_KEY);
    window.dispatchEvent(new Event('monitoring-status-changed'));
  }, [connected, selectedPatient?.id, selectedPatient?.prenume, selectedPatient?.nume]);

  useEffect(() => {
    checkSensorsRunning();
    if (isPacient) {
      const loadPatientAssignment = async () => {
        try {
          const response = await api.get('/sensors/sessions', {
            params: { status: 'activa' }
          });
          const sessions = response.data.sessions || [];
          const hasAssignment = sessions.length > 0;
          setPatientHasAssignment(hasAssignment);

          if (ownPatient) {
            const patientWithAssignment = {
              ...ownPatient,
              active_sessions_count: hasAssignment ? sessions.length : 0,
              sensor_types: sessions.map((s) => s.sensor_type).filter(Boolean).join(','),
            };
            setPatients([patientWithAssignment]);
            setAllPatients([patientWithAssignment]);
            setSelectedPatient(patientWithAssignment);
          }
        } catch (err) {
          console.error('Eroare verificare asignare pacient:', err);
          setPatientHasAssignment(false);
          if (ownPatient) {
            const fallbackPatient = {
              ...ownPatient,
              active_sessions_count: 0,
              sensor_types: '',
            };
            setPatients([fallbackPatient]);
            setAllPatients([fallbackPatient]);
            setSelectedPatient(fallbackPatient);
          }
        } finally {
          setPatientAssignmentLoaded(true);
        }
      };

      loadPatientAssignment();
      return;
    }
    fetchPatients();
    fetchAllPatients();
  }, []);

  useEffect(() => {
    const intervalId = setInterval(() => {
      checkSensorsRunning();
    }, 3000);

    return () => clearInterval(intervalId);
  }, [checkSensorsRunning]);

  useEffect(() => {
    const handleSensorsControlAction = (event) => {
      const detail = event?.detail || {};
      const action = detail.action;
      const sensorTypes = Array.isArray(detail.sensorTypes) && detail.sensorTypes.length
        ? detail.sensorTypes
        : ['ecg', 'puls', 'temperatura'];

      if (!action || !selectedPatientRef.current?.id) return;

      const actionPacientId = Number(detail.pacientId);
      const selectedId = Number(selectedPatientRef.current.id);
      if (Number.isFinite(actionPacientId) && actionPacientId > 0 && actionPacientId !== selectedId) {
        return;
      }

      if (action === 'start') {
        const startedAt = Date.now();
        setSessionSensorsEnabled((prev) => {
          const next = { ...prev };
          sensorTypes.forEach((type) => { next[type] = true; });
          return next;
        });
        setSessionSensorStartAt((prev) => {
          const next = { ...prev };
          sensorTypes.forEach((type) => { next[type] = startedAt; });
          return next;
        });
        setSensorsRunning((prev) => {
          const next = { ...prev };
          sensorTypes.forEach((type) => { next[type] = true; });
          return next;
        });
        setSensorStatus((prev) => {
          const next = { ...prev };
          sensorTypes.forEach((type) => {
            next[type] = {
              ...(next[type] || {}),
              online: true,
            };
          });
          return next;
        });
      }

      if (action === 'stop') {
        setSessionSensorsEnabled((prev) => {
          const next = { ...prev };
          sensorTypes.forEach((type) => { next[type] = false; });
          return next;
        });
        setSessionSensorStartAt((prev) => {
          const next = { ...prev };
          sensorTypes.forEach((type) => { next[type] = null; });
          return next;
        });
        setSensorStatus((prev) => {
          const next = { ...prev };
          sensorTypes.forEach((type) => {
            next[type] = {
              ...(next[type] || {}),
              online: false,
            };
          });
          return next;
        });
        setSensorsRunning((prev) => {
          const next = { ...prev };
          sensorTypes.forEach((type) => { next[type] = false; });
          return next;
        });
      }

      checkSensorsRunning();
    };

    window.addEventListener(SENSORS_CONTROL_EVENT, handleSensorsControlAction);
    return () => {
      window.removeEventListener(SENSORS_CONTROL_EVENT, handleSensorsControlAction);
    };
  }, [checkSensorsRunning]);

  useEffect(() => {
    if (!selectedPatient?.id) {
      handleRefresh();
      setSessionSensorsEnabled({ ecg: false, puls: false, temperatura: false });
      setSessionSensorStartAt({ ecg: null, puls: null, temperatura: null });
      return;
    }

    handleRefresh();
    setSessionSensorsEnabled({ ecg: false, puls: false, temperatura: false });
    setSessionSensorStartAt({ ecg: null, puls: null, temperatura: null });
  }, [selectedPatient?.id]);

  const appendEcgPoint = useCallback((value, leadsOk = true, timestamp = null, mode = null) => {
    if (ecgPausedRef.current) return;
    if (!leadsOk) return;

    const prevPoint = ecgBufferRef.current[ecgBufferRef.current.length - 1];

    const prevTs = toTimestampMs(prevPoint?.ts);
    let plotTs = toTimestampMs(timestamp);
    if (!Number.isFinite(plotTs)) {
      plotTs = Number.isFinite(prevTs) ? (prevTs + ECG_MIN_SAMPLE_INTERVAL_MS) : Date.now();
    } else if (Number.isFinite(prevTs) && plotTs <= prevTs) {
      // Ensure strictly increasing timestamps for stable X-axis progression.
      plotTs = prevTs + ECG_MIN_SAMPLE_INTERVAL_MS;
    }

    const nextPoint = {
      idx: ecgSampleIndexRef.current,
      value,
      leads_ok: leadsOk,
      ts: plotTs,
      mode,
    };
    ecgSampleIndexRef.current += 1;
    ecgBufferRef.current = [...ecgBufferRef.current, nextPoint].slice(-MAX_ECG_POINTS);
    setEcgData([...ecgBufferRef.current]);
  }, []);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['polling', 'websocket'],
      upgrade: true,
      reconnection: true,
      reconnectionDelay: 2000,
      timeout: 10000,
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

      if (!isReadingAllowedForCurrentSession(data.sensor_type, data.timestamp)) {
        return;
      }

      if (data.sensor_type === 'ecg') {
        if (data.leads_ok === false) return;
        const ecgValue = normalizeEcgValue(data.value_1, data.leads_ok !== false, data.value_2);
        if (ecgValue === null) return;
        appendEcgPoint(ecgValue, true, data.timestamp, Number(data.value_2));
      } else if (data.sensor_type === 'puls') {
        setLatestPulse({ hr: data.value_1 });
        setPulseData(prev => {
          const next = [...prev, {
            time: new Date(data.timestamp).toLocaleTimeString(locale),
            hr: data.value_1,
          }];
          return next.slice(-MAX_VITAL_POINTS);
        });
      } else if (data.sensor_type === 'temperatura') {
        const tempValue = normalizeTemperatureValue(data.value_1);
        if (tempValue === null) return;
        setLatestTemp(tempValue);
        setTempData(prev => {
          const next = [...prev, {
            time: new Date(data.timestamp).toLocaleTimeString(locale),
            temp: tempValue,
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
          .filter((r) => isReadingAllowedForCurrentSession('ecg', r.timestamp || data.timestamp))
          .filter((r) => r.leads_ok !== false)
          .map((r) => ({
            mode: Number(r.value_2),
            value: normalizeEcgValue(r.value_1, r.leads_ok !== false && Number(r.value_1) !== 0, r.value_2),
            leads_ok: r.leads_ok !== false,
            ts: r.timestamp || data.timestamp,
          }))
          .filter((r) => r.value !== null)
          .forEach((r) => appendEcgPoint(r.value, r.leads_ok, r.ts, r.mode));
      } else if (data.sensor_type === 'puls') {
        setPulseData(prev => {
          const next = [...prev];
          data.readings
            .filter((r) => isReadingAllowedForCurrentSession('puls', r.timestamp || data.timestamp))
            .forEach(r => {
            next.push({
              time: new Date(r.timestamp).toLocaleTimeString(locale),
              hr: r.value_1,
            });
          });
          return next.slice(-MAX_VITAL_POINTS);
        });
        const allowedReadings = data.readings.filter((r) => isReadingAllowedForCurrentSession('puls', r.timestamp || data.timestamp));
        if (allowedReadings.length > 0) {
          setLatestPulse({ hr: allowedReadings[allowedReadings.length - 1].value_1 });
        }
      } else if (data.sensor_type === 'temperatura') {
        setTempData(prev => {
          const next = [...prev];
          data.readings
            .filter((r) => isReadingAllowedForCurrentSession('temperatura', r.timestamp || data.timestamp))
            .map((r) => ({
              timestamp: r.timestamp,
              temp: normalizeTemperatureValue(r.value_1),
            }))
            .filter((r) => r.temp !== null)
            .forEach(r => {
            next.push({
              time: new Date(r.timestamp).toLocaleTimeString(locale),
              temp: r.temp,
            });
          });
          return next.slice(-MAX_VITAL_POINTS);
        });
        const allowedReadings = data.readings.filter((r) => isReadingAllowedForCurrentSession('temperatura', r.timestamp || data.timestamp));
        const lastValidTemp = [...allowedReadings]
          .map((r) => normalizeTemperatureValue(r.value_1))
          .filter((temp) => temp !== null)
          .pop();
        if (lastValidTemp !== undefined) {
          setLatestTemp(lastValidTemp);
        }
      }
    });
    return () => {
      socket.emit('unsubscribe_sensor', 'ecg');
      socket.emit('unsubscribe_sensor', 'puls');
      socket.emit('unsubscribe_sensor', 'temperatura');
      socket.disconnect();
    };
  }, [appendEcgPoint, isReadingAllowedForCurrentSession]);

  const isSensorOnline = (type) => Boolean(sensorStatus[type]?.online || sensorsRunning[type]);

  const handleRefresh = () => {
    setEcgData([]);
    setPulseData([]);
    setTempData([]);
    ecgBufferRef.current = [];
    ecgSampleIndexRef.current = 0;
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

  const loadDetailedHistoryForDialog = async (pacientId, range = historyRange, customFrom = historyFrom, customTo = historyTo) => {
    if (!pacientId) return;

    const bounds = getHistoryRangeBounds(range, customFrom, customTo);

    if (range === 'custom') {
      if (!bounds.from || !bounds.to) {
        showToast('Completează intervalul personalizat (de la / până la)', 'warning');
        return;
      }
      if (new Date(bounds.from) > new Date(bounds.to)) {
        showToast('Interval invalid: data de început trebuie să fie înainte de data de sfârșit', 'warning');
        return;
      }
    }

    setHistoryLoading(true);
    try {
      const [ecgRes, pulsRes, tempRes] = await Promise.all([
        api.get('/sensors/history/ecg', {
          params: {
            pacient_id: pacientId,
            from: bounds.from,
            to: bounds.to,
            limit: HISTORY_LIMITS.ecg,
          }
        }),
        api.get('/sensors/history/puls', {
          params: {
            pacient_id: pacientId,
            from: bounds.from,
            to: bounds.to,
            limit: HISTORY_LIMITS.puls,
          }
        }),
        api.get('/sensors/history/temperatura', {
          params: {
            pacient_id: pacientId,
            from: bounds.from,
            to: bounds.to,
            limit: HISTORY_LIMITS.temperatura,
          }
        }),
      ]);

      setHistorySnapshot({
        ecg: ecgRes.data.readings || [],
        puls: pulsRes.data.readings || [],
        temperatura: tempRes.data.readings || [],
      });
      setHistoryVisibleCounts({
        ecg: HISTORY_PAGE_SIZE,
        puls: HISTORY_PAGE_SIZE,
        temperatura: HISTORY_PAGE_SIZE,
      });
    } catch (err) {
      console.error('Eroare încărcare istoric detaliat:', err);
      showToast('Nu am putut încărca istoricul pacientului', 'error');
      setHistorySnapshot({ ecg: [], puls: [], temperatura: [] });
      setHistoryVisibleCounts({
        ecg: HISTORY_PAGE_SIZE,
        puls: HISTORY_PAGE_SIZE,
        temperatura: HISTORY_PAGE_SIZE,
      });
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleLoadMoreHistory = (sensorType) => {
    setHistoryVisibleCounts((prev) => ({
      ...prev,
      [sensorType]: prev[sensorType] + HISTORY_PAGE_SIZE,
    }));
  };

  const handleExportSensorCsv = (sensorType) => {
    const rows = historySnapshot[sensorType] || [];
    if (!rows.length || !selectedPatient) {
      showToast('Nu există date pentru export', 'warning');
      return;
    }

    const fileSafePatient = `${selectedPatient.prenume || ''}_${selectedPatient.nume || ''}`
      .trim()
      .replace(/\s+/g, '_')
      .toLowerCase();

    const csvRows = rows.map((r) => [
      r.id,
      r.sensor_type,
      r.pacient_id,
      r.value_1,
      r.value_2,
      r.device_id,
      r.created_at,
    ]);

    downloadCsv(
      `${fileSafePatient || 'pacient'}_${sensorType}_${historyRange}.csv`,
      ['id', 'sensor_type', 'pacient_id', 'value_1', 'value_2', 'device_id', 'created_at'],
      csvRows
    );
  };

  const handleExportAllHistoryCsv = () => {
    const mergedRows = ['ecg', 'puls', 'temperatura']
      .flatMap((type) => (historySnapshot[type] || []).map((r) => ({ ...r, sensor_type: type })))
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    if (!mergedRows.length || !selectedPatient) {
      showToast('Nu există date pentru export', 'warning');
      return;
    }

    const fileSafePatient = `${selectedPatient.prenume || ''}_${selectedPatient.nume || ''}`
      .trim()
      .replace(/\s+/g, '_')
      .toLowerCase();

    const csvRows = mergedRows.map((r) => [
      r.id,
      r.sensor_type,
      r.pacient_id,
      r.value_1,
      r.value_2,
      r.device_id,
      r.created_at,
    ]);

    downloadCsv(
      `${fileSafePatient || 'pacient'}_istoric_complet_${historyRange}.csv`,
      ['id', 'sensor_type', 'pacient_id', 'value_1', 'value_2', 'device_id', 'created_at'],
      csvRows
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
              {isEnglish ? 'Monitoring session management' : 'Gestionare Sesiuni de Monitorizare'}
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
                        return <Typography variant="body2" color="text.secondary">{isEnglish ? 'Select patient' : 'Selectează pacient'}</Typography>;
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
              {!isPacient && (
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormControl fullWidth size="small" sx={{ minWidth: 220 }}>
                    <Select
                      value={assignmentFilter}
                      onChange={(e) => setAssignmentFilter(e.target.value)}
                    >
                      <MenuItem value="all">{isEnglish ? 'All patients' : 'Toți pacienții'}</MenuItem>
                      <MenuItem value="assigned">{isEnglish ? 'Assigned patients only' : 'Doar pacienții asignați'}</MenuItem>
                      <MenuItem value="unassigned">{isEnglish ? 'Unassigned patients only' : 'Doar pacienții neasignați'}</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              )}
            </Grid>

            {!isPacient && (
              <>
                <TextField
                  fullWidth
                  size="small"
                  label={isEnglish ? 'Search patient to assign/unassign' : 'Caută pacient pentru asignare/deasignare'}
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
                            {isAssigned ? (isEnglish ? 'Unassign' : 'Deasignare') : (isEnglish ? 'Assign' : 'Asignare')}
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
                        primary={allPatients.length === 0 ? (isEnglish ? 'No patient found' : 'Niciun pacient găsit') : (isEnglish ? 'No patient for the selected filter' : 'Niciun pacient pentru filtrul selectat')}
                      />
                    </ListItem>
                  )}
                </List>
              </>
            )}

            {isPacient && (
              <Alert severity="info" sx={{ mb: 1.5 }}>
                {patientAssignmentLoaded && !patientHasAssignment
                  ? (isEnglish ? 'Patient account: you do not currently have a device assigned by the doctor. Sensor start is blocked.' : 'Cont pacient: momentan nu aveți un dispozitiv asignat de medic. Pornirea senzorilor este blocată.')
                  : (isEnglish ? 'Patient account: you can only see your own sensor data.' : 'Cont pacient: puteți vedea doar datele proprii ale senzorilor.')}
              </Alert>
            )}

            {patients.length === 0 && !loadingPatients && (
              <Alert severity="info">
                {isEnglish ? 'You have no active monitoring sessions. Assign a device to a patient to see sensor data.' : 'Nu aveți sesiuni de monitorizare active. Asignați un dispozitiv unui pacient pentru a vedea datele senzorilor.'}
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
                  <strong>{isEnglish ? 'Selected patient:' : 'Pacient selectat:'}</strong> {selectedPatient.prenume} {selectedPatient.nume}
                </Typography>
                {!isPacient && (
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<HistoryIcon />}
                    sx={{ mt: 1.25 }}
                    onClick={async () => {
                      setHistoryDialogOpen(true);
                      await loadDetailedHistoryForDialog(selectedPatient.id, historyRange, historyFrom, historyTo);
                    }}
                  >
                    {isEnglish ? 'View patient history' : 'Vezi istoricul pacientului'}
                  </Button>
                )}
              </Paper>
            )}
          </CardContent>
        </Card>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
              {isEnglish ? 'Live Sensor Monitoring' : 'Monitorizare Senzori Live'}
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {isEnglish ? 'Real-time data from Raspberry Pi 5' : 'Date în timp real de la Raspberry Pi 5'}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              icon={<FiberManualRecordIcon sx={{ fontSize: 12 }} />}
              label={connected ? (isEnglish ? 'Connected' : 'Conectat') : (isEnglish ? 'Disconnected' : 'Deconectat')}
              color={connected ? 'success' : 'error'}
              variant="outlined"
              size="small"
            />
            <Tooltip title={Object.values(sensorsRunning).some(v => v) ? (isEnglish ? 'Some sensors are running' : 'Ceva senzori rulează') : (isEnglish ? 'No active sensors' : 'Niciun senzor activ')}>
              <Chip
                icon={<FiberManualRecordIcon sx={{ fontSize: 12 }} />}
                label={Object.values(sensorsRunning).some(v => v) ? (isEnglish ? 'Active sensors' : 'Senzori Activi') : (isEnglish ? 'Inactive sensors' : 'Senzori Inactivi')}
                color={Object.values(sensorsRunning).some(v => v) ? 'success' : 'default'}
                variant="outlined"
                size="small"
              />
            </Tooltip>
            <Tooltip title={isEnglish ? 'Reset data' : 'Resetează datele'}>
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
              disabled={isPacient && patientAssignmentLoaded && !patientHasAssignment}
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
              disabled={isPacient && patientAssignmentLoaded && !patientHasAssignment}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <SensorStatusCard
              icon={<ThermostatIcon sx={{ fontSize: 28 }} />}
              label={isEnglish ? 'Temperature' : 'Temperatură'}
              online={isSensorOnline('temperatura')}
              color="#ff9800"
              sensorType="temperatura"
              onStart={handleStartSensors}
              onStop={handleStopSensors}
              running={sensorsRunning.temperatura}
              loading={loadingControl.temperatura}
              disabled={isPacient && patientAssignmentLoaded && !patientHasAssignment}
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
            <MonitorHeartIcon sx={{ mr: 1 }} /> {isEnglish ? 'All' : 'Toate'}
          </ToggleButton>
          <ToggleButton value="ecg">
            <MonitorHeartIcon sx={{ mr: 1 }} /> ECG
          </ToggleButton>
          <ToggleButton value="puls">
            <FavoriteIcon sx={{ mr: 1 }} /> {isEnglish ? 'Pulse' : 'Puls'}
          </ToggleButton>
          <ToggleButton value="temperatura">
            <ThermostatIcon sx={{ mr: 1 }} /> {isEnglish ? 'Temperature' : 'Temperatură'}
          </ToggleButton>
        </ToggleButtonGroup>

        <Box sx={{ display: activeTab === 'all' ? 'block' : 'none' }}>
          <Grid container spacing={1.5} alignItems="stretch">
            <Grid size={{ xs: 12, md: 6 }} sx={{ display: 'flex' }}>
              <PulseChart data={pulseData} latest={latestPulse} theme={theme} fullHeight isEnglish={isEnglish} compact chartHeight={220} />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }} sx={{ display: 'flex' }}>
              <TempChart data={tempData} latest={latestTemp} theme={theme} fullHeight isEnglish={isEnglish} compact chartHeight={220} />
            </Grid>
          </Grid>
          <Box sx={{ mt: 1.5, width: '100%' }}>
            <ECGChart
              data={ecgData}
              theme={theme}
              paused={ecgPaused}
              onTogglePause={() => setEcgPaused((prev) => !prev)}
              isEnglish={isEnglish}
              compact
              chartHeight={240}
            />
          </Box>
        </Box>

        <Box sx={{ display: activeTab === 'ecg' ? 'block' : 'none' }}>
          <ECGChart
            data={ecgData}
            theme={theme}
            paused={ecgPaused}
            onTogglePause={() => setEcgPaused((prev) => !prev)}
            isEnglish={isEnglish}
          />
        </Box>

        <Box sx={{ display: activeTab === 'puls' ? 'block' : 'none' }}>
          <PulseChart data={pulseData} latest={latestPulse} theme={theme} isEnglish={isEnglish} />
        </Box>

        <Box sx={{ display: activeTab === 'temperatura' ? 'block' : 'none' }}>
          <TempChart data={tempData} latest={latestTemp} theme={theme} isEnglish={isEnglish} />
        </Box>

        <Dialog open={confirmAssignOpen} onClose={() => {
          setConfirmAssignOpen(false);
          setPendingAssignPatientId(null);
          setPendingAssignPatientName('');
        }}>
          <DialogTitle>{isEnglish ? 'Confirm assignment' : 'Confirmare asignare'}</DialogTitle>
          <DialogContent>
            <Typography variant="body2">
              {isEnglish ? 'Are you sure you want to assign the device to patient' : 'Sigur vrei să asignezi dispozitivul pacientului'} <strong>{pendingAssignPatientName}</strong>?
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => {
              setConfirmAssignOpen(false);
              setPendingAssignPatientId(null);
              setPendingAssignPatientName('');
            }}>
              {isEnglish ? 'Cancel' : 'Anulează'}
            </Button>
            <Button
              variant="contained"
              color="success"
              onClick={confirmAssignDevice}
              disabled={Boolean(assigningDevice)}
            >
              {isEnglish ? 'Confirm' : 'Confirmă'}
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={confirmUnassignOpen} onClose={() => setConfirmUnassignOpen(false)}>
          <DialogTitle>{isEnglish ? 'Confirm unassignment' : 'Confirmare deasignare'}</DialogTitle>
          <DialogContent>
            <Typography variant="body2">
              {isEnglish ? 'Are you sure you want to unassign the device from the patient?' : 'Sigur vrei să deasignezi dispozitivul de la pacient?'}
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => {
              setConfirmUnassignOpen(false);
              setPendingUnassignPatientId(null);
            }}>
              {isEnglish ? 'Cancel' : 'Anulează'}
            </Button>
            <Button
              variant="contained"
              color="error"
              onClick={confirmUnassignDevice}
              disabled={Boolean(unassigningPatientId)}
            >
              {isEnglish ? 'Confirm' : 'Confirmă'}
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={historyDialogOpen}
          onClose={() => setHistoryDialogOpen(false)}
          fullWidth
          maxWidth="md"
        >
          <DialogTitle>
            {isEnglish ? 'Patient history: ' : 'Istoric pacient: '}{selectedPatient?.prenume} {selectedPatient?.nume}
          </DialogTitle>
          <DialogContent dividers>
            <Grid container spacing={1.5} sx={{ mb: 2 }}>
              <Grid size={{ xs: 12, md: 3 }}>
                <FormControl fullWidth size="small">
                  <Select
                    value={historyRange}
                    onChange={(e) => setHistoryRange(e.target.value)}
                  >
                    <MenuItem value="24h">{isEnglish ? 'Last 24 hours' : 'Ultimele 24 ore'}</MenuItem>
                    <MenuItem value="7d">{isEnglish ? 'Last 7 days' : 'Ultimele 7 zile'}</MenuItem>
                    <MenuItem value="30d">{isEnglish ? 'Last 30 days' : 'Ultimele 30 zile'}</MenuItem>
                    <MenuItem value="custom">{isEnglish ? 'Custom range' : 'Interval personalizat'}</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              {historyRange === 'custom' && (
                <>
                  <Grid size={{ xs: 12, md: 3 }}>
                    <TextField
                      fullWidth
                      size="small"
                      type="datetime-local"
                      label={isEnglish ? 'From' : 'De la'}
                      InputLabelProps={{ shrink: true }}
                      value={historyFrom}
                      onChange={(e) => setHistoryFrom(e.target.value)}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 3 }}>
                    <TextField
                      fullWidth
                      size="small"
                      type="datetime-local"
                      label={isEnglish ? 'To' : 'Până la'}
                      InputLabelProps={{ shrink: true }}
                      value={historyTo}
                      onChange={(e) => setHistoryTo(e.target.value)}
                    />
                  </Grid>
                </>
              )}
              <Grid size={{ xs: 12, md: historyRange === 'custom' ? 3 : 9 }} sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="contained"
                  onClick={() => loadDetailedHistoryForDialog(selectedPatient?.id, historyRange, historyFrom, historyTo)}
                  disabled={historyLoading || !selectedPatient?.id}
                >
                  {isEnglish ? 'Apply filter' : 'Aplică filtru'}
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<DownloadIcon />}
                  onClick={handleExportAllHistoryCsv}
                  disabled={historyLoading}
                >
                  {isEnglish ? 'Export all data' : 'Export toate datele'}
                </Button>
              </Grid>
            </Grid>

            {historyLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                <CircularProgress size={28} />
              </Box>
            ) : (
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{isEnglish ? 'ECG' : 'ECG'}</Typography>
                    <Button size="small" startIcon={<DownloadIcon />} onClick={() => handleExportSensorCsv('ecg')}>
                      CSV
                    </Button>
                  </Box>
                  <Paper variant="outlined" sx={{ maxHeight: 300, overflowY: 'auto' }}>
                    <List dense>
                      {historySnapshot.ecg.length === 0 && (
                        <ListItem><ListItemText primary={isEnglish ? 'No ECG data' : 'Fără date ECG'} /></ListItem>
                      )}
                      {historySnapshot.ecg.slice().reverse().slice(0, historyVisibleCounts.ecg).map((r) => (
                        <ListItem key={r.id}>
                          <ListItemText
                            primary={`${Number(r.value_1).toFixed(1)} mV`}
                            secondary={new Date(r.created_at).toLocaleString(locale)}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Paper>
                  {historySnapshot.ecg.length > historyVisibleCounts.ecg && (
                    <Button
                      size="small"
                      sx={{ mt: 1 }}
                      onClick={() => handleLoadMoreHistory('ecg')}
                    >
                      {isEnglish ? 'Show more ' : 'Afișează încă '}{Math.min(HISTORY_PAGE_SIZE, historySnapshot.ecg.length - historyVisibleCounts.ecg)}
                    </Button>
                  )}
                  {historySnapshot.ecg.length > 0 && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                      {isEnglish ? 'Shown ' : 'Afișate '}{Math.min(historyVisibleCounts.ecg, historySnapshot.ecg.length)}{isEnglish ? ' of ' : ' din '}{historySnapshot.ecg.length}
                    </Typography>
                  )}
                </Grid>

                <Grid size={{ xs: 12, md: 4 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{isEnglish ? 'Pulse' : 'Puls'}</Typography>
                    <Button size="small" startIcon={<DownloadIcon />} onClick={() => handleExportSensorCsv('puls')}>
                      CSV
                    </Button>
                  </Box>
                  <Paper variant="outlined" sx={{ maxHeight: 300, overflowY: 'auto' }}>
                    <List dense>
                      {historySnapshot.puls.length === 0 && (
                        <ListItem><ListItemText primary={isEnglish ? 'No pulse data' : 'Fără date puls'} /></ListItem>
                      )}
                      {historySnapshot.puls.slice().reverse().slice(0, historyVisibleCounts.puls).map((r) => (
                        <ListItem key={r.id}>
                          <ListItemText
                            primary={`${Number(r.value_1).toFixed(0)} BPM`}
                            secondary={new Date(r.created_at).toLocaleString(locale)}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Paper>
                  {historySnapshot.puls.length > historyVisibleCounts.puls && (
                    <Button
                      size="small"
                      sx={{ mt: 1 }}
                      onClick={() => handleLoadMoreHistory('puls')}
                    >
                      {isEnglish ? 'Show more ' : 'Afișează încă '}{Math.min(HISTORY_PAGE_SIZE, historySnapshot.puls.length - historyVisibleCounts.puls)}
                    </Button>
                  )}
                  {historySnapshot.puls.length > 0 && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                      {isEnglish ? 'Shown ' : 'Afișate '}{Math.min(historyVisibleCounts.puls, historySnapshot.puls.length)}{isEnglish ? ' of ' : ' din '}{historySnapshot.puls.length}
                    </Typography>
                  )}
                </Grid>

                <Grid size={{ xs: 12, md: 4 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{isEnglish ? 'Temperature' : 'Temperatură'}</Typography>
                    <Button size="small" startIcon={<DownloadIcon />} onClick={() => handleExportSensorCsv('temperatura')}>
                      CSV
                    </Button>
                  </Box>
                  <Paper variant="outlined" sx={{ maxHeight: 300, overflowY: 'auto' }}>
                    <List dense>
                      {historySnapshot.temperatura.length === 0 && (
                        <ListItem><ListItemText primary={isEnglish ? 'No temperature data' : 'Fără date temperatură'} /></ListItem>
                      )}
                      {historySnapshot.temperatura.slice().reverse().slice(0, historyVisibleCounts.temperatura).map((r) => (
                        <ListItem key={r.id}>
                          <ListItemText
                            primary={`${Number(r.value_1).toFixed(1)} °C`}
                            secondary={new Date(r.created_at).toLocaleString(locale)}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Paper>
                  {historySnapshot.temperatura.length > historyVisibleCounts.temperatura && (
                    <Button
                      size="small"
                      sx={{ mt: 1 }}
                      onClick={() => handleLoadMoreHistory('temperatura')}
                    >
                      {isEnglish ? 'Show more ' : 'Afișează încă '}{Math.min(HISTORY_PAGE_SIZE, historySnapshot.temperatura.length - historyVisibleCounts.temperatura)}
                    </Button>
                  )}
                  {historySnapshot.temperatura.length > 0 && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                      {isEnglish ? 'Shown ' : 'Afișate '}{Math.min(historyVisibleCounts.temperatura, historySnapshot.temperatura.length)}{isEnglish ? ' of ' : ' din '}{historySnapshot.temperatura.length}
                    </Typography>
                  )}
                </Grid>
              </Grid>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setHistoryDialogOpen(false)}>{isEnglish ? 'Close' : 'Închide'}</Button>
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

function SensorStatusCard({ icon, label, online, color, extra, sensorType, onStart, onStop, running, loading, disabled = false }) {
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
              disabled={loading || disabled}
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
              disabled={loading || disabled}
            >
              Start
            </Button>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}

function ECGChart({ data, theme, paused, onTogglePause, isEnglish, chartHeight = 400, compact = false }) {
  const isDark = theme.palette.mode === 'dark';
  const displayStateRef = useRef({ invert: false, polarityLocked: false, lastTs: NaN });
  const display = useMemo(() => {
    const lastTs = toTimestampMs(data?.[data.length - 1]?.ts);
    const prevTs = Number.isFinite(displayStateRef.current.lastTs) ? displayStateRef.current.lastTs : NaN;
    if (Number.isFinite(lastTs) && isLargeGapMs(prevTs, lastTs, 1500)) {
      displayStateRef.current = { invert: false, polarityLocked: false, lastTs: NaN };
    }
    return buildEcgDisplay(data, displayStateRef.current);
  }, [data]);

  return (
    <Card>
    <CardContent sx={compact ? { py: 1.5, px: 1.5 } : undefined}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            <MonitorHeartIcon sx={{ mr: 1, verticalAlign: 'middle', color: '#f44336' }} />
            {isEnglish ? 'Electrocardiogram (ECG)' : 'Electrocardiogramă (ECG)'}
          </Typography>
          <Button
            size="small"
            variant={paused ? 'contained' : 'outlined'}
            color={paused ? 'warning' : 'primary'}
            onClick={onTogglePause}
            startIcon={paused ? <PlayArrowIcon /> : <PauseIcon />}
          >
            {paused ? (isEnglish ? 'Resume' : 'Reia') : (isEnglish ? 'Pause' : 'Pauză')}
          </Button>
        </Box>
        {data.length > 0 && (
          <Box sx={{ display: 'flex', gap: 1, mb: compact ? 1 : 1.5, flexWrap: 'wrap' }}>
            <Chip
              size="small"
              label={`${isEnglish ? 'Quality' : 'Calitate'}: ${display.quality === 'Semnal util' ? (isEnglish ? 'Useful signal' : 'Semnal util') : (isEnglish ? 'Weak signal' : 'Semnal slab')}`}
              color={display.quality === 'Semnal util' ? 'success' : 'warning'}
              variant="outlined"
            />
            <Chip
              size="small"
              label={`Scară fixă ±${display.halfSpan.toFixed(1)} mV`}
              variant="outlined"
            />
          </Box>
        )}
        {data.length === 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 8 }}>
            <Typography color="text.secondary">
              {isEnglish ? 'Waiting for ECG data from the sensor...' : 'Se așteaptă date ECG de la senzor...'}
            </Typography>
          </Box>
        ) : (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <LineChart data={display.chartData} margin={{ top: 10, right: 8, left: 0, bottom: 10 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.12)'}
              />
              <XAxis
                type="number"
                dataKey="xSec"
                domain={display.xDomain}
                ticks={display.majorVerticals}
                tickFormatter={(v) => `${Math.abs(v).toFixed(1)}s`}
                tick={{ fill: theme.palette.text.secondary, fontSize: 11 }}
                axisLine={{ stroke: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.2)' }}
              />
              <YAxis
                domain={display.yDomain}
                allowDataOverflow
                label={{ value: display.yLabel, angle: -90, position: 'insideLeft' }}
                width={64}
                tickFormatter={(value) => Number(value).toFixed(1)}
                tick={{ fill: theme.palette.text.secondary, fontSize: 12 }}
              />
              <RechartsTooltip
                formatter={(val) => [`${Number(val).toFixed(2)} mV`, isEnglish ? 'Signal' : 'Semnal']}
                labelFormatter={() => ''}
              />
              <ReferenceLine y={display.baseline} stroke="#667" strokeDasharray="5 5" label={isEnglish ? 'Baseline' : 'Linie de bază'} />
              <Line
                type="linear"
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

function PulseChart({ data, latest, theme, fullHeight = false, isEnglish, chartHeight = 300, compact = false }) {
  const isDark = theme.palette.mode === 'dark';
  const displayData = useMemo(() => {
    if (!data || !data.length) return [];
    const enriched = data.map((d) => {
      const ts = Number(d.ts) || (() => {
        try {
          const parsed = Date.parse(new Date().toDateString() + ' ' + String(d.time));
          return Number.isFinite(parsed) ? parsed : Date.now();
        } catch (e) {
          return Date.now();
        }
      })();
      return { ...d, ts };
    });
    const maxTs = Math.max(...enriched.map((d) => d.ts));
    return enriched
      .map((d) => ({ ...d, xSec: (d.ts - maxTs) / 1000 }))
      .filter((d) => Number(d.xSec) >= -60);
  }, [data]);

  return (
    <Box sx={{ width: '100%', display: 'flex' }}>
      <Card sx={{ width: '100%', display: 'flex', flexDirection: 'column', height: fullHeight ? '100%' : 'auto' }}>
        <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', px: 0, pt: compact ? 1.25 : 2, pb: compact ? 1 : 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: compact ? 1 : 2, px: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              <FavoriteIcon sx={{ mr: 1, verticalAlign: 'middle', color: '#e91e63' }} />
              {isEnglish ? 'Heart rate (BPM)' : 'Frecvență cardiacă (BPM)'}
            </Typography>
            <Box sx={{ textAlign: 'right' }}>
              <FavoriteIcon sx={{ fontSize: 28, color: '#e91e63' }} />
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#e91e63' }}>
                {latest.hr !== '--' ? Math.round(latest.hr) : '--'}
              </Typography>
            </Box>
          </Box>
          {displayData.length === 0 ? (
            <Box sx={{ py: 6, textAlign: 'center', px: 2 }}>
              <Typography color="text.secondary">{isEnglish ? 'Waiting for data...' : 'Se așteaptă date...'}</Typography>
            </Box>
          ) : (
            <ResponsiveContainer width="100%" height={chartHeight}>
              <AreaChart data={displayData} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)'} />
                <XAxis
                  type="number"
                  dataKey="xSec"
                  domain={[-60, 0]}
                  tickFormatter={(v) => `${Math.abs(Number(v)).toFixed(0)}s`}
                  tick={{ fontSize: 10 }}
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
                    formatter={(val) => [`${Math.round(val)} BPM`, isEnglish ? 'Heart rate' : 'Frecvență']}
                    labelFormatter={() => ''}
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

function TempChart({ data, latest, theme, fullHeight = false, isEnglish, chartHeight = 300, compact = false }) {
  const isDark = theme.palette.mode === 'dark';

  const displayData = useMemo(() => {
    if (!data || !data.length) return [];
    const enriched = data.map((d) => {
      const ts = Number(d.ts) || (() => {
        try {
          const parsed = Date.parse(new Date().toDateString() + ' ' + String(d.time));
          return Number.isFinite(parsed) ? parsed : Date.now();
        } catch (e) {
          return Date.now();
        }
      })();
      return { ...d, ts };
    });
    const maxTs = Math.max(...enriched.map((d) => d.ts));
    return enriched
      .map((d) => ({ ...d, xSec: (d.ts - maxTs) / 1000 }))
      .filter((d) => Number(d.xSec) >= -60);
  }, [data]);

  const getTemperatureColor = (temp) => {
    if (temp === '--') return '#9e9e9e';
    const t = parseFloat(temp);
    if (t < 35.0) return '#2196F3';      // Hipotermie
    if (t <= 37.2) return '#4caf50';    // Normal
    if (t <= 38.0) return '#ff9800';    // Subfebril
    return '#f44336';                    // Febră
  };

  const getTemperatureLabel = (temp) => {
    if (temp === '--') return isEnglish ? 'Unknown' : 'Necunoscut';
    const t = parseFloat(temp);
    if (t < 35.0) return isEnglish ? 'Hypothermia' : 'Hipotermie';
    if (t <= 37.2) return isEnglish ? 'Normal' : 'Normal';
    if (t <= 38.0) return isEnglish ? 'Mild fever' : 'Subfebril';
    return isEnglish ? 'Fever' : 'Febră';
  };

  return (
    <Box sx={{ width: '100%', display: 'flex' }}>
      <Card sx={{ width: '100%', display: 'flex', flexDirection: 'column', height: fullHeight ? '100%' : 'auto' }}>
        <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', px: 0, pt: compact ? 1.25 : 2, pb: compact ? 1 : 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: compact ? 1 : 2, px: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
              <ThermostatIcon sx={{ mr: 1, verticalAlign: 'middle', color: getTemperatureColor(latest) }} />
              {isEnglish ? 'Temperature trend' : 'Evoluție temperatură'}
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
          {displayData.length === 0 ? (
            <Box sx={{ py: 6, textAlign: 'center', px: 2 }}>
              <Typography color="text.secondary">{isEnglish ? 'Waiting for data from the sensor...' : 'Se așteaptă date de la senzor...'}</Typography>
            </Box>
          ) : (
            <ResponsiveContainer width="100%" height={chartHeight}>
              <AreaChart data={displayData} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)'} />
                <XAxis
                  type="number"
                  dataKey="xSec"
                  domain={[-60, 0]}
                  tickFormatter={(v) => `${Math.abs(Number(v)).toFixed(0)}s`}
                  tick={{ fontSize: 10 }}
                  padding={{ left: 0, right: 0 }}
                />
                <YAxis domain={[35, 40]} tick={{ fontSize: 11 }} width={34} />
                <RechartsTooltip
                  formatter={(val) => [`${val}°C`, isEnglish ? 'Temperature' : 'Temperatură']}
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
                  labelFormatter={() => ''}
                />
                <ReferenceLine y={37.2} stroke="#ff9800" strokeDasharray="3 3" label="37.2°C" />
                <ReferenceLine y={35.0} stroke="#2196F3" strokeDasharray="3 3" label="35.0°C" />
                <Area type="monotone" dataKey="temp" stroke="#ff9800" fill="#ff980030" strokeWidth={2} dot={{ r: 2 }} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
