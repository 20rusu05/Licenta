const DEFAULT_STATE = {
  lastValue: null,
  lastTs: null,
  emaValue: null,
};

function asNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getState(stateMap, key) {
  if (!stateMap.has(key)) {
    stateMap.set(key, { ...DEFAULT_STATE });
  }
  return stateMap.get(key);
}

function clamp(value, minValue, maxValue) {
  return Math.max(minValue, Math.min(maxValue, value));
}

export function applyPlausibilityFilter({
  sensorType,
  value1,
  value2,
  deviceId,
  pacientId,
  timestampMs,
  stateMap,
}) {
  if (sensorType === "temperatura") {
    const numericTemp = asNumber(value1);
    if (numericTemp === null) {
      return {
        value1: null,
        value2,
        filtered: true,
        reason: "invalid-number",
      };
    }

    // DS18B20 may report 85.0°C right after power-up or -127°C on bus faults.
    // Keep the accepted range wide enough for ambient testing, but reject obvious sensor errors.
    if (numericTemp === 85 || numericTemp === -127 || numericTemp < 5 || numericTemp > 45) {
      return {
        value1: null,
        value2,
        filtered: true,
        reason: numericTemp === 85 ? "power-on-default" : "out-of-range",
      };
    }

    return {
      value1: Math.round(numericTemp * 10) / 10,
      value2,
      filtered: false,
      reason: "ok",
    };
  }

  if (sensorType !== "puls") {
    return {
      value1,
      value2,
      filtered: false,
      reason: "not-target-sensor",
    };
  }

  const numeric = asNumber(value1);
  if (numeric === null) {
    return {
      value1: null,
      value2,
      filtered: true,
      reason: "invalid-number",
    };
  }

  const key = [sensorType, deviceId || "unknown", pacientId || "na"].join(":");
  const state = getState(stateMap, key);
  const now = Number.isFinite(timestampMs) ? timestampMs : Date.now();

  let candidate = clamp(numeric, 38, 180);
  let filtered = false;
  let reason = "ok";

  if (state.lastValue !== null && state.lastTs !== null) {
    const dtSec = clamp((now - state.lastTs) / 1000.0, 0.25, 5.0);
    const maxRise = 7.0 * dtSec + 1.5;
    const maxFall = 10.0 * dtSec + 2.5;
    const delta = candidate - state.lastValue;

    if (delta > maxRise) {
      candidate = state.lastValue + maxRise;
      filtered = true;
      reason = "rise-limited";
    } else if (delta < -maxFall) {
      candidate = state.lastValue - maxFall;
      filtered = true;
      reason = "fall-limited";
    }

    const alpha = 0.62;
    const emaBase = state.emaValue ?? state.lastValue;
    candidate = (alpha * candidate) + ((1.0 - alpha) * emaBase);
  }

  candidate = clamp(candidate, 38, 180);
  candidate = Math.round(candidate * 10) / 10;

  state.lastValue = candidate;
  state.emaValue = candidate;
  state.lastTs = now;

  return {
    value1: candidate,
    value2,
    filtered,
    reason,
  };
}
