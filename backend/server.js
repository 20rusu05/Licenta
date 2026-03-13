import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServer } from "http";
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

dotenv.config();

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => callback(null, true),
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const connectedSensors = {};
app.set("io", io);
app.set("connectedSensors", connectedSensors);

app.use(cors({ origin: (origin, callback) => callback(null, true), credentials: true }));
app.use(express.json());

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
    const { sensor_type, value_1, value_2, device_id, pacient_id } = data;

    // Update last reading
    if (connectedSensors[socket.id]) {
      connectedSensors[socket.id].last_reading = new Date().toISOString();
    }

    const query = `
      INSERT INTO sensor_readings (sensor_type, pacient_id, value_1, value_2, device_id)
      VALUES (?, ?, ?, ?, ?)
    `;
    db.query(query, [sensor_type, pacient_id || null, value_1, value_2 || null, device_id || "unknown"], (err) => {
      if (err) console.error("[DB] Eroare salvare citire:", err.message);
    });

    io.to(`sensor_${sensor_type}`).emit("sensor_update", {
      sensor_type,
      value_1,
      value_2,
      device_id,
      pacient_id,
      timestamp: new Date().toISOString(),
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
httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Socket.IO activ - așteptare senzori...`);
});
