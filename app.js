require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");

const db = require("./config/db");

const beritaRoutes = require("./routes/beritaRoutes");
const authRoutes = require("./routes/authRoutes");
const guruRoutes = require("./routes/guruRoutes");
const galeriRoutes = require("./routes/galeriRoutes");
const pesanRoutes = require("./routes/pesanRoutes");
const siswaRoutes = require("./routes/siswaRoutes");
const usersRoutes = require("./routes/usersRoutes");
const pengumumanRoutes = require("./routes/pengumumanRoutes");
const agendaRoutes = require("./routes/agendaRoutes");
const profileRoutes = require("./routes/profileRoutes");
const websiteProfileRoutes = require("./routes/websiteProfileRoutes");
const kelasRoutes = require("./routes/kelasRoutes");
const absensiRoutes = require("./routes/absensiRoutes");
const ppdbRoutes = require("./routes/ppdbRoutes");
const absensiGuruRoutes = require("./routes/absensiGuruRoutes");

const app = express();

const PORT = process.env.PORT || 3000;

// Ganti nanti dengan domain frontend kamu setelah deploy
const allowedOrigins = [
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // izinkan request tanpa origin (Postman, mobile app, server-to-server)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error("CORS tidak diizinkan untuk origin ini: " + origin));
  },
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Backend sekolah aktif 🚀"
  });
});

// ROUTES
app.use("/berita", beritaRoutes);
app.use("/login", authRoutes);
app.use("/guru", guruRoutes);
app.use("/galeri", galeriRoutes);
app.use("/pesan", pesanRoutes);
app.use("/siswa", siswaRoutes);
app.use("/users", usersRoutes);
app.use("/pengumuman", pengumumanRoutes);
app.use("/agenda", agendaRoutes);
app.use("/profile", profileRoutes);
app.use("/website-profile", websiteProfileRoutes);
app.use("/kelas", kelasRoutes);
app.use("/absensi", absensiRoutes);
app.use("/ppdb", ppdbRoutes);
app.use("/absensi-guru", absensiGuruRoutes);

app.get("/buat-admin", async (req, res) => {
  const bcrypt = require("bcrypt");

  try {
    const passwordHash = await bcrypt.hash("12345", 10);

    const cekSql = "SELECT id FROM users WHERE username = ? LIMIT 1";
    db.query(cekSql, ["admin"], (cekErr, cekResults) => {
      if (cekErr) {
        return res.status(500).json({ success: false, message: cekErr.message });
      }

      if (cekResults.length > 0) {
        return res.json({ success: true, message: "User admin sudah ada" });
      }

      const sql = `
        INSERT INTO users (nama, username, password, role, is_active)
        VALUES (?, ?, ?, ?, ?)
      `;

      db.query(sql, ["Administrator", "admin", passwordHash, "admin", 1], (err) => {
        if (err) {
          return res.status(500).json({ success: false, message: err.message });
        }

        res.json({ success: true, message: "Admin berhasil dibuat" });
      });
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// handler route tidak ditemukan
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route tidak ditemukan"
  });
});

// error handler umum
app.use((err, req, res, next) => {
  console.error("SERVER ERROR:", err);

  res.status(500).json({
    success: false,
    message: err.message || "Terjadi kesalahan pada server"
  });
});

app.listen(PORT, () => {
  console.log(`Server jalan di port ${PORT}`);
});

app.get("/buat-admin", async (req, res) => {
  const bcrypt = require("bcrypt");

  const passwordHash = await bcrypt.hash("12345", 10);

  const sql = `
    INSERT INTO users (nama, username, password, role, is_active)
    VALUES (?, ?, ?, ?, ?)
  `;

  db.query(sql, ["Administrator", "admin", passwordHash, "admin", 1], (err) => {
    if (err) {
      return res.json({ error: err.message });
    }

    res.json({ success: true, message: "Admin berhasil dibuat" });
  });
});