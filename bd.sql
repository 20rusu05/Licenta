CREATE DATABASE licenta;
USE licenta;

CREATE TABLE pacienti (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nume VARCHAR(100),
  email VARCHAR(100),
  parola VARCHAR(255)
);
<<<<<<< HEAD
=======

-- Tabel pentru doctori (cu aceleași atribute ca pacienții)
CREATE TABLE doctori (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nume VARCHAR(100) NOT NULL,
  prenume VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  parola VARCHAR(255) NOT NULL,
  telefon VARCHAR(20) NOT NULL,
  reset_token VARCHAR(255) NULL,
  reset_token_expiry DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Tabel pentru medicamente (asociate cu doctori)
CREATE TABLE medicamente (
  id INT AUTO_INCREMENT PRIMARY KEY,
  doctor_id INT NOT NULL,
  denumire VARCHAR(255) NOT NULL,
  descriere TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (doctor_id) REFERENCES doctori(id) ON DELETE CASCADE,
  INDEX idx_doctor_id (doctor_id)
);

-- Tabel pentru aplicări medicamente (cereri de la pacienți cu formular medical)
CREATE TABLE aplicari_medicamente (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pacient_id INT NOT NULL,
  medicament_id INT NOT NULL,
  status ENUM('pending', 'acceptat', 'respins') DEFAULT 'pending',
  -- Date formular medical
  fumeaza ENUM('da', 'nu', 'fost') NULL,
  activitate_fizica ENUM('sedentar', 'usoara', 'moderata', 'intensa') NULL,
  probleme_inima BOOLEAN NULL,
  alergii TEXT NULL,
  boli_cronice TEXT NULL,
  medicamente_curente TEXT NULL,
  greutate DECIMAL(5,2) NULL,
  inaltime DECIMAL(5,2) NULL,
  observatii TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (pacient_id) REFERENCES pacienti(id) ON DELETE CASCADE,
  FOREIGN KEY (medicament_id) REFERENCES medicamente(id) ON DELETE CASCADE,
  INDEX idx_pacient_id (pacient_id),
  INDEX idx_medicament_id (medicament_id),
  INDEX idx_status (status)
);

CREATE TABLE programari (
    id INT AUTO_INCREMENT PRIMARY KEY,
    pacient_id INT NOT NULL,
    doctor_id INT NOT NULL,
    data_ora DATETIME NOT NULL,
    status ENUM('programata', 'completata', 'anulata') DEFAULT 'programata',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pacient_id) REFERENCES pacienti(id) ON DELETE CASCADE,
    FOREIGN KEY (doctor_id) REFERENCES doctori(id) ON DELETE CASCADE,
    INDEX idx_pacient_id (pacient_id),
    INDEX idx_doctor_id (doctor_id),
    INDEX idx_data_ora (data_ora),
    INDEX idx_status (status)
);
	
-- Indexuri pentru performanță
CREATE INDEX idx_pacienti_email ON pacienti(email);
CREATE INDEX idx_pacienti_telefon ON pacienti(telefon);
CREATE INDEX idx_doctori_email ON doctori(email);
CREATE INDEX idx_doctori_telefon ON doctori(telefon);
>>>>>>> 4a7065f (Pacienti+filtrari la programari)
