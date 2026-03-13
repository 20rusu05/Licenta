import express from "express";
import { db } from "../db.js";

const router = express.Router();

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

  const validTypes = ["ecg", "pulsoximetru", "temperatura"];
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
  const { sensor_type, value_1, value_2, device_id, pacient_id } = req.body;

  if (!sensor_type || value_1 === undefined) {
    return res.status(400).json({ error: "Date incomplete" });
  }

  const query = `
    INSERT INTO sensor_readings (sensor_type, pacient_id, value_1, value_2, device_id)
    VALUES (?, ?, ?, ?, ?)
  `;

  db.query(
    query,
    [sensor_type, pacient_id || null, value_1, value_2 || null, device_id || "unknown"],
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
          value_1,
          value_2,
          device_id,
          pacient_id,
          timestamp: new Date().toISOString(),
        });
      }

      res.json({ success: true, id: result.insertId });
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

export default router;
