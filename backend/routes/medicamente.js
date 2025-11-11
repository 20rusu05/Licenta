import express from "express";
import { db } from "../db.js";
import jwt from "jsonwebtoken";

const router = express.Router();

// Middleware JWT
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Token lipsă" });

  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: "Token invalid" });
  }
}

// GET medicamente cu aplicanți
router.get("/", authMiddleware, async (req, res) => {
  try {
    const [rows] = await db.promise().query(`
      SELECT 
        m.id, 
        m.denumire, 
        m.descriere,
        COALESCE(
          JSON_ARRAYAGG(
            IF(a.id IS NOT NULL, JSON_OBJECT(
              'id', a.id,
              'pacient_id', p.id,
              'pacient_nume', p.nume,
              'pacient_email', p.email,
              'status', a.status
            ), NULL)
          ), JSON_ARRAY()
        ) AS aplicanti
      FROM medicamente m
      LEFT JOIN aplicari_medicamente a ON a.medicament_id = m.id
      LEFT JOIN pacienti p ON p.id = a.pacient_id
      GROUP BY m.id
      ORDER BY m.id DESC
    `);

    const medicamente = rows.map((m) => {
      let aplicanti = [];
      try {
        aplicanti =
          typeof m.aplicanti === "string"
            ? JSON.parse(m.aplicanti).filter((x) => x !== null)
            : Array.isArray(m.aplicanti)
            ? m.aplicanti.filter((x) => x !== null)
            : [];
      } catch (e) {
        console.error("Eroare parsare JSON:", e);
      }
      return { ...m, aplicanti };
    });

    res.json(medicamente);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Eroare server" });
  }
});

// Adăugare medicament
router.post("/", authMiddleware, async (req, res) => {
  if (req.user.role !== "doctor")
    return res.status(403).json({ error: "Doar doctorii pot adăuga medicamente" });

  const { denumire, descriere } = req.body;
  if (!denumire) return res.status(400).json({ error: "Denumire necesară" });

  try {
    const [result] = await db
      .promise()
      .query("INSERT INTO medicamente (denumire, descriere, doctor_id) VALUES (?, ?, ?)", [
        denumire,
        descriere || null,
        req.user.id,
      ]);
    res.status(201).json({ message: "Medicament adăugat", id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Eroare la inserare medicament" });
  }
});

// Aplicare / renunțare medicament (pacient)
router.post("/:id/aplica", authMiddleware, async (req, res) => {
  if (req.user.role !== "pacient")
    return res.status(403).json({ error: "Doar pacienții pot aplica" });

  const medicamentId = req.params.id;
  const pacientId = req.user.id;

  try {
    const [existing] = await db
      .promise()
      .query(
        "SELECT id, status FROM aplicari_medicamente WHERE medicament_id = ? AND pacient_id = ?",
        [medicamentId, pacientId]
      );

    if (existing.length > 0) {
      await db
        .promise()
        .query("UPDATE aplicari_medicamente SET status = 'respins' WHERE id = ?", [
          existing[0].id,
        ]);
      return res.json({ message: "Ai renunțat la cererea ta." });
    }

    await db
      .promise()
      .query(
        "INSERT INTO aplicari_medicamente (pacient_id, medicament_id, status, created_at) VALUES (?, ?, 'pending', NOW())",
        [pacientId, medicamentId]
      );

    res.json({ message: "Cererea a fost trimisă și este în așteptare." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Eroare server" });
  }
});

// Update status aplicare (doctor)
router.post("/aplicari/:id/status", authMiddleware, async (req, res) => {
  if (req.user.role !== "doctor")
    return res.status(403).json({ error: "Doar doctorii pot actualiza status" });

  const aplicareId = req.params.id;
  const { status } = req.body;

  if (!["acceptat", "respins"].includes(status))
    return res.status(400).json({ error: "Status invalid" });

  try {
    await db
      .promise()
      .query("UPDATE aplicari_medicamente SET status = ? WHERE id = ?", [
        status,
        aplicareId,
      ]);
    res.json({ message: "Status actualizat" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Eroare server" });
  }
});

export default router;
