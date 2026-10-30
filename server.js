const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "pages")));

let pool;

async function startServer() {
  try {
    pool = mysql.createPool({
      host: process.env.DB_HOST || "localhost",
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || "traffic_management",
      waitForConnections: true,
      connectionLimit: 10
    });

    await pool.query("SELECT 1");
    console.log("MySQL connected successfully!");

    // Auto-create tables so the app works out of the box.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS traffic_records (
        id INT AUTO_INCREMENT PRIMARY KEY,
        road_name VARCHAR(120) NOT NULL,
        location VARCHAR(120) NOT NULL,
        vehicle_count INT NOT NULL DEFAULT 0,
        congestion VARCHAR(10) NOT NULL DEFAULT 'Low',
        incident VARCHAR(40) NOT NULL DEFAULT 'None',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS simulation_reports (
        report_id INT AUTO_INCREMENT PRIMARY KEY,
        controller_mode VARCHAR(20) NOT NULL DEFAULT 'adaptive',
        vehicles_served INT NOT NULL DEFAULT 0,
        average_wait_seconds DECIMAL(10,2) NOT NULL DEFAULT 0,
        maximum_queue INT NOT NULL DEFAULT 0,
        simulation_duration_seconds INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log("Database tables ready.");

    // Health check.
    app.get("/api/health", (req, res) => {
      res.json({
        message: "Traffic Management API is running",
        database: "connected"
      });
    });

    // GET all road records.
    app.get("/api/roads", async (req, res) => {
      try {
        const [rows] = await pool.query(
          "SELECT * FROM traffic_records ORDER BY id DESC"
        );
        res.json(rows);
      } catch (error) {
        console.error("Could not fetch roads:", error.message);
        res.status(500).json({ error: "Could not fetch road records" });
      }
    });

    // POST add a new road record.
    app.post("/api/roads", async (req, res) => {
      try {
        const { road, location, vehicles, congestion, incident } = req.body;

        if (
          typeof road !== "string" || !road.trim() ||
          typeof location !== "string" || !location.trim() ||
          vehicles === undefined ||
          !Number.isInteger(Number(vehicles)) ||
          Number(vehicles) < 0 ||
          !["Low", "Medium", "High"].includes(congestion) ||
          typeof incident !== "string" || !incident.trim()
        ) {
          return res
            .status(400)
            .json({ error: "Please provide valid road details" });
        }

        const [result] = await pool.execute(
          `INSERT INTO traffic_records
           (road_name, location, vehicle_count, congestion, incident, updated_at)
           VALUES (?, ?, ?, ?, ?, NOW())`,
          [
            road.trim(),
            location.trim(),
            Number(vehicles),
            congestion,
            incident.trim()
          ]
        );

        const [rows] = await pool.execute(
          "SELECT * FROM traffic_records WHERE id = ?",
          [result.insertId]
        );

        res.status(201).json({
          message: "Road added successfully",
          road: rows[0]
        });
      } catch (error) {
        console.error("Could not add road:", error.message);
        res.status(500).json({ error: "Could not add road record" });
      }
    });

    // DELETE a road record.
    app.delete("/api/roads/:id", async (req, res) => {
      try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
          return res.status(400).json({ error: "Invalid road ID" });
        }

        const [result] = await pool.execute(
          "DELETE FROM traffic_records WHERE id = ?",
          [id]
        );

        if (result.affectedRows === 0) {
          return res.status(404).json({ error: "Road record not found" });
        }

        res.json({ message: "Road deleted successfully", id });
      } catch (error) {
        console.error("Could not delete road:", error.message);
        res.status(500).json({ error: "Could not delete road record" });
      }
    });

    // POST save a simulation report.
    app.post("/api/simulation-reports", async (req, res) => {
      try {
        const {
          controller_mode,
          vehicles_served,
          average_wait_seconds,
          maximum_queue,
          simulation_duration_seconds
        } = req.body;

        const [result] = await pool.execute(
          `INSERT INTO simulation_reports
           (controller_mode, vehicles_served, average_wait_seconds,
            maximum_queue, simulation_duration_seconds)
           VALUES (?, ?, ?, ?, ?)`,
          [
            controller_mode || "adaptive",
            vehicles_served ?? 0,
            average_wait_seconds ?? 0,
            maximum_queue ?? 0,
            simulation_duration_seconds ?? 0
          ]
        );

        res.json({
          success: true,
          message: "Simulation report saved!",
          report_id: result.insertId
        });
      } catch (error) {
        console.error("Report save error:", error);
        res
          .status(500)
          .json({ success: false, message: "Could not save simulation report." });
      }
    });

    // GET saved simulation reports.
    app.get("/api/simulation-reports", async (req, res) => {
      try {
        const [rows] = await pool.execute(
          "SELECT * FROM simulation_reports ORDER BY report_id DESC"
        );
        res.json(rows);
      } catch (error) {
        console.error("Report fetch error:", error);
        res.status(500).json({ message: "Could not fetch reports." });
      }
    });

    // Serve the main page.
    app.get("/", (req, res) => {
      res.sendFile(path.join(__dirname, "pages", "trafficlight.html"));
    });

    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Startup failed:", error.message);
    process.exit(1);
  }
}

startServer();
