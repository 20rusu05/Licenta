import express from "express";
import { db } from "../db.js";
import bcrypt from "bcrypt";

const router = express.Router();

router.post("/register", async (req, res) => {
  const { nume, email, parola } = req.body;
  if (!nume || !email || !parola)
    return res.status(400).json({ error: "Campuri lipsa" });

  try {
    const [exists] = await db.promise().query(
      "SELECT id FROM pacienti WHERE email = ?",
      [email]
    );
    if (exists.length)
      return res.status(400).json({ error: "Email deja folosit" });

    const hash = await bcrypt.hash(parola, 10);
    await db.promise().query(
      "INSERT INTO pacienti (nume, email, parola) VALUES (?, ?, ?)",
      [nume, email, hash]
    );

    res.json({ message: "Utilizator creat" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Eroare server" });
  }
});

export default router;
