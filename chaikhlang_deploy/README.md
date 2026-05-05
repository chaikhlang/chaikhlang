# 🛡️ ชายกลาง — Deploy Guide (ฟรี 100%)

## โครงสร้างโปรเจค
```
chaikhlang_deploy/
├── backend/              ← Node.js API → deploy บน Render.com (ฟรี)
│   ├── src/
│   │   ├── index.js      (entry point)
│   │   ├── db.js         (PostgreSQL connection)
│   │   ├── migrate.js    (สร้าง tables + seed data)
│   │   ├── middleware/auth.js
│   │   └── routes/
│   │       ├── auth.js
│   │       ├── listings.js
│   │       ├── orders.js
│   │       └── wallet.js
│   └── package.json
├── frontend/
│   ├── index.html        ← HTML สำเร็จรูป → deploy บน Vercel (ฟรี)
│   └── vercel.json
└── render.yaml           ← config สำหรับ Render
```

---

## ขั้นตอน Deploy (ทำตามลำดับ)

### Step 1 — Upload โค้ดขึ้น GitHub
1. สมัคร github.com (ฟรี)
2. New repository → ชื่อ `chaikhlang` → Public
3. อัปโหลดโฟลเดอร์ `chaikhlang_deploy` ทั้งหมดขึ้นไป
   - กด "uploading an existing file"
   - ลากทั้งโฟลเดอร์ใส่

---

### Step 2 — ตั้งค่า Database บน Supabase (ฟรี)
1. สมัคร supabase.com ด้วย GitHub
2. New Project → ตั้งชื่อ `chaikhlang` → เลือก Region: Southeast Asia
3. ตั้ง Database Password (จดไว้!)
4. รอ ~2 นาที ให้ project พร้อม
5. ไปที่ Project Settings → Database → Connection String
6. คัดลอก URI (เริ่มด้วย `postgresql://...`)

---

### Step 3 — Deploy Backend บน Render.com (ฟรี)
1. สมัคร render.com ด้วย GitHub
2. New → Web Service
3. Connect GitHub repo `chaikhlang`
4. ตั้งค่า:
   - **Name:** chaikhlang-api
   - **Root Directory:** backend
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `node src/index.js`
   - **Instance Type:** Free
5. Environment Variables → Add:
   ```
   NODE_ENV          = production
   DATABASE_URL      = [วาง Connection String จาก Supabase]
   JWT_SECRET        = [random string ยาวๆ เช่น สร้างที่ passwordsgenerator.net]
   FRONTEND_URL      = https://chaikhlang.vercel.app
   ```
6. Deploy → รอ ~3 นาที
7. ได้ URL เช่น `https://chaikhlang-api.onrender.com`
8. ทดสอบ: เปิด `https://chaikhlang-api.onrender.com/api/health`
   → ควรเห็น `{"status":"ok",...}`

---

### Step 4 — รัน Database Migration
หลัง deploy Render แล้ว ให้รัน migration เพื่อสร้าง tables:

ไปที่ Render Dashboard → chaikhlang-api → Shell → พิมพ์:
```bash
node src/migrate.js
```
ควรเห็น:
```
🚀 Starting database migration...
✅ Tables created!
✅ Seed data inserted!
🎉 Migration complete! Ready to launch.
```

---

### Step 5 — แก้ API URL ใน Frontend
เปิดไฟล์ `frontend/index.html` หา `chaikhlang-api.onrender.com`
แล้วเปลี่ยนเป็น URL จริงที่ได้จาก Render ในขั้นตอนที่ 3

---

### Step 6 — Deploy Frontend บน Vercel (ฟรี)
1. สมัคร vercel.com ด้วย GitHub
2. New Project → Import `chaikhlang` repo
3. **Root Directory:** frontend
4. กด Deploy → รอ ~1 นาที
5. ได้ URL เช่น `https://chaikhlang.vercel.app`

---

### Step 7 — อัปเดต FRONTEND_URL บน Render
กลับไปที่ Render → chaikhlang-api → Environment
เปลี่ยน `FRONTEND_URL` เป็น URL จริงจาก Vercel แล้ว Save → Redeploy

---

## ทดสอบระบบ

| สิ่งที่ทดสอบ | URL |
|---|---|
| API Health | https://chaikhlang-api.onrender.com/api/health |
| รายการสินค้า | https://chaikhlang-api.onrender.com/api/listings |
| เว็บไซต์ | https://chaikhlang.vercel.app |

Test Account: `dragon@example.com` / `password123`

---

## ค่าใช้จ่าย
| บริการ | ราคา |
|---|---|
| GitHub | ฟรี |
| Supabase (500MB) | ฟรี |
| Render.com (Web Service) | ฟรี* |
| Vercel (Frontend) | ฟรีตลอด |
| **รวม** | **ฟรี!** |

*Render Free tier: app จะ sleep หลัง 15 นาทีที่ไม่มีคนใช้
 request แรกหลัง sleep จะช้า ~30 วินาที (ปกติสำหรับ free tier)

เมื่อมีผู้ใช้จริงแล้ว → upgrade Render เป็น $7/เดือน เพื่อให้ไม่ sleep

---

## คำสั่งที่ใช้บ่อยหลัง Deploy

```bash
# ดู logs บน Render Shell
pm2 logs  # (ถ้าใช้ paid plan)

# รัน migration ใหม่ (ถ้าแก้ schema)
node src/migrate.js

# ทดสอบ API
curl https://chaikhlang-api.onrender.com/api/health
curl https://chaikhlang-api.onrender.com/api/listings
```
