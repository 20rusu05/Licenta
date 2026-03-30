import express from "express";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { db } from "../db.js";
import { applyPlausibilityFilter } from "../sensorPlausibility.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Obiect global pentru a ține referințe la procesele de senzori
const sensorProcesses = {
  ecg: null,
  puls: null,
  temperatura: null,
};

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

router.get("/latest/:sensorType", (req, res) => {
  const { sensorType } = req.params;
  const limit = parseInt(req.query.limit) || 100;

  const validTypes = ["ecg", "puls", "temperatura"];
  if (!validTypes.includes(sensorType)) {
    return res.status(400).json({ error: "Tip senzor invalid" });
  }

  const query = `
    SELECT id, sensor_type, pacient_id, value_1, value_2, device_id, created_at
    FROM sensor_readings
    WHERE sensor_type = ?
    ORDER BY created_at DESC
    LIMIT ?
  `;

  db.query(query, [sensorType, limit], (err, results) => {
    if (err) {
      console.error("Eroare citire senzori:", err);
      return res.status(500).json({ error: "Eroare server" });
    }
    // Inversează pentru ordinea cronologică
    res.json({ readings: results.reverse() });
  });
});

router.get("/history/:sensorType", (req, res) => {
  const { sensorType } = req.params;
  const { pacient_id, from, to, limit = 500 } = req.query;

  let query = `
    SELECT id, sensor_type, pacient_id, value_1, value_2, device_id, created_at
    FROM sensor_readings
    WHERE sensor_type = ?
  `;
  const params = [sensorType];

  if (pacient_id) {
    query += " AND pacient_id = ?";
    params.push(pacient_id);
  }
  if (from) {
    query += " AND created_at >= ?";
    params.push(from);
  }
  if (to) {
    query += " AND created_at <= ?";
    params.push(to);
  }

  query += " ORDER BY created_at DESC LIMIT ?";
  params.push(parseInt(limit));

  db.query(query, params, (err, results) => {
    if (err) {
      console.error("Eroare istoric senzori:", err);
      return res.status(500).json({ error: "Eroare server" });
    }
    res.json({ readings: results.reverse() });
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

      // Broadcast via Socket.IO
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

      res.json({
        success: true,
        id: result.insertId,
        filtered: filtered.filtered,
        filter_reason: filtered.reason,
      });
    }
  );
});

// GET /api/sensors/sessions - Sesiuni de monitorizare
router.get("/sessions", (req, res) => {
  const { pacient_id, doctor_id, status } = req.query;

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

  if (pacient_id) {
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

  // Validează tipul senzorului
  const validTypes = ["ecg", "puls", "temperatura"];
  if (!sensorType || !validTypes.includes(sensorType)) {
    return res.status(400).json({ 
      success: false, 
      message: "Tip senzor invalid" 
    });
  }

  // Dacă procesul deja rulează, returnează succes
  if (sensorProcesses[sensorType] && !sensorProcesses[sensorType].killed) {
    return res.json({ 
      success: true, 
      message: `Senzorul '${sensorType}' este deja în execuție`,
      running: true,
      sensorType
    });
  }

  try {
    const sensorsPath = path.join(__dirname, "../../sensors");
    
    // Construiește argumentele pentru main.py
    const args = [];
    if (pacient_id) {
      args.push("--pacient", String(pacient_id));
    }
    // Pornește doar senzorul specific
    args.push("--sensors", sensorType);

    // Pornește procesul
    const process = spawn("python3", ["main.py", ...args], {
      cwd: sensorsPath,
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    sensorProcesses[sensorType] = process;

    // Logare output
    process.stdout.on("data", (data) => {
      console.log(`[${sensorType.toUpperCase()}] ${data.toString()}`);
    });

    process.stderr.on("data", (data) => {
      console.error(`[${sensorType.toUpperCase()} ERROR] ${data.toString()}`);
    });

    process.on("error", (err) => {
      console.error(`[${sensorType}] Eroare start proces:`, err);
      sensorProcesses[sensorType] = null;
    });

    process.on("exit", (code) => {
      console.log(`[${sensorType}] Proces oprit cu cod ${code}`);
      sensorProcesses[sensorType] = null;
    });

    res.json({ 
      success: true, 
      message: `Senzorul '${sensorType}' a fost pornit`,
      running: true,
      sensorType,
      pid: process.pid 
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

  if (!sensorProcesses[sensorType] || sensorProcesses[sensorType].killed) {
    return res.json({ 
      success: true, 
      message: `Senzorul '${sensorType}' nu este în execuție`,
      running: false,
      sensorType
    });
  }

  try {
    // Trimite SIGTERM pentru a opri procesul în mod corect
    process.kill(-sensorProcesses[sensorType].pid);
    
    res.json({ 
      success: true, 
      message: `Comanda de oprire a senzorului '${sensorType}' a fost trimisă`,
      running: false,
      sensorType
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

  const running = sensorProcesses[sensorType] && !sensorProcesses[sensorType].killed;
  res.json({ 
    running,
    sensorType,
    pid: running ? sensorProcesses[sensorType].pid : null 
  });
});

// GET /api/sensors/running - Verifică statusul tuturor senzorilor
router.get("/running", (req, res) => {
  const running = {};
  const pids = {};
  
  Object.keys(sensorProcesses).forEach(sensorType => {
    const isRunning = sensorProcesses[sensorType] && !sensorProcesses[sensorType].killed;
    running[sensorType] = isRunning;
    if (isRunning) {
      pids[sensorType] = sensorProcesses[sensorType].pid;
    }
  });

  res.json({ 
    running,
    pids
  });
});

export default router;
