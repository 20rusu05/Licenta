import express from "express";
import { db } from "../db.js";
import { verifyToken } from "./middleware/authMiddleware.js";

const router = express.Router();

// Middleware pentru verificare admin
const isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: "Acces interzis. Doar adminii pot accesa aceasta resursa." });
  }
  next();
};

// Get all users (doctors and patients)
router.get("/users", verifyToken, isAdmin, async (req, res) => {
  try {
    const [doctori] = await db
      .promise()
      .query("SELECT id, nume, prenume, email, telefon, created_at FROM doctori ORDER BY created_at DESC");
    
    const [pacienti] = await db
      .promise()
      .query("SELECT id, nume, prenume, email, telefon, created_at FROM pacienti ORDER BY created_at DESC");

    const users = {
      doctori: doctori.map(d => ({ ...d, role: 'doctor' })),
      pacienti: pacienti.map(p => ({ ...p, role: 'pacient' }))
    };

    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Eroare la preluarea utilizatorilor" });
  }
});

// Get user statistics
router.get("/statistics", verifyToken, isAdmin, async (req, res) => {
  try {
    const [doctoriCount] = await db
      .promise()
      .query("SELECT COUNT(*) as count FROM doctori");
    
    const [pacientiCount] = await db
      .promise()
      .query("SELECT COUNT(*) as count FROM pacienti");
    
    const [programariCount] = await db
      .promise()
      .query("SELECT COUNT(*) as count FROM programari");
    
    const [medicamenteCount] = await db
      .promise()
      .query("SELECT COUNT(*) as count FROM medicamente");

    res.json({
      doctori: doctoriCount[0].count,
      pacienti: pacientiCount[0].count,
      programari: programariCount[0].count,
      medicamente: medicamenteCount[0].count
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Eroare la preluarea statisticilor" });
  }
});

// Delete doctor (cascade delete will handle related data)
router.delete("/users/doctor/:id", verifyToken, isAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    // Verifică dacă doctorul există
    const [doctor] = await db
      .promise()
      .query("SELECT id, nume, prenume, email FROM doctori WHERE id = ?", [id]);

    if (doctor.length === 0) {
      return res.status(404).json({ error: "Doctorul nu a fost găsit" });
    }

    // Șterge doctorul (cascade va șterge automat: medicamente, aplicari_medicamente, programari)
    await db
      .promise()
      .query("DELETE FROM doctori WHERE id = ?", [id]);

    res.json({ 
      message: "Doctor șters cu succes",
      deletedUser: doctor[0]
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Eroare la ștergerea doctorului" });
  }
});

// Delete patient (cascade delete will handle related data)
router.delete("/users/pacient/:id", verifyToken, isAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    // Verifică dacă pacientul există
    const [pacient] = await db
      .promise()
      .query("SELECT id, nume, prenume, email FROM pacienti WHERE id = ?", [id]);

    if (pacient.length === 0) {
      return res.status(404).json({ error: "Pacientul nu a fost găsit" });
    }

    // Șterge pacientul (cascade va șterge automat: aplicari_medicamente, programari)
    await db
      .promise()
      .query("DELETE FROM pacienti WHERE id = ?", [id]);

    res.json({ 
      message: "Pacient șters cu succes",
      deletedUser: pacient[0]
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Eroare la ștergerea pacientului" });
  }
});

// Get user details with related data count
router.get("/users/:role/:id", verifyToken, isAdmin, async (req, res) => {
  const { role, id } = req.params;

  if (role !== 'doctor' && role !== 'pacient') {
    return res.status(400).json({ error: "Rol invalid" });
  }

  try {
    const tableName = role === 'doctor' ? 'doctori' : 'pacienti';
    
    const [user] = await db
      .promise()
      .query(`SELECT id, nume, prenume, email, telefon, created_at FROM ${tableName} WHERE id = ?`, [id]);

    if (user.length === 0) {
      return res.status(404).json({ error: "Utilizatorul nu a fost găsit" });
    }

    let relatedData = {};

    if (role === 'doctor') {
      const [medicamente] = await db
        .promise()
        .query("SELECT COUNT(*) as count FROM medicamente WHERE doctor_id = ?", [id]);
      
      const [programari] = await db
        .promise()
        .query("SELECT COUNT(*) as count FROM programari WHERE doctor_id = ?", [id]);
      
      relatedData = {
        medicamente: medicamente[0].count,
        programari: programari[0].count
      };
    } else {
      const [aplicari] = await db
        .promise()
        .query("SELECT COUNT(*) as count FROM aplicari_medicamente WHERE pacient_id = ?", [id]);
      
      const [programari] = await db
        .promise()
        .query("SELECT COUNT(*) as count FROM programari WHERE pacient_id = ?", [id]);
      
      relatedData = {
        aplicari_medicamente: aplicari[0].count,
        programari: programari[0].count
      };
    }

    res.json({
      user: { ...user[0], role },
      relatedData
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Eroare la preluarea detaliilor utilizatorului" });
  }
});

export default router;
