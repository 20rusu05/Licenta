import express from "express";
import { db } from "../db.js";
import { verifyToken } from "./middleware/authMiddleware.js";

const router = express.Router();

// Obține toți pacienții care au interacționat cu doctorul
router.get("/", verifyToken, async (req, res) => {
  const userId = req.user.id;
  const role = req.user.role;

  if (role !== "doctor") {
    return res.status(403).json({ error: "Doar doctorii pot vizualiza lista de pacienți" });
  }

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;
  const search = req.query.search || '';

  try {
    // Construim clauza de search
    let searchCondition = '';
    let searchParams = [];
    
    if (search) {
      searchCondition = ` AND (p.nume LIKE ? OR p.prenume LIKE ? OR p.email LIKE ? OR p.telefon LIKE ?)`;
      const searchPattern = `%${search}%`;
      searchParams = [searchPattern, searchPattern, searchPattern, searchPattern];
    }

    // Count total pacienți (cu search dacă există)
    const [[{ total }]] = await db.promise().query(
      `
      SELECT COUNT(DISTINCT p.id) AS total
      FROM pacienti p
      WHERE p.id IN (
        SELECT DISTINCT pacient_id FROM programari WHERE doctor_id = ?
        UNION
        SELECT DISTINCT am.pacient_id FROM aplicari_medicamente am
        JOIN medicamente m ON am.medicament_id = m.id
        WHERE m.doctor_id = ?
      )
      ${searchCondition}
      `,
      [userId, userId, ...searchParams]
    );

    // Selectează pacienții care au avut programări sau aplicări la medicamentele doctorului
    const [rows] = await db.promise().query(
      `
      SELECT DISTINCT 
        p.id,
        p.nume,
        p.prenume,
        p.email,
        p.telefon,
        p.created_at,
        (SELECT COUNT(*) FROM programari WHERE pacient_id = p.id AND doctor_id = ?) AS total_programari,
        (SELECT COUNT(*) FROM aplicari_medicamente am 
         JOIN medicamente m ON am.medicament_id = m.id 
         WHERE am.pacient_id = p.id AND m.doctor_id = ?) AS total_aplicari,
        (SELECT MAX(data_programare) FROM programari WHERE pacient_id = p.id AND doctor_id = ?) AS ultima_programare
      FROM pacienti p
      WHERE p.id IN (
        SELECT DISTINCT pacient_id FROM programari WHERE doctor_id = ?
        UNION
        SELECT DISTINCT am.pacient_id FROM aplicari_medicamente am
        JOIN medicamente m ON am.medicament_id = m.id
        WHERE m.doctor_id = ?
      )
      ${searchCondition}
      ORDER BY ultima_programare DESC, p.nume ASC
      LIMIT ? OFFSET ?
      `,
      [userId, userId, userId, userId, userId, ...searchParams, limit, offset]
    );
    
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

// Actualizează datele unui utilizator (pacient sau doctor)
router.put("/:id", verifyToken, async (req, res) => {
  const profileId = req.params.id;
  const userId = req.user.id;
  const role = req.user.role;
  const { nume, prenume, telefon } = req.body;

  // Verificăm că utilizatorul își actualizează propriul profil
  if (parseInt(userId) !== parseInt(profileId)) {
    return res.status(403).json({ error: "Nu aveți permisiunea de a actualiza acest profil" });
  }

  try {
    // Validări
    if (!nume || !prenume) {
      return res.status(400).json({ error: "Numele și prenumele sunt obligatorii" });
    }

    if (telefon && !/^(07\d{8}|02\d{8}|03\d{8})$/.test(telefon)) {
      return res.status(400).json({ error: "Numărul de telefon nu este valid" });
    }

    // Determinăm tabela în funcție de rol
    const table = role === "doctor" ? "doctori" : "pacienti";

    // Actualizare
    await db.promise().query(
      `UPDATE ${table} 
       SET nume = ?, prenume = ?, telefon = ?
       WHERE id = ?`,
      [nume, prenume, telefon, profileId]
    );

    res.json({ message: "Profil actualizat cu succes" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Eroare la actualizarea profilului" });
  }
});

export default router;


