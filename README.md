# NewMed

![React](https://img.shields.io/badge/React-19.2-61DAFB?logo=react&logoColor=111)
![Vite](https://img.shields.io/badge/Vite-7.1-646CFF?logo=vite&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.18-000000?logo=express&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-8.x-4479A1?logo=mysql&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.IO-4.8-010101?logo=socketdotio&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.13-3776AB?logo=python&logoColor=white)

NewMed este o platformă web pentru management medical, construită pentru pacienți, doctori și administratori. Aplicația centralizează programările, medicamentele, comunicarea doctor-pacient și monitorizarea live a semnelor vitale prin senzori conectați la Raspberry Pi.

Proiectul este potrivit pentru cabinete sau scenarii educaționale în care este nevoie de o soluție full-stack cu autentificare, dashboard-uri pe roluri și date medicale în timp real.

## Cuprins

- [Tech Stack](#tech-stack)
- [Funcționalități](#funcționalități)
- [Arhitectură](#arhitectură)
- [Quick Start](#quick-start)
- [Configurare variabile de mediu](#configurare-variabile-de-mediu)
- [Senzori Raspberry Pi](#senzori-raspberry-pi)
- [API Endpoints](#api-endpoints)
- [Structura bazei de date](#structura-bazei-de-date)

## Tech Stack

| Zonă | Tehnologii |
| --- | --- |
| Frontend | React 19, Vite, React Router, Material UI, Recharts, Axios, Socket.IO Client |
| Backend | Node.js, Express, HTTPS, JWT, bcrypt, Multer, Nodemailer, Socket.IO |
| Bază de date | MySQL, mysql2 connection pool, schema SQL în `bd.sql` |
| Senzori | Python 3, Raspberry Pi 5, ADS1115/MCP3008, AD8232 ECG, senzor de puls analogic, DS18B20 |
| Securitate | JWT, parole hash-uite cu bcrypt, sesiune în `sessionStorage`, HTTPS local |

## Funcționalități

- Autentificare și înregistrare pentru pacienți, doctori și administratori.
- Roluri diferențiate: pacient, doctor și admin.
- Dashboard-uri cu statistici, activitate recentă, programări și medicamente.
- Gestionare programări cu filtrare, căutare, paginare și statusuri.
- Gestionare medicamente și aplicări ale pacienților la tratamente/studii.
- Mesagerie doctor-pacient pentru utilizatorii care au relație medicală validă.
- Profil utilizator cu actualizare date și poză de profil.
- Panou de administrare pentru statistici și management utilizatori.
- Monitorizare live pentru ECG, puls și temperatură prin Socket.IO.
- Istoric citiri senzori și sesiuni de monitorizare.
- Resetare parolă prin email, folosind token temporar.

## Arhitectură

```text
Licenta/
├── backend/                  # API Express, Socket.IO, autentificare, rute medicale
│   ├── routes/               # Module API: auth, admin, dashboard, sensors, messages etc.
│   ├── certs/                # Certificate HTTPS locale (neincluse în Git)
│   ├── uploads/              # Avataruri încărcate de utilizatori
│   ├── db.js                 # Pool MySQL
│   ├── server.js             # Entry point backend
│   └── create-admin.js       # Script pentru cont admin inițial
├── frontend/                 # Aplicație React + Vite
│   ├── src/components/       # Ecrane și componente pe domenii
│   ├── src/services/api.js   # Client Axios configurat cu JWT
│   └── vite.config.js
├── sensors/                  # Manager senzori Raspberry Pi + clienți HTTP/Socket.IO
│   ├── config.py             # Configurare hardware și server
│   ├── main.py               # Pornire senzori
│   ├── ekg.py
│   ├── puls.py
│   └── temperatura.py
├── bd.sql                    # Schema bazei de date MySQL
└── README.md
```

## Quick Start

### Prerechizite

- Node.js 20.19+ sau 22.12+ și npm.
- MySQL 8.x sau compatibil.
- OpenSSL pentru certificate HTTPS locale.
- Python 3.13+ pentru modulul de senzori.
- Opțional: Raspberry Pi 5 cu SPI/I2C activate pentru rularea pe hardware real.

### 1. Clonare repository

```bash
git clone <repository-url>
cd Licenta
```

### 2. Configurare bază de date

Fișierul `bd.sql` folosește baza de date `licenta`, deci trebuie creată înainte de import.

```bash
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS licenta CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p < bd.sql
```

### 3. Configurare backend

```bash
cd backend
npm install
cp .env.example .env
```

Completează valorile din `backend/.env`, apoi generează certificate locale pentru HTTPS:

```bash
mkdir -p certs
openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout certs/server.key \
  -out certs/server.crt \
  -days 365 \
  -subj "/CN=localhost"
```

Pornește API-ul:

```bash
node server.js
```

Backend-ul rulează implicit pe `https://localhost:3001`.

### 4. Creeare cont admin inițial

Într-un terminal separat:

```bash
cd backend
node create-admin.js
```

Scriptul creează contul admin definit în `backend/create-admin.js`. Pentru un mediu real, schimbă datele implicite înainte de rulare.

### 5. Configurare frontend

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Frontend-ul rulează implicit pe `http://localhost:5173`.

## Configurare variabile de mediu

### Backend: `backend/.env`

```env
PORT=3001

DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=licenta

JWT_SECRET=change_this_to_a_long_random_secret

FRONTEND_BASE_URL=http://localhost:5173
EMAIL_USER=
EMAIL_PASS=

HTTPS_KEY_PATH=./certs/server.key
HTTPS_CERT_PATH=./certs/server.crt
SENSOR_DB_MIN_INTERVAL_MS=3000
```

`EMAIL_USER` și `EMAIL_PASS` sunt necesare doar pentru fluxul de resetare parolă prin email.

### Frontend: `frontend/.env.local`

```env
VITE_BACKEND_URL=https://localhost:3001
```

Dacă accesezi aplicația de pe alt dispozitiv din rețea, setează `VITE_BACKEND_URL` către IP-ul mașinii pe care rulează backend-ul.

## Senzori Raspberry Pi

Modulul `sensors/` trimite citiri către backend prin Socket.IO, cu fallback HTTP către `POST /api/sensors/reading`.

### Instalare dependențe

```bash
cd sensors
python3 -m venv venv
source venv/bin/activate
pip install requests python-socketio urllib3 smbus2 RPi.GPIO spidev
```

### Pornire senzori

```bash
SERVER_URL=https://localhost:3001 SENSOR_TLS_VERIFY=false python main.py --auto
```

Exemple utile:

```bash
python main.py --pacient 1
python main.py --sensors ecg temperatura
python main.py --auto --sensors ecg
```

Pentru testare fără hardware ECG:

```bash
ECG_FORCE_SIM=1 python main.py --sensors ecg
```

Configurația hardware pentru AD8232, ADS1115/MCP3008 și DS18B20 este documentată în `sensors/config.py`.

## API Endpoints

Toate rutele protejate folosesc header-ul:

```http
Authorization: Bearer <jwt_token>
```

| Metodă | Endpoint | Descriere | Acces |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | Înregistrare pacient sau doctor. Emailurile `@newmed.ro` sunt tratate ca doctori. | Public |
| POST | `/api/auth/login` | Autentificare și returnare JWT. | Public |
| POST | `/api/forgot-password` | Generează token și trimite email de resetare. | Public |
| POST | `/api/reset-password` | Setează o parolă nouă folosind tokenul primit. | Public |
| GET | `/api/dashboard/stats` | Statistici pentru dashboard, adaptate rolului. | Pacient/Doctor |
| GET | `/api/programari` | Listează programările cu filtrare, căutare și paginare. | Pacient/Doctor |
| POST | `/api/programari` | Creează o programare. | Doctor |
| PUT | `/api/programari/:id` | Actualizează data unei programări. | Doctor |
| PATCH | `/api/programari/:id/completeaza` | Marchează/debifează o programare ca finalizată. | Doctor |
| GET | `/api/medicamente` | Listează medicamentele și aplicările relevante. | Pacient/Doctor |
| POST | `/api/medicamente` | Creează medicament/tratament. | Doctor |
| POST | `/api/medicamente/:id/aplica` | Pacientul aplică la un medicament/tratament. | Pacient |
| GET | `/api/pacienti` | Listează pacienții asociați doctorului. | Doctor |
| GET | `/api/messages/conversations` | Listează conversațiile. | Pacient/Doctor |
| POST | `/api/messages/conversations/:id/messages` | Trimite mesaj într-o conversație. | Pacient/Doctor |
| GET | `/api/sensors/status` | Listează senzorii conectați prin Socket.IO. | Public |
| GET | `/api/sensors/latest/:sensorType` | Ultimele citiri pentru `ecg`, `puls` sau `temperatura`. | Autentificat |
| GET | `/api/sensors/history/:sensorType` | Istoric citiri pe interval. | Autentificat |
| POST | `/api/sensors/start` | Pornește un proces de senzor gestionat de backend. | Autentificat |
| POST | `/api/sensors/stop` | Oprește un proces de senzor. | Autentificat |
| GET | `/api/admin/users` | Listează utilizatorii. | Admin |
| GET | `/api/admin/statistics` | Statistici globale. | Admin |
| DELETE | `/api/admin/users/doctor/:id` | Șterge un doctor. | Admin |
| DELETE | `/api/admin/users/pacient/:id` | Șterge un pacient. | Admin |

## Structura bazei de date

Schema principală este în `bd.sql` și include:

- `admini`, `doctori`, `pacienti` pentru utilizatori și roluri.
- `medicamente` și `aplicari_medicamente` pentru tratamente/studii și aplicări.
- `programari` pentru calendarul medical.
- `conversatii`, `mesaje`, `conversatii_sterse` pentru mesagerie.
- `sensor_readings`, `monitoring_sessions`, `device_assignments` pentru monitorizare și dispozitive.

## Note de dezvoltare

- Backend-ul folosește HTTPS și va eșua la pornire dacă lipsesc certificatele din `backend/certs/`.
- Datele sensibile trebuie ținute doar în fișiere `.env`, care sunt ignorate de Git.
- Avatarurile încărcate local sunt salvate în `backend/uploads/` și nu trebuie versionate.
- Pentru producție, configurează CORS strict, secrete JWT puternice, parole admin unice și certificate TLS reale.
