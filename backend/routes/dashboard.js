import express from 'express';
import { db } from '../db.js';
import { verifyToken } from './middleware/authMiddleware.js';

const router = express.Router();

// GET /api/dashboard/stats - Statistici pentru dashboard
router.get('/stats', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    if (userRole === 'doctor') {
      // Statistici pentru doctor
      const [totalPacienti] = await db.promise().query(
        'SELECT COUNT(DISTINCT pacient_id) as total FROM programari WHERE doctor_id = ?',
        [userId]
      );

      const [programariAzi] = await db.promise().query(
        `SELECT COUNT(*) as total FROM programari 
         WHERE doctor_id = ? 
         AND DATE(data_programare) = CURDATE()
         AND status != 'anulata'`,
        [userId]
      );

      const [programariSaptamana] = await db.promise().query(
        `SELECT COUNT(*) as total FROM programari 
         WHERE doctor_id = ? 
         AND YEARWEEK(data_programare, 1) = YEARWEEK(CURDATE(), 1)
         AND status != 'anulata'`,
        [userId]
      );

      const [cereriPending] = await db.promise().query(
        `SELECT COUNT(*) as total FROM aplicari_medicamente am
         JOIN medicamente m ON am.medicament_id = m.id
         WHERE m.doctor_id = ? AND am.status = 'pending'`,
        [userId]
      );

      const [medicamenteActive] = await db.promise().query(
        'SELECT COUNT(*) as total FROM medicamente WHERE doctor_id = ? AND complet = 0',
        [userId]
      );

      // Programări de azi
      const [programariDeAzi] = await db.promise().query(
        `SELECT p.id, p.data_programare, p.status,
                pac.nume, pac.prenume, pac.email
         FROM programari p
         JOIN pacienti pac ON p.pacient_id = pac.id
         WHERE p.doctor_id = ? 
         AND DATE(p.data_programare) = CURDATE()
         AND p.status != 'anulata'
         ORDER BY p.data_programare ASC
         LIMIT 5`,
        [userId]
      );

      // Activitate recentă (ultimele 10 acțiuni)
      const [activitateRecenta] = await db.promise().query(
        `SELECT 'programare' as tip, p.id, p.created_at as data, 
                pac.nume, pac.prenume, DATE_FORMAT(p.data_programare, '%d/%m/%Y %H:%i') as detalii
         FROM programari p
         JOIN pacienti pac ON p.pacient_id = pac.id
         WHERE p.doctor_id = ?
         UNION ALL
         SELECT 'cerere_medicament' as tip, am.id, am.created_at as data,
                pac.nume, pac.prenume, m.denumire as detalii
         FROM aplicari_medicamente am
         JOIN pacienti pac ON am.pacient_id = pac.id
         JOIN medicamente m ON am.medicament_id = m.id
         WHERE m.doctor_id = ?
         ORDER BY data DESC
         LIMIT 10`,
        [userId, userId]
      );

      // Statistici programări pe următoarele 7 zile
      const [programariSaptamanalaRaw] = await db.promise().query(
        `SELECT DATE(data_programare) as data, COUNT(*) as total
         FROM programari
         WHERE doctor_id = ? 
         AND data_programare >= CURDATE()
         AND data_programare < DATE_ADD(CURDATE(), INTERVAL 7 DAY)
         AND status != 'anulata'
         GROUP BY DATE(data_programare)
         ORDER BY data ASC`,
        [userId]
      );

      // Convertește datele la format string YYYY-MM-DD
      const programariSaptamanala = programariSaptamanalaRaw.map(row => {
        let dateStr;
        if (row.data instanceof Date) {
          // Conversie corectă din Date la YYYY-MM-DD în timezone local
          const year = row.data.getFullYear();
          const month = String(row.data.getMonth() + 1).padStart(2, '0');
          const day = String(row.data.getDate()).padStart(2, '0');
          dateStr = `${year}-${month}-${day}`;
        } else {
          dateStr = row.data;
        }
        return {
          data: dateStr,
          total: row.total
        };
      });

      // Toate programările din următoarea săptămână (pentru popup)
      const [programariSaptamanaDetalii] = await db.promise().query(
        `SELECT p.id, p.data_programare, p.status,
                pac.nume, pac.prenume, pac.email
         FROM programari p
         JOIN pacienti pac ON p.pacient_id = pac.id
         WHERE p.doctor_id = ? 
         AND p.data_programare >= CURDATE()
         AND p.data_programare < DATE_ADD(CURDATE(), INTERVAL 7 DAY)
         AND p.status != 'anulata'
         ORDER BY p.data_programare ASC`,
        [userId]
      );

      // Top 5 pacienți după număr de programări
      const [topPacienti] = await db.promise().query(
        `SELECT pac.id, pac.nume, pac.prenume, pac.email,
                COUNT(p.id) as total_programari,
                MAX(p.data_programare) as ultima_programare
         FROM pacienti pac
         JOIN programari p ON pac.id = p.pacient_id
         WHERE p.doctor_id = ?
         GROUP BY pac.id, pac.nume, pac.prenume, pac.email
         ORDER BY total_programari DESC
         LIMIT 5`,
        [userId]
      );

      return res.json({
        stats: {
          totalPacienti: totalPacienti[0].total,
          programariAzi: programariAzi[0].total,
          programariSaptamana: programariSaptamana[0].total,
          cereriPending: cereriPending[0].total,
          medicamenteActive: medicamenteActive[0].total
        },
        programariDeAzi,
        activitateRecenta,
        programariSaptamanala,
        programariSaptamanaDetalii,
        topPacienti
      });

    } else {
      // Statistici pentru pacient
      const [totalProgramari] = await db.promise().query(
        'SELECT COUNT(*) as total FROM programari WHERE pacient_id = ?',
        [userId]
      );

      const [programariViitoare] = await db.promise().query(
        `SELECT COUNT(*) as total FROM programari 
         WHERE pacient_id = ? 
         AND data_programare >= NOW()
         AND status != 'anulata'`,
        [userId]
      );

      const [medicamenteActive] = await db.promise().query(
        `SELECT COUNT(*) as total FROM aplicari_medicamente 
         WHERE pacient_id = ? AND status = 'acceptat'`,
        [userId]
      );

      const [cereriPending] = await db.promise().query(
        `SELECT COUNT(*) as total FROM aplicari_medicamente 
         WHERE pacient_id = ? AND status = 'pending'`,
        [userId]
      );

      // Următoarea programare
      const [urmatoareaProgramare] = await db.promise().query(
        `SELECT p.id, p.data_programare, p.status,
                d.nume as doctor_nume, d.prenume as doctor_prenume
         FROM programari p
         JOIN doctori d ON p.doctor_id = d.id
         WHERE p.pacient_id = ? 
         AND p.data_programare >= NOW()
         AND p.status != 'anulata'
         ORDER BY p.data_programare ASC
         LIMIT 1`,
        [userId]
      );

      // Medicamentele mele
      const [medicamentele] = await db.promise().query(
        `SELECT am.id, am.status, am.created_at,
                m.denumire, m.descriere,
                d.nume as doctor_nume, d.prenume as doctor_prenume
         FROM aplicari_medicamente am
         JOIN medicamente m ON am.medicament_id = m.id
         JOIN doctori d ON m.doctor_id = d.id
         WHERE am.pacient_id = ?
         ORDER BY am.created_at DESC
         LIMIT 10`,
        [userId]
      );

      // Istoric programări (ultimele 5)
      const [istoricProgramari] = await db.promise().query(
        `SELECT p.id, p.data_programare, p.status,
                d.nume as doctor_nume, d.prenume as doctor_prenume
         FROM programari p
         JOIN doctori d ON p.doctor_id = d.id
         WHERE p.pacient_id = ?
         ORDER BY p.data_programare DESC
         LIMIT 5`,
        [userId]
      );

      // Programări viitoare
      const [programariViitoareList] = await db.promise().query(
        `SELECT p.id, p.data_programare, p.status,
                d.nume as doctor_nume, d.prenume as doctor_prenume
         FROM programari p
         JOIN doctori d ON p.doctor_id = d.id
         WHERE p.pacient_id = ? 
         AND p.data_programare >= NOW()
         AND p.status != 'anulata'
         ORDER BY p.data_programare ASC
         LIMIT 5`,
        [userId]
      );

      return res.json({
        stats: {
          totalProgramari: totalProgramari[0].total,
          programariViitoare: programariViitoare[0].total,
          medicamenteActive: medicamenteActive[0].total,
          cereriPending: cereriPending[0].total
        },
        urmatoareaProgramare: urmatoareaProgramare[0] || null,
        medicamentele,
        istoricProgramari,
        programariViitoareList
      });
    }

  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ message: 'Eroare la încărcarea statisticilor' });
  }
});

export default router;
