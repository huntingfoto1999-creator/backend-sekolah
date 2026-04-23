const express = require("express");
const router = express.Router();
const db = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { authRequired } = require("../middleware/authMiddleware");

// LOGIN
router.post("/", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      message: "Username dan password wajib diisi"
    });
  }

  db.query(
    "SELECT * FROM users WHERE username = ? AND is_active = 1 LIMIT 1",
    [username],
    async (err, results) => {
      if (err) {
        return res.status(500).json({
          message: "Gagal proses login",
          error: err.message
        });
      }

      if (results.length === 0) {
        return res.status(401).json({
          message: "Username atau password salah"
        });
      }

      const user = results[0];

      try {
        const match = await bcrypt.compare(password, user.password);

        if (!match) {
          return res.status(401).json({
            message: "Username atau password salah"
          });
        }

        const token = jwt.sign(
          {
            id: user.id,
            username: user.username,
            nama: user.nama,
            role: user.role
          },
          process.env.JWT_SECRET,
          {
            expiresIn: process.env.JWT_EXPIRES_IN || "7d"
          }
        );

        return res.json({
          message: "Login berhasil",
          token,
          username: user.username,
          nama: user.nama,
          role: user.role
        });
      } catch (compareErr) {
        return res.status(500).json({
          message: "Gagal verifikasi password",
          error: compareErr.message
        });
      }
    }
  );
});

// PROFILE USER LOGIN
router.get("/me", authRequired, (req, res) => {
  res.json({
    id: req.user.id,
    username: req.user.username,
    nama: req.user.nama,
    role: req.user.role
  });
});

module.exports = router;