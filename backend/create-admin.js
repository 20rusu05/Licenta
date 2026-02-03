import bcrypt from 'bcrypt';
import { db } from './db.js';

const createAdmin = async () => {
  try {
    // Admin credentials
    const email = 'admin1@newmed.ro';
    const parola = 'newmed.ro';
    const nume = 'Admin';
    const prenume = 'NewMed';
    const telefon = '0700000000';

    // Check if admin already exists
    const [existingAdmin] = await db
      .promise()
      .query('SELECT id FROM admini WHERE email = ?', [email]);

    if (existingAdmin.length > 0) {
      console.log('✅ Admin-ul există deja în baza de date.');
      console.log('Email: admin1@newmed.ro');
      console.log('Parola: newmed.ro');
      process.exit(0);
    }

    // Hash password
    const hash = await bcrypt.hash(parola, 10);

    // Insert admin
    const [result] = await db
      .promise()
      .query(
        'INSERT INTO admini (nume, prenume, email, parola, telefon) VALUES (?, ?, ?, ?, ?)',
        [nume, prenume, email, hash, telefon]
      );

    console.log('✅ Cont admin creat cu succes!');
    console.log('─────────────────────────────');
    console.log('Email: admin1@newmed.ro');
    console.log('Parola: newmed.ro');
    console.log('─────────────────────────────');
    console.log('ID-ul adminului:', result.insertId);
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Eroare la crearea adminului:', err.message);
    process.exit(1);
  }
};

createAdmin();
