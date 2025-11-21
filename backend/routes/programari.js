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
    // Convertim data din ISO format la format MySQL (YYYY-MM-DD HH:MM:SS)
    const mysqlDateTime = new Date(data_ora).toISOString().slice(0, 19).replace('T', ' ');
    
    await db.promise().query(
      "INSERT INTO programari (pacient_id, doctor_id, data_ora) VALUES (?, ?, ?)",
      [pacient_id, doctor_id, mysqlDateTime]
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
  const filter = req.query.filter || 'toate'; // toate, viitoare, trecute, completate

  try {
    let query, countQuery, countsQuery, params, userIdCol;

    // Determinăm coloana pentru user
    userIdCol = role === "doctor" ? "doctor_id" : "pacient_id";

    // Query pentru contoare (toate, viitoare, trecute, completate)
    countsQuery = `
      SELECT 
        COUNT(*) AS toate,
        COALESCE(SUM(CASE WHEN data_ora IS NOT NULL AND data_ora > NOW() AND status != 'completata' THEN 1 ELSE 0 END), 0) AS viitoare,
        COALESCE(SUM(CASE WHEN data_ora IS NOT NULL AND data_ora <= NOW() AND status != 'completata' THEN 1 ELSE 0 END), 0) AS trecute,
        COALESCE(SUM(CASE WHEN status = 'completata' THEN 1 ELSE 0 END), 0) AS completate
      FROM programari
      WHERE ${userIdCol} = ?
    `;

    if (role === "doctor") {
      // Query de bază pentru doctor
      let whereClause = "p.doctor_id = ?";
      
      // Adaugă filtru pentru data și status
      if (filter === 'viitoare') {
        whereClause += " AND p.data_ora > NOW() AND p.status != 'completata'";
      } else if (filter === 'trecute') {
        whereClause += " AND p.data_ora <= NOW() AND p.status != 'completata'";
      } else if (filter === 'completate') {
        whereClause += " AND p.status = 'completata'";
      }

      query = `
        SELECT p.id, p.data_ora, p.status, p.pacient_id, u.nume AS pacient_nume, u.email AS pacient_email
        FROM programari p
        JOIN pacienti u ON p.pacient_id = u.id
        WHERE ${whereClause}
        ORDER BY p.data_ora ASC
        LIMIT ? OFFSET ?
      `;

      countQuery = `
        SELECT COUNT(*) AS total
        FROM programari p
        WHERE ${whereClause}
      `;

      params = [userId, limit, offset];
    } else {
      // Query de bază pentru pacient
      let whereClause = "p.pacient_id = ?";
      
      // Adaugă filtru pentru data și status
      if (filter === 'viitoare') {
        whereClause += " AND p.data_ora > NOW() AND p.status != 'completata'";
      } else if (filter === 'trecute') {
        whereClause += " AND p.data_ora <= NOW() AND p.status != 'completata'";
      } else if (filter === 'completate') {
        whereClause += " AND p.status = 'completata'";
      }

      query = `
        SELECT p.id, p.data_ora, p.status, p.doctor_id, d.nume AS medic_nume, d.email AS medic_email
        FROM programari p
        JOIN doctori d ON p.doctor_id = d.id
        WHERE ${whereClause}
        ORDER BY p.data_ora ASC
        LIMIT ? OFFSET ?
      `;

      countQuery = `
        SELECT COUNT(*) AS total
        FROM programari p
        WHERE ${whereClause}
      `;

      params = [userId, limit, offset];
    }

    // Obține contoarele pentru toate filtrele
    const [[countsRow]] = await db.promise().query(countsQuery, [userId]);
    
    // Obține total pentru filtrul curent
    const [[countRow]] = await db.promise().query(countQuery, [userId]);
    const total = countRow.total;

    // Obține datele
    const [rows] = await db.promise().query(query, params);

    res.json({
      data: rows,
      current_page: page,
      total_pages: Math.ceil(total / limit),
      total_items: total,
      limit: limit,
      counts: {
        toate: parseInt(countsRow.toate) || 0,
        viitoare: parseInt(countsRow.viitoare) || 0,
        trecute: parseInt(countsRow.trecute) || 0,
        completate: parseInt(countsRow.completate) || 0
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Eroare server" });
  }
});

// Actualizează data programării (reprogramare)
router.put("/:id", verifyToken, async (req, res) => {
  const programareId = req.params.id;
  const { data_ora, resetStatus } = req.body;
  const userId = req.user.id;
  const role = req.user.role;

  if (!data_ora) return res.status(400).json({ error: "Data programării este obligatorie" });

  if (role !== "doctor") {
    return res.status(403).json({ error: "Doar doctorii pot modifica programările" });
  }

  try {
    // Verifică că programarea aparține doctorului
    const [programare] = await db.promise().query(
      "SELECT * FROM programari WHERE id = ? AND doctor_id = ?",
      [programareId, userId]
    );

    if (programare.length === 0) {
      return res.status(404).json({ error: "Programare inexistentă sau nu ai permisiunea" });
    }

    // Convertim data din ISO format la format MySQL
    const mysqlDateTime = new Date(data_ora).toISOString().slice(0, 19).replace('T', ' ');

    // Actualizează data programării și opțional statusul
    if (resetStatus) {
      // Dacă programarea era completată și o reprogramăm, o resetăm la 'programata'
      await db.promise().query(
        "UPDATE programari SET data_ora = ?, status = 'programata' WHERE id = ?",
        [mysqlDateTime, programareId]
      );
    } else {
      await db.promise().query(
        "UPDATE programari SET data_ora = ? WHERE id = ?",
        [mysqlDateTime, programareId]
      );
    }

    res.json({ message: "Programare actualizată cu succes" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Eroare server" });
  }
});

// Marchează programarea ca completată sau resetează la programată (toggle)
router.patch("/:id/completeaza", verifyToken, async (req, res) => {
  const programareId = req.params.id;
  const userId = req.user.id;
  const role = req.user.role;

  if (role !== "doctor") {
    return res.status(403).json({ error: "Doar doctorii pot marca programările ca completate" });
  }

  try {
    // Verifică că programarea aparține doctorului
    const [programare] = await db.promise().query(
      "SELECT * FROM programari WHERE id = ? AND doctor_id = ?",
      [programareId, userId]
    );

    if (programare.length === 0) {
      return res.status(404).json({ error: "Programare inexistentă sau nu ai permisiunea" });
    }

    // Toggle statusul - dacă e completată, o setăm la programată, altfel la completată
    const newStatus = programare[0].status === 'completata' ? 'programata' : 'completata';

    await db.promise().query(
      "UPDATE programari SET status = ? WHERE id = ?",
      [newStatus, programareId]
    );

    res.json({ message: newStatus === 'completata' ? "Programare marcată ca completată" : "Programare resetată la status programată" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Eroare server" });
  }
});

// Șterge o programare
router.delete("/:id", verifyToken, async (req, res) => {
  const programareId = req.params.id;
  const userId = req.user.id;
  const role = req.user.role;

  try {
    // Verifică că programarea aparține utilizatorului
    const [programare] = await db.promise().query(
      "SELECT * FROM programari WHERE id = ?",
      [programareId]
    );

    if (programare.length === 0) {
      return res.status(404).json({ error: "Programare inexistentă" });
    }

    // Doar doctorul poate anula programarea
    if (role === "doctor" && programare[0].doctor_id !== userId) {
      return res.status(403).json({ error: "Nu ai permisiunea să anulezi această programare" });
    }

    if (role === "pacient" && programare[0].pacient_id !== userId) {
      return res.status(403).json({ error: "Nu ai permisiunea să anulezi această programare" });
    }

    // Șterge programarea
    await db.promise().query("DELETE FROM programari WHERE id = ?", [programareId]);

    res.json({ message: "Programare anulată cu succes" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Eroare server" });
  }
});

export default router;