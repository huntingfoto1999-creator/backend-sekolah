require("dotenv").config();
const bcrypt = require("bcrypt");
const db = require("./config/db");

async function seedUsers() {
  try {
    const adminHash = await bcrypt.hash("12345", 10);
    const guruHash = await bcrypt.hash("12345", 10);

    db.query("DELETE FROM users", (delErr) => {
      if (delErr) {
        console.error("Gagal hapus users lama:", delErr.message);
        return;
      }

      const sql = `
        INSERT INTO users (nama, username, password, role, is_active)
        VALUES
        (?, ?, ?, ?, ?),
        (?, ?, ?, ?, ?)
      `;

      const values = [
        "Administrator", "admin", adminHash, "admin", 1,
        "Guru", "guru", guruHash, "guru", 1
      ];

      db.query(sql, values, (err) => {
        if (err) {
          console.error("Gagal seed users:", err.message);
          return;
        }

        console.log("Seed users berhasil");
        process.exit();
      });
    });
  } catch (err) {
    console.error("Error seed users:", err.message);
  }
}

seedUsers();