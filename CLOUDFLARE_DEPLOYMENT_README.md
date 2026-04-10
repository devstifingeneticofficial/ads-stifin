# 📦 Deployment Guide: Cloudflare Pages + VPS Database

Panduan lengkap untuk deploy aplikasi **ads-stifin** ke **Cloudflare Pages** dengan database di **VPS pribadi**.

> 🚀 **TL;DR?** Baca [PAGES_QUICK_START.md](./PAGES_QUICK_START.md) (3 langkah, ~1 jam)

> ⚠️ **Pages atau Workers?** Jawabnya: **PAGES** - auto-deploy, unlimited free tier, cocok Next.js

---

## 🎯 Arsitektur

```
                    🌍 Your Users
                         ↓
        Cloudflare Global Edge Network
                    ↓ (HTTPS)
        Cloudflare Pages (Serverless)
         - Frontend (React/Next.js)
         - API Routes (Functions)
                    ↓ (HTTPS/SSL)
        Your VPS (Database Server)
         - PostgreSQL 12+
         - Backup & Monitoring
```

### ✅ Keuntungan Arsitektur Ini:
- **Global CDN**: Frontend serve cepat dari data center terdekat
- **Serverless Frontend**: Automatic scaling, tidak perlu manage server
- **Private Database**: Full kontrol atas data, lebih aman
- **Cost-Effective**: Cloudflare Pages gratis, VPS sendiri lebih murah dari DB as Service
- **No Vendor Lock-in**: Bisa pindah ke VPS lain kapan saja

---

## 📚 Dokumentasi Lengkap

| File | Deskripsi |
|------|-----------|
| **QUICK_REFERENCE.md** | TL;DR - Command cheat sheet & quick setup |
| **DEPLOYMENT_WINDOWS.md** | Setup step-by-step untuk Windows PowerShell |
| **DEPLOYMENT_GUIDE.md** | Panduan teknis lengkap (Linux/Mac friendly) |
| **DEPLOYMENT_CHECKLIST.md** | Checklist tracking untuk deployment |
| **.env.production.example** | Template environment variables |
| **wrangler.toml.example** | Template Cloudflare config |

---

## ⚡ Quick Start (5 langkah)

### 1. Persiapan VPS (30 menit)
```bash
# SSH ke VPS Anda
ssh user@your_vps_ip

# Install & setup PostgreSQL
sudo apt update && sudo apt install postgresql postgresql-contrib

# Create database
sudo -u postgres psql
CREATE DATABASE ads_stifin_db;
CREATE USER ads_user WITH PASSWORD 'your_strong_password_here';
GRANT ALL PRIVILEGES ON DATABASE ads_stifin_db TO ads_user;
\q

# Configure remote access & firewall
# (Detail di DEPLOYMENT_GUIDE.md)
```

### 2. Setup Local Environment (10 menit)
```powershell
cd C:\Users\user\Documents\GitHub\ads-stifin

# Copy environment template
Copy-Item .env.production.example .env.production

# Edit dengan data VPS Anda
notepad .env.production
# DATABASE_URL="postgresql://ads_user:password@YOUR_VPS_IP:5432/ads_stifin_db"
```

### 3. Test Lokal (15 menit)
```powershell
# Install dependencies
npm install

# Test database connection
psql -h YOUR_VPS_IP -U ads_user -d ads_stifin_db -c "SELECT 1"

# Generate Prisma & setup DB
$env:DATABASE_URL="postgresql://ads_user:password@YOUR_VPS_IP:5432/ads_stifin_db"
npx prisma generate
npx prisma db push

# Build & test lokal
npm run build
npm run start
# Buka http://localhost:3000, test login dengan demo account
```

### 4. Deploy ke Cloudflare (10 menit)
```powershell
# Install Wrangler
npm install -g wrangler
wrangler login  # Authenticate dengan Cloudflare account

# Deploy
wrangler pages deploy

# Atau: Push ke GitHub untuk auto-deploy via GitHub Actions
git add .
git commit -m "Deploy to Cloudflare Pages"
git push origin main
```

### 5. Setup di Cloudflare Dashboard (5 menit)
```
1. Go to Cloudflare Dashboard
2. Pages → Your Project → Settings → Environment Variables
3. Add environment variables:
   - DATABASE_URL = "postgresql://..."
   - JWT_SECRET = "your_secret_key"
   - NODE_ENV = "production"
4. Save & redeploy
```

**Done! Application live pada `https://your-app.pages.dev`**

---

## 🔍 Verify Setup

```powershell
# Test aplikasi
curl https://your-app.pages.dev/api/auth/session
# Response: {"user":null} ✓

# Test login
$body = @{"email"="roy@stifin.com";"password"="password123"} | ConvertTo-Json
curl -X POST https://your-app.pages.dev/api/auth/login `
  -H "Content-Type: application/json" `
  -Body $body
# Response: {"success":true,"user":{...}} ✓
```

