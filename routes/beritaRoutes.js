const express = require("express");
const router = express.Router();
const db = require("../config/db");
const multer = require("multer");
const path = require("path");
const { roleRequired } = require("../middleware/authMiddleware");

// Konfigurasi upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });

// GET semua berita (publik)
router.get("/", (req, res) => {
  db.query("SELECT * FROM berita ORDER BY id DESC", (err, results) => {
    if (err) {
      return res.status(500).json({
        message: "Gagal ambil data berita",
        error: err.message
      });
    }

    res.json(results);
  });
});

// GET detail berita by id (publik)
router.get("/:id", (req, res) => {
  const id = req.params.id;

  db.query("SELECT * FROM berita WHERE id = ?", [id], (err, results) => {
    if (err) {
      return res.status(500).json({
        message: "Gagal ambil detail berita",
        error: err.message
      });
    }

    if (results.length === 0) {
      return res.status(404).json({
        message: "Berita tidak ditemukan"
      });
    }

    res.json(results[0]);
  });
});

// POST tambah berita (admin only)
router.post("/", roleRequired("admin"), upload.single("gambar"), (req, res) => {
  const { judul, tanggal, kategori, isi } = req.body;

  if (!judul || !tanggal || !kategori || !isi) {
    return res.status(400).json({
      message: "Data belum lengkap"
    });
  }

  const gambar = req.file ? req.file.filename : "";

  const sql = `
    INSERT INTO berita (judul, tanggal, kategori, isi, gambar)
    VALUES (?, ?, ?, ?, ?)
  `;

  db.query(sql, [judul, tanggal, kategori, isi, gambar], (err, result) => {
    if (err) {
      return res.status(500).json({
        message: "Gagal tambah berita",
        error: err.message
      });
    }

    res.json({
      message: "Berita berhasil ditambah",
      id: result.insertId
    });
  });
});

// PUT edit berita (admin only)
router.put("/:id", roleRequired("admin"), upload.single("gambar"), (req, res) => {
  const id = req.params.id;
  const { judul, tanggal, kategori, isi } = req.body;

  if (!judul || !tanggal || !kategori || !isi) {
    return res.status(400).json({
      message: "Data belum lengkap"
    });
  }

  db.query("SELECT * FROM berita WHERE id = ?", [id], (err, results) => {
    if (err) {
      return res.status(500).json({
        message: "Gagal ambil berita lama",
        error: err.message
      });
    }

    if (results.length === 0) {
      return res.status(404).json({
        message: "Berita tidak ditemukan"
      });
    }

    const gambarLama = results[0].gambar;
    const gambarBaru = req.file ? req.file.filename : gambarLama;

    const sql = `
      UPDATE berita
      SET judul = ?, tanggal = ?, kategori = ?, isi = ?, gambar = ?
      WHERE id = ?
    `;

    db.query(sql, [judul, tanggal, kategori, isi, gambarBaru, id], (err2) => {
      if (err2) {
        return res.status(500).json({
          message: "Gagal update berita",
          error: err2.message
        });
      }

      res.json({
        message: "Berita berhasil diupdate"
      });
    });
  });
});

// DELETE berita (admin only)
router.delete("/:id", roleRequired("admin"), (req, res) => {
  const id = req.params.id;

  db.query("DELETE FROM berita WHERE id = ?", [id], (err) => {
    if (err) {
      return res.status(500).json({
        message: "Gagal hapus berita",
        error: err.message
      });
    }

    res.json({
      message: "Berita berhasil dihapus"
    });
  });
});

module.exports = router;