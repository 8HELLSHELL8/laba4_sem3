CREATE TABLE IF NOT EXISTS device_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(63) NOT NULL,
    description TEXT
);

CREATE TABLE IF NOT EXISTS device_statuses (
    id SERIAL PRIMARY KEY,
    name VARCHAR(31) NOT NULL
);

CREATE TABLE IF NOT EXISTS locations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(63),
    description TEXT
);

CREATE TABLE IF NOT EXISTS access_level (
    id SERIAL PRIMARY KEY,
    name VARCHAR(31) NOT NULL UNIQUE,
    description TEXT
);

CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(31) NOT NULL UNIQUE,
    description TEXT
);

CREATE TABLE IF NOT EXISTS devices (
    id SERIAL PRIMARY KEY,
    name VARCHAR(63) NOT NULL,
    type INT REFERENCES device_types NOT NULL,
    location_id INT REFERENCES locations NOT NULL,
    status INT REFERENCES device_statuses NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(63) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role INT REFERENCES roles NOT NULL,
    acc_lvl INT REFERENCES access_level NOT NULL,
    current_token VARCHAR(255),
    last_login TIMESTAMP
);

INSERT INTO device_types (name) VALUES 
('Camera'),
('Detector'),
('Other');

INSERT INTO access_level (name) VALUES 
('strict'),
('full'),
('dev');

INSERT INTO device_statuses (name) VALUES 
('Active'),
('Inactive'),
('Maintenance'),
('Retired');


INSERT INTO locations (name, description) VALUES
('Kitchen', NULL),
('Balcony', NULL),
('Roof', NULL),
('Living Room', NULL),
('Server Room A', 'Основная серверная комната, 3 этаж'),
('Warehouse B', 'Склад резервного оборудования');

INSERT INTO roles (name, description) VALUES 
('admin', 'Администратор системы с полными правами'),
('manager', 'Менеджер оборудования с ограниченными правами'),
('user', 'Обычный пользователь с базовыми правами');

INSERT INTO users (name, password, role, acc_lvl) VALUES
('admin', '$2b$10$Xcu/ii7L2leYyBbhTEZjuuUqCFxSQY9eu2qQfJVdDaLPRDXyZHGbW', 1, 3),
('manager', '$2b$10$AQwpDxZB7J/zCh2wIN.7vuVbFUXcnmUMb.icCknFyRxgpckIxlBbe', 2, 2),
('user1', '$2b$10$87q0wyx1aZd4aYujDUtTPuazrIXKQg2bq29ltIQEnBfudOGb38F7G', 3, 1);

INSERT INTO devices (name, type, location_id, status) VALUES
('Device A', 1, 1, 1),
('Device B', 2, 2, 2),
('Device C', 1, 2, 1),
('Device D', 2, 1, 2),
('Server Rack 1', 1, 1, 1),
('Network Switch A', 2, 2, 1);

CREATE OR REPLACE FUNCTION clear_expired_tokens()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.last_login IS NOT NULL AND 
       EXTRACT(EPOCH FROM (NOW() - NEW.last_login)) > 15 * 60 THEN
        NEW.current_token := NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
