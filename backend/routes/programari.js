import express from "express";
import { db } from "../db.js";
import { verifyToken } from "./middleware/authMiddleware.js";

const router = express.Router();

// Creează programare
router.post("/", verifyToken, async (req, res) => {
  const { pacient_id, data_ora } = req.body;
  const doctor_id = req.user.id;

  if (!pacient_id || !data_ora) return res.status(400).json({ error: "Date incomplete" });

  try {
    await db.promise().query(
      "INSERT INTO programari (pacient_id, doctor_id, data_ora) VALUES (?, ?, ?)",
      [pacient_id, doctor_id, data_ora]
    );
    res.json({ message: "Programare creată cu succes" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Eroare server" });
  }
});

// Preia programările
router.get("/", verifyToken, async (req, res) => {
  const userId = req.user.id;
  const role = req.user.role;

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;

  try {
    let query, countQuery, params;

    if (role === "doctor") {
      query = `
        SELECT p.id, p.data_ora, p.pacient_id, u.nume AS pacient_nume, u.email AS pacient_email
        FROM programari p
        JOIN pacienti u ON p.pacient_id = u.id
        WHERE p.doctor_id = ?
        ORDER BY p.data_ora ASC
        LIMIT ? OFFSET ?
      `;

      countQuery = `
        SELECT COUNT(*) AS total
        FROM programari
        WHERE doctor_id = ?
      `;

      params = [userId, limit, offset];
    } else {
      query = `
        SELECT p.id, p.data_ora, p.doctor_id, d.nume AS medic_nume, d.email AS medic_email
        FROM programari p
        JOIN doctori d ON p.doctor_id = d.id
        WHERE p.pacient_id = ?
        ORDER BY p.data_ora ASC
        LIMIT ? OFFSET ?
      `;

      countQuery = `
        SELECT COUNT(*) AS total
        FROM programari
        WHERE pacient_id = ?
      `;

      params = [userId, limit, offset];
    }

    const [[countRow]] = await db.promise().query(countQuery, [userId]);
    const total = countRow.total;

    const [rows] = await db.promise().query(query, params);

    res.json({
      data: rows,
      current_page: page,
      total_pages: Math.ceil(total / limit),
      total_items: total,
      limit: limit
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Eroare server" });
  }
});

export default router;