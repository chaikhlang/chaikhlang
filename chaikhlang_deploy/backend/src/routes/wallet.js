const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.get('/', authMiddleware, async (req, res) => {
  const result = await db.query('SELECT wallet FROM users WHERE id=$1', [req.user.id]);
  if (!result.rows.length) return res.status(404).json({ error: 'ไม่พบผู้ใช้' });
  res.json({ balance: Number(result.rows[0].wallet) });
});

// Demo topup — in production replace with real payment gateway
router.post('/topup', authMiddleware, async (req, res) => {
  const { amount } = req.body;
  if (!amount || amount < 50) return res.status(400).json({ error: 'จำนวนเงินขั้นต่ำ 50 บาท' });
  if (amount > 50000) return res.status(400).json({ error: 'จำนวนเงินสูงสุด 50,000 บาทต่อครั้ง' });
  const result = await db.query(
    'UPDATE users SET wallet = wallet + $1 WHERE id=$2 RETURNING wallet',
    [Number(amount), req.user.id]
  );
  res.json({ balance: Number(result.rows[0].wallet), message: `เติมเงิน ${amount} บาทสำเร็จ` });
});

module.exports = router;
