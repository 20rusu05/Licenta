import express from "express";
import { db } from "../db.js";
import { verifyToken } from "./middleware/authMiddleware.js";

const router = express.Router();

// Creează programare
router.post("/", verifyToken, async (req, res) => {
  const { pacient_id, data_programare } = req.body;
  const doctor_id = req.user.id;

  if (!pacient_id || !data_programare) return res.status(400).json({ error: "Date incomplete" });

  try {
    const mysqlDateTime = new Date(data_programare).toISOString().slice(0, 19).replace('T', ' ');
    
    await db.promise().query(
      "INSERT INTO programari (pacient_id, doctor_id, data_programare) VALUES (?, ?, ?)",
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
  const filter = req.query.filter || 'toate';
  const search = String(req.query.search || '').trim();

  try {
    let query, countQuery, countsQuery;
    let listParams = [];
    let countParams = [];
    let countsParams = [];

    const searchLike = `%${search}%`;

    if (role === "doctor") {
      let whereClause = "p.doctor_id = ?";
      let countsWhereClause = "p.doctor_id = ?";
      const searchClause = search
        ? ` AND (
              u.nume LIKE ?
              OR u.prenume LIKE ?
              OR u.email LIKE ?
              OR DATE_FORMAT(p.data_programare, '%d.%m.%Y') LIKE ?
              OR DATE_FORMAT(p.data_programare, '%d.%m.%Y, %H:%i') LIKE ?
              OR DATE_FORMAT(p.data_programare, '%Y-%m-%d') LIKE ?
            )`
        : "";

      if (filter === 'viitoare') {
        whereClause += " AND p.data_programare > NOW() AND p.status != 'completata'";
      } else if (filter === 'trecute') {
        whereClause += " AND p.data_programare <= NOW() AND p.status != 'completata'";
      } else if (filter === 'completate') {
        whereClause += " AND p.status = 'completata'";
      }

      whereClause += searchClause;
      countsWhereClause += searchClause;

      query = `
        SELECT p.id, p.data_programare, p.status, p.pacient_id, u.nume AS pacient_nume, u.email AS pacient_email
        FROM programari p
        JOIN pacienti u ON p.pacient_id = u.id
        WHERE ${whereClause}
        ORDER BY p.data_programare ASC
        LIMIT ? OFFSET ?
      `;

      countQuery = `
        SELECT COUNT(*) AS total
        FROM programari p
        JOIN pacienti u ON p.pacient_id = u.id
        WHERE ${whereClause}
      `;

      countsQuery = `
        SELECT 
          COUNT(*) AS toate,
          COALESCE(SUM(CASE WHEN p.data_programare IS NOT NULL AND p.data_programare > NOW() AND p.status != 'completata' THEN 1 ELSE 0 END), 0) AS viitoare,
          COALESCE(SUM(CASE WHEN p.data_programare IS NOT NULL AND p.data_programare <= NOW() AND p.status != 'completata' THEN 1 ELSE 0 END), 0) AS trecute,
          COALESCE(SUM(CASE WHEN p.status = 'completata' THEN 1 ELSE 0 END), 0) AS completate
        FROM programari p
        JOIN pacienti u ON p.pacient_id = u.id
        WHERE ${countsWhereClause}
      `;

      const searchParams = search
        ? [searchLike, searchLike, searchLike, searchLike, searchLike, searchLike]
        : [];

      countParams = [userId, ...searchParams];
      countsParams = [userId, ...searchParams];
      listParams = [userId, ...searchParams, limit, offset];
    } else {
      let whereClause = "p.pacient_id = ?";
      let countsWhereClause = "p.pacient_id = ?";
      const searchClause = search
        ? ` AND (
              d.nume LIKE ?
              OR d.prenume LIKE ?
              OR d.email LIKE ?
              OR DATE_FORMAT(p.data_programare, '%d.%m.%Y') LIKE ?
              OR DATE_FORMAT(p.data_programare, '%d.%m.%Y, %H:%i') LIKE ?
              OR DATE_FORMAT(p.data_programare, '%Y-%m-%d') LIKE ?
            )`
        : "";

      if (filter === 'viitoare') {
        whereClause += " AND p.data_programare > NOW() AND p.status != 'completata'";
      } else if (filter === 'trecute') {
        whereClause += " AND p.data_programare <= NOW() AND p.status != 'completata'";
      } else if (filter === 'completate') {
        whereClause += " AND p.status = 'completata'";
      }

      whereClause += searchClause;
      countsWhereClause += searchClause;

      query = `
        SELECT p.id, p.data_programare, p.status, p.doctor_id, d.nume AS medic_nume, d.email AS medic_email
        FROM programari p
        JOIN doctori d ON p.doctor_id = d.id
        WHERE ${whereClause}
        ORDER BY p.data_programare ASC
        LIMIT ? OFFSET ?
      `;

      countQuery = `
        SELECT COUNT(*) AS total
        FROM programari p
        JOIN doctori d ON p.doctor_id = d.id
        WHERE ${whereClause}
      `;

      countsQuery = `
        SELECT 
          COUNT(*) AS toate,
          COALESCE(SUM(CASE WHEN p.data_programare IS NOT NULL AND p.data_programare > NOW() AND p.status != 'completata' THEN 1 ELSE 0 END), 0) AS viitoare,
          COALESCE(SUM(CASE WHEN p.data_programare IS NOT NULL AND p.data_programare <= NOW() AND p.status != 'completata' THEN 1 ELSE 0 END), 0) AS trecute,
          COALESCE(SUM(CASE WHEN p.status = 'completata' THEN 1 ELSE 0 END), 0) AS completate
        FROM programari p
        JOIN doctori d ON p.doctor_id = d.id
        WHERE ${countsWhereClause}
      `;

      const searchParams = search
        ? [searchLike, searchLike, searchLike, searchLike, searchLike, searchLike]
        : [];

      countParams = [userId, ...searchParams];
      countsParams = [userId, ...searchParams];
      listParams = [userId, ...searchParams, limit, offset];
    }

    const [[countsRow]] = await db.promise().query(countsQuery, countsParams);
    const [[countRow]] = await db.promise().query(countQuery, countParams);
    const total = countRow.total;

    const [rows] = await db.promise().query(query, listParams);

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
  const { data_programare, resetStatus } = req.body;
  const userId = req.user.id;
  const role = req.user.role;

  if (!data_programare) return res.status(400).json({ error: "Data programării este obligatorie" });

  if (role !== "doctor") {
    return res.status(403).json({ error: "Doar doctorii pot modifica programările" });
  }

  try {
    const [programare] = await db.promise().query(
      "SELECT * FROM programari WHERE id = ? AND doctor_id = ?",
      [programareId, userId]
    );

    if (programare.length === 0) {
      return res.status(404).json({ error: "Programare inexistentă sau nu ai permisiunea" });
    }

    const mysqlDateTime = new Date(data_programare).toISOString().slice(0, 19).replace('T', ' ');

    if (resetStatus) {
      // Dacă programarea era completată și o reprogramăm, o resetăm la 'programata'
      await db.promise().query(
        "UPDATE programari SET data_programare = ?, status = 'programata' WHERE id = ?",
        [mysqlDateTime, programareId]
      );
    } else {
      await db.promise().query(
        "UPDATE programari SET data_programare = ? WHERE id = ?",
        [mysqlDateTime, programareId]
      );
    }

    res.json({ message: "Programare actualizată cu succes" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Eroare server" });
  }
});

router.patch("/:id/completeaza", verifyToken, async (req, res) => {
  const programareId = req.params.id;
  const userId = req.user.id;
  const role = req.user.role;

  if (role !== "doctor") {
    return res.status(403).json({ error: "Doar doctorii pot marca programările ca completate" });
  }

  try {
    const [programare] = await db.promise().query(
      "SELECT * FROM programari WHERE id = ? AND doctor_id = ?",
      [programareId, userId]
    );

    if (programare.length === 0) {
      return res.status(404).json({ error: "Programare inexistentă sau nu ai permisiunea" });
    }


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

router.delete("/:id", verifyToken, async (req, res) => {
  const programareId = req.params.id;
  const userId = req.user.id;
  const role = req.user.role;

  try {
    const [programare] = await db.promise().query(
      "SELECT * FROM programari WHERE id = ?",
      [programareId]
    );

    if (programare.length === 0) {
      return res.status(404).json({ error: "Programare inexistentă" });
    }

    if (role === "doctor" && programare[0].doctor_id !== userId) {
      return res.status(403).json({ error: "Nu ai permisiunea să anulezi această programare" });
    }

    if (role === "pacient" && programare[0].pacient_id !== userId) {
      return res.status(403).json({ error: "Nu ai permisiunea să anulezi această programare" });
    }

    await db.promise().query("DELETE FROM programari WHERE id = ?", [programareId]);

    res.json({ message: "Programare anulată cu succes" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Eroare server" });
  }
});

export default router;