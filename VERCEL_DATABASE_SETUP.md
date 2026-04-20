# 🔧 Fix Login 500 Error - Vercel Configuration

## ❌ Masalah Saat Ini

Database tidak terhubung di Vercel karena **DATABASE_URL environment variable tidak diatur**.

```
Error: LOGIN endpoint mengembalikan 500
Penyebab: PrismaClient tidak bisa terhubung ke database
```

---

## ✅ Solusi - Setup DATABASE_URL di Vercel

### **OPSI 1: PostgreSQL di VPS (RECOMMENDED)**

#### Step 1: Siapkan VPS PostgreSQL
```bash
# Di VPS Anda:
sudo apt update && sudo apt install postgresql postgresql-contrib

# Buat database dan user
sudo -u postgres createdb ads_stifin_db
sudo -u postgres createuser ads_stifin_user
sudo -u postgres psql

-- Di PostgreSQL shell:
ALTER USER ads_stifin_user WITH PASSWORD 'SECURE_PASSWORD_HERE';
GRANT ALL PRIVILEGES ON DATABASE ads_stifin_db TO ads_stifin_user;
\q
```

#### Step 2: Update Vercel Environment Variables
1. Buka **https://vercel.com/dashboard**
2. Pilih project **ads-stifin-final**
3. Settings → Environment Variables
4. Tambahkan variable baru:

```
Variable name: DATABASE_URL
Value: postgresql://ads_stifin_user:SECURE_PASSWORD_HERE@YOUR_VPS_IP:5432/ads_stifin_db?sslmode=require

Contoh:
postgresql://ads_stifin_user:MyPassword123@192.168.1.50:5432/ads_stifin_db?sslmode=require
```

5. Untuk **Production** environment, klik **Save**

#### Step 3: Verifikasi Setup
Setelah push/redeploy, test endpoint ini:
```
GET https://ads-stifin-final-xxx.vercel.app/api/health/db
```

Harusnya return:
```json
{
  "status": "healthy",
  "database": "connected",
  "userCount": 5,
  "timestamp": "2026-04-20T01:51:10.416Z"
}
```

---

### **OPSI 2: Railway.app (Database Managed - EASIER)**

Railway menyediakan PostgreSQL yang sudah managed dan bisa langsung connect ke Vercel.

#### Step 1: Buat Railway PostgreSQL
1. Buka **https://railway.app**
2. New Project → PostgreSQL
3. Copy connection string dari Railway dashboard
4. Format: `postgresql://user:password@host:port/db_name`

#### Step 2: Add ke Vercel
Vercel dashboard → Environment Variables → Add:
```
DATABASE_URL = [paste Railway connection string]
```

#### Step 3: Deploy & Test
```bash
git add .
git commit -m "Fix: Add DATABASE_URL and improve error handling"
git push
```

---

## 🧪 Testing

### Test 1: Database Health Check
```bash
curl https://ads-stifin-final-xxx.vercel.app/api/health/db
```

### Test 2: Try Login
```bash
curl -X POST https://ads-stifin-final-xxx.vercel.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"promotor1@example.com","password":"password123"}'
```

Expected response:
```json
{
  "success": true,
  "user": {
    "id": "...",
    "email": "promotor1@example.com",
    "name": "Promotor 1",
    "role": "PROMOTOR"
  }
}
```

---

## 🆘 Troubleshooting

### Error: "Database connection failed"
1. Check DATABASE_URL format is correct
2. Verify VPS/server is reachable from Vercel IP ranges
3. Check firewall rules allow port 5432
4. Verify username & password are correct

### Error: "SSL connection required"
- Vercel servers require SSL connections
- Ensure `sslmode=require` is in DATABASE_URL

### Error: "Too many connections"
- Increase max_connections in PostgreSQL
- Or use PgBouncer connection pooler

---

## 📝 Current Improvements Made

✅ Added detailed database error logging in login endpoint
✅ Improved Prisma client initialization for serverless
✅ Created `/api/health/db` endpoint for monitoring
✅ Added connection timeout safeguards

Next: Deploy changes and configure DATABASE_URL in Vercel
