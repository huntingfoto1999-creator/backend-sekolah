const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { roleRequired } = require("../middleware/authMiddleware");

function isAdmin(req) {
  return req.user.role === "admin";
}

function validateStatus(status) {
  return ["hadir", "izin", "sakit", "alpha"].includes(String(status || "").toLowerCase());
}

function ensureKelasAccess(req, kelasId, callback) {
  if (isAdmin(req)) {
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

function getSiswaByIdWithAccess(req, siswaId, callback) {
  let sql = `
    SELECT
      siswa.id,
      siswa.nama,
      siswa.nis,
      siswa.kelas_id,
      kelas.nama_kelas,
      kelas.wali_user_id
    FROM siswa
    LEFT JOIN kelas ON siswa.kelas_id = kelas.id
    WHERE siswa.id = ?
  `;
  const params = [siswaId];

  if (!isAdmin(req)) {
    sql += " AND kelas.wali_user_id = ? ";
    params.push(req.user.id);
  }

  sql += " LIMIT 1";

  db.query(sql, params, (err, results) => {
    if (err) return callback(err);
    if (results.length === 0) return callback(null, null);
    callback(null, results[0]);
  });
}

// ================= GET ABSENSI =================
router.get("/", roleRequired("admin", "guru"), (req, res) => {
  const { tanggal, kelas_id } = req.query;

  let sql = `
    SELECT
      absensi.id,
      absensi.siswa_id,
      absensi.tanggal,
      absensi.status,
      absensi.keterangan,
      siswa.nama,
      siswa.nis,
      siswa.kelas_id,
      kelas.nama_kelas
    FROM absensi
    LEFT JOIN siswa ON absensi.siswa_id = siswa.id
    LEFT JOIN kelas ON siswa.kelas_id = kelas.id
    WHERE 1=1
  `;
  const params = [];

  if (tanggal) {
    sql += " AND absensi.tanggal = ? ";
    params.push(tanggal);
  }

  if (kelas_id) {
    sql += " AND siswa.kelas_id = ? ";
    params.push(kelas_id);
  }

  if (!isAdmin(req)) {
    sql += " AND kelas.wali_user_id = ? ";
    params.push(req.user.id);
  }

  sql += " ORDER BY absensi.tanggal DESC, siswa.nama ASC";

  db.query(sql, params, (err, result) => {
    if (err) {
      return res.status(500).json({
        message: "Gagal ambil data absensi",
        error: err.message
      });
    }
    res.json(result);
  });
});

// ================= SIMPAN / UPDATE =================
router.post("/", roleRequired("admin", "guru"), (req, res) => {
  const { siswa_id, tanggal, status, keterangan } = req.body;

  if (!siswa_id || !tanggal || !status) {
    return res.status(400).json({
      message: "siswa_id, tanggal, dan status wajib diisi"
    });
  }

  if (!validateStatus(status)) {
    return res.status(400).json({
      message: "Status absensi tidak valid"
    });
  }

  getSiswaByIdWithAccess(req, siswa_id, (findErr, siswa) => {
    if (findErr) {
      return res.status(500).json({
        message: "Gagal validasi akses siswa",
        error: findErr.message
      });
    }

    if (!siswa) {
      return res.status(404).json({
        message: "Siswa tidak ditemukan atau tidak bisa diakses"
      });
    }

    const cekSql = `SELECT id FROM absensi WHERE siswa_id = ? AND tanggal = ?`;

    db.query(cekSql, [siswa_id, tanggal], (err, result) => {
      if (err) {
        return res.status(500).json({
          message: "Gagal cek absensi",
          error: err.message
        });
      }

      if (result.length > 0) {
        const updateSql = `
          UPDATE absensi
          SET status = ?, keterangan = ?
          WHERE siswa_id = ? AND tanggal = ?
        `;

        db.query(
          updateSql,
          [String(status).toLowerCase(), (keterangan || "").trim(), siswa_id, tanggal],
          (err2) => {
            if (err2) {
              return res.status(500).json({
                message: "Gagal update absensi",
                error: err2.message
              });
            }

            res.json({ message: "Absensi berhasil diupdate" });
          }
        );
      } else {
        const insertSql = `
          INSERT INTO absensi (siswa_id, tanggal, status, keterangan)
          VALUES (?, ?, ?, ?)
        `;

        db.query(
          insertSql,
          [siswa_id, tanggal, String(status).toLowerCase(), (keterangan || "").trim()],
          (err3) => {
            if (err3) {
              return res.status(500).json({
                message: "Gagal simpan absensi",
                error: err3.message
              });
            }

            res.json({ message: "Absensi berhasil disimpan" });
          }
        );
      }
    });
  });
});

// ================= REKAP HARIAN =================
router.get("/rekap", roleRequired("admin", "guru"), (req, res) => {
  const { tanggal, kelas_id } = req.query;

  if (!tanggal || !kelas_id) {
    return res.status(400).json({
      message: "Tanggal dan kelas wajib diisi"
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

    const sql = `
      SELECT
        siswa.id AS siswa_id,
        siswa.nama,
        siswa.nis,
        siswa.kelas_id,
        kelas.nama_kelas,
        absensi.status,
        absensi.keterangan
      FROM siswa
      LEFT JOIN kelas ON siswa.kelas_id = kelas.id
      LEFT JOIN absensi
        ON siswa.id = absensi.siswa_id
        AND absensi.tanggal = ?
      WHERE siswa.kelas_id = ?
      ORDER BY siswa.nama ASC
    `;

    db.query(sql, [tanggal, kelas_id], (err, result) => {
      if (err) {
        return res.status(500).json({
          message: "Gagal ambil rekap harian",
          error: err.message
        });
      }
      res.json(result);
    });
  });
});

// ================= SUMMARY HARIAN =================
router.get("/summary", roleRequired("admin", "guru"), (req, res) => {
  const { tanggal, kelas_id } = req.query;

  if (!tanggal || !kelas_id) {
    return res.status(400).json({
      message: "Tanggal dan kelas wajib diisi"
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

    const sql = `
      SELECT
        COUNT(siswa.id) AS total_siswa,
        COALESCE(SUM(CASE WHEN absensi.status = 'hadir' THEN 1 ELSE 0 END), 0) AS hadir,
        COALESCE(SUM(CASE WHEN absensi.status = 'izin' THEN 1 ELSE 0 END), 0) AS izin,
        COALESCE(SUM(CASE WHEN absensi.status = 'sakit' THEN 1 ELSE 0 END), 0) AS sakit,
        COALESCE(SUM(CASE WHEN absensi.status = 'alpha' THEN 1 ELSE 0 END), 0) AS alpha
      FROM siswa
      LEFT JOIN absensi
        ON siswa.id = absensi.siswa_id
        AND absensi.tanggal = ?
      WHERE siswa.kelas_id = ?
    `;

    db.query(sql, [tanggal, kelas_id], (err, result) => {
      if (err) {
        return res.status(500).json({
          message: "Gagal ambil summary absensi",
          error: err.message
        });
      }
      res.json(result[0] || {});
    });
  });
});

// ================= RIWAYAT SISWA =================
router.get("/riwayat/:id", roleRequired("admin", "guru"), (req, res) => {
  const siswa_id = req.params.id;

  getSiswaByIdWithAccess(req, siswa_id, (findErr, siswa) => {
    if (findErr) {
      return res.status(500).json({
        message: "Gagal validasi akses siswa",
        error: findErr.message
      });
    }

    if (!siswa) {
      return res.status(404).json({
        message: "Siswa tidak ditemukan atau tidak bisa diakses"
      });
    }

    const sql = `
      SELECT tanggal, status, keterangan
      FROM absensi
      WHERE siswa_id = ?
      ORDER BY tanggal DESC
    `;

    db.query(sql, [siswa_id], (err, result) => {
      if (err) {
        return res.status(500).json({
          message: "Gagal ambil riwayat absensi",
          error: err.message
        });
      }
      res.json(result);
    });
  });
});

// ================= REKAP BULANAN =================
router.get("/bulanan", roleRequired("admin", "guru"), (req, res) => {
  const { kelas_id, bulan, tahun } = req.query;

  if (!kelas_id || !bulan || !tahun) {
    return res.status(400).json({
      message: "kelas_id, bulan, dan tahun wajib diisi"
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

    const sql = `
      SELECT
        siswa.id AS siswa_id,
        siswa.nama,
        siswa.nis,
        COALESCE(SUM(CASE WHEN absensi.status = 'hadir' THEN 1 ELSE 0 END), 0) AS hadir,
        COALESCE(SUM(CASE WHEN absensi.status = 'izin' THEN 1 ELSE 0 END), 0) AS izin,
        COALESCE(SUM(CASE WHEN absensi.status = 'sakit' THEN 1 ELSE 0 END), 0) AS sakit,
        COALESCE(SUM(CASE WHEN absensi.status = 'alpha' THEN 1 ELSE 0 END), 0) AS alpha,
        COALESCE(COUNT(absensi.id), 0) AS total_tercatat
      FROM siswa
      LEFT JOIN absensi
        ON siswa.id = absensi.siswa_id
        AND MONTH(absensi.tanggal) = ?
        AND YEAR(absensi.tanggal) = ?
      WHERE siswa.kelas_id = ?
      GROUP BY siswa.id, siswa.nama, siswa.nis
      ORDER BY siswa.nama ASC
    `;

    db.query(sql, [bulan, tahun, kelas_id], (err, rows) => {
      if (err) {
        return res.status(500).json({
          message: "Gagal ambil rekap bulanan",
          error: err.message
        });
      }

      const summary = rows.reduce(
        (acc, item) => {
          acc.total_siswa += 1;
          acc.hadir += Number(item.hadir || 0);
          acc.izin += Number(item.izin || 0);
          acc.sakit += Number(item.sakit || 0);
          acc.alpha += Number(item.alpha || 0);
          return acc;
        },
        {
          total_siswa: 0,
          hadir: 0,
          izin: 0,
          sakit: 0,
          alpha: 0
        }
      );

      res.json({
        kelas_id,
        bulan,
        tahun,
        summary,
        data: rows
      });
    });
  });
});

module.exports = router;