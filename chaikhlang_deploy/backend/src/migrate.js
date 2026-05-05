const db = require('./db');

async function migrate() {
  console.log('🚀 Starting database migration...');

  await db.query(`
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";

    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      username VARCHAR(50) UNIQUE NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      avatar VARCHAR(5) DEFAULT 'U',
      verified BOOLEAN DEFAULT FALSE,
      seller_rating DECIMAL(3,2) DEFAULT 0,
      total_sales INTEGER DEFAULT 0,
      wallet BIGINT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS listings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      seller_id UUID REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(200) NOT NULL,
      game VARCHAR(100) NOT NULL,
      category VARCHAR(50) DEFAULT 'item',
      server VARCHAR(100) DEFAULT 'TH',
      price BIGINT NOT NULL,
      description TEXT DEFAULT '',
      delivery_method VARCHAR(50) DEFAULT 'in_game_trade',
      stock INTEGER DEFAULT 1,
      sold INTEGER DEFAULT 0,
      image_emoji VARCHAR(10) DEFAULT '🎮',
      tags TEXT[] DEFAULT '{}',
      status VARCHAR(20) DEFAULT 'active',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS orders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      listing_id UUID REFERENCES listings(id),
      buyer_id UUID REFERENCES users(id),
      seller_id UUID REFERENCES users(id),
      amount BIGINT NOT NULL,
      fee BIGINT NOT NULL,
      seller_receives BIGINT NOT NULL,
      status VARCHAR(30) DEFAULT 'escrow_locked',
      seller_info TEXT,
      dispute_reason TEXT,
      auto_release_at TIMESTAMPTZ,
      escrow_locked_at TIMESTAMPTZ DEFAULT NOW(),
      seller_sent_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id UUID REFERENCES orders(id),
      listing_id UUID REFERENCES listings(id),
      buyer_id UUID REFERENCES users(id),
      seller_id UUID REFERENCES users(id),
      rating INTEGER CHECK (rating BETWEEN 1 AND 5),
      comment TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);
    CREATE INDEX IF NOT EXISTS idx_listings_game ON listings(game);
    CREATE INDEX IF NOT EXISTS idx_orders_buyer ON orders(buyer_id);
    CREATE INDEX IF NOT EXISTS idx_orders_seller ON orders(seller_id);
  `);

  console.log('✅ Tables created!');

  // Seed demo data
  const bcrypt = require('bcryptjs');
  const hash = await bcrypt.hash('password123', 10);

  await db.query(`
    INSERT INTO users (username, email, password_hash, avatar, verified, seller_rating, total_sales, wallet)
    VALUES
      ('dragonX99', 'dragon@example.com', $1, 'DX', true, 4.9, 147, 12500),
      ('shadow_pro', 'shadow@example.com', $1, 'SP', true, 4.7, 89, 8200),
      ('zeny_shop', 'zeny@example.com', $1, 'ZS', true, 5.0, 312, 45000),
      ('gamevault_th', 'vault@example.com', $1, 'GV', true, 4.8, 203, 31000)
    ON CONFLICT (email) DO NOTHING;
  `, [hash]);

  const sellers = await db.query(`SELECT id, username FROM users LIMIT 4`);
  const s = sellers.rows;
  if (s.length >= 3) {
    await db.query(`
      INSERT INTO listings (seller_id, title, game, category, server, price, description, delivery_method, stock, sold, image_emoji, tags)
      VALUES
        ($1,'Zeny 10,000,000 — Ragnarok Origin','Ragnarok Origin','currency','Asia-TH01',420,'ส่งเร็วภายใน 30 นาที รับประกัน ขายมาแล้ว 300+ ออเดอร์','in_game_trade',50,312,'💰',ARRAY['ragnarok','zeny']),
        ($2,'Dark Sword +15 Full Enchant','Ragnarok M','item','Asia01',850,'Dark Sword +15 Full enchant ค่า ATK สูงสุด card slot ครบ','in_game_trade',1,0,'⚔️',ARRAY['ragnarok','weapon']),
        ($3,'บัญชี ROV Diamond III + สกิน 45 ชิ้น','ROV','account','TH',3200,'Rank Diamond III Hero 38 ตัว สกิน Rare 45 ชิ้น ไม่มีประวัติโกง','account_details',1,0,'🎮',ARRAY['rov','account']),
        ($4,'บัญชี Genshin AR55 + Raiden C2','Genshin Impact','account','Asia',5500,'AR55 Raiden Shogun C2, Hu Tao C1, Eula C0','account_details',1,0,'⚡',ARRAY['genshin','account']),
        ($1,'PUBG Mobile UC 3850 ยูซี','PUBG Mobile','currency','TH',990,'UC จริง ส่งทันทีหลังชำระ ปลอดภัย 100%','in_game_trade',100,89,'🔫',ARRAY['pubg','uc']),
        ($3,'Valorant Immortal + Elderflame Knife','Valorant','account','SEA',2400,'Rank Immortal 2 Elderflame Knife สกินครบ ไม่เคย ban','account_details',1,0,'🔪',ARRAY['valorant','account']),
        ($4,'FIFA Online 4 — NXT Mbappe','FIFA Online 4','item','TH',1800,'NXT Mbappe เกรด A ไม่มีโปรแกรมเสริม','in_game_trade',3,7,'⚽',ARRAY['fifa','player']),
        ($2,'Honkai Star Rail — Acheron E2S1','Honkai Star Rail','account','Asia',7200,'Acheron E2S1 + Sparkle E0S1 + Robin E0 Trailblaze 65','account_details',1,0,'🌟',ARRAY['honkai','account'])
      ON CONFLICT DO NOTHING;
    `, [s[0].id, s[1].id, s[2].id, s[3]?.id || s[0].id]);
  }

  console.log('✅ Seed data inserted!');
  console.log('🎉 Migration complete! Ready to launch.');
  process.exit(0);
}

migrate().catch(err => {
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
});
