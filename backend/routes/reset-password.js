import express from 'express';
import { db } from '../db.js';
import bcrypt from 'bcrypt';

const router = express.Router();

router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    // Verifică dacă token-ul există și nu a expirat
    const [users] = await db.promise().query(
      'SELECT id FROM pacienti WHERE reset_token = ? AND reset_token_expiry > NOW()',
      [token]
    );

    if (!users.length) {
      return res.status(400).json({ 
        error: 'Link-ul de resetare este invalid sau a expirat.' 
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Actualizează parola și șterge token-ul
    await db.promise().query(
      'UPDATE pacienti SET parola = ?, reset_token = NULL, reset_token_expiry = NULL WHERE reset_token = ?',
      [hashedPassword, token]
    );

    res.json({ message: 'Parola a fost actualizată cu succes.' });
  } catch (error) {
    console.error('Eroare la resetarea parolei:', error);
    res.status(500).json({ error: 'Eroare la resetarea parolei.' });
  }
});

export default router;