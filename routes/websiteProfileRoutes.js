const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { roleRequired } = require("../middleware/authMiddleware");

// GET profil website (publik)
router.get("/", (req, res) => {
  db.query(
    "SELECT * FROM website_profile ORDER BY id DESC LIMIT 1",
    (err, results) => {
      if (err) {
        return res.status(500).json({
          message: "Gagal ambil profil website",
          error: err.message
        });
      }

      if (results.length === 0) {
        return res.json({
          nama_sekolah: "SD Harapan Sungailiat",
          hero_judul: "Membangun Generasi Cerdas, Berkarakter, dan Siap Masa Depan",
          hero_deskripsi:
            "SD Harapan Sungailiat hadir sebagai lingkungan belajar yang modern, aman, dan inspiratif untuk membentuk siswa yang unggul dalam akademik, disiplin dalam sikap, dan kuat dalam nilai karakter.",
          tentang_judul: "SD Harapan Sungailiat",
          tentang_deskripsi:
            "Sekolah yang berkomitmen menghadirkan pendidikan dasar berkualitas melalui pembelajaran aktif, pembinaan karakter, dan lingkungan belajar yang mendukung perkembangan siswa.",
          visi:
            "Menjadi sekolah dasar unggulan yang menghasilkan siswa berprestasi, berkarakter, berbudaya, dan siap menghadapi perkembangan zaman.",
          misi:
            "Meningkatkan kualitas pembelajaran yang aktif, kreatif, dan menyenangkan.\nMembentuk karakter disiplin, tanggung jawab, dan kepedulian sosial.\nMendorong prestasi akademik maupun non-akademik secara seimbang.\nMenciptakan lingkungan sekolah yang aman, bersih, dan nyaman.",
          alamat:
            "Jl. Pemuda No. 45, Sungailiat, Kabupaten Bangka, Kepulauan Bangka Belitung",
          telepon: "(0717) 123-456",
          email: "info@sdharapan.sch.id",
          akreditasi: "Unggul & Terpercaya",
          pembelajaran: "Aktif, Kreatif, Modern",
          lingkungan: "Nyaman & Aman"
        });
      }

      res.json(results[0]);
    }
  );
});

// POST / UPSERT profil website (admin)
router.put("/", roleRequired("admin"), (req, res) => {
  const {
    nama_sekolah,
    hero_judul,
    hero_deskripsi,
    tentang_judul,
    tentang_deskripsi,
    visi,
    misi,
    alamat,
    telepon,
    email,
    akreditasi,
    pembelajaran,
    lingkungan
  } = req.body;

  db.query(
    "SELECT id FROM website_profile ORDER BY id DESC LIMIT 1",
    (cekErr, cekResults) => {
      if (cekErr) {
        return res.status(500).json({
          message: "Gagal cek profil website",
          error: cekErr.message
        });
      }

      if (cekResults.length === 0) {
        db.query(
          `INSERT INTO website_profile
          (nama_sekolah, hero_judul, hero_deskripsi, tentang_judul, tentang_deskripsi, visi, misi, alamat, telepon, email, akreditasi, pembelajaran, lingkungan)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            nama_sekolah || "",
            hero_judul || "",
            hero_deskripsi || "",
            tentang_judul || "",
            tentang_deskripsi || "",
            visi || "",
            misi || "",
            alamat || "",
            telepon || "",
            email || "",
            akreditasi || "",
            pembelajaran || "",
            lingkungan || ""
          ],
          (err) => {
            if (err) {
              return res.status(500).json({
                message: "Gagal simpan profil website",
                error: err.message
              });
            }

            res.json({
              message: "Profil website berhasil disimpan"
            });
          }
        );
      } else {
        const id = cekResults[0].id;

        db.query(
          `UPDATE website_profile SET
            nama_sekolah = ?,
            hero_judul = ?,
            hero_deskripsi = ?,
            tentang_judul = ?,
            tentang_deskripsi = ?,
            visi = ?,
            misi = ?,
            alamat = ?,
            telepon = ?,
            email = ?,
            akreditasi = ?,
            pembelajaran = ?,
            lingkungan = ?
          WHERE id = ?`,
          [
            nama_sekolah || "",
            hero_judul || "",
            hero_deskripsi || "",
            tentang_judul || "",
            tentang_deskripsi || "",
            visi || "",
            misi || "",
            alamat || "",
            telepon || "",
            email || "",
            akreditasi || "",
            pembelajaran || "",
            lingkungan || "",
            id
          ],
          (err) => {
            if (err) {
              return res.status(500).json({
                message: "Gagal update profil website",
                error: err.message
              });
            }

            res.json({
              message: "Profil website berhasil diupdate"
            });
          }
        );
      }
    }
  );
});

module.exports = router;