USE licenta;

CREATE TABLE admini (
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

CREATE TABLE pacienti (
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

CREATE TABLE medicamente (
  id INT AUTO_INCREMENT PRIMARY KEY,
  doctor_id INT NOT NULL,
  denumire VARCHAR(255) NOT NULL,
  descriere TEXT NULL,
  complet TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (doctor_id) REFERENCES doctori(id) ON DELETE CASCADE,
  INDEX idx_doctor_id (doctor_id)
);

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
    data_programare DATETIME NOT NULL,
    motiv TEXT NULL,
    status ENUM('programata', 'completata', 'anulata') DEFAULT 'programata',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (pacient_id) REFERENCES pacienti(id) ON DELETE CASCADE,
    FOREIGN KEY (doctor_id) REFERENCES doctori(id) ON DELETE CASCADE,
    INDEX idx_pacient_id (pacient_id),
    INDEX idx_doctor_id (doctor_id),
    INDEX idx_data_programare (data_programare),
    INDEX idx_status (status)
);
	
-- Tabel pentru datele senzorilor Raspberry Pi
CREATE TABLE sensor_readings (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  sensor_type ENUM('ecg', 'puls', 'temperatura') NOT NULL,
  pacient_id INT NULL,
  value_1 FLOAT NOT NULL COMMENT 'ECG: voltage, Puls: heart_rate, Temperatura: temp_celsius',
  value_2 FLOAT NULL COMMENT 'Puls: extra_value',
  device_id VARCHAR(50) DEFAULT 'rpi5-01',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (pacient_id) REFERENCES pacienti(id) ON DELETE SET NULL,
  INDEX idx_sensor_type (sensor_type),
  INDEX idx_pacient_id (pacient_id),
  INDEX idx_created_at (created_at),
  INDEX idx_sensor_device (device_id, sensor_type, created_at)
);

-- Tabel sesiuni de monitorizare
CREATE TABLE monitoring_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pacient_id INT NOT NULL,
  doctor_id INT NULL,
  sensor_type ENUM('ecg', 'puls', 'temperatura') NOT NULL,
  status ENUM('activa', 'finalizata') DEFAULT 'activa',
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP NULL,
  notes TEXT NULL,
  FOREIGN KEY (pacient_id) REFERENCES pacienti(id) ON DELETE CASCADE,
  FOREIGN KEY (doctor_id) REFERENCES doctori(id) ON DELETE SET NULL,
  INDEX idx_pacient_session (pacient_id, status),
  INDEX idx_doctor_session (doctor_id, status)
);

CREATE TABLE device_assignments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  device_id VARCHAR(50) NOT NULL UNIQUE,
  doctor_id INT NOT NULL,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (doctor_id) REFERENCES doctori(id) ON DELETE CASCADE,
  INDEX idx_device_id (device_id)
);

CREATE INDEX idx_admini_email ON admini(email);
CREATE INDEX idx_pacienti_email ON pacienti(email);
CREATE INDEX idx_pacienti_telefon ON pacienti(telefon);
CREATE INDEX idx_doctori_email ON doctori(email);
CREATE INDEX idx_doctori_telefon ON doctori(telefon);
