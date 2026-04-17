import express from "express";
import { db } from "../db.js";
import { verifyToken } from "./middleware/authMiddleware.js";

const router = express.Router();

const sanitizeText = (value) => String(value || "").trim();

const CONTACTS_DOCTOR_QUERY = `
  SELECT DISTINCT
    p.id,
    p.nume,
    p.prenume,
    p.email,
    p.avatar_url
  FROM pacienti p
  WHERE p.id IN (
    SELECT DISTINCT am.pacient_id
    FROM aplicari_medicamente am
    JOIN medicamente m ON m.id = am.medicament_id
    WHERE m.doctor_id = ?
  )
`;

const CONTACTS_PACIENT_QUERY = `
  SELECT DISTINCT
    d.id,
    d.nume,
    d.prenume,
    d.email,
    d.avatar_url
  FROM doctori d
  WHERE d.id IN (
    SELECT DISTINCT m.doctor_id
    FROM aplicari_medicamente am
    JOIN medicamente m ON m.id = am.medicament_id
    WHERE am.pacient_id = ?
      AND am.status = 'acceptat'
  )
`;

async function getAllowedCounterpartIds(userId, role) {
  if (role === "doctor") {
    const [rows] = await db.promise().query(
      `
      SELECT DISTINCT p.id
      FROM pacienti p
      WHERE p.id IN (
        SELECT DISTINCT am.pacient_id
        FROM aplicari_medicamente am
        JOIN medicamente m ON m.id = am.medicament_id
        WHERE m.doctor_id = ?
      )
      `,
      [userId]
    );
    return new Set(rows.map((r) => Number(r.id)));
  }

  const [rows] = await db.promise().query(
    `
    SELECT DISTINCT d.id
    FROM doctori d
    WHERE d.id IN (
      SELECT DISTINCT m.doctor_id
      FROM aplicari_medicamente am
      JOIN medicamente m ON m.id = am.medicament_id
      WHERE am.pacient_id = ?
        AND am.status = 'acceptat'
    )
    `,
    [userId]
  );

  return new Set(rows.map((r) => Number(r.id)));
}

async function getConversationForUser(conversationId, userId, role) {
  const [rows] = await db.promise().query(
    `
    SELECT c.id, c.doctor_id, c.pacient_id, cs.deleted_at
    FROM conversatii c
    LEFT JOIN conversatii_sterse cs
      ON cs.conversatie_id = c.id
      AND cs.user_role = ?
      AND cs.user_id = ?
    WHERE c.id = ?
      AND (${role === "doctor" ? "c.doctor_id = ?" : "c.pacient_id = ?"})
    LIMIT 1
    `,
    [role, userId, conversationId, userId]
  );

  return rows[0] || null;
}

