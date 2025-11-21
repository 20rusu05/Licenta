// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
<<<<<<< HEAD
import authRoutes from "./routes/auth.js";
import { db } from "./db.js";             // conexiunea MySQL
=======
import authRouter from "./routes/auth.js";
import medicamenteRouter from "./routes/medicamente.js";
import programariRouter from "./routes/programari.js";
import pacientiRouter from "./routes/pacienti.js";
>>>>>>> 4a7065f (Pacienti+filtrari la programari)

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

<<<<<<< HEAD
// Debug: logăm toate cererile ca să vedem ce ajunge la server
app.use((req, res, next) => {
  console.log(req.method, req.url);
  next();
=======
app.use("/api/auth", authRouter);
app.use("/api/medicamente", medicamenteRouter);
app.use("/api/programari", programariRouter);
app.use("/api/pacienti", pacientiRouter);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
>>>>>>> 4a7065f (Pacienti+filtrari la programari)
});

// Rute
app.use("/api/auth", authRoutes);

// Test server
app.get("/", (req, res) => {
  res.send("Serverul merge!");
});

// Pornire server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server pornit pe portul ${PORT}`));
