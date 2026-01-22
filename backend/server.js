import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRouter from "./routes/auth.js";
import medicamenteRouter from "./routes/medicamente.js";
import programariRouter from "./routes/programari.js";
import pacientiRouter from "./routes/pacienti.js";
import dashboardRouter from "./routes/dashboard.js";
import forgotPasswordRouter from "./routes/forgot-password.js";
import resetPasswordRouter from "./routes/reset-password.js";

dotenv.config();

const app = express();

app.use(cors({ origin: "http://localhost:3000", credentials: true }));
app.use(express.json());

app.use("/api/auth", authRouter);
app.use("/api/medicamente", medicamenteRouter);
app.use("/api/programari", programariRouter);
app.use("/api/pacienti", pacientiRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api", forgotPasswordRouter);
app.use("/api", resetPasswordRouter);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
