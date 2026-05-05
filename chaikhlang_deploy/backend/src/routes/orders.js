const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Create order — lock funds in escrow
router.post('/', authMiddleware, async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { listing_id } = req.body;

    const listingRes = await client.query(`SELECT * FROM listings WHERE id=$1 AND status='active'`, [listing_id]);
    if (!listingRes.rows.length) return res.status(404).json({ error: 'ไม่พบรายการนี้' });
    const listing = listingRes.rows[0];

    if (listing.seller_id === req.user.id)
      return res.status(400).json({ error: 'ไม่สามารถซื้อสินค้าของตัวเองได้' });

    const buyerRes = await client.query('SELECT wallet FROM users WHERE id=$1', [req.user.id]);
    const buyer = buyerRes.rows[0];
    if (!buyer || buyer.wallet < listing.price)
      return res.status(400).json({ error: 'ยอดเงินในกระเป๋าไม่เพียงพอ' });

    // Lock funds
    await client.query('UPDATE users SET wallet = wallet - $1 WHERE id=$2', [listing.price, req.user.id]);

    const fee = Math.round(listing.price * 0.03);
    const autoRelease = new Date(Date.now() + 72 * 60 * 60 * 1000);

    const orderRes = await client.query(`
      INSERT INTO orders (listing_id, buyer_id, seller_id, amount, fee, seller_receives, auto_release_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
    `, [listing_id, req.user.id, listing.seller_id, listing.price, fee, listing.price - fee, autoRelease]);

    await client.query('COMMIT');
    res.status(201).json(orderRes.rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  } finally {
    client.release();
  }
});

// Seller sends item info
router.patch('/:id/send-info', authMiddleware, async (req, res) => {
  try {
    const orderRes = await db.query('SELECT * FROM orders WHERE id=$1', [req.params.id]);
    if (!orderRes.rows.length) return res.status(404).json({ error: 'ไม่พบออเดอร์' });
    const order = orderRes.rows[0];
    if (order.seller_id !== req.user.id) return res.status(403).json({ error: 'ไม่ใช่สิทธิ์ของคุณ' });
    if (order.status !== 'escrow_locked') return res.status(400).json({ error: 'ไม่สามารถส่งข้อมูลได้ในสถานะนี้' });
    const { info } = req.body;
    if (!info) return res.status(400).json({ error: 'กรุณากรอกข้อมูล' });
    const result = await db.query(`UPDATE orders SET status='seller_sent', seller_info=$1, seller_sent_at=NOW() WHERE id=$2 RETURNING *`, [info, order.id]);
    res.json(result.rows[0]);
  } catch (e) { res.status(500).json({ error: 'เกิดข้อผิดพลาด' }); }
});

// Buyer confirms → release funds to seller
router.patch('/:id/confirm', authMiddleware, async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const orderRes = await client.query('SELECT * FROM orders WHERE id=$1', [req.params.id]);
    if (!orderRes.rows.length) return res.status(404).json({ error: 'ไม่พบออเดอร์' });
    const order = orderRes.rows[0];
    if (order.buyer_id !== req.user.id) return res.status(403).json({ error: 'ไม่ใช่สิทธิ์ของคุณ' });
    if (order.status !== 'seller_sent') return res.status(400).json({ error: 'ยังไม่ได้รับข้อมูลจากคนขาย' });

    // Release funds
    await client.query('UPDATE users SET wallet = wallet + $1, total_sales = total_sales + 1 WHERE id=$2', [order.seller_receives, order.seller_id]);
    await client.query(`UPDATE listings SET sold = sold + 1, stock = GREATEST(stock - 1, 0), status = CASE WHEN stock <= 1 THEN 'sold' ELSE status END WHERE id=$1`, [order.listing_id]);
    const result = await client.query(`UPDATE orders SET status='completed', completed_at=NOW() WHERE id=$1 RETURNING *`, [order.id]);

    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  } finally { client.release(); }
});

// Open dispute
router.patch('/:id/dispute', authMiddleware, async (req, res) => {
  try {
    const orderRes = await db.query('SELECT * FROM orders WHERE id=$1', [req.params.id]);
    if (!orderRes.rows.length) return res.status(404).json({ error: 'ไม่พบออเดอร์' });
    const order = orderRes.rows[0];
    if (order.buyer_id !== req.user.id) return res.status(403).json({ error: 'ไม่ใช่สิทธิ์ของคุณ' });
    if (!['escrow_locked','seller_sent'].includes(order.status)) return res.status(400).json({ error: 'ไม่สามารถเปิด dispute ได้' });
    const result = await db.query(`UPDATE orders SET status='disputed', dispute_reason=$1 WHERE id=$2 RETURNING *`, [req.body.reason || 'ไม่ระบุ', order.id]);
    res.json(result.rows[0]);
  } catch (e) { res.status(500).json({ error: 'เกิดข้อผิดพลาด' }); }
});

// Get my orders
router.get('/my', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT o.*, l.title as listing_title, l.image_emoji,
             b.username as buyer_username, b.avatar as buyer_avatar,
             s.username as seller_username, s.avatar as seller_avatar
      FROM orders o
      LEFT JOIN listings l ON o.listing_id = l.id
      LEFT JOIN users b ON o.buyer_id = b.id
      LEFT JOIN users s ON o.seller_id = s.id
      WHERE o.buyer_id=$1 OR o.seller_id=$1
      ORDER BY o.created_at DESC
    `, [req.user.id]);
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: 'เกิดข้อผิดพลาด' }); }
});

// Get single order
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT o.*, l.title as listing_title, l.image_emoji, l.price as listing_price
      FROM orders o LEFT JOIN listings l ON o.listing_id = l.id
      WHERE o.id=$1
    `, [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'ไม่พบออเดอร์' });
    const order = result.rows[0];
    if (order.buyer_id !== req.user.id && order.seller_id !== req.user.id)
      return res.status(403).json({ error: 'ไม่ใช่สิทธิ์ของคุณ' });
    res.json(order);
  } catch (e) { res.status(500).json({ error: 'เกิดข้อผิดพลาด' }); }
});

module.exports = router;