router.get("/contacts", verifyToken, async (req, res) => {
  const userId = req.user.id;
  const role = req.user.role;
  const search = sanitizeText(req.query.search);

  if (role !== "doctor" && role !== "pacient") {
    return res.status(403).json({ error: "Doar doctorii și pacienții au acces la mesaje" });
  }

  try {
    const params = [userId];
    let query = role === "doctor" ? CONTACTS_DOCTOR_QUERY : CONTACTS_PACIENT_QUERY;

    if (search) {
      query += " AND (nume LIKE ? OR prenume LIKE ? OR email LIKE ?)";
      const pattern = `%${search}%`;
      params.push(pattern, pattern, pattern);
    }

    query += " ORDER BY nume ASC, prenume ASC LIMIT 50";

    const [rows] = await db.promise().query(query, params);
    res.json({ contacts: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Eroare la încărcarea contactelor" });
  }
});

router.get("/conversations", verifyToken, async (req, res) => {
  const userId = req.user.id;
  const role = req.user.role;

  if (role !== "doctor" && role !== "pacient") {
    return res.status(403).json({ error: "Doar doctorii și pacienții au acces la mesaje" });
  }

  const userFilter = role === "doctor" ? "c.doctor_id = ?" : "c.pacient_id = ?";
  const counterpartSelect = role === "doctor"
    ? "p.id AS counterpart_id, p.nume AS counterpart_nume, p.prenume AS counterpart_prenume, p.avatar_url AS counterpart_avatar"
    : "d.id AS counterpart_id, d.nume AS counterpart_nume, d.prenume AS counterpart_prenume, d.avatar_url AS counterpart_avatar";
  const counterpartJoin = role === "doctor"
    ? "JOIN pacienti p ON p.id = c.pacient_id JOIN doctori d ON d.id = c.doctor_id"
    : "JOIN doctori d ON d.id = c.doctor_id JOIN pacienti p ON p.id = c.pacient_id";
  const unreadRole = role === "doctor" ? "pacient" : "doctor";

  try {
    const [rows] = await db.promise().query(
      `
      SELECT
        c.id,
        c.doctor_id,
        c.pacient_id,
        c.updated_at,
        ${counterpartSelect},
        lm.continut AS last_message,
        lm.created_at AS last_message_at,
        (
          SELECT COUNT(*)
          FROM mesaje um
          WHERE um.conversatie_id = c.id
            AND um.sender_role = ?
            AND um.is_read = 0
            AND (cs.deleted_at IS NULL OR um.created_at > cs.deleted_at)
        ) AS unread_count
      FROM conversatii c
      ${counterpartJoin}
      LEFT JOIN conversatii_sterse cs
        ON cs.conversatie_id = c.id
        AND cs.user_role = ?
        AND cs.user_id = ?
      LEFT JOIN mesaje lm ON lm.id = (
        SELECT m2.id
        FROM mesaje m2
        WHERE m2.conversatie_id = c.id
          AND (cs.deleted_at IS NULL OR m2.created_at > cs.deleted_at)
        ORDER BY m2.created_at DESC, m2.id DESC
        LIMIT 1
      )
      WHERE ${userFilter}
        AND (
          cs.deleted_at IS NULL
          OR EXISTS (
            SELECT 1
            FROM mesaje mv
            WHERE mv.conversatie_id = c.id
              AND mv.created_at > cs.deleted_at
          )
        )
      ORDER BY COALESCE(lm.created_at, c.updated_at) DESC
      `,
      [unreadRole, role, userId, userId]
    );

    res.json({ conversations: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Eroare la încărcarea conversațiilor" });
  }
});

router.post("/conversations", verifyToken, async (req, res) => {
  const userId = req.user.id;
  const role = req.user.role;
  const counterpartId = Number(req.body.counterpartId);

  if (role !== "doctor" && role !== "pacient") {
    return res.status(403).json({ error: "Doar doctorii și pacienții au acces la mesaje" });
  }

  if (!Number.isInteger(counterpartId) || counterpartId <= 0) {
    return res.status(400).json({ error: "Contact invalid" });
  }

  try {
    const allowedIds = await getAllowedCounterpartIds(userId, role);
    if (!allowedIds.has(counterpartId)) {
      return res.status(403).json({ error: "Nu ai permisiunea pentru această conversație" });
    }

    const doctorId = role === "doctor" ? userId : counterpartId;
    const pacientId = role === "pacient" ? userId : counterpartId;

    const [existing] = await db.promise().query(
      "SELECT id FROM conversatii WHERE doctor_id = ? AND pacient_id = ? LIMIT 1",
      [doctorId, pacientId]
    );

    if (existing.length > 0) {
      return res.json({ conversationId: existing[0].id });
    }

    const [insertResult] = await db.promise().query(
      "INSERT INTO conversatii (doctor_id, pacient_id) VALUES (?, ?)",
      [doctorId, pacientId]
    );

    return res.status(201).json({ conversationId: insertResult.insertId });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Eroare la crearea conversației" });
  }
});

router.get("/conversations/:id/messages", verifyToken, async (req, res) => {
  const userId = req.user.id;
  const role = req.user.role;
  const conversationId = Number(req.params.id);

  if (!Number.isInteger(conversationId) || conversationId <= 0) {
    return res.status(400).json({ error: "Conversație invalidă" });
  }

  if (role !== "doctor" && role !== "pacient") {
    return res.status(403).json({ error: "Doar doctorii și pacienții au acces la mesaje" });
  }

  try {
    const conversation = await getConversationForUser(conversationId, userId, role);
    if (!conversation) {
      return res.status(404).json({ error: "Conversația nu există" });
    }

    const deletedAt = conversation.deleted_at || null;

    const [rows] = await db.promise().query(
      `
      SELECT id, conversatie_id, sender_role, sender_id, continut, is_read, created_at
      FROM mesaje
      WHERE conversatie_id = ?
        AND (? IS NULL OR created_at > ?)
      ORDER BY created_at ASC, id ASC
      `,
      [conversationId, deletedAt, deletedAt]
    );

    const oppositeRole = role === "doctor" ? "pacient" : "doctor";
    await db.promise().query(
      `
      UPDATE mesaje
      SET is_read = 1
      WHERE conversatie_id = ?
        AND sender_role = ?
        AND is_read = 0
        AND (? IS NULL OR created_at > ?)
      `,
      [conversationId, oppositeRole, deletedAt, deletedAt]
    );

    res.json({ messages: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Eroare la încărcarea mesajelor" });
  }
});

router.post("/conversations/:id/messages", verifyToken, async (req, res) => {
  const userId = req.user.id;
  const role = req.user.role;
  const conversationId = Number(req.params.id);
  const content = sanitizeText(req.body.content);

  if (!Number.isInteger(conversationId) || conversationId <= 0) {
    return res.status(400).json({ error: "Conversație invalidă" });
  }

  if (role !== "doctor" && role !== "pacient") {
    return res.status(403).json({ error: "Doar doctorii și pacienții au acces la mesaje" });
  }

  if (!content) {
    return res.status(400).json({ error: "Mesajul nu poate fi gol" });
  }

  if (content.length > 2000) {
    return res.status(400).json({ error: "Mesajul este prea lung" });
  }

  try {
    const conversation = await getConversationForUser(conversationId, userId, role);
    if (!conversation) {
      return res.status(404).json({ error: "Conversația nu există" });
    }

    const [result] = await db.promise().query(
      `
      INSERT INTO mesaje (conversatie_id, sender_role, sender_id, continut)
      VALUES (?, ?, ?, ?)
      `,
      [conversationId, role, userId, content]
    );

    await db.promise().query(
      "UPDATE conversatii SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [conversationId]
    );

    const [rows] = await db.promise().query(
      `
      SELECT id, conversatie_id, sender_role, sender_id, continut, is_read, created_at
      FROM mesaje
      WHERE id = ?
      LIMIT 1
      `,
      [result.insertId]
    );

    res.status(201).json({ message: rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Eroare la trimiterea mesajului" });
  }
});

router.delete("/conversations/:id", verifyToken, async (req, res) => {
  const userId = req.user.id;
  const role = req.user.role;
  const conversationId = Number(req.params.id);

  if (!Number.isInteger(conversationId) || conversationId <= 0) {
    return res.status(400).json({ error: "Conversație invalidă" });
  }

  if (role !== "doctor" && role !== "pacient") {
    return res.status(403).json({ error: "Doar doctorii și pacienții au acces la mesaje" });
  }

  try {
    const [conversationRows] = await db.promise().query(
      `
      SELECT id
      FROM conversatii
      WHERE id = ?
        AND (${role === "doctor" ? "doctor_id = ?" : "pacient_id = ?"})
      LIMIT 1
      `,
      [conversationId, userId]
    );

    if (conversationRows.length === 0) {
      return res.status(404).json({ error: "Conversația nu există" });
    }

    await db.promise().query(
      `
      INSERT INTO conversatii_sterse (conversatie_id, user_role, user_id)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE deleted_at = CURRENT_TIMESTAMP
      `,
      [conversationId, role, userId]
    );

    const [[{ latestMessageAt }]] = await db.promise().query(
      `
      SELECT MAX(created_at) AS latestMessageAt
      FROM mesaje
      WHERE conversatie_id = ?
      `,
      [conversationId]
    );

    const [deleteRows] = await db.promise().query(
      `
      SELECT user_role, deleted_at
      FROM conversatii_sterse
      WHERE conversatie_id = ?
      `,
      [conversationId]
    );

    let deletedByCount = 0;
    if (!latestMessageAt) {
      deletedByCount = new Set(deleteRows.map((row) => row.user_role)).size;
    } else {
      deletedByCount = new Set(
        deleteRows
          .filter((row) => new Date(row.deleted_at).getTime() >= new Date(latestMessageAt).getTime())
          .map((row) => row.user_role)
      ).size;
    }

    if (Number(deletedByCount) < 2) {
      return res.json({ message: "Conversația a fost ascunsă pentru tine" });
    }

    await db.promise().query(
      "DELETE FROM conversatii WHERE id = ?",
      [conversationId]
    );

    res.json({ message: "Conversația a fost ștearsă definitiv" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Eroare la ștergerea conversației" });
  }
});

export default router;
