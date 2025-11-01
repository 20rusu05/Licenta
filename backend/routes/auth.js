import express from "express";
import { db } from "../db.js";
import bcrypt from "bcrypt";

const router = express.Router();

router.post("/register", async (req, res) => {
  const { nume, prenume, email, parola, telefon } = req.body;
  if (!nume || !prenume || !email || !parola || !telefon)
    return res.status(400).json({ error: "Campuri lipsa" });

  try {
    const [existsEmail] = await db.promise().query(
      "SELECT id FROM pacienti WHERE email = ?",
      [email]
    );
    if (existsEmail.length)
      return res.status(400).json({ error: "Email deja folosit" });

    const [existsTelefon] = await db.promise().query(
      "SELECT id FROM pacienti WHERE telefon = ?",
      [telefon]
    );
    if (existsTelefon.length)
      return res.status(400).json({ error: "Număr de telefon deja folosit" });

    const hash = await bcrypt.hash(parola, 10);
    await db.promise().query(
      "INSERT INTO pacienti (nume, prenume, email, parola, telefon) VALUES (?, ?, ?, ?, ?)",
      [nume, prenume, email, hash, telefon]
    );

    res.json({ message: "Utilizator creat" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Eroare server" });
  }
});

router.post("/login", async (req, res) => {
  const { email, parola } = req.body;
  if (!email || !parola)
    return res.status(400).json({ error: "Campuri lipsa" });

  try {
    const [users] = await db.promise().query(
      "SELECT id, nume, email, parola FROM pacienti WHERE email = ?",
      [email]
    );

    if (users.length === 0)
      return res.status(401).json({ error: "Email sau parola incorecta" });

    const user = users[0];
    const match = await bcrypt.compare(parola, user.parola);

    if (!match)
      return res.status(401).json({ error: "Email sau parola incorecta" });

    // Nu trimitem parola înapoi la client
    delete user.parola;
    
    res.json({
      message: "Autentificare reusita",
      user
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Eroare server" });
  }
});

export default router;
