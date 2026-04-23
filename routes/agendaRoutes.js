const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { roleRequired } = require("../middleware/authMiddleware");

// GET semua agenda (publik)
router.get("/", (req, res) => {
  db.query("SELECT * FROM agenda ORDER BY tanggal DESC, id DESC", (err, results) => {
    if (err) {
      return res.status(500).json({
        message: "Gagal ambil data agenda",
        error: err.message
      });
    }

    res.json(results);
  });
});

// GET detail agenda
router.get("/:id", (req, res) => {
  const id = req.params.id;

  db.query("SELECT * FROM agenda WHERE id = ?", [id], (err, results) => {
    if (err) {
      return res.status(500).json({
        message: "Gagal ambil detail agenda",
        error: err.message
      });
    }

    if (results.length === 0) {
      return res.status(404).json({
        message: "Agenda tidak ditemukan"
      });
    }

    res.json(results[0]);
  });
});

// POST tambah agenda (admin)
router.post("/", roleRequired("admin"), (req, res) => {
  const { judul, deskripsi, tanggal, waktu, lokasi } = req.body;

  if (!judul || !tanggal) {
    return res.status(400).json({
      message: "Judul dan tanggal wajib diisi"
    });
  }

  db.query(
    "INSERT INTO agenda (judul, deskripsi, tanggal, waktu, lokasi) VALUES (?, ?, ?, ?, ?)",
    [judul, deskripsi || "", tanggal, waktu || "", lokasi || ""],
    (err, result) => {
      if (err) {
        return res.status(500).json({
          message: "Gagal tambah agenda",
          error: err.message
        });
      }

      res.json({
        message: "Agenda berhasil ditambah",
        id: result.insertId
      });
    }
  );
});

// PUT edit agenda (admin)
router.put("/:id", roleRequired("admin"), (req, res) => {
  const id = req.params.id;
  const { judul, deskripsi, tanggal, waktu, lokasi } = req.body;

  if (!judul || !tanggal) {
    return res.status(400).json({
      message: "Judul dan tanggal wajib diisi"
    });
  }

  db.query(
    "UPDATE agenda SET judul = ?, deskripsi = ?, tanggal = ?, waktu = ?, lokasi = ? WHERE id = ?",
    [judul, deskripsi || "", tanggal, waktu || "", lokasi || "", id],
    (err, result) => {
      if (err) {
        return res.status(500).json({
          message: "Gagal update agenda",
          error: err.message
        });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({
          message: "Agenda tidak ditemukan"
        });
      }

      res.json({
        message: "Agenda berhasil diupdate"
      });
    }
  );
});

// DELETE agenda (admin)
router.delete("/:id", roleRequired("admin"), (req, res) => {
  const id = req.params.id;

  db.query("DELETE FROM agenda WHERE id = ?", [id], (err, result) => {
    if (err) {
      return res.status(500).json({
        message: "Gagal hapus agenda",
        error: err.message
      });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Agenda tidak ditemukan"
      });
    }

    res.json({
      message: "Agenda berhasil dihapus"
    });
  });
});

module.exports = router;