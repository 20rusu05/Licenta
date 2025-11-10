import express from "express";
import { db } from "../db.js";
import jwt from "jsonwebtoken";

const router = express.Router();

// Middleware JWT
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Token lipsa" });

  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: "Token invalid" });
  }
}

// List medicamente
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.promise().query("SELECT id, denumire, descriere FROM medicamente ORDER BY id DESC");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Eroare server" });
  }
});

// Add medicament (doctors only)
router.post("/", authMiddleware, async (req, res) => {
  const { denumire, descriere } = req.body;
  if (!denumire) return res.status(400).json({ error: "Denumire necesara" });

  try {
    const doctorId = req.user.id;
    const [result] = await db
      .promise()
      .query("INSERT INTO medicamente (denumire, descriere, doctor_id) VALUES (?, ?, ?)", [
        denumire,
        descriere || null,
        doctorId
      ]);
    res.status(201).json({ message: "Medicament adaugat", id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Eroare la inserare medicament" });
  }
});

// Aplicare medicament (pacient)
router.post("/apply", async (req, res) => {
  const { pacientId, medicamentId } = req.body;
  if (!pacientId || !medicamentId) return res.status(400).json({ error: "Campuri lipsa" });

  try {
    await db
      .promise()
      .query(
        "INSERT INTO aplicari_medicamente (pacient_id, medicament_id, status, created_at) VALUES (?, ?, 'pending', NOW())",
        [pacientId, medicamentId]
      );
    res.json({ message: "Aplicare inregistrata" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Eroare server" });
  }
});

// List aplicari
router.get("/aplicari", authMiddleware, async (req, res) => {
  const { status } = req.query;
  try {
    const where = status ? "WHERE a.status = ?" : "";
    const params = status ? [status] : [];
    const [rows] = await db
      .promise()
      .query(
        `SELECT a.id, a.status, a.created_at, 
                p.id AS pacient_id, p.nume AS pacient_nume, p.email AS pacient_email,
                m.id AS medicament_id, m.denumire AS medicament_denumire
         FROM aplicari_medicamente a
         JOIN pacienti p ON p.id = a.pacient_id
         JOIN medicamente m ON m.id = a.medicament_id
         ${where}
         ORDER BY a.created_at DESC`,
        params
      );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Eroare server" });
  }
});

// Update aplicare
router.post("/aplicari/:id/status", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!id || !status || !["acceptat", "respins"].includes(status)) {
    return res.status(400).json({ error: "Parametri invalidi" });
  }

  try {
    await db.promise().query("UPDATE aplicari_medicamente SET status = ? WHERE id = ?", [status, id]);
    res.json({ message: "Status actualizat" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Eroare server" });
  }
});

export default router;
