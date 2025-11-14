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

// ------------------------
// GET medicamente cu aplicanti
// ------------------------
router.get("/", authMiddleware, async (req, res) => {
  try {
    const whereClause = req.user.role === "doctor" ? "WHERE m.doctor_id = ?" : "";

    const [rows] = await db.promise().query(
      `
      SELECT 
        m.id, 
        m.denumire, 
        m.descriere,
        a.id AS aplicare_id,
        a.status,
        a.fumeaza,
        a.activitate_fizica,
        a.probleme_inima,
        a.alergii,
        a.boli_cronice,
        a.medicamente_curente,
        a.greutate,
        a.inaltime,
        a.observatii,
        p.id AS pacient_id,
        p.nume AS pacient_nume,
        p.email AS pacient_email
      FROM medicamente m
      LEFT JOIN aplicari_medicamente a ON a.medicament_id = m.id
      LEFT JOIN pacienti p ON p.id = a.pacient_id
      ${whereClause}
      ORDER BY m.id DESC, a.id ASC
      `,
      req.user.role === "doctor" ? [req.user.id] : []
    );

    const medicamenteMap = new Map();

    for (const row of rows) {
      if (!medicamenteMap.has(row.id)) {
        medicamenteMap.set(row.id, {
          id: row.id,
          denumire: row.denumire,
          descriere: row.descriere,
          aplicanti: [],
        });
      }
      if (row.aplicare_id) {
        medicamenteMap.get(row.id).aplicanti.push({
          id: row.aplicare_id,
          pacient_id: row.pacient_id,
          pacient_nume: row.pacient_nume,
          pacient_email: row.pacient_email,
          status: row.status,
          fumeaza: row.fumeaza,
          activitate_fizica: row.activitate_fizica,
          probleme_inima: row.probleme_inima,
          alergii: row.alergii,
          boli_cronice: row.boli_cronice,
          medicamente_curente: row.medicamente_curente,
          greutate: row.greutate,
          inaltime: row.inaltime,
          observatii: row.observatii,
        });
      }
    }

    res.json([...medicamenteMap.values()]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Eroare server" });
  }
});

// ------------------------
// POST /api/medicamente – adaugare medicament (doctor)
// ------------------------
router.post("/", authMiddleware, async (req, res) => {
  if (req.user.role !== "doctor")
    return res.status(403).json({ error: "Doar doctorii pot adauga medicamente" });

  const { denumire, descriere } = req.body;
  if (!denumire) return res.status(400).json({ error: "Denumire necesara" });

  try {
    const [result] = await db.promise().query(
      "INSERT INTO medicamente (denumire, descriere, doctor_id) VALUES (?, ?, ?)",
      [denumire, descriere || null, req.user.id]
    );
    res.status(201).json({ message: "Medicament adaugat", id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Eroare server" });
  }
});

// ------------------------
// PUT /api/medicamente/:id – editare medicament (doctor)
// ------------------------
router.put("/:id", authMiddleware, async (req, res) => {
  if (req.user.role !== "doctor")
    return res.status(403).json({ error: "Doar doctorii pot edita medicamente" });

  const { denumire, descriere } = req.body;
  const medicamentId = req.params.id;

  try {
    await db.promise().query(
      "UPDATE medicamente SET denumire = ?, descriere = ? WHERE id = ? AND doctor_id = ?",
      [denumire, descriere, medicamentId, req.user.id]
    );
    res.json({ message: "Medicament actualizat" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Eroare server" });
  }
});

// ------------------------
// DELETE /api/medicamente/:id – stergere medicament (doctor)
// ------------------------
router.delete("/:id", authMiddleware, async (req, res) => {
  if (req.user.role !== "doctor")
    return res.status(403).json({ error: "Doar doctorii pot sterge medicamente" });

  const medicamentId = req.params.id;

  try {
    await db.promise().query(
      "DELETE FROM medicamente WHERE id = ? AND doctor_id = ?",
      [medicamentId, req.user.id]
    );
    res.json({ message: "Medicament sters" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Eroare server" });
  }
});

// Aplicare medicament (pacient)
router.post("/:id/aplica", authMiddleware, async (req, res) => {
  if (req.user.role !== "pacient")
    return res.status(403).json({ error: "Doar pacienții pot aplica" });

  const medicamentId = req.params.id;
  const pacientId = req.user.id;

  const {
    fumeaza,
    activitate_fizica,
    probleme_inima,
    alergii,
    boli_cronice,
    medicamente_curente,
    greutate,
    inaltime,
    observatii,
  } = req.body;

  // Mapare valori corecte pentru ENUM/BOOLEAN
  const fumeazaValues = ["da", "nu", "fost"];
  const activitateValues = ["sedentar", "usoara", "moderata", "intensa"];
  const fumeazaValue = fumeazaValues.includes(fumeaza) ? fumeaza : null;
  const activitateValue = activitateValues.includes(activitate_fizica) ? activitate_fizica : null;
  const problemeInimaValue = typeof probleme_inima === "boolean" ? probleme_inima : null;

  // Verificam numericitatea pentru greutate si inaltime
  const greutateValue = parseFloat(greutate);
  const inaltimeValue = parseFloat(inaltime);

  if (isNaN(greutateValue) || isNaN(inaltimeValue)) {
    return res.status(400).json({
      error: "Câmpurile 'Greutate' și 'Înălțime' trebuie să conțină doar numere.",
    });
  }

  try {
    // Verificăm dacă pacientul a aplicat deja
    const [existing] = await db
      .promise()
      .query(
        "SELECT id FROM aplicari_medicamente WHERE medicament_id = ? AND pacient_id = ?",
        [medicamentId, pacientId]
      );

    if (existing.length > 0) {
      return res.status(400).json({ error: "Ai aplicat deja la acest medicament" });
    }

    // Inserăm aplicația
    await db
      .promise()
      .query(
        `INSERT INTO aplicari_medicamente 
        (pacient_id, medicament_id, status, fumeaza, activitate_fizica, probleme_inima, alergii, boli_cronice, medicamente_curente, greutate, inaltime, observatii, created_at) 
        VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          pacientId,
          medicamentId,
          fumeazaValue,
          activitateValue,
          problemeInimaValue,
          alergii || null,
          boli_cronice || null,
          medicamente_curente || null,
          greutateValue,
          inaltimeValue,
          observatii || null,
        ]
      );

    res.json({ message: "Cererea a fost trimisă și este în așteptare." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Eroare server" });
  }
});



router.post("/aplicari/:id/status", authMiddleware, async (req, res) => {
  if (req.user.role !== "doctor")
    return res.status(403).json({ error: "Doar doctorii pot actualiza status" });

  const aplicareId = req.params.id;
  const { status } = req.body;

  if (!["acceptat", "respins"].includes(status))
    return res.status(400).json({ error: "Status invalid" });

  try {
    await db.promise().query(
      "UPDATE aplicari_medicamente SET status = ? WHERE id = ?",
      [status, aplicareId]
    );
    res.json({ message: "Status actualizat" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Eroare server" });
  }
});

// Stergere aplicare medicament (renuntare)
router.delete("/aplicare/:id", authMiddleware, async (req, res) => {
  const aplicareId = req.params.id;

  try {
    // Verificam daca aplicarea exista si apartine utilizatorului
    const [rows] = await db.promise().query(
      "SELECT * FROM aplicari_medicamente WHERE id = ? AND pacient_id = ?",
      [aplicareId, req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Aplicarea nu exista sau nu iti apartine" });
    }

    // Verificare status
    if (rows[0].status !== "pending") {
      return res.status(400).json({ error: "Nu poti renunta daca aplicarea nu este pending" });
    }

    // Stergere aplicare
    await db.promise().query("DELETE FROM aplicari_medicamente WHERE id = ?", [aplicareId]);

    res.json({ message: "Aplicarea a fost stearsa (renuntare efectuata)." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Eroare server" });
  }
});

export default router;