---

## 📊 System Requirements

### VPS
- **OS**: Ubuntu 20.04 LTS atau lebih baru (atau alternatif Linux lain)
- **RAM**: Minimum 2GB (recommended 4GB+)
- **CPU**: 2 cores minimum
- **Disk**: 50GB minimum
- **PostgreSQL**: Version 12 atau lebih baru
- **Network**: Public IP dengan fixed address

### Local Development
- **Node.js**: v18 atau lebih baru
- **npm**: v9 atau lebih baru
- **Wrangler CLI**: v3 atau lebih baru
- **PostgreSQL client**: `psql` untuk testing

---

## 🔐 Security Checklist

- [ ] Database password STRONG (min 16 chars, complex)
- [ ] Firewall hanya allow Cloudflare IPs ke port 5432
- [ ] SSL/TLS untuk database connection (`?sslmode=require`)
- [ ] JWT_SECRET min 32 chars, random, not in git
- [ ] DATABASE_URL hanya di Cloudflare dashboard, bukan di git
- [ ] Regular database backups (daily recommended)
- [ ] WAF enabled di Cloudflare
- [ ] DDoS protection enabled
- [ ] Monitor database logs untuk suspicious activity

---

## 🚑 Troubleshooting

### Database Connection Issues
```powershell
# Test koneksi dari local
psql -h YOUR_VPS_IP -U ads_user -d ads_stifin_db -c "SELECT 1"

# Jika failed:
# 1. Check firewall di VPS: sudo ufw status
# 2. Check PostgreSQL listen: sudo netstat -tulpn | grep 5432
# 3. Check password benar
# 4. Check IP address sudah betul
```

### Application Errors  
```powershell
# Check Cloudflare logs
wrangler pages deployment tail --format pretty

# Check database logs (SSH ke VPS)
ssh user@VPS_IP
sudo tail -f /var/log/postgresql/postgresql.log

# Check application logs (local test)
npm run dev  # Run development mode untuk debug
```

### Cold Starts / Slow First Request
```
Normal behavior untuk serverless functions - up to 2-3 seconds
Keep-alive strategy: Setup health check endpoint untuk keep warm
```

---

## 📈 Monitoring & Maintenance

### Regular Tasks
- [ ] Weekly: Check Cloudflare analytics & error rates
- [ ] Weekly: Monitor database query performance
- [ ] Monthly: Review database backups
- [ ] Monthly: Update dependencies (`npm update`)
- [ ] Quarterly: Rotate JWT_SECRET
- [ ] Semi-annually: Rotate database password

### Performance Optimization
```sql
-- Check slow queries di database
SELECT query, calls, mean_time FROM pg_stat_statements 
ORDER BY mean_time DESC LIMIT 10;

-- Add indexes untuk frequently queried columns
CREATE INDEX idx_user_email ON users(email);
CREATE INDEX idx_ad_request_status ON ad_requests(status);
```

---

## 🆘 Need Help?

### Common Issues & Solutions

1. **"Cannot find module .prisma/client"**
   - Solution: Run `npx prisma generate`

2. **"Connection refused to database"**
   - Solution: Check VPS firewall allows Cloudflare IPs

3. **"FATAL: remaining connection slots reserved"**
   - Solution: Increase `max_connections` in PostgreSQL

4. **"Secrets exposed in git"**
   - Solution: Immediately rotate all credentials!

### Resources
- Full setup guide: [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)
- Windows-specific: [DEPLOYMENT_WINDOWS.md](./DEPLOYMENT_WINDOWS.md)
- Task checklist: [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)

---

## 📞 Support Contacts

- **Cloudflare Support**: https://support.cloudflare.com
- **Prisma Help**: https://www.prisma.io/docs/
- **PostgreSQL Docs**: https://www.postgresql.org/docs/
- **Next.js Deployment**: https://nextjs.org/docs/deployment

---

## 🎉 Success Indicators

Jika sudah berhasil:
- ✅ Application accessible via HTTPS di Cloudflare domain
- ✅ Login works dengan demo account
- ✅ Database queries respond dalam < 500ms
- ✅ No 500 errors in Cloudflare logs
- ✅ Data persists when app is reloaded
- ✅ Backup database berjalan

---

**Happy deploying! 🚀**

For detailed setup, refer to the specific guides based on your environment:
- Windows user? → [DEPLOYMENT_WINDOWS.md](./DEPLOYMENT_WINDOWS.md)
- Need quick commands? → [QUICK_REFERENCE.md](./QUICK_REFERENCE.md)
- Full technical details? → [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)
