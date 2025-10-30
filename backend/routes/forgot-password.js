import express from 'express';
import { db } from '../db.js';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    const [users] = await db.promise().query(
      'SELECT id FROM pacienti WHERE email = ?', 
      [email]
    );

    if (!users.length) {
      return res.status(200).json({ 
        message: 'Dacă email-ul există, veți primi un link de resetare.' 
      });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 3600000); // 1 hour

    await db.promise().query(
      'UPDATE pacienti SET reset_token = ?, reset_token_expiry = ? WHERE email = ?',
      [token, expires, email]
    );

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    const resetUrl = `http://localhost:3000/reset-password/${token}`;

    await transporter.sendMail({
      from: '"NewMed" <noreply@newmed.com>',
      to: email,
      subject: 'Resetare parolă NewMed',
      html: `
        <div style="font-family: Arial, sans-serif; color: #333;">
          <h2 style="color: #2196F3;">NewMed - Resetare Parolă</h2>
          <p>Ați solicitat resetarea parolei pentru contul dvs. NewMed.</p>
          <p>Click pe butonul de mai jos pentru a vă reseta parola:</p>
          <a href="${resetUrl}" 
             style="background-color: #2196F3; 
                    color: white; 
                    padding: 10px 20px; 
                    text-decoration: none; 
                    border-radius: 5px; 
                    display: inline-block;
                    margin: 20px 0;">
            Resetează Parola
          </a>
          <p>Link-ul expiră în 60 de minute.</p>
          <p>Dacă nu ați solicitat resetarea parolei, puteți ignora acest email.</p>
        </div>
      `
    });

    res.json({ 
      message: 'Dacă email-ul există, veți primi un link de resetare.' 
    });
  } catch (error) {
    console.error('Eroare la procesarea cererii:', error);
    res.status(500).json({ 
      error: 'A apărut o eroare la procesarea cererii.' 
    });
  }
});

export default router;