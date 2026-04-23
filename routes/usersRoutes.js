const express = require("express");
const router = express.Router();
const db = require("../config/db");
const bcrypt = require("bcrypt");
const { roleRequired } = require("../middleware/authMiddleware");

// GET semua user
router.get("/", roleRequired("admin"), (req, res) => {
  db.query(
    "SELECT id, nama, username, role, is_active, created_at FROM users ORDER BY id DESC",
    (err, results) => {
      if (err) {
        return res.status(500).json({
          message: "Gagal ambil data user",
          error: err.message
        });
      }

      res.json(results);
    }
  );
});

// POST tambah user
router.post("/", roleRequired("admin"), async (req, res) => {
  const { nama, username, password, role } = req.body;

  if (!nama || !username || !password || !role) {
    return res.status(400).json({
      message: "Nama, username, password, dan role wajib diisi"
    });
  }

  if (!["admin", "guru"].includes(role)) {
    return res.status(400).json({
      message: "Role tidak valid"
    });
  }

  db.query(
    "SELECT id FROM users WHERE username = ? LIMIT 1",
    [username],
    async (cekErr, cekResults) => {
      if (cekErr) {
        return res.status(500).json({
          message: "Gagal cek username",
          error: cekErr.message
        });
      }

      if (cekResults.length > 0) {
        return res.status(400).json({
          message: "Username sudah digunakan"
        });
      }

      try {
        const hashedPassword = await bcrypt.hash(password, 10);

        db.query(
          "INSERT INTO users (nama, username, password, role, is_active) VALUES (?, ?, ?, ?, 1)",
          [nama, username, hashedPassword, role],
          (err, result) => {
            if (err) {
              return res.status(500).json({
                message: "Gagal tambah user",
                error: err.message
              });
            }

            res.json({
              message: "User berhasil ditambah",
              id: result.insertId
            });
          }
        );
      } catch (hashErr) {
        return res.status(500).json({
          message: "Gagal hash password",
          error: hashErr.message
        });
      }
    }
  );
});

// PUT edit user
router.put("/:id", roleRequired("admin"), async (req, res) => {
  const id = req.params.id;
  const { nama, username, role, is_active, password } = req.body;

  if (!nama || !username || !role) {
    return res.status(400).json({
      message: "Nama, username, dan role wajib diisi"
    });
  }

  if (!["admin", "guru"].includes(role)) {
    return res.status(400).json({
      message: "Role tidak valid"
    });
  }

  db.query(
    "SELECT id FROM users WHERE username = ? AND id != ? LIMIT 1",
    [username, id],
    async (cekErr, cekResults) => {
      if (cekErr) {
        return res.status(500).json({
          message: "Gagal cek username",
          error: cekErr.message
        });
      }

      if (cekResults.length > 0) {
        return res.status(400).json({
          message: "Username sudah digunakan user lain"
        });
      }

      try {
        const finalStatus = Number(is_active) === 1 ? 1 : 0;

        if (password && password.trim() !== "") {
          const hashedPassword = await bcrypt.hash(password, 10);

          db.query(
            "UPDATE users SET nama = ?, username = ?, role = ?, is_active = ?, password = ? WHERE id = ?",
            [nama, username, role, finalStatus, hashedPassword, id],
            (err, result) => {
              if (err) {
                return res.status(500).json({
                  message: "Gagal update user",
                  error: err.message
                });
              }

              if (result.affectedRows === 0) {
                return res.status(404).json({
                  message: "User tidak ditemukan"
                });
              }

              res.json({
                message: "User dan password berhasil diupdate"
              });
            }
          );
        } else {
          db.query(
            "UPDATE users SET nama = ?, username = ?, role = ?, is_active = ? WHERE id = ?",
            [nama, username, role, finalStatus, id],
            (err, result) => {
              if (err) {
                return res.status(500).json({
                  message: "Gagal update user",
                  error: err.message
                });
              }

              if (result.affectedRows === 0) {
                return res.status(404).json({
                  message: "User tidak ditemukan"
                });
              }

              res.json({
                message: "User berhasil diupdate"
              });
            }
          );
        }
      } catch (hashErr) {
        return res.status(500).json({
          message: "Gagal hash password",
          error: hashErr.message
        });
      }
    }
  );
});

// PUT reset password user
router.put("/:id/reset-password", roleRequired("admin"), async (req, res) => {
  const id = req.params.id;
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({
      message: "Password baru wajib diisi"
    });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    db.query(
      "UPDATE users SET password = ? WHERE id = ?",
      [hashedPassword, id],
      (err, result) => {
        if (err) {
          return res.status(500).json({
            message: "Gagal reset password",
            error: err.message
          });
        }

        if (result.affectedRows === 0) {
          return res.status(404).json({
            message: "User tidak ditemukan"
          });
        }

        res.json({
          message: "Password user berhasil direset"
        });
      }
    );
  } catch (hashErr) {
    return res.status(500).json({
      message: "Gagal hash password",
      error: hashErr.message
    });
  }
});

// DELETE user
router.delete("/:id", roleRequired("admin"), (req, res) => {
  const id = req.params.id;

  if (String(req.user.id) === String(id)) {
    return res.status(400).json({
      message: "Akun yang sedang login tidak bisa dihapus"
    });
  }

  db.query("DELETE FROM users WHERE id = ?", [id], (err, result) => {
    if (err) {
      return res.status(500).json({
        message: "Gagal hapus user",
        error: err.message
      });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "User tidak ditemukan"
      });
    }

    res.json({
      message: "User berhasil dihapus"
    });
  });
});

module.exports = router;