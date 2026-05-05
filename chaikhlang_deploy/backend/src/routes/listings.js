const express = require('express');
const db = require('../db');
const { authMiddleware, optionalAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', optionalAuth, async (req, res) => {
  try {
    let { game, category, search, sort, page = 1, limit = 12 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const params = [];
    let where = `WHERE l.status = 'active'`;

    if (game && game !== 'all') { params.push(game); where += ` AND l.game = $${params.length}`; }
    if (category && category !== 'all') { params.push(category); where += ` AND l.category = $${params.length}`; }
    if (search) { params.push(`%${search}%`); where += ` AND (l.title ILIKE $${params.length} OR l.game ILIKE $${params.length})`; }

    const orderMap = { price_asc: 'l.price ASC', price_desc: 'l.price DESC', popular: 'l.sold DESC', newest: 'l.created_at DESC' };
    const orderBy = orderMap[sort] || 'l.created_at DESC';

    params.push(Number(limit), offset);
    const countParams = params.slice(0, params.length - 2);

    const [rows, countResult] = await Promise.all([
      db.query(`
        SELECT l.*, u.username as seller_username, u.avatar as seller_avatar,
               u.verified as seller_verified, u.seller_rating, u.total_sales as seller_total_sales
        FROM listings l
        LEFT JOIN users u ON l.seller_id = u.id
        ${where}
        ORDER BY ${orderBy}
        LIMIT $${params.length - 1} OFFSET $${params.length}
      `, params),
      db.query(`SELECT COUNT(*) FROM listings l ${where}`, countParams)
    ]);

    const listings = rows.rows.map(r => ({
      ...r,
      seller: { id: r.seller_id, username: r.seller_username, avatar: r.seller_avatar, verified: r.seller_verified, seller_rating: r.seller_rating, total_sales: r.seller_total_sales }
    }));

    res.json({ listings, total: Number(countResult.rows[0].count), page: Number(page), pages: Math.ceil(Number(countResult.rows[0].count) / Number(limit)) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'โหลดรายการไม่สำเร็จ' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT l.*, u.username as seller_username, u.avatar as seller_avatar,
             u.verified as seller_verified, u.seller_rating, u.total_sales as seller_total_sales
      FROM listings l LEFT JOIN users u ON l.seller_id = u.id
      WHERE l.id = $1
    `, [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'ไม่พบรายการนี้' });
    const r = result.rows[0];
    const reviews = await db.query(`SELECT r.*, u.username FROM reviews r LEFT JOIN users u ON r.buyer_id=u.id WHERE r.seller_id=$1 LIMIT 5`, [r.seller_id]);
    res.json({ ...r, seller: { id: r.seller_id, username: r.seller_username, avatar: r.seller_avatar, verified: r.seller_verified, seller_rating: r.seller_rating, total_sales: r.seller_total_sales }, reviews: reviews.rows });
  } catch (e) { res.status(500).json({ error: 'เกิดข้อผิดพลาด' }); }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { title, game, category, server, price, description, delivery_method, stock, image_emoji } = req.body;
    if (!title || !game || !price) return res.status(400).json({ error: 'กรุณากรอกข้อมูลให้ครบ' });
    const result = await db.query(`
      INSERT INTO listings (seller_id,title,game,category,server,price,description,delivery_method,stock,image_emoji,tags)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *
    `, [req.user.id, title, game, category||'item', server||'TH', Number(price), description||'', delivery_method||'in_game_trade', Number(stock)||1, image_emoji||'🎮', [game.toLowerCase()]]);
    res.status(201).json(result.rows[0]);
  } catch (e) { res.status(500).json({ error: 'เกิดข้อผิดพลาด' }); }
});

module.exports = router;
