const express = require("express");
const router = express.Router();
const db = require("../config/db");
const multer = require("multer");
const path = require("path");
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

// GET semua guru (publik)
router.get("/", (req, res) => {
  db.query("SELECT * FROM guru ORDER BY id DESC", (err, results) => {
    if (err) {
      return res.status(500).json({
        message: "Gagal ambil data guru",
        error: err.message
      });
    }

    res.json(results);
  });
});

// POST tambah guru (admin)
router.post("/", roleRequired("admin"), upload.single("foto"), (req, res) => {
  const { nama, mapel } = req.body;

  if (!nama || !mapel) {
    return res.status(400).json({
      message: "Data guru belum lengkap"
    });
  }

  const foto = req.file ? req.file.filename : "";

  db.query(
    "INSERT INTO guru (nama, mapel, foto) VALUES (?, ?, ?)",
    [nama, mapel, foto],
    (err, result) => {
      if (err) {
        return res.status(500).json({
          message: "Gagal tambah guru",
          error: err.message
        });
      }

      res.json({
        message: "Guru berhasil ditambah",
        id: result.insertId
      });
    }
  );
});

// PUT edit guru (admin)
router.put("/:id", roleRequired("admin"), upload.single("foto"), (req, res) => {
  const id = req.params.id;
  const { nama, mapel } = req.body;

  if (!nama || !mapel) {
    return res.status(400).json({
      message: "Data guru belum lengkap"
    });
  }

  db.query("SELECT * FROM guru WHERE id = ?", [id], (err, results) => {
    if (err) {
      return res.status(500).json({
        message: "Gagal ambil data guru lama",
        error: err.message
      });
    }

    if (results.length === 0) {
      return res.status(404).json({
        message: "Guru tidak ditemukan"
      });
    }

    const fotoLama = results[0].foto;
    const fotoBaru = req.file ? req.file.filename : fotoLama;

    db.query(
      "UPDATE guru SET nama = ?, mapel = ?, foto = ? WHERE id = ?",
      [nama, mapel, fotoBaru, id],
      (err2) => {
        if (err2) {
          return res.status(500).json({
            message: "Gagal update guru",
            error: err2.message
          });
        }

        res.json({
          message: "Guru berhasil diupdate"
        });
      }
    );
  });
});

// DELETE guru (admin)
router.delete("/:id", roleRequired("admin"), (req, res) => {
  const id = req.params.id;

  db.query("DELETE FROM guru WHERE id = ?", [id], (err) => {
    if (err) {
      return res.status(500).json({
        message: "Gagal hapus guru",
        error: err.message
      });
    }

    res.json({
      message: "Guru berhasil dihapus"
    });
  });
});

module.exports = router;