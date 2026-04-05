import express from "express";
import { db } from "../db.js";
import jwt from "jsonwebtoken";

const router = express.Router();

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

router.get("/", authMiddleware, async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;
  
  const medicamentId = req.query.medicamentId ? parseInt(req.query.medicamentId) : null;
  const aplicantiPage = parseInt(req.query.aplicantiPage) || 1;
  const aplicantiLimit = parseInt(req.query.aplicantiLimit) || 5;
  const aplicantiOffset = (aplicantiPage - 1) * aplicantiLimit;

  try {
    let countQuery, selectQuery, queryParams = [];
    
    if (req.user.role === 'pacient') {
      countQuery = "SELECT COUNT(*) AS total FROM medicamente";
      selectQuery = `SELECT m.id, m.denumire, m.descriere, m.complet, d.nume AS doctor_nume, d.prenume AS doctor_prenume 
                     FROM medicamente m 
                     JOIN doctori d ON m.doctor_id = d.id 
                     ORDER BY m.id DESC LIMIT ? OFFSET ?`;
    } else {
      countQuery = "SELECT COUNT(*) AS total FROM medicamente WHERE doctor_id = ?";
      selectQuery = `SELECT m.id, m.denumire, m.descriere, m.complet 
                     FROM medicamente m 
                     WHERE m.doctor_id = ? 
                     ORDER BY m.id DESC LIMIT ? OFFSET ?`;
      queryParams = [req.user.id];
    }
    
    const [[{ total }]] = await db.promise().query(
      countQuery,
      req.user.role === 'doctor' ? [req.user.id] : []
    );

    const [medicamente] = await db.promise().query(
      selectQuery,
      req.user.role === 'doctor' ? [...queryParams, limit, offset] : [limit, offset]
    );

    if (medicamentId) {
      let medicamentQuery = `SELECT id, denumire, descriere, complet, doctor_id FROM medicamente WHERE id = ?`;
      let medicamentParams = [medicamentId];
      
      if (req.user.role === 'doctor') {
        medicamentQuery += ` AND doctor_id = ?`;
        medicamentParams.push(req.user.id);
      }
      
      const [medicamentSpecific] = await db.promise().query(
        medicamentQuery,
        medicamentParams
      );

      if (medicamentSpecific.length === 0) {
        return res.status(404).json({ error: "Medicament inexistent sau nu ai acces la el" });
      }

      const m = medicamentSpecific[0];

      const [[{ totalAplicanti }]] = await db.promise().query(
        `SELECT COUNT(*) AS totalAplicanti FROM aplicari_medicamente WHERE medicament_id = ?`,
        [m.id]
      );

      const [aplicantiRows] = await db.promise().query(
        `
        SELECT 
          a.id,
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
        FROM aplicari_medicamente a
        JOIN pacienti p ON p.id = a.pacient_id
        WHERE a.medicament_id = ?
        ORDER BY a.id ASC
        LIMIT ? OFFSET ?
        `,
        [m.id, aplicantiLimit, aplicantiOffset]
      );

      return res.json({
        medicament: {
          id: m.id,
          denumire: m.denumire,
          descriere: m.descriere,
          complet: m.complet,
          aplicanti: aplicantiRows,
          aplicantiTotal: totalAplicanti,
          aplicantiPage: aplicantiPage,
          aplicantiLimit: aplicantiLimit,
        }
      });
    }

    let medicamenteFiltered = medicamente;
    if (req.user.role === 'pacient') {
      medicamenteFiltered = medicamente.filter(m => !m.complet);
    }
    
    const medicamenteWithAplicanti = await Promise.all(
      medicamenteFiltered.map(async (m) => {
        // Count total aplicanti pentru acest medicament
        const [[{ totalAplicanti }]] = await db.promise().query(
          `SELECT COUNT(*) AS totalAplicanti FROM aplicari_medicamente WHERE medicament_id = ?`,
          [m.id]
        );

        let aplicantiArray = [];
        
        if (req.user.role === 'pacient') {
          const [aplicarePacient] = await db.promise().query(
            `
            SELECT 
              a.id,
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
            FROM aplicari_medicamente a
            JOIN pacienti p ON p.id = a.pacient_id
            WHERE a.medicament_id = ? AND a.pacient_id = ?
            `,
            [m.id, req.user.id]
          );
          aplicantiArray = aplicarePacient;
        }

        const medicamentResult = {
          id: m.id,
          denumire: m.denumire,
          descriere: m.descriere,
          complet: m.complet,
          aplicanti: aplicantiArray,
          aplicantiTotal: totalAplicanti,
          aplicantiPage: 1,
          aplicantiLimit: aplicantiLimit,
        };
        
        if (req.user.role === 'pacient') {
          medicamentResult.doctor_nume = m.doctor_nume;
          medicamentResult.doctor_prenume = m.doctor_prenume;
        }
        
        return medicamentResult;
      })
    );

    res.json({
      total,
      page,
      limit,
      medicamente: medicamenteWithAplicanti,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Eroare server" });
  }
});

router.post("/aplicari/:id/programare", authMiddleware, async (req, res) => {
  if (req.user.role !== "doctor")
    return res.status(403).json({ error: "Doar doctorii pot crea programari" });

  const aplicareId = req.params.id;
  const { dataProgramare } = req.body;

  if (!dataProgramare)
    return res.status(400).json({ error: "Data programarii este obligatorie" });

  const dataSelectata = new Date(dataProgramare);
  const now = new Date();
  if (dataSelectata < now) {
    return res.status(400).json({ error: "Nu poti seta o programare in trecut" });
  }

  try {
    const [rows] = await db.promise().query(
      "SELECT pacient_id, medicament_id FROM aplicari_medicamente WHERE id = ?",
      [aplicareId]
    );

    if (rows.length === 0) return res.status(404).json({ error: "Aplicare inexistenta" });

    const { pacient_id, medicament_id } = rows[0];

    const [existing] = await db.promise().query(
      "SELECT id FROM programari WHERE doctor_id = ? AND data_programare = ?",
      [req.user.id, dataProgramare]
    );

    if (existing.length > 0) {
      return res.status(400).json({ error: "Exista deja o programare la aceasta ora" });
    }

    await db.promise().query(
      "INSERT INTO programari (doctor_id, pacient_id, data_programare) VALUES (?, ?, ?)",
      [req.user.id, pacient_id, dataProgramare]
    );

    await db.promise().query(
      "UPDATE aplicari_medicamente SET status = 'acceptat' WHERE id = ?",
      [aplicareId]
    );

    res.json({ message: "Programare creata" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Eroare server" });
  }
});

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

  const fumeazaValues = ["da", "nu", "fost"];
  const activitateValues = ["sedentar", "usoara", "moderata", "intensa"];
  const fumeazaValue = fumeazaValues.includes(fumeaza) ? fumeaza : null;
  const activitateValue = activitateValues.includes(activitate_fizica) ? activitate_fizica : null;
  const problemeInimaValue = typeof probleme_inima === "boolean" ? probleme_inima : null;

  const greutateValue = parseFloat(greutate);
  const inaltimeValue = parseFloat(inaltime);

  if (isNaN(greutateValue) || isNaN(inaltimeValue)) {
    return res.status(400).json({
      error: "Câmpurile 'Greutate' și 'Înălțime' trebuie să conțină doar numere.",
    });
  }

  try {
    const [existing] = await db
      .promise()
      .query(
        "SELECT id FROM aplicari_medicamente WHERE medicament_id = ? AND pacient_id = ?",
        [medicamentId, pacientId]
      );

    if (existing.length > 0) {
      return res.status(400).json({ error: "Ai aplicat deja la acest medicament" });
    }

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

router.post("/programari", authMiddleware, async (req, res) => {
  if (req.user.role !== "doctor")
    return res.status(403).json({ error: "Doar doctorii pot crea programari" });

  const { aplicareId, data } = req.body;

  if (!aplicareId || !data)
    return res.status(400).json({ error: "Date insuficiente" });

  const dataSelectata = new Date(data);
  const now = new Date();

  if (dataSelectata < now)
    return res.status(400).json({ error: "Nu poti seta o programare in trecut" });

  try {
    const [existing] = await db
      .promise()
      .query(
        "SELECT id FROM programari WHERE doctor_id = ? AND data = ?",
        [req.user.id, data]
      );

    if (existing.length > 0)
      return res.status(400).json({ error: "Exista deja o programare la aceasta ora" });

    await db
      .promise()
      .query(
        "INSERT INTO programari (doctor_id, aplicare_id, data) VALUES (?, ?, ?)",
        [req.user.id, aplicareId, data]
      );

    res.json({ message: "Programare creata" });
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

router.delete("/aplicare/:id", authMiddleware, async (req, res) => {
  const aplicareId = req.params.id;

  try {
    const [rows] = await db.promise().query(
      "SELECT * FROM aplicari_medicamente WHERE id = ? AND pacient_id = ?",
      [aplicareId, req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Aplicarea nu exista sau nu iti apartine" });
    }

    if (rows[0].status !== "pending") {
      return res.status(400).json({ error: "Nu poti renunta daca aplicarea nu este pending" });
    }

    await db.promise().query("DELETE FROM aplicari_medicamente WHERE id = ?", [aplicareId]);

    res.json({ message: "Aplicarea a fost stearsa (renuntare efectuata)." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Eroare server" });
  }
});
router.get("/aplicari", authMiddleware, async (req, res) => {
  if (req.user.role !== "doctor") {
    return res.status(403).json({ error: "Doar doctorii pot vizualiza aplicările" });
  }

  const { status } = req.query;

  let sql = `
    SELECT 
      a.id,
      a.status,
      a.created_at,
      m.denumire AS medicament_denumire,
      p.nume AS pacient_nume,
      p.email AS pacient_email
    FROM aplicari_medicamente a
    JOIN medicamente m ON m.id = a.medicament_id
    JOIN pacienti p ON p.id = a.pacient_id
  `;
  const params = [];

  if (status) {
    sql += " WHERE a.status = ?";
    params.push(status);
  }

  sql += " ORDER BY a.created_at DESC";

  try {
    const [rows] = await db.promise().query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Eroare server" });
  }
});

router.patch("/:id/completeaza", authMiddleware, async (req, res) => {
  if (req.user.role !== "doctor") {
    return res.status(403).json({ error: "Doar doctorii pot completa medicamente" });
  }

  const medicamentId = req.params.id;

  try {
    const [medicament] = await db.promise().query(
      "SELECT * FROM medicamente WHERE id = ? AND doctor_id = ?",
      [medicamentId, req.user.id]
    );

    if (medicament.length === 0) {
      return res.status(404).json({ error: "Medicament inexistent sau nu ai permisiunea" });
    }

    const complet = medicament[0].complet ? 0 : 1;

    await db.promise().query(
      "UPDATE medicamente SET complet = ? WHERE id = ?",
      [complet, medicamentId]
    );

    res.json({ message: complet ? "Medicament marcat ca complet" : "Medicament redeschis pentru aplicări" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Eroare server" });
  }
});

export default router;
