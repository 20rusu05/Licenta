import express from "express";
import { db } from "../db.js";
import bcrypt from "bcrypt";

const router = express.Router();

router.post("/register", async (req, res) => {
  const { nume, prenume, email, parola, telefon } = req.body;
  if (!nume || !prenume || !email || !parola || !telefon)
    return res.status(400).json({ error: "Campuri lipsa" });

  // Verifică dacă email-ul este de tip doctor (prenume.nume@newmed.ro)
  const isDoctor = /^[^.@]+\.[^.@]+@newmed\.ro$/i.test(email);
  const tableName = isDoctor ? 'doctori' : 'pacienti';
  
  try {
    // Verifică email în ambele tabele
    const [existsEmailPacienti] = await db.promise().query(
      "SELECT id FROM pacienti WHERE email = ?",
      [email]
    );
    const [existsEmailDoctori] = await db.promise().query(
      "SELECT id FROM doctori WHERE email = ?",
      [email]
    );
    if (existsEmailPacienti.length || existsEmailDoctori.length)
      return res.status(400).json({ error: "Email deja folosit" });

    // Verifică telefon în ambele tabele
    const [existsTelefonPacienti] = await db.promise().query(
      "SELECT id FROM pacienti WHERE telefon = ?",
      [telefon]
    );
    const [existsTelefonDoctori] = await db.promise().query(
      "SELECT id FROM doctori WHERE telefon = ?",
      [telefon]
    );
    if (existsTelefonPacienti.length || existsTelefonDoctori.length)
      return res.status(400).json({ error: "Număr de telefon deja folosit" });

    const hash = await bcrypt.hash(parola, 10);
    
    // Inserează în tabelul corespunzător bazat pe tipul email-ului
    await db.promise().query(
      `INSERT INTO ${tableName} (nume, prenume, email, parola, telefon) VALUES (?, ?, ?, ?, ?)`,
      [nume, prenume, email, hash, telefon]
    );

    console.log(`User creat în tabela ${tableName} cu email ${email}`);
    res.json({ 
      message: "Utilizator creat",
      role: isDoctor ? 'doctor' : 'pacient'
    });
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
    let user = null;
    let role = null;

    // Încearcă mai întâi în tabela doctori
    const [doctori] = await db.promise().query(
      "SELECT id, nume, prenume, email, parola FROM doctori WHERE email = ?",
      [email]
    );

    if (doctori.length > 0) {
      user = doctori[0];
      role = 'doctor';
    } else {
      // Dacă nu e doctor, caută în pacienti
      const [pacienti] = await db.promise().query(
        "SELECT id, nume, prenume, email, parola FROM pacienti WHERE email = ?",
        [email]
      );
      
      if (pacienti.length > 0) {
        user = pacienti[0];
        role = 'pacient';
      }
    }

    if (!user)
      return res.status(401).json({ error: "Email sau parola incorecta" });

    const match = await bcrypt.compare(parola, user.parola);

    if (!match)
      return res.status(401).json({ error: "Email sau parola incorecta" });

    // Nu trimitem parola înapoi la client
    delete user.parola;
    
    // Adăugăm rolul și verificăm dacă e doctor după email
    const isDoctor = /^[^.@]+\.[^.@]+@newmed\.ro$/i.test(email);
    console.log(`Login reușit pentru ${email} (${isDoctor ? 'doctor' : 'pacient'})`);
    
    res.json({
      message: "Autentificare reusita",
      user: { ...user, role: isDoctor ? 'doctor' : 'pacient' }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Eroare server" });
  }
});

export default router;
