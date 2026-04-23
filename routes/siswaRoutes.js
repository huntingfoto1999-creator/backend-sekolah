const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { roleRequired } = require("../middleware/authMiddleware");

// helper cek apakah guru punya akses ke kelas tertentu
function ensureKelasAccess(req, kelasId, callback) {
  const isAdmin = req.user.role === "admin";

  if (isAdmin) {
    return callback(null, true);
  }

  db.query(
    "SELECT id FROM kelas WHERE id = ? AND wali_user_id = ? LIMIT 1",
    [kelasId, req.user.id],
    (err, results) => {
      if (err) return callback(err);
      callback(null, results.length > 0);
    }
  );
}

// helper ambil siswa by id + validasi akses guru/admin
function getSiswaByIdWithAccess(req, siswaId, callback) {
  const isAdmin = req.user.role === "admin";

  let sql = `
    SELECT
      siswa.*,
      kelas.nama_kelas,
      kelas.wali_user_id
    FROM siswa
    LEFT JOIN kelas ON siswa.kelas_id = kelas.id
    WHERE siswa.id = ?
  `;
  const params = [siswaId];

  if (!isAdmin) {
    sql += " AND kelas.wali_user_id = ? ";
    params.push(req.user.id);
  }

  sql += " LIMIT 1";

  db.query(sql, params, (err, results) => {
    if (err) return callback(err);
    if (results.length === 0) {
      return callback(null, null);
    }
    callback(null, results[0]);
  });
}

// ================= GET SISWA =================
router.get("/", roleRequired("admin", "guru"), (req, res) => {
  const { kelas_id } = req.query;
  const isAdmin = req.user.role === "admin";

  let sql = `
    SELECT
      siswa.*,
      kelas.nama_kelas
    FROM siswa
    LEFT JOIN kelas ON siswa.kelas_id = kelas.id
    WHERE 1=1
  `;
  const params = [];

  if (kelas_id) {
    sql += " AND siswa.kelas_id = ? ";
    params.push(kelas_id);
  }

  if (!isAdmin) {
    sql += " AND kelas.wali_user_id = ? ";
    params.push(req.user.id);
  }

  sql += " ORDER BY siswa.nama ASC";

  db.query(sql, params, (err, results) => {
    if (err) {
      return res.status(500).json({
        message: "Gagal ambil data siswa",
        error: err.message
      });
    }

    res.json(results);
  });
});

// ================= GET DETAIL SISWA =================
router.get("/:id", roleRequired("admin", "guru"), (req, res) => {
  const id = req.params.id;

  getSiswaByIdWithAccess(req, id, (err, siswa) => {
    if (err) {
      return res.status(500).json({
        message: "Gagal ambil detail siswa",
        error: err.message
      });
    }

    if (!siswa) {
      return res.status(404).json({
        message: "Siswa tidak ditemukan"
      });
    }

    res.json(siswa);
  });
});

// ================= TAMBAH =================
router.post("/", roleRequired("admin", "guru"), (req, res) => {
  const { nama, nis, kelas_id, alamat } = req.body;

  if (!nama || !nis || !kelas_id) {
    return res.status(400).json({
      message: "Nama, NIS, dan kelas wajib diisi"
    });
  }

  ensureKelasAccess(req, kelas_id, (aksesErr, allowed) => {
    if (aksesErr) {
      return res.status(500).json({
        message: "Gagal validasi akses kelas",
        error: aksesErr.message
      });
    }

    if (!allowed) {
      return res.status(403).json({
        message: "Anda tidak punya akses ke kelas ini"
      });
    }

    db.query(
      "SELECT id FROM siswa WHERE nis = ? LIMIT 1",
      [nis.trim()],
      (cekErr, cekResults) => {
        if (cekErr) {
          return res.status(500).json({
            message: "Gagal cek NIS siswa",
            error: cekErr.message
          });
        }

        if (cekResults.length > 0) {
          return res.status(400).json({
            message: "NIS sudah digunakan"
          });
        }

        const sql = `
          INSERT INTO siswa (nama, nis, kelas_id, alamat)
          VALUES (?, ?, ?, ?)
        `;

        db.query(
          sql,
          [nama.trim(), nis.trim(), kelas_id, (alamat || "").trim()],
          (err, result) => {
            if (err) {
              return res.status(500).json({
                message: "Gagal tambah siswa",
                error: err.message
              });
            }

            res.json({
              message: "Siswa berhasil ditambahkan",
              id: result.insertId
            });
          }
        );
      }
    );
  });
});

// ================= UPDATE =================
router.put("/:id", roleRequired("admin", "guru"), (req, res) => {
  const id = req.params.id;
  const { nama, nis, kelas_id, alamat } = req.body;

  if (!nama || !nis || !kelas_id) {
    return res.status(400).json({
      message: "Nama, NIS, dan kelas wajib diisi"
    });
  }

  getSiswaByIdWithAccess(req, id, (findErr, siswaLama) => {
    if (findErr) {
      return res.status(500).json({
        message: "Gagal cek siswa",
        error: findErr.message
      });
    }

    if (!siswaLama) {
      return res.status(404).json({
        message: "Siswa tidak ditemukan"
      });
    }

    ensureKelasAccess(req, kelas_id, (aksesErr, allowed) => {
      if (aksesErr) {
        return res.status(500).json({
          message: "Gagal validasi akses kelas",
          error: aksesErr.message
        });
      }

      if (!allowed) {
        return res.status(403).json({
          message: "Anda tidak punya akses memindahkan siswa ke kelas ini"
        });
      }

      db.query(
        "SELECT id FROM siswa WHERE nis = ? AND id != ? LIMIT 1",
        [nis.trim(), id],
        (cekErr, cekResults) => {
          if (cekErr) {
            return res.status(500).json({
              message: "Gagal cek NIS siswa",
              error: cekErr.message
            });
          }

          if (cekResults.length > 0) {
            return res.status(400).json({
              message: "NIS sudah digunakan siswa lain"
            });
          }

          const sql = `
            UPDATE siswa
            SET nama = ?, nis = ?, kelas_id = ?, alamat = ?
            WHERE id = ?
          `;

          db.query(
            sql,
            [nama.trim(), nis.trim(), kelas_id, (alamat || "").trim(), id],
            (err) => {
              if (err) {
                return res.status(500).json({
                  message: "Gagal update siswa",
                  error: err.message
                });
              }

              res.json({
                message: "Siswa berhasil diupdate"
              });
            }
          );
        }
      );
    });
  });
});

// ================= DELETE =================
router.delete("/:id", roleRequired("admin", "guru"), (req, res) => {
  const id = req.params.id;

  getSiswaByIdWithAccess(req, id, (findErr, siswa) => {
    if (findErr) {
      return res.status(500).json({
        message: "Gagal cek data siswa",
        error: findErr.message
      });
    }

    if (!siswa) {
      return res.status(404).json({
        message: "Siswa tidak ditemukan"
      });
    }

    db.query("DELETE FROM absensi WHERE siswa_id = ?", [id], (absErr) => {
      if (absErr) {
        return res.status(500).json({
          message: "Gagal hapus relasi absensi siswa",
          error: absErr.message
        });
      }

      db.query("DELETE FROM siswa WHERE id = ?", [id], (err) => {
        if (err) {
          return res.status(500).json({
            message: "Gagal hapus siswa",
            error: err.message
          });
        }

        res.json({
          message: "Siswa berhasil dihapus"
        });
      });
    });
  });
});

module.exports = router;