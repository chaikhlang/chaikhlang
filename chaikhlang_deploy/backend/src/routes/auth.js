const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { authMiddleware, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password)
      return res.status(400).json({ error: 'กรุณากรอกข้อมูลให้ครบ' });
    if (password.length < 8)
      return res.status(400).json({ error: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร' });

    const existing = await db.query(
      'SELECT id FROM users WHERE email=$1 OR username=$2', [email, username]
    );
    if (existing.rows.length > 0)
      return res.status(400).json({ error: 'อีเมลหรือชื่อผู้ใช้นี้ถูกใช้แล้ว' });

    const hash = await bcrypt.hash(password, 10);
    const avatar = username.slice(0, 2).toUpperCase();
    const result = await db.query(
      `INSERT INTO users (username, email, password_hash, avatar)
       VALUES ($1,$2,$3,$4) RETURNING id, username, email, avatar, verified, seller_rating, total_sales, wallet, created_at`,
      [username, email, hash, avatar]
    );
    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'กรุณากรอกข้อมูลให้ครบ' });

    const result = await db.query(
      'SELECT * FROM users WHERE email=$1', [email]
    );
    if (!result.rows.length)
      return res.status(400).json({ error: 'ไม่พบอีเมลนี้ในระบบ' });

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(400).json({ error: 'รหัสผ่านไม่ถูกต้อง' });

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    const { password_hash, ...safeUser } = user;
    res.json({ token, user: safeUser });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

router.get('/me', authMiddleware, async (req, res) => {
  const result = await db.query(
    'SELECT id,username,email,avatar,verified,seller_rating,total_sales,wallet,created_at FROM users WHERE id=$1',
    [req.user.id]
  );
  if (!result.rows.length) return res.status(404).json({ error: 'ไม่พบผู้ใช้' });
  res.json(result.rows[0]);
});

module.exports = router;
