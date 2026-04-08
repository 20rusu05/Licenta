import express from "express";
import { db } from "../db.js";
import { verifyToken } from "./middleware/authMiddleware.js";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { existsSync, mkdirSync } from "fs";
import { unlink } from "fs/promises";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const avatarsDir = path.join(__dirname, "..", "uploads", "avatars");

if (!existsSync(avatarsDir)) {
  mkdirSync(avatarsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, avatarsDir);
  },
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname || "").toLowerCase();
    const safeExtension = [".jpg", ".jpeg", ".png", ".webp"].includes(extension) ? extension : ".jpg";
    cb(null, `user-${req.user.id}-${Date.now()}${safeExtension}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
      return;
    }
    cb(new Error("Fișier invalid. Sunt permise doar imagini."));
  },
});

const deleteAvatarIfLocal = async (avatarUrl) => {
  if (!avatarUrl || !avatarUrl.startsWith("/uploads/avatars/")) {
    return;
  }

  const filename = path.basename(avatarUrl);
  const filePath = path.join(avatarsDir, filename);

  try {
    await unlink(filePath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.warn(`Nu s-a putut șterge avatarul: ${filePath}`);
    }
  }
};

// Obține toți pacienții care au interacționat cu doctorul
router.get("/", verifyToken, async (req, res) => {
  const userId = req.user.id;
  const role = req.user.role;

  if (role !== "doctor") {
    return res.status(403).json({ error: "Doar doctorii pot vizualiza lista de pacienți" });
  }

  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const offset = (page - 1) * limit;
  const search = req.query.search || "";

  try {
    let searchCondition = "";
    let searchParams = [];

    if (search) {
      searchCondition = ` AND (p.nume LIKE ? OR p.prenume LIKE ? OR p.email LIKE ? OR p.telefon LIKE ?)`;
      const searchPattern = `%${search}%`;
      searchParams = [searchPattern, searchPattern, searchPattern, searchPattern];
    }

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
      limit,
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

  if (parseInt(userId, 10) !== parseInt(profileId, 10)) {
    return res.status(403).json({ error: "Nu aveți permisiunea de a actualiza acest profil" });
  }

  try {
    if (!nume || !prenume) {
      return res.status(400).json({ error: "Numele și prenumele sunt obligatorii" });
    }

    if (telefon && !/^(07\d{8}|02\d{8}|03\d{8})$/.test(telefon)) {
      return res.status(400).json({ error: "Numărul de telefon nu este valid" });
    }

    const table = role === "doctor" ? "doctori" : "pacienti";

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

router.post("/:id/avatar", verifyToken, (req, res) => {
  upload.single("avatar")(req, res, async (err) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ error: "Imaginea este prea mare. Maxim 5MB." });
      }
      return res.status(400).json({ error: err.message || "Eroare la încărcarea imaginii" });
    }

    const profileId = req.params.id;
    const userId = req.user.id;
    const role = req.user.role;

    if (parseInt(userId, 10) !== parseInt(profileId, 10)) {
      return res.status(403).json({ error: "Nu aveți permisiunea de a actualiza acest profil" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "Nu a fost trimisă nicio imagine" });
    }

    const table = role === "doctor" ? "doctori" : "pacienti";
    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    const uploadedFilePath = path.join(avatarsDir, req.file.filename);

    try {
      const [rows] = await db.promise().query(
        `SELECT avatar_url FROM ${table} WHERE id = ? LIMIT 1`,
        [profileId]
      );
      const previousAvatarUrl = rows?.[0]?.avatar_url || null;

      await db.promise().query(
        `UPDATE ${table}
         SET avatar_url = ?
         WHERE id = ?`,
        [avatarUrl, profileId]
      );

      await deleteAvatarIfLocal(previousAvatarUrl);

      return res.json({ message: "Poza de profil a fost actualizată", avatar_url: avatarUrl });
    } catch (uploadError) {
      console.error(uploadError);

      try {
        await unlink(uploadedFilePath);
      } catch (cleanupError) {
        if (cleanupError.code !== "ENOENT") {
          console.warn(`Nu s-a putut șterge avatarul nou după eroare DB: ${uploadedFilePath}`);
        }
      }

      return res.status(500).json({ error: "Eroare la actualizarea pozei de profil" });
    }
  });
});

export default router;
