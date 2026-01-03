import express from "express";
import { db } from "../db.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const router = express.Router();

// Register
router.post("/register", async (req, res) => {
  const { nume, prenume, email, parola, telefon } = req.body;
  if (!nume || !prenume || !email || !parola || !telefon)
    return res.status(400).json({ error: "Campuri lipsa" });

  const isDoctor = /^[^.@]+\.[^.@]+@newmed\.ro$/i.test(email);
  const tableName = isDoctor ? "doctori" : "pacienti";

  try {
    const [existsEmailDoctori] = await db
      .promise()
      .query("SELECT id FROM doctori WHERE email = ?", [email]);
    const [existsEmailPacienti] = await db
      .promise()
      .query("SELECT id FROM pacienti WHERE email = ?", [email]);

    if (existsEmailDoctori.length || existsEmailPacienti.length)
      return res.status(400).json({ error: "Email deja folosit" });

    const [existsTelefonDoctori] = await db
      .promise()
      .query("SELECT id FROM doctori WHERE telefon = ?", [telefon]);
    const [existsTelefonPacienti] = await db
      .promise()
      .query("SELECT id FROM pacienti WHERE telefon = ?", [telefon]);

    if (existsTelefonDoctori.length || existsTelefonPacienti.length)
      return res.status(400).json({ error: "Numar de telefon deja folosit" });

    const hash = await bcrypt.hash(parola, 10);

    const [result] = await db
      .promise()
      .query(
        `INSERT INTO ${tableName} (nume, prenume, email, parola, telefon) VALUES (?, ?, ?, ?, ?)`,
        [nume, prenume, email, hash, telefon]
      );

    res.json({
      message: "Utilizator creat",
      user: { id: result.insertId, nume, prenume, email, role: isDoctor ? "doctor" : "pacient" }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Eroare server" });
  }
});

// Login
router.post("/login", async (req, res) => {
  const { email, parola } = req.body;
  if (!email || !parola) return res.status(400).json({ error: "Campuri lipsa" });

  try {
    let user = null;
    let role = null;

    const [doctori] = await db
      .promise()
      .query("SELECT id, nume, prenume, email, telefon, parola FROM doctori WHERE email = ?", [email]);

    if (doctori.length > 0) {
      user = doctori[0];
      role = "doctor";
    } else {
      const [pacienti] = await db
        .promise()
        .query("SELECT id, nume, prenume, email, telefon, parola FROM pacienti WHERE email = ?", [email]);
      if (pacienti.length > 0) {
        user = pacienti[0];
        role = "pacient";
      }
    }

    if (!user) return res.status(401).json({ error: "Email sau parola incorecta" });

    const match = await bcrypt.compare(parola, user.parola);
    if (!match) return res.status(401).json({ error: "Email sau parola incorecta" });

    delete user.parola;

    const token = jwt.sign({ id: user.id, email: user.email, role }, process.env.JWT_SECRET, {
      expiresIn: "12h"
    });

    res.json({ message: "Autentificare reusita", user: { ...user, role }, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Eroare server" });
  }
});

export default router;
