-- Real Time Traffic Control - Database Setup
-- Tables are auto-created when the server starts, but you can also
-- run this file manually in MySQL if you prefer.

CREATE DATABASE IF NOT EXISTS traffic_management;
USE traffic_management;

CREATE TABLE IF NOT EXISTS traffic_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    road_name VARCHAR(120) NOT NULL,
    location VARCHAR(120) NOT NULL,
    vehicle_count INT NOT NULL DEFAULT 0,
    congestion VARCHAR(10) NOT NULL DEFAULT 'Low',
    incident VARCHAR(40) NOT NULL DEFAULT 'None',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS simulation_reports (
    report_id INT AUTO_INCREMENT PRIMARY KEY,
    controller_mode VARCHAR(20) NOT NULL DEFAULT 'adaptive',
    vehicles_served INT NOT NULL DEFAULT 0,
    average_wait_seconds DECIMAL(10,2) NOT NULL DEFAULT 0,
    maximum_queue INT NOT NULL DEFAULT 0,
    simulation_duration_seconds INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
