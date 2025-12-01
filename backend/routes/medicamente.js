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
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;
  
  // Parametri pentru paginarea aplicantilor per medicament
  const medicamentId = req.query.medicamentId ? parseInt(req.query.medicamentId) : null;
  const aplicantiPage = parseInt(req.query.aplicantiPage) || 1;
  const aplicantiLimit = parseInt(req.query.aplicantiLimit) || 5;
  const aplicantiOffset = (aplicantiPage - 1) * aplicantiLimit;

  try {
    // Total medicamente (count)
    const [[{ total }]] = await db.promise().query(
      "SELECT COUNT(*) AS total FROM medicamente"
    );

    // Lista medicamente (fara aplicanti)
    const [medicamente] = await db.promise().query(
      `SELECT id, denumire, descriere, complet FROM medicamente ORDER BY id DESC LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    // Daca se cere un medicament specific, returnam doar acel medicament cu aplicantii
    if (medicamentId) {
      const [medicamentSpecific] = await db.promise().query(
        `SELECT id, denumire, descriere, complet FROM medicamente WHERE id = ?`,
        [medicamentId]
      );

      if (medicamentSpecific.length === 0) {
        return res.status(404).json({ error: "Medicament inexistent" });
      }

      const m = medicamentSpecific[0];

      // Count total aplicanti pentru acest medicament
      const [[{ totalAplicanti }]] = await db.promise().query(
        `SELECT COUNT(*) AS totalAplicanti FROM aplicari_medicamente WHERE medicament_id = ?`,
        [m.id]
      );

      // Aplicanti paginati
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

    // Pentru fiecare medicament, luam count-ul aplicantilor 
    // Si pentru pacienti, returnam aplicarea lor daca exista
    // Filtrăm medicamentele completate pentru pacienți
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
        
        // Daca utilizatorul e pacient, returnam doar aplicarea lui (daca exista)
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

        return {
          id: m.id,
          denumire: m.denumire,
          descriere: m.descriere,
          complet: m.complet,
          aplicanti: aplicantiArray,
          aplicantiTotal: totalAplicanti,
          aplicantiPage: 1,
          aplicantiLimit: aplicantiLimit,
        };
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

  // Validare: data nu poate fi în trecut
  const dataSelectata = new Date(dataProgramare);
  const now = new Date();
  if (dataSelectata < now) {
    return res.status(400).json({ error: "Nu poti seta o programare in trecut" });
  }

  try {
    // luam pacientul si medicamentul din aplicare
    const [rows] = await db.promise().query(
      "SELECT pacient_id, medicament_id FROM aplicari_medicamente WHERE id = ?",
      [aplicareId]
    );

    if (rows.length === 0) return res.status(404).json({ error: "Aplicare inexistenta" });

    const { pacient_id, medicament_id } = rows[0];

    // Validare: nu pot exista 2 programari la aceeasi ora pentru acelasi doctor
    const [existing] = await db.promise().query(
      "SELECT id FROM programari WHERE doctor_id = ? AND data_programare = ?",
      [req.user.id, dataProgramare]
    );

    if (existing.length > 0) {
      return res.status(400).json({ error: "Exista deja o programare la aceasta ora" });
    }

    // Tabelul programari are: doctor_id, pacient_id, data_programare
    await db.promise().query(
      "INSERT INTO programari (doctor_id, pacient_id, data_programare) VALUES (?, ?, ?)",
      [req.user.id, pacient_id, dataProgramare]
    );

    res.json({ message: "Programare creata" });
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

router.post("/programari", authMiddleware, async (req, res) => {
  if (req.user.role !== "doctor")
    return res.status(403).json({ error: "Doar doctorii pot crea programari" });

  const { aplicareId, data } = req.body;

  if (!aplicareId || !data)
    return res.status(400).json({ error: "Date insuficiente" });

  const dataSelectata = new Date(data);
  const now = new Date();

  // 1. Verificare sa nu fie in trecut
  if (dataSelectata < now)
    return res.status(400).json({ error: "Nu poti seta o programare in trecut" });

  try {
    // 2. Verifica daca exista deja o programare la aceeasi ora
    const [existing] = await db
      .promise()
      .query(
        "SELECT id FROM programari WHERE doctor_id = ? AND data = ?",
        [req.user.id, data]
      );

    if (existing.length > 0)
      return res.status(400).json({ error: "Exista deja o programare la aceasta ora" });

    // 3. Creeaza programarea
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
router.get("/aplicari", authMiddleware, async (req, res) => {
  if (req.user.role !== "doctor") {
    return res.status(403).json({ error: "Doar doctorii pot vizualiza aplicările" });
  }

  const { status } = req.query; // Preluam status din query params

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

// Marcare medicament ca complet (nu mai accepta aplicanti)
router.patch("/:id/completeaza", authMiddleware, async (req, res) => {
  if (req.user.role !== "doctor") {
    return res.status(403).json({ error: "Doar doctorii pot completa medicamente" });
  }

  const medicamentId = req.params.id;

  try {
    // Verifică că medicamentul aparține doctorului
    const [medicament] = await db.promise().query(
      "SELECT * FROM medicamente WHERE id = ? AND doctor_id = ?",
      [medicamentId, req.user.id]
    );

    if (medicament.length === 0) {
      return res.status(404).json({ error: "Medicament inexistent sau nu ai permisiunea" });
    }

    // Toggle complet status
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
