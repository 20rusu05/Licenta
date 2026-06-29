import bcrypt from 'bcrypt';
import { db } from './db.js';

const createAdmin = async () => {
  try {
    const email = (process.env.ADMIN_EMAIL || '').trim();
    const parola = process.env.ADMIN_PASSWORD || '';
    const nume = (process.env.ADMIN_LAST_NAME || 'Admin').trim();
    const prenume = (process.env.ADMIN_FIRST_NAME || 'NewMed').trim();
    const telefon = (process.env.ADMIN_PHONE || '0700000000').trim();

    const missingEnv = [];
    if (!email) missingEnv.push('ADMIN_EMAIL');
    if (!parola.trim()) missingEnv.push('ADMIN_PASSWORD');

    if (missingEnv.length > 0) {
      console.error(`Lipsesc variabilele de mediu: ${missingEnv.join(', ')}`);
      console.error('Completeaza-le in backend/.env inainte de a crea contul admin.');
      process.exit(1);
    }

    const [existingAdmin] = await db
      .promise()
      .query('SELECT id FROM admini WHERE email = ?', [email]);

    if (existingAdmin.length > 0) {
      console.log('Admin-ul există deja în baza de date.');
      console.log('Email:', email);
      process.exit(0);
    }

    const hash = await bcrypt.hash(parola, 10);

    const [result] = await db
      .promise()
      .query(
        'INSERT INTO admini (nume, prenume, email, parola, telefon) VALUES (?, ?, ?, ?, ?)',
        [nume, prenume, email, hash, telefon]
      );

    console.log('✅ Cont admin creat cu succes!');
    console.log('─────────────────────────────');
    console.log('Email:', email);
    console.log('─────────────────────────────');
    console.log('ID-ul adminului:', result.insertId);
    
    process.exit(0);
  } catch (err) {
    console.error('Eroare la crearea adminului:', err.message);
    process.exit(1);
  }
};

createAdmin();
