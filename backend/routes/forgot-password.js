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
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const emailUser = String(process.env.EMAIL_USER || '').trim();
    const emailPass = String(process.env.EMAIL_PASS || '').replace(/\s+/g, '');

    if (!emailUser || !emailPass) {
      return res.status(500).json({
        error: 'Configurarea pentru trimiterea emailurilor lipsește pe server.'
      });
    }

    let user = null;
    let tableName = null;

    const [pacienti] = await db.promise().query(
      'SELECT id, email FROM pacienti WHERE email = ?', 
      [normalizedEmail]
    );

    if (pacienti.length > 0) {
      user = pacienti[0];
      tableName = 'pacienti';
    } else {
      const [doctori] = await db.promise().query(
        'SELECT id, email FROM doctori WHERE email = ?', 
        [normalizedEmail]
      );
      if (doctori.length > 0) {
        user = doctori[0];
        tableName = 'doctori';
      }
    }

    if (!user) {
      return res.status(200).json({ 
        message: 'Dacă email-ul există, veți primi un link de resetare.' 
      });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 3600000); // 1 hour

    await db.promise().query(
      `UPDATE ${tableName} SET reset_token = ?, reset_token_expiry = ? WHERE email = ?`,
      [token, expires, normalizedEmail]
    );

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: emailUser,
        pass: emailPass
      }
    });

    const frontendBaseUrl = (process.env.FRONTEND_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
    const resetUrl = `${frontendBaseUrl}/reset-password/${token}`;

    const sendMailOptions = {
      from: `"NewMed System" <${emailUser}>`,
      to: normalizedEmail,
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
    };

    try {
      await transporter.sendMail(sendMailOptions);

      return res.json({
        message: 'Dacă email-ul există, veți primi un link de resetare.'
      });
    } catch (mailError) {
      console.error('Eroare la trimiterea emailului:', {
        message: mailError?.message,
        code: mailError?.code,
        response: mailError?.response,
        command: mailError?.command,
      });

      if (mailError?.code === 'EAUTH' || mailError?.code === 'ECONNECTION') {
        return res.status(200).json({
          message: 'Dacă email-ul există, veți primi un link de resetare.',
        });
      }

      throw mailError;
    }
  } catch (error) {
    console.error('Eroare la procesarea cererii:', {
      message: error?.message,
      code: error?.code,
      response: error?.response,
      command: error?.command,
    });

    const emailErrorMessage = error?.code === 'EAUTH'
      ? 'Autentificarea pentru trimiterea emailului a eșuat. Verifică EMAIL_USER și EMAIL_PASS.'
      : error?.code === 'ECONNECTION'
        ? 'Nu se poate conecta la serverul de email. Verifică accesul la SMTP.'
        : error?.message || 'Nu s-a putut trimite emailul de resetare.';

    res.status(500).json({ 
      error: emailErrorMessage
    });
  }
});

export default router;