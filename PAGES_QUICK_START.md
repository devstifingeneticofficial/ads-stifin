# ⚡ START HERE: Deploy ke Cloudflare Pages (Paling Mudah!)

Panduan super singkat untuk deploy **ads-stifin** ke Cloudflare Pages + VPS Database.

> **Waktu setup: ~1 jam total** (termasuk testing)

---

## 🎯 Arsitektur (Pages, bukan Workers)

```
GitHub Repository
        ↓
   Push ke main
        ↓
Cloudflare Pages (auto-detect & build)
        ↓
   Serverless deployment ✨
        ↓
   Your VPS Database
```

---

## ✅ Prerequisites

- [ ] GitHub account (code sudah ada)
- [ ] Cloudflare account (free tier OK)
- [ ] VPS dengan PostgreSQL (minimal setup: database + user created)
- [ ] VPS IP address & database credentials siap

---

## 🚀 3 Langkah Setup

### Step 1: VPS Database Setup (30 menit)

Di VPS Anda (via SSH):
```bash
# SSH ke VPS
ssh user@YOUR_VPS_IP

# Install PostgreSQL (jika belum)
sudo apt update
sudo apt install postgresql postgresql-contrib

# Create database & user
sudo -u postgres psql << EOF
CREATE DATABASE ads_stifin_db;
CREATE USER ads_user WITH PASSWORD 'your_strong_password_123!@#';
GRANT ALL PRIVILEGES ON DATABASE ads_stifin_db TO ads_user;
\q
EOF

# Configure untuk remote access
sudo nano /etc/postgresql/14/main/postgresql.conf
# Uncomment: listen_addresses = '*'
sudo systemctl restart postgresql

# Configure firewall (whitelist Cloudflare IPs only)
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp  # SSH
sudo ufw allow from 173.245.48.0/20 to any port 5432  # Cloudflare
sudo ufw allow from 103.21.244.0/22 to any port 5432  # Cloudflare
# (Lanjutkan untuk semua Cloudflare IP ranges dari https://www.cloudflare.com/ips/)
sudo ufw enable
```

**Test koneksi dari local:**
```powershell
psql -h YOUR_VPS_IP -U ads_user -d ads_stifin_db -c "SELECT 1"
# Output: 1 ✓
```

---

### Step 2: Setup Lokal & Database (20 menit)

Di local machine (Windows PowerShell):
```powershell
cd C:\Users\user\Documents\GitHub\ads-stifin

# Create .env.production
$env_content = @"
DATABASE_URL="postgresql://ads_user:your_strong_password_123!@#@YOUR_VPS_IP:5432/ads_stifin_db?sslmode=require"
NODE_ENV="production"
NEXT_PUBLIC_API_URL="https://your-app.pages.dev"
JWT_SECRET="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"  # Min 32 chars, random
"@

$env_content | Out-File .env.production -Encoding utf8

# Test database connection
psql -h YOUR_VPS_IP -U ads_user -d ads_stifin_db -c "SELECT 1"

# Generate & push Prisma schema ke VPS
$env:DATABASE_URL="postgresql://ads_user:password@YOUR_VPS_IP:5432/ads_stifin_db?sslmode=require"
npx prisma generate
npx prisma db push --skip-generate

# Build lokal sebagai test
npm run build

# Verify success
dir .next\standalone  # Should exist
```

---

### Step 3: Deploy ke Cloudflare Pages (10 menit)

#### Option A: Via GitHub (RECOMMENDED - Auto Deploy!)

1. **Login ke Cloudflare Dashboard:**
   - https://dash.cloudflare.com/

2. **Go to Pages:**
   - Left menu → Pages → Create a project

3. **Connect GitHub:**
   - Click "Connect to Git"
   - Authorize Cloudflare to access GitHub
   - Select `ryse77/ads-stifin`

4. **Configure Build:**
   ```
   Production branch: main
   Framework: Next.js
   Build command: npm run build
   Build output directory: .next
   ```
   → Cloudflare auto-detects, just click Save

5. **Set Environment Variables:**
   - Settings → Environment Variables → Add variable
   
   Add these 3:
   ```
   NAME: DATABASE_URL
   VALUE: postgresql://ads_user:your_password@YOUR_VPS_IP:5432/ads_stifin_db?sslmode=require
   
   NAME: JWT_SECRET
   VALUE: (generate random string, min 32 chars)
   
   NAME: NODE_ENV
   VALUE: production
   ```

6. **Deploy!**
   - Click "Save and Deploy"
   - Wait ~2-3 minutes for build
   - Visit your app at `https://your-app-name.pages.dev` ✨

