const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();

// Trust proxy (required for Render.com)
app.set('trust proxy', 1);

const allowedOrigins = [
  process.env.FRONTEND_URL,
  'https://chaikhlang.vercel.app',
  'http://localhost:3000',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
].filter(Boolean);

app.use(cors());

app.use(express.json({ limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, message: { error: 'Request มากเกินไป กรุณารอสักครู่' } });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: { error: 'ลองเข้าสู่ระบบมากเกินไป กรุณารอ 15 นาที' } });

app.use('/api/', limiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/listings', require('./routes/listings'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/wallet', require('./routes/wallet'));

// Health check — Render uses this to know app is alive
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'ชายกลาง API', version: '1.0.0', time: new Date().toISOString() });
});

// 404
app.use('/api/*', (req, res) => res.status(404).json({ error: 'ไม่พบ endpoint นี้' }));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});
if (process.env.NODE_ENV === 'production') {
  const migrate = require('./migrate');
  if (typeof migrate === 'function') migrate().catch(console.error);
}
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 ชายกลาง API running on port ${PORT}`);
  console.log(`   ENV: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   DB:  ${process.env.DATABASE_URL ? '✅ Connected' : '⚠️  No DATABASE_URL'}`);
});
