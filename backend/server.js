// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.js";
import pacientiRoutes from "./routes/pacienti.js";
import forgotPasswordRoutes from "./routes/forgot-password.js";
import resetPasswordRoutes from "./routes/reset-password.js";
import medicamenteRoutes from "./routes/medicamente.js";
import { db } from "./db.js";             // conexiunea MySQL

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Debug: logăm toate cererile ca să vedem ce ajunge la server
app.use((req, res, next) => {
  console.log(req.method, req.url);
  next();
});

// (Schema DB gestionată manual în SQL, fără creare automată din cod)

// Rute
app.use("/api/auth", authRoutes);
app.use("/api/auth", forgotPasswordRoutes);
app.use("/api/auth", resetPasswordRoutes);
app.use("/api/pacienti", pacientiRoutes);
app.use("/api/medicamente", medicamenteRoutes);

// Test server
app.get("/", (req, res) => {
  res.send("Serverul merge!");
});

// Pornire server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server pornit pe portul ${PORT}`));
