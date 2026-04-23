const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { roleRequired, authRequired } = require("../middleware/authMiddleware");

function validateStatus(status) {
  return ["hadir", "izin", "sakit", "alpha"].includes(String(status || "").toLowerCase());
}

function getToday() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getGuruByUserId(userId, callback) {
  db.query(
    "SELECT id, nama, username, role, is_active FROM users WHERE id = ? LIMIT 1",
    [userId],
    (err, results) => {
      if (err) return callback(err);
      if (results.length === 0) return callback(null, null);
      callback(null, results[0]);
    }
  );
}

// ================= ABSEN MASUK / SIMPAN ABSENSI GURU SENDIRI =================
router.post("/checkin", roleRequired("guru", "admin"), (req, res) => {
  const userId = req.user.id;
  const { tanggal, status, keterangan } = req.body;

  const tanggalFix = tanggal || getToday();
  const statusFix = String(status || "hadir").toLowerCase();
  const keteranganFix = (keterangan || "").trim();

  if (!validateStatus(statusFix)) {
    return res.status(400).json({
      message: "Status absensi guru tidak valid"
    });
  }

  getGuruByUserId(userId, (userErr, user) => {
    if (userErr) {
      return res.status(500).json({
        message: "Gagal validasi user",
        error: userErr.message
      });
    }

    if (!user) {
      return res.status(404).json({
        message: "User tidak ditemukan"
      });
    }

    if (Number(user.is_active) !== 1) {
      return res.status(403).json({
        message: "User tidak aktif"
      });
    }

    const cekSql = `
      SELECT id, jam_masuk, jam_pulang, status
      FROM absensi_guru
      WHERE guru_user_id = ? AND tanggal = ?
      LIMIT 1
    `;

    db.query(cekSql, [userId, tanggalFix], (cekErr, cekResults) => {
      if (cekErr) {
        return res.status(500).json({
          message: "Gagal cek absensi guru",
          error: cekErr.message
        });
      }

      if (cekResults.length > 0) {
        return res.json({
          message: "Absensi masuk hari ini sudah ada",
          data: cekResults[0]
        });
      }

      const insertSql = `
        INSERT INTO absensi_guru
        (guru_user_id, tanggal, jam_masuk, status, keterangan)
        VALUES (?, ?, NOW(), ?, ?)
      `;

      db.query(insertSql, [userId, tanggalFix, statusFix, keteranganFix], (insertErr, result) => {
        if (insertErr) {
          return res.status(500).json({
            message: "Gagal simpan absensi masuk guru",
            error: insertErr.message
          });
        }

        res.json({
          message: "Absensi masuk guru berhasil disimpan",
          id: result.insertId
        });
      });
    });
  });
});

// ================= ABSEN PULANG GURU SENDIRI =================
router.post("/checkout", roleRequired("guru", "admin"), (req, res) => {
  const userId = req.user.id;
  const { tanggal } = req.body;

  const tanggalFix = tanggal || getToday();

  const cekSql = `
    SELECT id, jam_masuk, jam_pulang
    FROM absensi_guru
    WHERE guru_user_id = ? AND tanggal = ?
    LIMIT 1
  `;

  db.query(cekSql, [userId, tanggalFix], (cekErr, cekResults) => {
    if (cekErr) {
      return res.status(500).json({
        message: "Gagal cek absensi guru",
        error: cekErr.message
      });
    }

    if (cekResults.length === 0) {
      return res.status(404).json({
        message: "Absensi masuk hari ini belum ada"
      });
    }

    const row = cekResults[0];

    if (row.jam_pulang) {
      return res.json({
        message: "Absensi pulang hari ini sudah dilakukan",
        data: row
      });
    }

    db.query(
      "UPDATE absensi_guru SET jam_pulang = NOW() WHERE id = ?",
      [row.id],
      (updateErr) => {
        if (updateErr) {
          return res.status(500).json({
            message: "Gagal simpan absensi pulang guru",
            error: updateErr.message
          });
        }

        res.json({
          message: "Absensi pulang guru berhasil disimpan"
        });
      }
    );
  });
});

