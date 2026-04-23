const express = require("express");
const router = express.Router();
const db = require("../config/db");
const nodemailer = require("nodemailer");
const { roleRequired } = require("../middleware/authMiddleware");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  }
});

// helper template email admin
function adminEmailTemplate({ nama, email, subjek, pesan }) {
  return `
    <div style="margin:0;padding:0;background:#f4f7fb;font-family:Arial,sans-serif;">
      <div style="max-width:700px;margin:30px auto;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,0.08);">
        <div style="background:linear-gradient(135deg,#0f172a,#1d4ed8);padding:28px 30px;color:#ffffff;">
          <div style="font-size:13px;letter-spacing:.5px;opacity:.9;">NOTIFIKASI WEBSITE SEKOLAH</div>
          <h2 style="margin:10px 0 0;font-size:28px;">Pesan Baru Masuk</h2>
        </div>

        <div style="height:5px;background:linear-gradient(to right,#1d4ed8,#fbbf24);"></div>

        <div style="padding:30px;">
          <p style="margin:0 0 18px;color:#334155;font-size:15px;line-height:1.8;">
            Anda menerima pesan baru dari formulir kontak website.
          </p>

          <table style="width:100%;border-collapse:collapse;margin-bottom:22px;">
            <tr>
              <td style="padding:10px 0;color:#64748b;font-weight:700;width:120px;">Nama</td>
              <td style="padding:10px 0;color:#0f172a;">${nama}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;color:#64748b;font-weight:700;">Email</td>
              <td style="padding:10px 0;color:#0f172a;">${email}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;color:#64748b;font-weight:700;">Subjek</td>
              <td style="padding:10px 0;color:#0f172a;">${subjek}</td>
            </tr>
          </table>

          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:18px;">
            <div style="font-size:14px;color:#64748b;font-weight:700;margin-bottom:8px;">Isi Pesan</div>
            <div style="font-size:15px;color:#334155;line-height:1.9;">
              ${String(pesan).replace(/\n/g, "<br>")}
            </div>
          </div>
        </div>

        <div style="background:#f8fafc;padding:18px 30px;font-size:13px;color:#64748b;text-align:center;">
          Email ini dikirim otomatis dari sistem website sekolah.
        </div>
      </div>
    </div>
  `;
}

// helper template auto reply
function autoReplyTemplate({ nama, subjek }) {
  return `
    <div style="margin:0;padding:0;background:#f4f7fb;font-family:Arial,sans-serif;">
      <div style="max-width:700px;margin:30px auto;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,0.08);">
        <div style="background:linear-gradient(135deg,#1d4ed8,#0f172a);padding:28px 30px;color:#ffffff;">
          <div style="font-size:13px;letter-spacing:.5px;opacity:.9;">SD HARAPAN SUNGAILIAT</div>
          <h2 style="margin:10px 0 0;font-size:28px;">Pesan Anda Sudah Kami Terima</h2>
        </div>

        <div style="height:5px;background:linear-gradient(to right,#fbbf24,#1d4ed8);"></div>

        <div style="padding:30px;">
          <p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.8;">
            Halo <strong>${nama}</strong>,
          </p>

          <p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.8;">
            Terima kasih telah menghubungi kami dengan subjek <strong>${subjek}</strong>.
            Pesan Anda sudah kami terima dan akan segera ditindaklanjuti.
          </p>

          <p style="margin:0;color:#334155;font-size:15px;line-height:1.8;">
            Hormat kami,<br>
            <strong>Admin SD Harapan Sungailiat</strong>
          </p>
        </div>

        <div style="background:#f8fafc;padding:18px 30px;font-size:13px;color:#64748b;text-align:center;">
          Ini adalah email balasan otomatis, mohon tidak membalas email ini.
        </div>
      </div>
    </div>
  `;
}

// POST kirim pesan (publik)
router.post("/", (req, res) => {
  const { nama, email, subjek, pesan } = req.body;

  if (!nama || !email || !subjek || !pesan) {
    return res.status(400).json({
      message: "Semua field wajib diisi"
    });
  }

  const sql = `
    INSERT INTO pesan (nama, email, subjek, pesan, status, created_at)
    VALUES (?, ?, ?, ?, 'baru', NOW())
  `;

  db.query(sql, [nama, email, subjek, pesan], async (err, result) => {
    if (err) {
      return res.status(500).json({
        message: "Gagal simpan pesan",
        error: err.message
      });
    }

    try {
      await transporter.sendMail({
        from: process.env.GMAIL_USER,
        to: process.env.GMAIL_USER,
        subject: `Pesan Baru: ${subjek}`,
        html: adminEmailTemplate({ nama, email, subjek, pesan })
      });

      await transporter.sendMail({
        from: process.env.GMAIL_USER,
        to: email,
        subject: `Pesan Anda telah diterima - ${subjek}`,
        html: autoReplyTemplate({ nama, subjek })
      });
    } catch (mailErr) {
      console.error("Gagal kirim email:", mailErr.message);
    }

    res.json({
      message: "Pesan berhasil dikirim",
      id: result.insertId
    });
  });
});

// GET semua pesan (admin only)
router.get("/", roleRequired("admin"), (req, res) => {
  db.query("SELECT * FROM pesan ORDER BY id DESC", (err, results) => {
    if (err) {
      return res.status(500).json({
        message: "Gagal ambil data pesan",
        error: err.message
      });
    }

    res.json(results);
  });
});

// GET count pesan baru (admin only)
router.get("/count/baru", roleRequired("admin"), (req, res) => {
  db.query(
    "SELECT COUNT(*) AS total FROM pesan WHERE status = 'baru'",
    (err, results) => {
      if (err) {
        return res.status(500).json({
          message: "Gagal ambil jumlah pesan baru",
          error: err.message
        });
      }

      res.json({
        total: results[0].total
      });
    }
  );
});

// PUT tandai dibaca (admin only)
router.put("/:id/dibaca", roleRequired("admin"), (req, res) => {
  const id = req.params.id;

  db.query(
    "UPDATE pesan SET status = 'dibaca' WHERE id = ?",
    [id],
    (err, result) => {
      if (err) {
        return res.status(500).json({
          message: "Gagal update status pesan",
          error: err.message
        });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({
          message: "Pesan tidak ditemukan"
        });
      }

      res.json({
        message: "Pesan berhasil ditandai dibaca"
      });
    }
  );
});

// DELETE pesan (admin only)
router.delete("/:id", roleRequired("admin"), (req, res) => {
  const id = req.params.id;

  db.query("DELETE FROM pesan WHERE id = ?", [id], (err, result) => {
    if (err) {
      return res.status(500).json({
        message: "Gagal hapus pesan",
        error: err.message
      });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Pesan tidak ditemukan"
      });
    }

    res.json({
      message: "Pesan berhasil dihapus"
    });
  });
});

module.exports = router;