import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { existsSync, mkdirSync, readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createHttpsServer } from "https";
import { Server } from "socket.io";
import authRouter from "./routes/auth.js";
import medicamenteRouter from "./routes/medicamente.js";
import programariRouter from "./routes/programari.js";
import pacientiRouter from "./routes/pacienti.js";
import dashboardRouter from "./routes/dashboard.js";
import forgotPasswordRouter from "./routes/forgot-password.js";
import resetPasswordRouter from "./routes/reset-password.js";
import adminRouter from "./routes/admin.js";
import sensorsRouter from "./routes/sensors.js";
import { db } from "./db.js";
import { applyPlausibilityFilter } from "./sensorPlausibility.js";

dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, "uploads");
const httpsKeyPath = process.env.HTTPS_KEY_PATH || "./certs/server.key";
const httpsCertPath = process.env.HTTPS_CERT_PATH || "./certs/server.crt";

if (!existsSync(httpsKeyPath) || !existsSync(httpsCertPath)) {
  throw new Error(
    `HTTPS certificates not found. Expected key at ${httpsKeyPath} and cert at ${httpsCertPath}.`
  );
}

const httpsServer = createHttpsServer(
  {
    key: readFileSync(httpsKeyPath),
    cert: readFileSync(httpsCertPath),
  },
  app
);

const io = new Server(httpsServer, {
  cors: {
    origin: (origin, callback) => callback(null, true),
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const connectedSensors = {};
const sensorFilterState = new Map();
app.set("io", io);
app.set("connectedSensors", connectedSensors);
app.set("sensorFilterState", sensorFilterState);

if (!existsSync(uploadsDir)) {
  mkdirSync(uploadsDir, { recursive: true });
}

app.use(cors({ origin: (origin, callback) => callback(null, true), credentials: true }));
app.use(express.json());
app.use("/uploads", express.static(uploadsDir));

app.use("/api/auth", authRouter);
app.use("/api/medicamente", medicamenteRouter);
app.use("/api/programari", programariRouter);
app.use("/api/pacienti", pacientiRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/admin", adminRouter);
app.use("/api/sensors", sensorsRouter);
app.use("/api", forgotPasswordRouter);
app.use("/api", resetPasswordRouter);

io.on("connection", (socket) => {
  console.log(`[Socket.IO] Client conectat: ${socket.id}`);

  socket.on("register_sensor", (data) => {
    const { sensor_type, device_id } = data;
    connectedSensors[socket.id] = {
      sensor_type,
      device_id,
      connected_at: new Date().toISOString(),
      last_reading: null,
    };
    console.log(`[Socket.IO] Senzor înregistrat: ${sensor_type} (${device_id})`);

    io.emit("sensor_connected", {
      sensor_type,
      device_id,
      socket_id: socket.id,
    });
  });

  socket.on("sensor_data", (data) => {
    const { sensor_type, value_1, value_2, device_id, pacient_id, timestamp } = data;

    const filtered = applyPlausibilityFilter({
      sensorType: sensor_type,
      value1: value_1,
      value2: value_2,
      deviceId: device_id,
      pacientId: pacient_id,
      timestampMs: typeof timestamp === "number" ? timestamp * 1000 : Date.now(),
      stateMap: sensorFilterState,
    });

    const filteredValue1 = filtered.value1;
    const filteredValue2 = filtered.value2;

    if (filteredValue1 === null || filteredValue1 === undefined) {
      return;
    }

    // Update last reading
    if (connectedSensors[socket.id]) {
      connectedSensors[socket.id].last_reading = new Date().toISOString();
    }

    const query = `
      INSERT INTO sensor_readings (sensor_type, pacient_id, value_1, value_2, device_id)
      VALUES (?, ?, ?, ?, ?)
    `;
    db.query(query, [sensor_type, pacient_id || null, filteredValue1, filteredValue2 || null, device_id || "unknown"], (err) => {
      if (err) console.error("[DB] Eroare salvare citire:", err.message);
    });

    io.to(`sensor_${sensor_type}`).emit("sensor_update", {
      sensor_type,
      value_1: filteredValue1,
      value_2: filteredValue2,
      device_id,
      pacient_id,
      timestamp: new Date().toISOString(),
      filtered: filtered.filtered,
      filter_reason: filtered.reason,
    });
  });

  // Primire batch de date senzor (ECG - multiple citiri)
  socket.on("sensor_batch", (data) => {
    const { sensor_type, readings, device_id, pacient_id } = data;

    if (!readings || !readings.length) return;

    // Update last reading
    if (connectedSensors[socket.id]) {
      connectedSensors[socket.id].last_reading = new Date().toISOString();
    }

    const values = readings.map((r) => [
      sensor_type,
      pacient_id || null,
      r.value,
      null,
      device_id || "unknown",
    ]);

    const query = `
      INSERT INTO sensor_readings (sensor_type, pacient_id, value_1, value_2, device_id)
      VALUES ?
    `;
    db.query(query, [values], (err) => {
      if (err) console.error("[DB] Eroare salvare batch:", err.message);
    });

    io.to(`sensor_${sensor_type}`).emit("sensor_batch_update", {
      sensor_type,
      readings: readings.map((r) => ({
        value_1: r.value,
        timestamp: new Date(r.timestamp * 1000).toISOString(),
        leads_ok: r.leads_ok,
      })),
      device_id,
      pacient_id,
    });
  });

  socket.on("subscribe_sensor", (sensorType) => {
    socket.join(`sensor_${sensorType}`);
    console.log(`[Socket.IO] Client ${socket.id} abonat la ${sensorType}`);
  });

  socket.on("unsubscribe_sensor", (sensorType) => {
    socket.leave(`sensor_${sensorType}`);
    console.log(`[Socket.IO] Client ${socket.id} dezabonat de la ${sensorType}`);
  });

  socket.on("disconnect", () => {
    if (connectedSensors[socket.id]) {
      const sensor = connectedSensors[socket.id];
      console.log(`[Socket.IO] Senzor deconectat: ${sensor.sensor_type} (${sensor.device_id})`);

      io.emit("sensor_disconnected", {
        sensor_type: sensor.sensor_type,
        device_id: sensor.device_id,
      });

      delete connectedSensors[socket.id];
    }
    console.log(`[Socket.IO] Client deconectat: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3001;
httpsServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Socket.IO activ - așteptare senzori...`);
});
