const express = require("express");
const router = express.Router();
const db = require("../config/db");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { roleRequired } = require("../middleware/authMiddleware");

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

// GET semua galeri
router.get("/", (req, res) => {
  db.query("SELECT * FROM galeri ORDER BY id DESC", (err, results) => {
    if (err) {
      return res.status(500).json({
        message: "Gagal ambil data galeri",
        error: err.message
      });
    }

    res.json(results);
  });
});

// POST tambah galeri
router.post("/", roleRequired("admin"), upload.single("gambar"), (req, res) => {
  const { judul } = req.body;

  if (!judul || !req.file) {
    return res.status(400).json({
      message: "Judul dan gambar wajib diisi"
    });
  }

  db.query(
    "INSERT INTO galeri (judul, gambar) VALUES (?, ?)",
    [judul, req.file.filename],
    (err, result) => {
      if (err) {
        return res.status(500).json({
          message: "Gagal tambah galeri",
          error: err.message
        });
      }

      res.json({
        message: "Galeri berhasil ditambah",
        id: result.insertId
      });
    }
  );
});

// DELETE galeri
router.delete("/:id", roleRequired("admin"), (req, res) => {
  const id = req.params.id;

  db.query("SELECT * FROM galeri WHERE id = ?", [id], (err, results) => {
    if (err) {
      return res.status(500).json({
        message: "Gagal ambil data galeri",
        error: err.message
      });
    }

    if (results.length === 0) {
      return res.status(404).json({
        message: "Galeri tidak ditemukan"
      });
    }

    const dataGaleri = results[0];
    const namaFile = dataGaleri.gambar;

    db.query("DELETE FROM galeri WHERE id = ?", [id], (deleteErr, result) => {
      if (deleteErr) {
        return res.status(500).json({
          message: "Gagal hapus galeri",
          error: deleteErr.message
        });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({
          message: "Galeri tidak ditemukan"
        });
      }

      if (namaFile) {
        const filePath = path.join(__dirname, "..", "uploads", namaFile);

        fs.unlink(filePath, (unlinkErr) => {
          if (unlinkErr && unlinkErr.code !== "ENOENT") {
            console.error("Gagal hapus file gambar:", unlinkErr.message);
          }
        });
      }

      res.json({
        message: "Galeri berhasil dihapus"
      });
    });
  });
});

module.exports = router;