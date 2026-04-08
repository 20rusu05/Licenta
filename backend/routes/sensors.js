import express from "express";
import { spawn, execSync } from "child_process";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { db } from "../db.js";
import { applyPlausibilityFilter } from "../sensorPlausibility.js";
import { verifyToken } from "./middleware/authMiddleware.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

function parseDateParam(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return null;

  const pad = (n) => String(n).padStart(2, "0");
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())} ${pad(parsed.getHours())}:${pad(parsed.getMinutes())}:${pad(parsed.getSeconds())}`;
}

// Obiect global pentru a ține referințe la procesele de senzori
const sensorProcesses = {
  ecg: null,
  puls: null,
  temperatura: null,
};

const sensorProcessPacients = {
  ecg: null,
  puls: null,
  temperatura: null,
};

const sensorProcessStartupErrors = {
  ecg: null,
  puls: null,
  temperatura: null,
};

function getOsSensorPids(sensorType) {
  try {
    const output = execSync(
      `ps -eo pid,args | grep -E "[p]ython(3)? .*main.py.*--sensors[[:space:]]+${sensorType}(\\s|$)" | awk '{print $1}'`,
      { encoding: "utf8" }
    );
    return output
      .split("\n")
      .map((line) => parseInt(line.trim(), 10))
      .filter((pid) => Number.isInteger(pid) && pid > 0);
  } catch (_err) {
    return [];
  }
}

function killOsSensorPids(pids) {
  let killed = 0;
  pids.forEach((pid) => {
    try {
      process.kill(pid);
      killed += 1;
    } catch (_err) {
      // ignore processes that already exited
    }
  });
  return killed;
}

router.get("/status", (req, res) => {
  const io = req.app.get("io");
  const connectedSensors = req.app.get("connectedSensors") || {};

  const status = Object.entries(connectedSensors).map(([id, info]) => ({
    id,
    sensor_type: info.sensor_type,
    device_id: info.device_id,
    connected_at: info.connected_at,
    last_reading: info.last_reading,
  }));

  res.json({ sensors: status, count: status.length });
});

router.get("/latest/:sensorType", verifyToken, (req, res) => {
  const { sensorType } = req.params;
  const limit = parseInt(req.query.limit) || 100;
  const { pacient_id } = req.query;
  const isPacient = req.user?.role === "pacient";

  const validTypes = ["ecg", "puls", "temperatura"];
  if (!validTypes.includes(sensorType)) {
    return res.status(400).json({ error: "Tip senzor invalid" });
  }

  let query = `
    SELECT id, sensor_type, pacient_id, value_1, value_2, device_id, created_at
    FROM sensor_readings
    WHERE sensor_type = ?
  `;
  const params = [sensorType];

  if (isPacient) {
    query += " AND pacient_id = ?";
    params.push(req.user.id);
  } else if (pacient_id) {
    query += " AND pacient_id = ?";
    params.push(pacient_id);
  }

  query += `
    ORDER BY created_at DESC
    LIMIT ?
  `;
  params.push(limit);

  db.query(query, params, (err, results) => {
    if (err) {
      console.error("Eroare citire senzori:", err);
      return res.status(500).json({ error: "Eroare server" });
    }
    // Inversează pentru ordinea cronologică
    res.json({ readings: results.reverse() });
  });
});

router.get("/history/:sensorType", verifyToken, (req, res) => {
  const { sensorType } = req.params;
  const { pacient_id, from, to, limit = 500 } = req.query;
  const isPacient = req.user?.role === "pacient";
  const effectivePacientId = isPacient ? req.user.id : pacient_id;

  const validTypes = ["ecg", "puls", "temperatura"];
  if (!validTypes.includes(sensorType)) {
    return res.status(400).json({ error: "Tip senzor invalid" });
  }

  const parsedFrom = from ? parseDateParam(from) : null;
  const parsedTo = to ? parseDateParam(to) : null;

  if (from && !parsedFrom) {
    return res.status(400).json({ error: "Parametrul 'from' nu este o dată validă" });
  }
  if (to && !parsedTo) {
    return res.status(400).json({ error: "Parametrul 'to' nu este o dată validă" });
  }

  if (parsedFrom && parsedTo && new Date(parsedFrom) > new Date(parsedTo)) {
    return res.status(400).json({ error: "Interval invalid: 'from' trebuie să fie înainte de 'to'" });
  }

  let query = `
    SELECT id, sensor_type, pacient_id, value_1, value_2, device_id, created_at
    FROM sensor_readings
    WHERE sensor_type = ?
  `;
  const params = [sensorType];

  if (effectivePacientId) {
    query += " AND pacient_id = ?";
    params.push(effectivePacientId);
  }
  if (parsedFrom) {
    query += " AND created_at >= ?";
    params.push(parsedFrom);
  }
  if (parsedTo) {
    query += " AND created_at <= ?";
    params.push(parsedTo);
  }

  query += " ORDER BY created_at DESC LIMIT ?";
  params.push(parseInt(limit, 10));

  db.query(query, params, (err, results) => {
    if (err) {
      console.error("Eroare istoric senzori:", err);
      return res.status(500).json({ error: "Eroare server" });
    }
    res.json({ readings: results.reverse() });
  });
});

// GET /api/sensors/device-patient/:deviceId - Get currently assigned patient for a device
router.get("/device-patient/:deviceId", (req, res) => {
  const { deviceId } = req.params;

  // First, find the doctor who owns this device
  const getDoctorQuery = `
    SELECT doctor_id FROM device_assignments
    WHERE device_id = ?
    LIMIT 1
  `;

  db.query(getDoctorQuery, [deviceId], (err, assignmentResults) => {
    if (err) {
      console.error("Eroare citire asignare dispozitiv:", err);
      return res.status(500).json({ error: "Eroare server" });
    }

    if (assignmentResults.length === 0) {
      return res.status(404).json({ error: "Device not assigned to any doctor" });
    }

    const doctorId = assignmentResults[0].doctor_id;

    // Now find the currently active patient for this doctor
    const getPatientQuery = `
      SELECT DISTINCT pacient_id
      FROM monitoring_sessions
      WHERE doctor_id = ? AND status = 'activa'
      ORDER BY started_at DESC
      LIMIT 1
    `;

    db.query(getPatientQuery, [doctorId], (patientErr, patientResults) => {
      if (patientErr) {
        console.error("Eroare citire pacient activ:", patientErr);
        return res.status(500).json({ error: "Eroare server" });
      }

      if (patientResults.length === 0) {
        return res.status(404).json({ error: "No active patient for this device" });
      }

      res.json({ pacient_id: patientResults[0].pacient_id });
    });
  });
});

// POST /api/sensors/reading - Primește o citire de la senzor (fallback HTTP)
router.post("/reading", (req, res) => {
  const { sensor_type, value_1, value_2, device_id, pacient_id, timestamp } = req.body;

  if (!sensor_type || value_1 === undefined) {
    return res.status(400).json({ error: "Date incomplete" });
  }

  const sensorFilterState = req.app.get("sensorFilterState") || new Map();
  const filtered = applyPlausibilityFilter({
    sensorType: sensor_type,
    value1: value_1,
    value2: value_2,
    deviceId: device_id,
    pacientId: pacient_id,
    timestampMs: typeof timestamp === "number" ? timestamp * 1000 : Date.now(),
    stateMap: sensorFilterState,
  });

  if (filtered.value1 === null || filtered.value1 === undefined) {
    return res.status(400).json({ error: "Valoare senzor invalida" });
  }

  const sensorDbPersistState = req.app.get("sensorDbPersistState") || new Map();
  const sensorDbMinIntervalMs = parseInt(req.app.get("sensorDbMinIntervalMs") || 3000, 10);
  const readingTimestampMs = typeof timestamp === "number" ? timestamp * 1000 : Date.now();
  const throttleKey = `${sensor_type || "unknown"}|${pacient_id || "no-patient"}|${device_id || "unknown"}`;
  const lastPersistedAt = sensorDbPersistState.get(throttleKey) || 0;
  const shouldPersist = readingTimestampMs - lastPersistedAt >= sensorDbMinIntervalMs;

  if (shouldPersist) {
    sensorDbPersistState.set(throttleKey, readingTimestampMs);
  }

  const emitLiveUpdate = () => {
    const io = req.app.get("io");
    if (io) {
      io.to(`sensor_${sensor_type}`).emit("sensor_update", {
        sensor_type,
        value_1: filtered.value1,
        value_2: filtered.value2,
        device_id,
        pacient_id,
        timestamp: new Date().toISOString(),
        filtered: filtered.filtered,
        filter_reason: filtered.reason,
      });
    }
  };

  if (!shouldPersist) {
    emitLiveUpdate();
    return res.json({
      success: true,
      persisted: false,
      filtered: filtered.filtered,
      filter_reason: filtered.reason,
    });
  }

  const query = `
    INSERT INTO sensor_readings (sensor_type, pacient_id, value_1, value_2, device_id)
    VALUES (?, ?, ?, ?, ?)
  `;

  db.query(
    query,
    [sensor_type, pacient_id || null, filtered.value1, filtered.value2 || null, device_id || "unknown"],
    (err, result) => {
      if (err) {
        console.error("Eroare salvare citire:", err);
        return res.status(500).json({ error: "Eroare server" });
      }

      emitLiveUpdate();

      res.json({
        success: true,
        id: result.insertId,
        persisted: true,
        filtered: filtered.filtered,
        filter_reason: filtered.reason,
      });
    }
  );
});

// GET /api/sensors/sessions - Sesiuni de monitorizare
router.get("/sessions", verifyToken, (req, res) => {
  const { pacient_id, doctor_id, status } = req.query;
  const isPacient = req.user?.role === "pacient";

  let query = `
    SELECT ms.*, 
           p.nume as pacient_nume, p.prenume as pacient_prenume,
           d.nume as doctor_nume, d.prenume as doctor_prenume
    FROM monitoring_sessions ms
    LEFT JOIN pacienti p ON ms.pacient_id = p.id
    LEFT JOIN doctori d ON ms.doctor_id = d.id
    WHERE 1=1
  `;
  const params = [];

  if (isPacient) {
    query += " AND ms.pacient_id = ?";
    params.push(req.user.id);
  } else if (pacient_id) {
    query += " AND ms.pacient_id = ?";
    params.push(pacient_id);
  }
  if (doctor_id) {
    query += " AND ms.doctor_id = ?";
    params.push(doctor_id);
  }
  if (status) {
    query += " AND ms.status = ?";
    params.push(status);
  }

  query += " ORDER BY ms.started_at DESC LIMIT 50";

  db.query(query, params, (err, results) => {
    if (err) {
      console.error("Eroare sesiuni:", err);
      return res.status(500).json({ error: "Eroare server" });
    }
    res.json({ sessions: results });
  });
});

// POST /api/sensors/sessions - Creează sesiune nouă
router.post("/sessions", (req, res) => {
  const { pacient_id, doctor_id, sensor_type, notes } = req.body;

  if (!pacient_id || !sensor_type) {
    return res.status(400).json({ error: "Date incomplete" });
  }

  const query = `
    INSERT INTO monitoring_sessions (pacient_id, doctor_id, sensor_type, notes)
    VALUES (?, ?, ?, ?)
  `;

  db.query(
    query,
    [pacient_id, doctor_id || null, sensor_type, notes || null],
    (err, result) => {
      if (err) {
        console.error("Eroare creare sesiune:", err);
        return res.status(500).json({ error: "Eroare server" });
      }
      res.json({ success: true, session_id: result.insertId });
    }
  );
});

// PUT /api/sensors/sessions/:id/end - Finalizare sesiune
router.put("/sessions/:id/end", (req, res) => {
  const { id } = req.params;

  const query = `
    UPDATE monitoring_sessions 
    SET status = 'finalizata', ended_at = NOW()
    WHERE id = ?
  `;

  db.query(query, [id], (err, result) => {
    if (err) {
      console.error("Eroare finalizare sesiune:", err);
      return res.status(500).json({ error: "Eroare server" });
    }
    res.json({ success: true });
  });
});

// DELETE /api/sensors/cleanup - Șterge citiri vechi (> 30 zile)
router.delete("/cleanup", (req, res) => {
  const days = parseInt(req.query.days) || 30;

  const query = `
    DELETE FROM sensor_readings 
    WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)
  `;

  db.query(query, [days], (err, result) => {
    if (err) {
      console.error("Eroare cleanup:", err);
      return res.status(500).json({ error: "Eroare server" });
    }
    res.json({ success: true, deleted: result.affectedRows });
  });
});

// POST /api/sensors/start - Pornește un senzor specific
router.post("/start", (req, res) => {
  const { sensorType, pacient_id } = req.body;
  const normalizedPacientId = pacient_id ? parseInt(pacient_id, 10) : null;

  // Validează tipul senzorului
  const validTypes = ["ecg", "puls", "temperatura"];
  if (!sensorType || !validTypes.includes(sensorType)) {
    return res.status(400).json({ 
      success: false, 
      message: "Tip senzor invalid" 
    });
  }

  // Curăță procesele orfane rămase după restarturi backend.
  const orphanPids = getOsSensorPids(sensorType);
  if (orphanPids.length > 0) {
    killOsSensorPids(orphanPids);
  }

  // Dacă procesul deja rulează pe același pacient, returnează succes
  if (sensorProcesses[sensorType] && !sensorProcesses[sensorType].killed) {
    if (sensorProcessPacients[sensorType] === normalizedPacientId) {
      return res.json({
        success: true,
        message: `Senzorul '${sensorType}' este deja în execuție`,
        running: true,
        sensorType,
        pacient_id: sensorProcessPacients[sensorType],
      });
    }

    // Dacă rulează pe alt pacient, îl repornim cu noul pacient selectat.
    try {
      process.kill(-sensorProcesses[sensorType].pid);
      sensorProcesses[sensorType] = null;
      sensorProcessPacients[sensorType] = null;
    } catch (killErr) {
      console.error(`[${sensorType}] Eroare restart (kill):`, killErr);
      return res.status(500).json({
        success: false,
        message: `Senzorul '${sensorType}' rulează deja și nu a putut fi repornit`,
        sensorType,
      });
    }

    // Continuăm aceeași cerere și pornim imediat procesul nou pe pacientul selectat.
  }

  try {
    const sensorsPath = path.join(__dirname, "../../sensors");
    const venvPython = path.join(sensorsPath, "venv", "bin", "python3");
    const pythonCmd = existsSync(venvPython) ? venvPython : "python3";
    
    // Construiește argumentele pentru main.py
    const args = [];
    if (normalizedPacientId) {
      args.push("--pacient", String(normalizedPacientId));
    }
    // Pornește doar senzorul specific
    args.push("--sensors", sensorType);

    // Pornește procesul
    const process = spawn(pythonCmd, ["main.py", ...args], {
      cwd: sensorsPath,
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    sensorProcesses[sensorType] = process;
    sensorProcessPacients[sensorType] = normalizedPacientId;
    sensorProcessStartupErrors[sensorType] = null;

    const startupErrors = [];
    let hasResponded = false;

    const finishSuccessResponse = () => {
      if (hasResponded) return;
      hasResponded = true;

      res.json({
        success: true,
        message: `Senzorul '${sensorType}' a fost pornit`,
        running: true,
        sensorType,
        pacient_id: normalizedPacientId,
        pid: process.pid,
      });
    };

    const finishErrorResponse = (message, error) => {
      if (hasResponded) return;
      hasResponded = true;

      res.status(500).json({
        success: false,
        message,
        sensorType,
        error,
      });
    };

    const startupTimer = setTimeout(() => {
      finishSuccessResponse();
    }, 1200);

    // Logare output
    process.stdout.on("data", (data) => {
      console.log(`[${sensorType.toUpperCase()}] ${data.toString()}`);
    });

    process.stderr.on("data", (data) => {
      const chunk = data.toString();
      if (startupErrors.length < 10) {
        startupErrors.push(chunk.trim());
      }
      console.error(`[${sensorType.toUpperCase()} ERROR] ${chunk}`);
    });

    process.on("error", (err) => {
      console.error(`[${sensorType}] Eroare start proces:`, err);
      clearTimeout(startupTimer);
      sensorProcesses[sensorType] = null;
      sensorProcessPacients[sensorType] = null;
      sensorProcessStartupErrors[sensorType] = err.message;
      finishErrorResponse("Eroare pornire senzor", err.message);
    });

    process.on("exit", (code, signal) => {
      clearTimeout(startupTimer);
      console.log(`[${sensorType}] Proces oprit cu cod ${code}, signal ${signal}`);

      const startupDetails = startupErrors.filter(Boolean).join(" | ").slice(0, 350);
      sensorProcessStartupErrors[sensorType] = startupDetails || `Proces oprit (code=${code}, signal=${signal || "none"})`;

      sensorProcesses[sensorType] = null;
      sensorProcessPacients[sensorType] = null;

      if (!hasResponded) {
        finishErrorResponse(
          `Senzorul '${sensorType}' s-a oprit imediat după pornire`,
          sensorProcessStartupErrors[sensorType]
        );
      }
    });
  } catch (err) {
    console.error(`[${sensorType}] Eroare pornire:`, err);
    res.status(500).json({ 
      success: false, 
      message: "Eroare pornire senzor",
      sensorType,
      error: err.message 
    });
  }
});

// POST /api/sensors/stop - Oprește un senzor specific
router.post("/stop", (req, res) => {
  const { sensorType } = req.body;

  // Validează tipul senzorului
  const validTypes = ["ecg", "puls", "temperatura"];
  if (!sensorType || !validTypes.includes(sensorType)) {
    return res.status(400).json({ 
      success: false, 
      message: "Tip senzor invalid" 
    });
  }

  const osPids = getOsSensorPids(sensorType);
  const hasTracked = sensorProcesses[sensorType] && !sensorProcesses[sensorType].killed;

  if (!hasTracked && osPids.length === 0) {
    return res.json({
      success: true,
      message: `Senzorul '${sensorType}' nu este în execuție`,
      running: false,
      sensorType,
    });
  }

  try {
    if (hasTracked) {
      // Trimite SIGTERM pentru procesul gestionat direct de backend.
      process.kill(-sensorProcesses[sensorType].pid);
    }

    const killedOrphans = killOsSensorPids(osPids);

    sensorProcessPacients[sensorType] = null;
    sensorProcessStartupErrors[sensorType] = null;
    
    res.json({ 
      success: true, 
      message: `Comanda de oprire a senzorului '${sensorType}' a fost trimisă`,
      running: false,
      sensorType,
      killed_orphan_processes: killedOrphans,
    });
  } catch (err) {
    console.error(`[${sensorType}] Eroare oprire:`, err);
    res.status(500).json({ 
      success: false, 
      message: "Eroare oprire senzor",
      sensorType,
      error: err.message 
    });
  }
});

// GET /api/sensors/running/:sensorType - Verifică dacă un senzor rulează
router.get("/running/:sensorType", (req, res) => {
  const { sensorType } = req.params;

  // Validează tipul senzorului
  const validTypes = ["ecg", "puls", "temperatura"];
  if (!validTypes.includes(sensorType)) {
    return res.status(400).json({ 
      success: false, 
      message: "Tip senzor invalid" 
    });
  }

  const trackedRunning = sensorProcesses[sensorType] && !sensorProcesses[sensorType].killed;
  const osPids = getOsSensorPids(sensorType);
  const running = Boolean(trackedRunning || osPids.length > 0);
  res.json({ 
    running,
    sensorType,
    pid: trackedRunning ? sensorProcesses[sensorType].pid : null,
    os_pids: osPids,
    pacient_id: trackedRunning ? sensorProcessPacients[sensorType] : null,
    startup_error: running ? null : sensorProcessStartupErrors[sensorType],
  });
});

// GET /api/sensors/running - Verifică statusul tuturor senzorilor
router.get("/running", (req, res) => {
  const running = {};
  const pids = {};
  
  Object.keys(sensorProcesses).forEach(sensorType => {
    const isRunning = sensorProcesses[sensorType] && !sensorProcesses[sensorType].killed;
    const osPids = getOsSensorPids(sensorType);
    running[sensorType] = Boolean(isRunning || osPids.length > 0);
    if (isRunning) {
      pids[sensorType] = sensorProcesses[sensorType].pid;
    }
    if (osPids.length > 0) {
      pids[`${sensorType}_os`] = osPids;
    }
  });

  res.json({ 
    running,
    pids,
    pacients: sensorProcessPacients,
    startup_errors: sensorProcessStartupErrors,
  });
});

// GET /api/sensors/doctor/patients - Obține toți pacienții doctorului cu sesiuni active
router.get("/doctor/patients", verifyToken, (req, res) => {
  const doctorId = req.user.id;

  const query = `
    SELECT
           p.id,
           p.nume,
           p.prenume,
           p.email,
           p.telefon,
           GROUP_CONCAT(ms.id ORDER BY ms.started_at DESC) as session_ids,
           GROUP_CONCAT(ms.sensor_type ORDER BY ms.sensor_type) as sensor_types,
           COUNT(ms.id) as active_sessions_count,
           MAX(ms.started_at) as started_at,
           MAX(sr.created_at) as last_reading_at,
           COALESCE(MAX(sr.device_id), 'unknown') as device_id
    FROM monitoring_sessions ms
    INNER JOIN pacienti p ON p.id = ms.pacient_id
    LEFT JOIN sensor_readings sr ON p.id = sr.pacient_id AND sr.created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)
    WHERE ms.doctor_id = ? AND ms.status = 'activa'
    GROUP BY p.id, p.nume, p.prenume, p.email, p.telefon
    ORDER BY MAX(ms.started_at) DESC
  `;

  db.query(query, [doctorId], (err, results) => {
    if (err) {
      console.error("Eroare obținere pacienți doctor:", err);
      return res.status(500).json({ error: "Eroare server" });
    }
    res.json({ success: true, patients: results });
  });
});

// GET /api/sensors/doctor/all-patients - Obține TOȚI pacienții doctorului (nu doar cei cu sesiuni active)
router.get("/doctor/all-patients", verifyToken, (req, res) => {
  const doctorId = req.user.id;
  const { search } = req.query;

  let query = `
    SELECT DISTINCT p.id, p.nume, p.prenume, p.email, p.telefon
    FROM pacienti p
    INNER JOIN programari pr ON p.id = pr.pacient_id AND pr.doctor_id = ?
    WHERE 1=1
  `;
  const params = [doctorId];

  if (search) {
    query += " AND (p.nume LIKE ? OR p.prenume LIKE ? OR p.email LIKE ?)";
    const searchTerm = `%${search}%`;
    params.push(searchTerm, searchTerm, searchTerm);
  }

  query += " ORDER BY p.nume, p.prenume LIMIT 50";

  db.query(query, params, (err, results) => {
    if (err) {
      console.error("Eroare obținere pacienți doctor:", err);
      return res.status(500).json({ error: "Eroare server" });
    }
    res.json({ success: true, patients: results });
  });
});

// POST /api/sensors/doctor/assign-session - Creează sesiune de monitorizare
router.post("/doctor/assign-session", verifyToken, (req, res) => {
  const doctorId = req.user.id;
  const { pacient_id } = req.body;

  if (!pacient_id) {
    return res.status(400).json({ error: "Date incomplete" });
  }

  const validTypes = ["ecg", "puls", "temperatura"];

  // Verifică dacă pacientul aparține doctorului (are programare cu el)
  const checkQuery = `
    SELECT COUNT(*) as count FROM programari 
    WHERE pacient_id = ? AND doctor_id = ?
  `;

  db.query(checkQuery, [pacient_id, doctorId], (err, results) => {
    if (err) {
      console.error("Eroare verificare pacient:", err);
      return res.status(500).json({ error: "Eroare server" });
    }

    if (results[0].count === 0) {
      return res.status(403).json({ error: "Acest pacient nu aparține dvs." });
    }

    const existingSessionQuery = `
      SELECT id, sensor_type FROM monitoring_sessions
      WHERE pacient_id = ? AND doctor_id = ? AND status = 'activa'
    `;

    db.query(existingSessionQuery, [pacient_id, doctorId], (existingErr, existingRows) => {
      if (existingErr) {
        console.error("Eroare verificare sesiune existentă:", existingErr);
        return res.status(500).json({ error: "Eroare server" });
      }

      const existingTypes = new Set(existingRows.map((r) => r.sensor_type));
      const missingTypes = validTypes.filter((t) => !existingTypes.has(t));

      if (missingTypes.length === 0) {
        return res.json({
          success: true,
          session_ids: existingRows.map((r) => r.id),
          already_assigned: true,
          message: "Pacientul are deja toate sesiunile active (ecg, puls, temperatura)"
        });
      }

      const insertValues = missingTypes.map((sensorType) => [pacient_id, doctorId, sensorType]);
      const insertQuery = `
        INSERT INTO monitoring_sessions (pacient_id, doctor_id, sensor_type, status)
        VALUES ?
      `;

      db.query(insertQuery, [insertValues.map((v) => [...v, 'activa'])], (insertErr, result) => {
        if (insertErr) {
          console.error("Eroare creare sesiune:", insertErr);
          return res.status(500).json({ error: "Eroare server" });
        }
        res.json({
          success: true,
          created_sessions: result.affectedRows,
          already_assigned: false,
          message: `S-au creat ${result.affectedRows} sesiuni noi` 
        });
      });
    });
  });
});

// PUT /api/sensors/doctor/end-patient-sessions/:pacientId - Finalizează toate sesiunile active ale pacientului la doctorul curent
router.put("/doctor/end-patient-sessions/:pacientId", verifyToken, (req, res) => {
  const doctorId = req.user.id;
  const { pacientId } = req.params;

  const updateQuery = `
    UPDATE monitoring_sessions
    SET status = 'finalizata', ended_at = NOW()
    WHERE pacient_id = ? AND doctor_id = ? AND status = 'activa'
  `;

  db.query(updateQuery, [pacientId, doctorId], (err, result) => {
    if (err) {
      console.error("Eroare finalizare sesiuni pacient:", err);
      return res.status(500).json({ error: "Eroare server" });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Nu există sesiuni active pentru acest pacient" });
    }

    res.json({ success: true, ended_sessions: result.affectedRows, message: "Sesiuni finalizate" });
  });
});

// PUT /api/sensors/doctor/end-session/:sessionId - Finalizeaza sesiune
router.put("/doctor/end-session/:sessionId", verifyToken, (req, res) => {
  const doctorId = req.user.id;
  const { sessionId } = req.params;

  // Verifică că sesiunea aparține doctorului curent
  const checkQuery = `
    SELECT id FROM monitoring_sessions 
    WHERE id = ? AND doctor_id = ? AND status = 'activa'
  `;

  db.query(checkQuery, [sessionId, doctorId], (err, results) => {
    if (err) {
      console.error("Eroare verificare sesiune:", err);
      return res.status(500).json({ error: "Eroare server" });
    }

    if (results.length === 0) {
      return res.status(403).json({ error: "Sesiune not found or access denied" });
    }

    // Finalizează sesiunea
    const updateQuery = `
      UPDATE monitoring_sessions 
      SET status = 'finalizata', ended_at = NOW()
      WHERE id = ?
    `;

    db.query(updateQuery, [sessionId], (err) => {
      if (err) {
        console.error("Eroare finalizare sesiune:", err);
        return res.status(500).json({ error: "Eroare server" });
      }
      res.json({ success: true, message: "Sesiune finalizată" });
    });
  });
});

export default router;
