const express = require("express");
const router = express.Router();
const db = require("../config/db");
const bcrypt = require("bcrypt");
const { authRequired } = require("../middleware/authMiddleware");

// GET profil login
router.get("/", authRequired, (req, res) => {
  db.query(
    "SELECT id, nama, username, role, is_active, created_at FROM users WHERE id = ? LIMIT 1",
    [req.user.id],
    (err, results) => {
      if (err) {
        return res.status(500).json({
          message: "Gagal ambil profil",
          error: err.message
        });
      }

      if (results.length === 0) {
        return res.status(404).json({
          message: "User tidak ditemukan"
        });
      }

      res.json(results[0]);
    }
  );
});

// PUT update nama profil
router.put("/", authRequired, (req, res) => {
  const { nama } = req.body;

  if (!nama || !nama.trim()) {
    return res.status(400).json({
      message: "Nama wajib diisi"
    });
  }

  db.query(
    "UPDATE users SET nama = ? WHERE id = ?",
    [nama.trim(), req.user.id],
    (err) => {
      if (err) {
        return res.status(500).json({
          message: "Gagal update profil",
          error: err.message
        });
      }

      res.json({
        message: "Profil berhasil diupdate"
      });
    }
  );
});

// PUT ganti password sendiri
router.put("/change-password", authRequired, async (req, res) => {
  const { passwordLama, passwordBaru } = req.body;

  if (!passwordLama || !passwordBaru) {
    return res.status(400).json({
      message: "Password lama dan password baru wajib diisi"
    });
  }

  try {
    db.query(
      "SELECT * FROM users WHERE id = ? LIMIT 1",
      [req.user.id],
      async (err, results) => {
        if (err) {
          return res.status(500).json({
            message: "Gagal ambil user",
            error: err.message
          });
        }

        if (results.length === 0) {
          return res.status(404).json({
            message: "User tidak ditemukan"
          });
        }

        const user = results[0];
        const cocok = await bcrypt.compare(passwordLama, user.password);

        if (!cocok) {
          return res.status(400).json({
            message: "Password lama salah"
          });
        }

        const hashedPassword = await bcrypt.hash(passwordBaru, 10);

        db.query(
          "UPDATE users SET password = ? WHERE id = ?",
          [hashedPassword, req.user.id],
          (updateErr) => {
            if (updateErr) {
              return res.status(500).json({
                message: "Gagal ganti password",
                error: updateErr.message
              });
            }

            res.json({
              message: "Password berhasil diganti"
            });
          }
        );
      }
    );
  } catch (error) {
    return res.status(500).json({
      message: "Gagal proses ganti password",
      error: error.message
    });
  }
});

module.exports = router;