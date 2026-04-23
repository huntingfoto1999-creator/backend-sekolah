const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { roleRequired } = require("../middleware/authMiddleware");

// helper
function getWaliNamaByUserId(userId, callback) {
  if (!userId) return callback(null, "");

  db.query(
    "SELECT id, nama, role, is_active FROM users WHERE id = ? LIMIT 1",
    [userId],
    (err, results) => {
      if (err) return callback(err);

      if (results.length === 0) {
        return callback(new Error("User wali kelas tidak ditemukan"));
      }

      const user = results[0];

      if (user.role !== "guru") {
        return callback(new Error("Wali kelas harus user dengan role guru"));
      }

      if (Number(user.is_active) !== 1) {
        return callback(new Error("User guru wali kelas tidak aktif"));
      }

      callback(null, user.nama || "");
    }
  );
}

// GET semua kelas
router.get("/", roleRequired("admin", "guru"), (req, res) => {
  const isAdmin = req.user.role === "admin";

  let sql = `
    SELECT
      kelas.id,
      kelas.nama_kelas,
      kelas.wali_kelas,
      kelas.wali_user_id,
      users.nama AS wali_user_nama,
      users.username AS wali_username
    FROM kelas
    LEFT JOIN users ON kelas.wali_user_id = users.id
  `;

  const params = [];

  if (!isAdmin) {
    sql += " WHERE kelas.wali_user_id = ? ";
    params.push(req.user.id);
  }

  sql += " ORDER BY kelas.nama_kelas ASC";

  db.query(sql, params, (err, results) => {
    if (err) {
      return res.status(500).json({
        message: "Gagal ambil data kelas",
        error: err.message
      });
    }

    res.json(results);
  });
});

// GET detail kelas
router.get("/:id", roleRequired("admin", "guru"), (req, res) => {
  const id = req.params.id;
  const isAdmin = req.user.role === "admin";

  let sql = `
    SELECT
      kelas.id,
      kelas.nama_kelas,
      kelas.wali_kelas,
      kelas.wali_user_id,
      users.nama AS wali_user_nama,
      users.username AS wali_username
    FROM kelas
    LEFT JOIN users ON kelas.wali_user_id = users.id
    WHERE kelas.id = ?
  `;

  const params = [id];

  if (!isAdmin) {
    sql += " AND kelas.wali_user_id = ? ";
    params.push(req.user.id);
  }

  sql += " LIMIT 1";

  db.query(sql, params, (err, results) => {
    if (err) {
      return res.status(500).json({
        message: "Gagal ambil detail kelas",
        error: err.message
      });
    }

    if (results.length === 0) {
      return res.status(404).json({
        message: "Kelas tidak ditemukan"
      });
    }

    res.json(results[0]);
  });
});

// POST tambah kelas
router.post("/", roleRequired("admin"), (req, res) => {
  const { nama_kelas, wali_user_id } = req.body;

  if (!nama_kelas || !nama_kelas.trim()) {
    return res.status(400).json({
      message: "Nama kelas wajib diisi"
    });
  }

  db.query(
    "SELECT id FROM kelas WHERE nama_kelas = ? LIMIT 1",
    [nama_kelas.trim()],
    (cekErr, cekResults) => {
      if (cekErr) {
        return res.status(500).json({
          message: "Gagal cek nama kelas",
          error: cekErr.message
        });
      }

      if (cekResults.length > 0) {
        return res.status(400).json({
          message: "Nama kelas sudah ada"
        });
      }

      const lanjutSimpan = (waliNama) => {
        db.query(
          "INSERT INTO kelas (nama_kelas, wali_kelas, wali_user_id) VALUES (?, ?, ?)",
          [nama_kelas.trim(), (waliNama || "").trim(), wali_user_id || null],
          (err, result) => {
            if (err) {
              return res.status(500).json({
                message: "Gagal tambah kelas",
                error: err.message
              });
            }

            res.json({
              message: "Kelas berhasil ditambah",
              id: result.insertId
            });
          }
        );
      };

      if (wali_user_id) {
        getWaliNamaByUserId(wali_user_id, (waliErr, waliNama) => {
          if (waliErr) {
            return res.status(400).json({
              message: waliErr.message
            });
          }

          lanjutSimpan(waliNama);
        });
      } else {
        lanjutSimpan("");
      }
    }
  );
});

// PUT edit kelas
router.put("/:id", roleRequired("admin"), (req, res) => {
  const id = req.params.id;
  const { nama_kelas, wali_user_id } = req.body;

  if (!nama_kelas || !nama_kelas.trim()) {
    return res.status(400).json({
      message: "Nama kelas wajib diisi"
    });
  }

  db.query(
    "SELECT id FROM kelas WHERE nama_kelas = ? AND id != ? LIMIT 1",
    [nama_kelas.trim(), id],
    (cekErr, cekResults) => {
      if (cekErr) {
        return res.status(500).json({
          message: "Gagal cek nama kelas",
          error: cekErr.message
        });
      }

      if (cekResults.length > 0) {
        return res.status(400).json({
          message: "Nama kelas sudah dipakai kelas lain"
        });
      }

      const lanjutUpdate = (waliNama) => {
        db.query(
          "UPDATE kelas SET nama_kelas = ?, wali_kelas = ?, wali_user_id = ? WHERE id = ?",
          [nama_kelas.trim(), (waliNama || "").trim(), wali_user_id || null, id],
          (err, result) => {
            if (err) {
              return res.status(500).json({
                message: "Gagal update kelas",
                error: err.message
              });
            }

            if (result.affectedRows === 0) {
              return res.status(404).json({
                message: "Kelas tidak ditemukan"
              });
            }

            res.json({
              message: "Kelas berhasil diupdate"
            });
          }
        );
      };

      if (wali_user_id) {
        getWaliNamaByUserId(wali_user_id, (waliErr, waliNama) => {
          if (waliErr) {
            return res.status(400).json({
              message: waliErr.message
            });
          }

          lanjutUpdate(waliNama);
        });
      } else {
        lanjutUpdate("");
      }
    }
  );
});

// DELETE kelas
router.delete("/:id", roleRequired("admin"), (req, res) => {
  const id = req.params.id;

  db.query(
    "SELECT COUNT(*) AS total FROM siswa WHERE kelas_id = ?",
    [id],
    (cekErr, cekResults) => {
      if (cekErr) {
        return res.status(500).json({
          message: "Gagal cek relasi siswa",
          error: cekErr.message
        });
      }

      if ((cekResults[0]?.total || 0) > 0) {
        return res.status(400).json({
          message: "Kelas tidak bisa dihapus karena masih dipakai data siswa"
        });
      }

      db.query(
        "DELETE FROM kelas WHERE id = ?",
        [id],
        (err, result) => {
          if (err) {
            return res.status(500).json({
              message: "Gagal hapus kelas",
              error: err.message
            });
          }

          if (result.affectedRows === 0) {
            return res.status(404).json({
              message: "Kelas tidak ditemukan"
            });
          }

          res.json({
            message: "Kelas berhasil dihapus"
          });
        }
      );
    }
  );
});

module.exports = router;