// ================= IZIN / SAKIT / ALPHA OLEH ADMIN =================
router.post("/manual", roleRequired("admin"), (req, res) => {
  const { guru_user_id, tanggal, status, keterangan } = req.body;

  if (!guru_user_id || !tanggal || !status) {
    return res.status(400).json({
      message: "guru_user_id, tanggal, dan status wajib diisi"
    });
  }

  if (!validateStatus(status)) {
    return res.status(400).json({
      message: "Status absensi guru tidak valid"
    });
  }

  getGuruByUserId(guru_user_id, (userErr, user) => {
    if (userErr) {
      return res.status(500).json({
        message: "Gagal validasi guru",
        error: userErr.message
      });
    }

    if (!user) {
      return res.status(404).json({
        message: "User guru tidak ditemukan"
      });
    }

    const cekSql = `
      SELECT id
      FROM absensi_guru
      WHERE guru_user_id = ? AND tanggal = ?
      LIMIT 1
    `;

    db.query(cekSql, [guru_user_id, tanggal], (cekErr, cekResults) => {
      if (cekErr) {
        return res.status(500).json({
          message: "Gagal cek absensi guru",
          error: cekErr.message
        });
      }

      if (cekResults.length > 0) {
        db.query(
          `
          UPDATE absensi_guru
          SET status = ?, keterangan = ?
          WHERE guru_user_id = ? AND tanggal = ?
          `,
          [String(status).toLowerCase(), (keterangan || "").trim(), guru_user_id, tanggal],
          (updateErr) => {
            if (updateErr) {
              return res.status(500).json({
                message: "Gagal update absensi guru",
                error: updateErr.message
              });
            }

            res.json({
              message: "Absensi guru berhasil diupdate"
            });
          }
        );
      } else {
        db.query(
          `
          INSERT INTO absensi_guru
          (guru_user_id, tanggal, status, keterangan)
          VALUES (?, ?, ?, ?)
          `,
          [guru_user_id, tanggal, String(status).toLowerCase(), (keterangan || "").trim()],
          (insertErr, result) => {
            if (insertErr) {
              return res.status(500).json({
                message: "Gagal tambah absensi guru",
                error: insertErr.message
              });
            }

            res.json({
              message: "Absensi guru berhasil ditambahkan",
              id: result.insertId
            });
          }
        );
      }
    });
  });
});

// ================= STATUS ABSENSI GURU LOGIN =================
router.get("/me", roleRequired("guru", "admin"), (req, res) => {
  const userId = req.user.id;
  const tanggal = req.query.tanggal || getToday();

  db.query(
    `
    SELECT
      ag.*,
      u.nama,
      u.username
    FROM absensi_guru ag
    LEFT JOIN users u ON ag.guru_user_id = u.id
    WHERE ag.guru_user_id = ? AND ag.tanggal = ?
    LIMIT 1
    `,
    [userId, tanggal],
    (err, results) => {
      if (err) {
        return res.status(500).json({
          message: "Gagal ambil absensi guru login",
          error: err.message
        });
      }

      if (results.length === 0) {
        return res.json(null);
      }

      res.json(results[0]);
    }
  );
});

// ================= LIST ABSENSI GURU =================
router.get("/", roleRequired("admin"), (req, res) => {
  const { tanggal, guru_user_id, status } = req.query;

  let sql = `
    SELECT
      ag.id,
      ag.guru_user_id,
      ag.tanggal,
      ag.jam_masuk,
      ag.jam_pulang,
      ag.status,
      ag.keterangan,
      u.nama,
      u.username
    FROM absensi_guru ag
    LEFT JOIN users u ON ag.guru_user_id = u.id
    WHERE 1=1
  `;
  const params = [];

  if (tanggal) {
    sql += " AND ag.tanggal = ? ";
    params.push(tanggal);
  }

  if (guru_user_id) {
    sql += " AND ag.guru_user_id = ? ";
    params.push(guru_user_id);
  }

  if (status) {
    sql += " AND ag.status = ? ";
    params.push(String(status).toLowerCase());
  }

  sql += " ORDER BY ag.tanggal DESC, u.nama ASC";

  db.query(sql, params, (err, results) => {
    if (err) {
      return res.status(500).json({
        message: "Gagal ambil data absensi guru",
        error: err.message
      });
    }

    res.json(results);
  });
});

