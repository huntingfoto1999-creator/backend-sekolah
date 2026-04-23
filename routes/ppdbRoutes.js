const express = require("express");
const router = express.Router();
const db = require("../config/db");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { roleRequired } = require("../middleware/authMiddleware");

// ================= MULTER =================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const safeName = Date.now() + "-" + Math.round(Math.random() * 1e9) + path.extname(file.originalname);
    cb(null, safeName);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = [
    "image/jpeg",
    "image/png",
    "image/jpg",
    "application/pdf"
  ];

  if (!allowed.includes(file.mimetype)) {
    return cb(new Error("Format file tidak didukung. Gunakan JPG, PNG, atau PDF."));
  }

  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024
  }
});

const uploadFields = upload.fields([
  { name: "akta_file", maxCount: 1 },
  { name: "kk_file", maxCount: 1 },
  { name: "foto_file", maxCount: 1 },
  { name: "ijazah_file", maxCount: 1 }
]);

function getUploadedFilename(req, fieldName) {
  if (!req.files || !req.files[fieldName] || !req.files[fieldName][0]) {
    return "";
  }
  return req.files[fieldName][0].filename;
}

function hapusFileJikaAda(namaFile) {
  if (!namaFile) return;
  const filePath = path.join(__dirname, "..", "uploads", namaFile);

  fs.unlink(filePath, (err) => {
    if (err && err.code !== "ENOENT") {
      console.error("Gagal hapus file:", err.message);
    }
  });
}

function generateNoPendaftaran(callback) {
  const year = new Date().getFullYear();

  db.query(
    "SELECT COUNT(*) AS total FROM ppdb WHERE YEAR(created_at) = ?",
    [year],
    (err, results) => {
      if (err) return callback(err);

      const urut = (results[0]?.total || 0) + 1;
      const nomor = String(urut).padStart(4, "0");
      const noPendaftaran = `PPDB${year}-${nomor}`;

      callback(null, noPendaftaran);
    }
  );
}

// ================= GET ALL PPDB (ADMIN) =================
router.get("/", roleRequired("admin"), (req, res) => {
  const { status, keyword } = req.query;

  let sql = `
    SELECT
      p.*,
      b.akta_file,
      b.kk_file,
      b.foto_file,
      b.ijazah_file
    FROM ppdb p
    LEFT JOIN ppdb_berkas b ON p.id = b.ppdb_id
    WHERE 1=1
  `;
  const params = [];

  if (status) {
    sql += " AND p.status = ? ";
    params.push(status);
  }

  if (keyword) {
    sql += `
      AND (
        p.no_pendaftaran LIKE ?
        OR p.nama_lengkap LIKE ?
        OR p.nisn LIKE ?
        OR p.no_hp LIKE ?
        OR p.asal_sekolah LIKE ?
      )
    `;
    const q = `%${keyword}%`;
    params.push(q, q, q, q, q);
  }

  sql += " ORDER BY p.id DESC";

  db.query(sql, params, (err, results) => {
    if (err) {
      return res.status(500).json({
        message: "Gagal ambil data PPDB",
        error: err.message
      });
    }

    res.json(results);
  });
});

// ================= GET DETAIL PPDB (ADMIN) =================
router.get("/:id", roleRequired("admin"), (req, res) => {
  const id = req.params.id;

  db.query(
    `
    SELECT
      p.*,
      b.akta_file,
      b.kk_file,
      b.foto_file,
      b.ijazah_file
    FROM ppdb p
    LEFT JOIN ppdb_berkas b ON p.id = b.ppdb_id
    WHERE p.id = ?
    LIMIT 1
    `,
    [id],
    (err, results) => {
      if (err) {
        return res.status(500).json({
          message: "Gagal ambil detail PPDB",
          error: err.message
        });
      }

      if (results.length === 0) {
        return res.status(404).json({
          message: "Data PPDB tidak ditemukan"
        });
      }

      res.json(results[0]);
    }
  );
});

