import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRouter from "./routes/auth.js";
import medicamenteRouter from "./routes/medicamente.js";
import programariRouter from "./routes/programari.js";
import pacientiRouter from "./routes/pacienti.js";

dotenv.config();

const app = express();

app.use(cors({ origin: "http://localhost:3000", credentials: true }));
app.use(express.json());

app.use("/api/auth", authRouter);
app.use("/api/medicamente", medicamenteRouter);
app.use("/api/programari", programariRouter);
app.use("/api/pacienti", pacientiRouter);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
