const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { roleRequired } = require("../middleware/authMiddleware");

// GET semua pengumuman (publik)
router.get("/", (req, res) => {
  db.query(
    "SELECT * FROM pengumuman ORDER BY tanggal DESC, id DESC",
    (err, results) => {
      if (err) {
        return res.status(500).json({
          message: "Gagal ambil data pengumuman",
          error: err.message
        });
      }

      res.json(results);
    }
  );
});

// GET detail pengumuman (publik)
router.get("/:id", (req, res) => {
  const id = req.params.id;

  db.query(
    "SELECT * FROM pengumuman WHERE id = ?",
    [id],
    (err, results) => {
      if (err) {
        return res.status(500).json({
          message: "Gagal ambil detail pengumuman",
          error: err.message
        });
      }

      if (results.length === 0) {
        return res.status(404).json({
          message: "Pengumuman tidak ditemukan"
        });
      }

      res.json(results[0]);
    }
  );
});

// POST tambah pengumuman (admin)
router.post("/", roleRequired("admin"), (req, res) => {
  const { judul, isi, tanggal, prioritas } = req.body;

  if (!judul || !isi || !tanggal) {
    return res.status(400).json({
      message: "Judul, isi, dan tanggal wajib diisi"
    });
  }

  db.query(
    "INSERT INTO pengumuman (judul, isi, tanggal, prioritas) VALUES (?, ?, ?, ?)",
    [judul, isi, tanggal, prioritas || "biasa"],
    (err, result) => {
      if (err) {
        return res.status(500).json({
          message: "Gagal tambah pengumuman",
          error: err.message
        });
      }

      res.json({
        message: "Pengumuman berhasil ditambah",
        id: result.insertId
      });
    }
  );
});

// PUT edit pengumuman (admin)
router.put("/:id", roleRequired("admin"), (req, res) => {
  const id = req.params.id;
  const { judul, isi, tanggal, prioritas } = req.body;

  if (!judul || !isi || !tanggal) {
    return res.status(400).json({
      message: "Judul, isi, dan tanggal wajib diisi"
    });
  }

  db.query(
    "UPDATE pengumuman SET judul = ?, isi = ?, tanggal = ?, prioritas = ? WHERE id = ?",
    [judul, isi, tanggal, prioritas || "biasa", id],
    (err, result) => {
      if (err) {
        return res.status(500).json({
          message: "Gagal update pengumuman",
          error: err.message
        });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({
          message: "Pengumuman tidak ditemukan"
        });
      }

      res.json({
        message: "Pengumuman berhasil diupdate"
      });
    }
  );
});

// DELETE pengumuman (admin)
router.delete("/:id", roleRequired("admin"), (req, res) => {
  const id = req.params.id;

  db.query(
    "DELETE FROM pengumuman WHERE id = ?",
    [id],
    (err, result) => {
      if (err) {
        return res.status(500).json({
          message: "Gagal hapus pengumuman",
          error: err.message
        });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({
          message: "Pengumuman tidak ditemukan"
        });
      }

      res.json({
        message: "Pengumuman berhasil dihapus"
      });
    }
  );
});

module.exports = router;