---

#### Option B: Via Wrangler CLI (If Option A fails)

```powershell
# Install Wrangler
npm install -g wrangler

# Login
wrangler login

# Deploy
wrangler pages deploy .next/standalone

# Set environment variables via CLI or dashboard
wrangler pages project variables set DATABASE_URL "postgresql://..."
wrangler pages project variables set JWT_SECRET "xxxx"
wrangler pages project variables set NODE_ENV "production"
```

---

## ✅ Verify Deployment Works

```powershell
# Test aplikasi
$url = "https://your-app.pages.dev/api/auth/session"
Invoke-WebRequest $url

# Expected output: {"user":null} ✓

# Test login
$body = @{
    email = "roy@stifin.com"
    password = "password123"
} | ConvertTo-Json

$response = Invoke-WebRequest `
  -Uri "https://your-app.pages.dev/api/auth/login" `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body $body

$response.Content  # Should show user data ✓
```

---

## 🎉 Success Indicators

- ✅ Pages build succeeds (check build log)
- ✅ Can access https://your-app.pages.dev without 500 error
- ✅ Login works with demo account (roy@stifin.com / password123)
- ✅ Database queries work (data loads from VPS)
- ✅ No errors in Cloudflare Pages logs

---

## 📱 Automatic Deployments (Magic!)

Sekarang setiap kali Anda:
```bash
git add .
git commit -m "some changes"
git push origin main
```

Cloudflare Pages **otomatis:**
1. Detect push
2. Build aplikasi
3. Deploy ke global edge
4. Publish live dalam 2-3 menit

Tidak perlu manual deploy! 🚀

---

## 🔄 Auto-Deploy Preview Branches

Bonus: Setiap PR otomatis dapat preview URL:
```
Create PR → Cloudflare auto-deploy → https://pr-123.your-app-name.pages.dev
Test sebelum merge ke main!
```

---

## 🔐 Security Reminders

- [ ] `.env.production` jangan commit ke git (sudah di .gitignore)
- [ ] JWT_SECRET min 32 chars, random
- [ ] Database password harus complex
- [ ] VPS firewall hanya allow Cloudflare IPs ke port 5432
- [ ] Use `sslmode=require` untuk secure connection

---

## 🆘 Troubleshooting

### Build fails di Cloudflare
```
Check build logs: Pages → Deployments → click failed deployment
Usually: missing env var, or database migration error
```

### Can't connect to database
```
1. Test dari local: psql -h VPS_IP -U ads_user -d ads_stifin_db
2. Check VPS firewall: sudo ufw status
3. Verify DATABASE_URL in Cloudflare environment variables
```

### Import `bcryptjs` error
```
Already fixed! (@types/bcryptjs removed from package.json)
Clear cache jika masih error: 
- Pages → Deployments → Retry deployment
```

### Cold starts / slow first request
```
Normal untuk serverless ~ 1-2 detik
System akan warm-up setelah beberapa requests
```

---

## 📊 What's Different from Local Dev

| Local (npm run dev) | Cloudflare Pages |
|---|---|
| Hot reload | Cold deploy (but auto) |
| Database: local atau VPS | Database: VPS only |
| Debugging: browser DevTools | Logs: Cloudflare Pages dashboard |
| Unlimited requests | Unlimited requests (free tier!) |
| Manual `npm run dev` | Auto-deploy on git push |

---

## 🎯 Next Actions

1. ✅ Setup VPS database (copy-paste commands di Step 1)
2. ✅ Create .env.production locally
3. ✅ Test database from local
4. ✅ Deploy via GitHub (Step 3 Option A)
5. ✅ Verify with curl commands
6. ✅ Test login in browser
7. ✅ Share domain dengan team!

---

## 📞 If Something Goes Wrong

Check these in order:
1. **Cloudflare Pages build logs** → settings/deployments
2. **VPS database logs** → `sudo tail -f /var/log/postgresql/postgresql.log`
3. **Environment variables** → Pages settings → verify DATABASE_URL
4. **Database connection** → test locally with psql
5. **Firewall rules** → VPS UFW settings

---

## 🎓 Learning Resources

- **Cloudflare Pages Guide**: https://developers.cloudflare.com/pages/
- **Next.js on Pages**: https://developers.cloudflare.com/pages/framework-guides/nextjs/
- **PostgreSQL Remote Connection**: https://www.postgresql.org/docs/current/sql-syntax.html
- **Prisma + Cloudflare**: https://www.prisma.io/docs/platforms/cloudflare-pages

---

**Ready? Follow the 3 steps above! Should take ~1 hour total. Good luck! 🚀**
