CREATE DATABASE licenta;
USE licenta;

CREATE TABLE pacienti (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nume VARCHAR(100),
  email VARCHAR(100),
  parola VARCHAR(255)
);
