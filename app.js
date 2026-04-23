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

// daftar origin yang diizinkan
const allowedOrigins = [
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // izinkan request tanpa origin seperti Postman / mobile app / server-to-server
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

// ROOT
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