// ================= DAFTAR PPDB (PUBLIK) =================
router.post("/", (req, res) => {
  uploadFields(req, res, (uploadErr) => {
    if (uploadErr) {
      return res.status(400).json({
        message: uploadErr.message || "Gagal upload berkas"
      });
    }

    const {
      nama_lengkap,
      jenis_kelamin,
      tempat_lahir,
      tanggal_lahir,
      nisn,
      agama,
      alamat,
      nama_ayah,
      nama_ibu,
      no_hp,
      email,
      asal_sekolah,
      pilihan_kelas
    } = req.body;

    if (!nama_lengkap || !jenis_kelamin || !alamat || !no_hp) {
      return res.status(400).json({
        message: "Nama lengkap, jenis kelamin, alamat, dan no HP wajib diisi"
      });
    }

    if (!["L", "P"].includes(jenis_kelamin)) {
      return res.status(400).json({
        message: "Jenis kelamin tidak valid"
      });
    }

    generateNoPendaftaran((noErr, noPendaftaran) => {
      if (noErr) {
        return res.status(500).json({
          message: "Gagal buat nomor pendaftaran",
          error: noErr.message
        });
      }

      const sqlPpdb = `
        INSERT INTO ppdb (
          no_pendaftaran,
          nama_lengkap,
          jenis_kelamin,
          tempat_lahir,
          tanggal_lahir,
          nisn,
          agama,
          alamat,
          nama_ayah,
          nama_ibu,
          no_hp,
          email,
          asal_sekolah,
          pilihan_kelas,
          status,
          catatan_admin
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'menunggu', '')
      `;

      const values = [
        noPendaftaran,
        nama_lengkap.trim(),
        jenis_kelamin,
        (tempat_lahir || "").trim(),
        tanggal_lahir || null,
        (nisn || "").trim(),
        (agama || "").trim(),
        (alamat || "").trim(),
        (nama_ayah || "").trim(),
        (nama_ibu || "").trim(),
        (no_hp || "").trim(),
        (email || "").trim(),
        (asal_sekolah || "").trim(),
        (pilihan_kelas || "").trim()
      ];

      db.query(sqlPpdb, values, (err, result) => {
        if (err) {
          return res.status(500).json({
            message: "Gagal simpan pendaftaran PPDB",
            error: err.message
          });
        }

        const ppdbId = result.insertId;

        const sqlBerkas = `
          INSERT INTO ppdb_berkas (
            ppdb_id,
            akta_file,
            kk_file,
            foto_file,
            ijazah_file
          ) VALUES (?, ?, ?, ?, ?)
        `;

        const berkasValues = [
          ppdbId,
          getUploadedFilename(req, "akta_file"),
          getUploadedFilename(req, "kk_file"),
          getUploadedFilename(req, "foto_file"),
          getUploadedFilename(req, "ijazah_file")
        ];

        db.query(sqlBerkas, berkasValues, (berkasErr) => {
          if (berkasErr) {
            return res.status(500).json({
              message: "Pendaftaran tersimpan, tapi berkas gagal disimpan",
              error: berkasErr.message
            });
          }

          res.json({
            message: "Pendaftaran PPDB berhasil dikirim",
            id: ppdbId,
            no_pendaftaran: noPendaftaran,
            status: "menunggu"
          });
        });
      });
    });
  });
});

// ================= CEK STATUS PUBLIK =================
router.get("/check/:no_pendaftaran", (req, res) => {
  const noPendaftaran = req.params.no_pendaftaran;

  db.query(
    `
    SELECT
      no_pendaftaran,
      nama_lengkap,
      asal_sekolah,
      pilihan_kelas,
      status,
      catatan_admin,
      created_at
    FROM ppdb
    WHERE no_pendaftaran = ?
    LIMIT 1
    `,
    [noPendaftaran],
    (err, results) => {
      if (err) {
        return res.status(500).json({
          message: "Gagal cek status pendaftaran",
          error: err.message
        });
      }

      if (results.length === 0) {
        return res.status(404).json({
          message: "Nomor pendaftaran tidak ditemukan"
        });
      }

      res.json(results[0]);
    }
  );
});

// ================= UPDATE STATUS (ADMIN) =================
router.put("/:id/status", roleRequired("admin"), (req, res) => {
  const id = req.params.id;
  const { status, catatan_admin } = req.body;

  if (!["menunggu", "diverifikasi", "ditolak", "diterima"].includes(status)) {
    return res.status(400).json({
      message: "Status PPDB tidak valid"
    });
  }

  db.query(
    "UPDATE ppdb SET status = ?, catatan_admin = ? WHERE id = ?",
    [status, (catatan_admin || "").trim(), id],
    (err, result) => {
      if (err) {
        return res.status(500).json({
          message: "Gagal update status PPDB",
          error: err.message
        });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({
          message: "Data PPDB tidak ditemukan"
        });
      }

      res.json({
        message: "Status PPDB berhasil diupdate"
      });
    }
  );
});

// ================= DELETE PPDB (ADMIN) =================
router.delete("/:id", roleRequired("admin"), (req, res) => {
  const id = req.params.id;

  db.query(
    "SELECT * FROM ppdb_berkas WHERE ppdb_id = ? LIMIT 1",
    [id],
    (cekErr, berkasResults) => {
      if (cekErr) {
        return res.status(500).json({
          message: "Gagal ambil berkas PPDB",
          error: cekErr.message
        });
      }

      const berkas = berkasResults[0] || {};

      db.query("DELETE FROM ppdb WHERE id = ?", [id], (err, result) => {
        if (err) {
          return res.status(500).json({
            message: "Gagal hapus data PPDB",
            error: err.message
          });
        }

        if (result.affectedRows === 0) {
          return res.status(404).json({
            message: "Data PPDB tidak ditemukan"
          });
        }

        hapusFileJikaAda(berkas.akta_file);
        hapusFileJikaAda(berkas.kk_file);
        hapusFileJikaAda(berkas.foto_file);
        hapusFileJikaAda(berkas.ijazah_file);

        res.json({
          message: "Data PPDB berhasil dihapus"
        });
      });
    }
  );
});

module.exports = router;