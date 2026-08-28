# SquadQueue Server

เซิร์ฟเวอร์ + ฐานข้อมูลจริงสำหรับแอป SquadQueue (แอปหาเพื่อนเล่นเกม) เขียนด้วย Node.js, Express, PostgreSQL และ Socket.IO สำหรับแชทแบบเรียลไทม์ ใช้แทนเวอร์ชันเดโมที่เก็บข้อมูลในเบราว์เซอร์เท่านั้น — เวอร์ชันนี้มีบัญชีผู้ใช้จริง เข้าจากอุปกรณ์ไหนก็ได้ และข้อมูลไม่หายเมื่อล้างเบราว์เซอร์

โปรเจกต์นี้ผ่านการทดสอบจริงแล้ว: รันเซิร์ฟเวอร์กับ PostgreSQL จริง ทดสอบสมัคร/ล็อกอิน/บันทึกโปรไฟล์/ดึงรายชื่อผู้เล่น/แชทเรียลไทม์ผ่าน Socket.IO (รวมสถานะออนไลน์) ทั้งหมดทำงานถูกต้อง

## โครงสร้างโปรเจกต์

```
squadqueue-server/
├── public/            หน้าเว็บ (HTML/CSS/JS) ที่ผู้ใช้เห็น
├── src/
│   ├── routes/        API: auth, profile, candidates, chat
│   ├── middleware/     ตรวจสอบการล็อกอิน (JWT)
│   ├── db.js          การเชื่อมต่อฐานข้อมูล
│   ├── schema.sql     โครงสร้างตาราง
│   ├── migrate.js     สคริปต์สร้างตาราง
│   ├── socket.js      แชทเรียลไทม์ + สถานะออนไลน์
│   └── server.js      จุดเริ่มต้นเซิร์ฟเวอร์
├── .env.example       ตัวอย่างค่า config ที่ต้องตั้ง
├── render.yaml        ไฟล์ deploy อัตโนมัติสำหรับ Render
└── package.json
```

## รันบนเครื่องตัวเอง (ทดสอบก่อน deploy จริง)

ต้องมี Node.js เวอร์ชัน 18 ขึ้นไป และ PostgreSQL (ติดตั้งในเครื่อง หรือใช้บริการฟรีออนไลน์ก็ได้ เช่น Neon/Supabase)

1. ติดตั้งไลบรารี:
   ```
   npm install
   ```
2. คัดลอกไฟล์ตัวอย่าง config:
   ```
   cp .env.example .env
   ```
3. เปิดไฟล์ `.env` แล้วใส่ `DATABASE_URL` ของฐานข้อมูล Postgres ของคุณ และสร้าง `JWT_SECRET` ด้วยคำสั่ง:
   ```
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```
   แล้วนำค่าที่ได้ไปวางใน `JWT_SECRET=`
4. สร้างตารางในฐานข้อมูล:
   ```
   npm run migrate
   ```
5. รันเซิร์ฟเวอร์:
   ```
   npm start
   ```
   แล้วเปิดเบราว์เซอร์ไปที่ `http://localhost:3000`

ปุ่ม "เข้าสู่ระบบด้วย Discord" จะยังใช้ไม่ได้จนกว่าจะตั้งค่า OAuth ตามขั้นตอนด้านล่าง (ถ้าไม่ตั้งค่า ปุ่มจะแจ้งเตือนเฉยๆ ไม่ error)

## Deploy ขึ้นใช้งานจริง

### วิธีที่แนะนำ: Render (มีไฟล์ blueprint ให้แล้ว)

