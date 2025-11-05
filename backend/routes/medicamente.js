import express from "express";
import { db } from "../db.js";

const router = express.Router();

// List all medications
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.promise().query(
      "SELECT id, denumire, descriere FROM medicamente ORDER BY id DESC"
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Eroare server" });
  }
});

// Add a new medication
router.post("/", async (req, res) => {
  const { denumire, descriere } = req.body;
  if (!denumire) return res.status(400).json({ error: "Denumire necesara" });
  try {
    const [result] = await db
      .promise()
      .query(
        "INSERT INTO medicamente (denumire, descriere) VALUES (?, ?)",
        [denumire, descriere || null]
      );
    res.json({ id: result.insertId, denumire, descriere: descriere || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Eroare server" });
  }
});

// Apply for a medication (patient)
router.post("/apply", async (req, res) => {
  const { pacientId, medicamentId } = req.body;
  if (!pacientId || !medicamentId)
    return res.status(400).json({ error: "Campuri lipsa" });
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

// List applications (optionally filter by status)
router.get("/aplicari", async (req, res) => {
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

// Update application status (accept or reject)
router.post("/aplicari/:id/status", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // 'acceptat' | 'respins'
  if (!id || !status || !['acceptat','respins'].includes(status)) {
    return res.status(400).json({ error: "Parametri invalidi" });
  }
  try {
    await db
      .promise()
      .query("UPDATE aplicari_medicamente SET status = ? WHERE id = ?", [status, id]);
    res.json({ message: "Status actualizat" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Eroare server" });
  }
});

export default router;


