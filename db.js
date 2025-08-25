const mysql = require("mysql2/promise");
require("dotenv").config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// Test the connection and log exact error if any
(async () => {
  try {
    const connection = await pool.getConnection();
    console.log("✅ Connected to MySQL successfully!");
    connection.release();
  } catch (err) {
    console.error("❌ Database connection failed:");
    console.error(err);  // 👉 this will show the exact problem
  }
})();

module.exports = pool;