1. อัปโหลดโค้ดโปรเจกต์นี้ขึ้น GitHub repository ของคุณ
2. เข้า [Render](https://render.com) → New → **Blueprint** → เลือก repo นี้
3. Render จะอ่านไฟล์ `render.yaml` แล้วสร้างให้อัตโนมัติ: เว็บเซอร์วิส + ฐานข้อมูล Postgres ฟรี พร้อมเชื่อม `DATABASE_URL` ให้เอง
4. หลังสร้างเสร็จ เข้าไปที่เว็บเซอร์วิส → แท็บ Environment → ใส่ค่า `JWT_SECRET` เอง (สร้างด้วยคำสั่งเดียวกับด้านบน)
5. รอ deploy เสร็จ ระบบจะรัน `npm install` และ `npm start` ให้อัตโนมัติ — **แต่ต้องรัน migration เองครั้งแรก**: ไปที่แท็บ Shell ของเว็บเซอร์วิสบน Render แล้วรัน `npm run migrate`
6. เข้าใช้งานได้ที่ URL ที่ Render ให้มา (เช่น `https://squadqueue-server.onrender.com`)

หมายเหตุ: แพลนฟรีของ Render จะพักเซิร์ฟเวอร์เมื่อไม่มีคนใช้งาน แล้วปลุกใหม่ตอนมีคนเข้า (ช้าประมาณ 30-60 วินาทีในครั้งแรก) ถ้าต้องการให้เร็วตลอดเวลาต้องอัปเกรดเป็นแพลนเสียเงิน

### ทางเลือกอื่น

- **Railway** (railway.app): สร้างโปรเจกต์ใหม่ → deploy จาก GitHub repo → เพิ่ม Postgres plugin → ตั้งค่า env vars เหมือนใน `.env.example` → รัน `npm run migrate` ผ่าน Railway shell
- **Vercel + ฐานข้อมูลแยก (Supabase/Neon)**: เหมาะกับ frontend แบบ static แต่ตัวเซิร์ฟเวอร์นี้เป็น Node/Express ที่ต้องมีการเชื่อมต่อ WebSocket (Socket.IO) ค้างไว้ตลอด ซึ่ง Vercel serverless ไม่รองรับดีนัก แนะนำให้ deploy ตัวเซิร์ฟเวอร์บน Render/Railway/Fly.io แทน แล้วใช้ Supabase หรือ Neon เป็นฐานข้อมูล Postgres ก็ได้ (แค่เปลี่ยนค่า `DATABASE_URL`)

## ตั้งค่ายืนยันอีเมล (Gmail SMTP)

ตอนนี้การสมัครสมาชิกด้วยอีเมล/รหัสผ่านต้องกดยืนยันลิงก์ในอีเมลก่อนถึงจะเข้าสู่ระบบได้ (บัญชีที่ล็อกอินผ่าน Discord ไม่ต้องยืนยันซ้ำ เพราะผู้ให้บริการยืนยันอีเมลมาให้แล้ว)

1. เปิดการยืนยัน 2 ขั้นตอน (2-Step Verification) ให้บัญชี Gmail ที่จะใช้ส่งอีเมลก่อน ที่ https://myaccount.google.com/security (ถ้าเปิดไว้แล้วข้ามขั้นตอนนี้ได้)
2. ไปที่ https://myaccount.google.com/apppasswords → เลือกประเภท "Mail" → ตั้งชื่ออะไรก็ได้ (เช่น "SquadQueue") → กด Create จะได้รหัสผ่าน 16 ตัวอักษรมา (ไม่ใช่รหัสผ่าน Gmail ปกติ)
3. นำค่าที่ได้ไปใส่ใน `.env` (หรือ Environment ของ Render):
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=อีเมล_gmail_ของคุณ@gmail.com
   SMTP_PASS=รหัส16ตัวที่ได้จาก App Password (ไม่มีเว้นวรรค)
   SMTP_FROM=SquadQueue <อีเมล_gmail_ของคุณ@gmail.com>
   ```
4. ตั้งค่า `APP_BASE_URL` ให้ตรงกับโดเมนจริงที่ผู้ใช้เข้าเว็บ (เช่น `https://squadqueue-server.onrender.com`) — ค่านี้สำคัญมาก เพราะถูกใช้สร้างลิงก์ยืนยันในอีเมล ถ้าตั้งผิดหรือไม่ตั้งเลย ลิงก์อาจชี้ไปผิดโดเมน (โดยเฉพาะเมื่อรันหลัง proxy อย่าง Render)
5. ถ้าไม่ตั้งค่า SMTP ไว้ (ปล่อย `SMTP_USER`/`SMTP_PASS` ว่าง) เซิร์ฟเวอร์จะไม่ส่งอีเมลจริง แต่จะพิมพ์ลิงก์ยืนยันออกทาง console log แทน — สะดวกสำหรับทดสอบในเครื่อง แต่ผู้ใช้จริงจะเข้าระบบไม่ได้ถ้าไม่มีใครส่งลิงก์ให้

## ตั้งค่า Login ด้วย Discord (จริง ไม่ใช่จำลอง)

1. ไปที่ https://discord.com/developers/applications → New Application
2. เข้าแท็บ **OAuth2** → คัดลอก **Client ID** และ **Client Secret**
3. ในหัวข้อ Redirects ให้เพิ่ม URL: `https://โดเมนของคุณ/api/auth/discord/callback` (ตอนทดสอบในเครื่องใช้ `http://localhost:3000/api/auth/discord/callback`)
4. นำค่าที่ได้ไปใส่ใน `.env` (หรือ Environment ของ Render):
   ```
   DISCORD_CLIENT_ID=...
   DISCORD_CLIENT_SECRET=...
   DISCORD_REDIRECT_URI=https://โดเมนของคุณ/api/auth/discord/callback
   ```
5. รีสตาร์ทเซิร์ฟเวอร์ ปุ่ม "เข้าสู่ระบบด้วย Discord" จะพาไปหน้ายืนยันตัวตนของ Discord จริง

## ความปลอดภัยที่ทำไว้ให้แล้ว

- รหัสผ่านถูกเข้ารหัสด้วย bcrypt ก่อนบันทึกเสมอ ไม่มีการเก็บรหัสผ่านตรงๆ ในฐานข้อมูล
- เซสชันใช้ JWT เก็บใน cookie แบบ `httpOnly` (จาวาสคริปต์ฝั่งเว็บอ่านไม่ได้ ป้องกัน XSS ขโมย token) และตั้ง `secure` อัตโนมัติเมื่อรันบน production (บังคับส่งผ่าน HTTPS เท่านั้น)
- **ห้ามเผยแพร่ค่า `JWT_SECRET` และ Client Secret ต่างๆ ที่ไหนก็ตาม** — เก็บไว้ใน `.env` เท่านั้น (ไฟล์นี้ถูกใส่ไว้ใน `.gitignore` แล้วเพื่อไม่ให้หลุดขึ้น GitHub โดยไม่ตั้งใจ) และตั้งค่าแยกใน Environment ของแพลตฟอร์มที่ deploy จริง

## ข้อจำกัดที่ควรรู้

- สถานะ "ออนไลน์" เก็บไว้ในหน่วยความจำของเซิร์ฟเวอร์ ใช้ได้ดีถ้ารันเซิร์ฟเวอร์เครื่องเดียว (ซึ่งเพียงพอสำหรับแพลนฟรีของ Render/Railway) แต่ถ้าจะขยายเป็นหลายเครื่องพร้อมกันในอนาคต จะต้องเพิ่มระบบเก็บสถานะกลาง เช่น Redis
- รายชื่อผู้เล่นในล็อบบี้ (`/api/candidates`) ดึงมาสูงสุด 200 คนล่าสุดที่อัปเดตโปรไฟล์ ถ้าผู้ใช้เยอะมากในอนาคตอาจต้องเพิ่มการแบ่งหน้า (pagination)