// ================= REKAP HARIAN ABSENSI GURU =================
router.get("/rekap", roleRequired("admin"), (req, res) => {
  const { tanggal } = req.query;

  if (!tanggal) {
    return res.status(400).json({
      message: "Tanggal wajib diisi"
    });
  }

  const sql = `
    SELECT
      u.id AS guru_user_id,
      u.nama,
      u.username,
      ag.status,
      ag.keterangan,
      ag.jam_masuk,
      ag.jam_pulang
    FROM users u
    LEFT JOIN absensi_guru ag
      ON u.id = ag.guru_user_id
      AND ag.tanggal = ?
    WHERE u.role = 'guru' AND u.is_active = 1
    ORDER BY u.nama ASC
  `;

  db.query(sql, [tanggal], (err, results) => {
    if (err) {
      return res.status(500).json({
        message: "Gagal ambil rekap harian absensi guru",
        error: err.message
      });
    }

    res.json(results);
  });
});

// ================= SUMMARY HARIAN ABSENSI GURU =================
router.get("/summary", roleRequired("admin"), (req, res) => {
  const { tanggal } = req.query;

  if (!tanggal) {
    return res.status(400).json({
      message: "Tanggal wajib diisi"
    });
  }

  const sql = `
    SELECT
      COUNT(u.id) AS total_guru,
      COALESCE(SUM(CASE WHEN ag.status = 'hadir' THEN 1 ELSE 0 END), 0) AS hadir,
      COALESCE(SUM(CASE WHEN ag.status = 'izin' THEN 1 ELSE 0 END), 0) AS izin,
      COALESCE(SUM(CASE WHEN ag.status = 'sakit' THEN 1 ELSE 0 END), 0) AS sakit,
      COALESCE(SUM(CASE WHEN ag.status = 'alpha' THEN 1 ELSE 0 END), 0) AS alpha
    FROM users u
    LEFT JOIN absensi_guru ag
      ON u.id = ag.guru_user_id
      AND ag.tanggal = ?
    WHERE u.role = 'guru' AND u.is_active = 1
  `;

  db.query(sql, [tanggal], (err, results) => {
    if (err) {
      return res.status(500).json({
        message: "Gagal ambil summary absensi guru",
        error: err.message
      });
    }

    res.json(results[0] || {});
  });
});

// ================= REKAP BULANAN ABSENSI GURU =================
router.get("/bulanan", roleRequired("admin"), (req, res) => {
  const { bulan, tahun } = req.query;

  if (!bulan || !tahun) {
    return res.status(400).json({
      message: "Bulan dan tahun wajib diisi"
    });
  }

  const sql = `
    SELECT
      u.id AS guru_user_id,
      u.nama,
      u.username,
      COALESCE(SUM(CASE WHEN ag.status = 'hadir' THEN 1 ELSE 0 END), 0) AS hadir,
      COALESCE(SUM(CASE WHEN ag.status = 'izin' THEN 1 ELSE 0 END), 0) AS izin,
      COALESCE(SUM(CASE WHEN ag.status = 'sakit' THEN 1 ELSE 0 END), 0) AS sakit,
      COALESCE(SUM(CASE WHEN ag.status = 'alpha' THEN 1 ELSE 0 END), 0) AS alpha
    FROM users u
    LEFT JOIN absensi_guru ag
      ON u.id = ag.guru_user_id
      AND MONTH(ag.tanggal) = ?
      AND YEAR(ag.tanggal) = ?
    WHERE u.role = 'guru' AND u.is_active = 1
    GROUP BY u.id, u.nama, u.username
    ORDER BY u.nama ASC
  `;

  db.query(sql, [bulan, tahun], (err, results) => {
    if (err) {
      return res.status(500).json({
        message: "Gagal ambil rekap bulanan absensi guru",
        error: err.message
      });
    }

    res.json(results);
  });
});

// ================= RIWAYAT ABSENSI GURU SENDIRI =================
router.get("/riwayat-saya", roleRequired("guru", "admin"), (req, res) => {
  const userId = req.user.id;
  const { bulan, tahun } = req.query;

  let sql = `
    SELECT
      id,
      guru_user_id,
      tanggal,
      jam_masuk,
      jam_pulang,
      status,
      keterangan
    FROM absensi_guru
    WHERE guru_user_id = ?
  `;
  const params = [userId];

  if (bulan) {
    sql += " AND MONTH(tanggal) = ? ";
    params.push(bulan);
  }

  if (tahun) {
    sql += " AND YEAR(tanggal) = ? ";
    params.push(tahun);
  }

  sql += " ORDER BY tanggal DESC";

  db.query(sql, params, (err, results) => {
    if (err) {
      return res.status(500).json({
        message: "Gagal ambil riwayat absensi guru",
        error: err.message
      });
    }

    res.json(results);
  });
});

module.exports = router;