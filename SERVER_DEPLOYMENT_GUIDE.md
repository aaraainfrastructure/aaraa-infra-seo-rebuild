# Node.js Server Deployment Guide

## What to Deploy

### **Option 1: Complete Deployment (Recommended)**

Deploy the entire `server/` folder with node_modules:

```
server/
├── node_modules/                (all dependencies - required)
├── server.js                     (main server file)
├── .env                          (environment variables - UPDATED)
├── .env.example                  (reference file)
├── package.json                  (dependency list)
├── package-lock.json             (dependency lock file)
└── server - Copy.js              (backup - optional)
```

---

### **Option 2: Lightweight Deployment (On Production Server)**

Deploy WITHOUT node_modules, then run `npm install`:

```
Deploy These Files Only:
├── server.js
├── .env                          (IMPORTANT: with correct variables)
├── package.json
└── package-lock.json

Then run on production server:
npm install
```

---

## Deployment Steps

### **Step 1: Prepare Deployment Package**

#### **If copying complete folder with node_modules:**

```bash
# Copy entire server folder to production
xcopy "d:\Web_Projects\aaraa-infra-seo-rebuild\server\*" "C:\production\server\" /E /Y /I

# Verify deployment
dir "C:\production\server\"
```

#### **If deploying without node_modules:**

```bash
# Copy only essential files
xcopy "d:\Web_Projects\aaraa-infra-seo-rebuild\server\server.js" "C:\production\server\" /Y
xcopy "d:\Web_Projects\aaraa-infra-seo-rebuild\server\.env" "C:\production\server\" /Y
xcopy "d:\Web_Projects\aaraa-infra-seo-rebuild\server\package.json" "C:\production\server\" /Y
xcopy "d:\Web_Projects\aaraa-infra-seo-rebuild\server\package-lock.json" "C:\production\server\" /Y
```

---

### **Step 2: Install Dependencies (if needed)**

```bash
cd C:\production\server
npm install
```

This will install these packages:
- express (web framework)
- cors (cross-origin requests)
- dotenv (environment variables)
- nodemailer (email sending)
- multer (form data parsing)
- helmet (security)
- express-rate-limit (rate limiting)

---

### **Step 3: Verify .env Configuration**

**Check that your production `.env` has:**

```env
SMTP_USER=aaraainfrastructure@gmail.com
SMTP_PASS=aumcvlriokritkwt
EMAIL_USER=aaraainfrastructure@gmail.com
EMAIL_PASS=aumcvlriokritkwt
RECIPIENT_EMAIL=aaraainfrastructure@gmail.com
DEST_EMAIL=aaraainfrastructure@gmail.com
PORT=3001

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false

ALLOWED_ORIGINS=http://localhost:3001
```

**For production domain, update ALLOWED_ORIGINS:**

```env
ALLOWED_ORIGINS=https://yourdomain.com
```

---

### **Step 4: Start the Server**

```bash
cd C:\production\server
npm start
```

**Expected Output:**

```
EMAIL_USER = aaraainfrastructure@gmail.com
EMAIL_PASS exists = true
RECIPIENT_EMAIL = aaraainfrastructure@gmail.com

[DEBUG - SMTP Auth Success]: Nodemailer is ready to send messages
AARAA Server running on http://localhost:3001
API: POST http://localhost:3001/api/submit
Health: GET http://localhost:3001/api/health
Language routes: en, hi, ta, te, kn, ml, mr
```

---

## Server Files Explanation

### **server.js** (Main Application)
- Express server setup
- API endpoints (/api/submit, /api/health)
- Nodemailer configuration
- Form handling logic
- Email template generation

**Status:** No changes needed - already correct

### **.env** (Environment Variables)
- SMTP credentials
- Email settings
- Port configuration
- CORS origins

**Status:** ✅ UPDATED with correct values

### **package.json** (Dependencies)
- Lists all npm packages needed
- Start scripts
- Version information

**Status:** No changes needed

### **package-lock.json** (Dependency Lock)
- Locks specific package versions
- Ensures consistent installations

**Status:** No changes needed

### **node_modules/** (Installed Packages)
- All npm packages installed
- 500+ MB folder
- Can be regenerated with `npm install`

**Status:** Ready to deploy

---

## File Size Reference

```
node_modules/               ~500 MB
server.js                   ~10 KB
.env                        ~1 KB
package.json                ~0.5 KB
package-lock.json           ~50 KB
────────────────────────────────
Total with node_modules:    ~500 MB
Total without node_modules: ~61 KB
```

---

## Deployment Options Comparison

| Method | Size | Time | Pros | Cons |
|--------|------|------|------|------|
| Copy with node_modules | 500 MB | Fast | Ready immediately | Large upload |
| Copy without node_modules | 61 KB | Slow | Small upload | Requires npm install |

---

## Step-by-Step Deployment (Quick)

### **Option A: Complete Deployment**

```bash
# 1. On your machine, zip the server folder
zip -r server-deploy.zip d:\Web_Projects\aaraa-infra-seo-rebuild\server\

# 2. Upload server-deploy.zip to production server

# 3. On production server, extract:
unzip server-deploy.zip

# 4. Go to folder:
cd server

# 5. Start server:
npm start

# Expected: Server running on port 3001
```

---

### **Option B: Lightweight Deployment**

```bash
# 1. Upload only these files to production:
- server.js
- .env (with correct production values)
- package.json
- package-lock.json

# 2. On production server:
npm install

# 3. Start:
npm start

# Expected: Server running on port 3001
```

---

## Verification Checklist

After deployment, verify:

```bash
# 1. Check if server is running
curl http://localhost:3001/api/health

# Expected response:
# {"status":"ok","timestamp":"2026-06-04T..."}

# 2. Check server logs for SMTP Auth Success
# Look for: "[DEBUG - SMTP Auth Success]: Nodemailer is ready to send messages"

# 3. Test API endpoint
curl -X POST http://localhost:3001/api/submit \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "name=Test&email=test@example.com&phone=+919999999999&message=Testing"

# 4. Check that email was sent
# Look for: "[timestamp] [AARAA Website] Contact Form | Test – sent to aaraainfrastructure@gmail.com"
```

---

## Production Deployment Checklist

Before going live:

- [ ] All files copied to production server
- [ ] node_modules installed (if deploying without them)
- [ ] .env file has production values
- [ ] ALLOWED_ORIGINS updated to production domain
- [ ] SMTP credentials verified
- [ ] Server starts without errors
- [ ] SMTP Auth Success message appears
- [ ] /api/health endpoint responds
- [ ] Test form submission works
- [ ] Email received in inbox
- [ ] All form fields present in email

---

## Troubleshooting

### Server Won't Start

**Solution:**
```bash
# 1. Check if port 3001 is in use
netstat -ano | findstr :3001

# 2. Kill process on port 3001 (if needed)
taskkill /PID [PID] /F

# 3. Try starting again
npm start
```

### SMTP Auth Error

**Solution:**
```bash
# Check .env has correct values:
# - SMTP_USER=aaraainfrastructure@gmail.com
# - SMTP_PASS=aumcvlriokritkwt (Gmail App Password)
# - EMAIL_USER=aaraainfrastructure@gmail.com
# - EMAIL_PASS=aumcvlriokritkwt

# If using Gmail, get new App Password:
# https://myaccount.google.com/apppasswords
```

### Port Already in Use

**Solution:**
```bash
# Try different port - update .env:
PORT=3002

# Then restart server
npm start
```

### node_modules Missing

**Solution:**
```bash
npm install
```

---

## Running Server in Background (Production)

### Windows

```bash
# Using nssm (Node.js Service Manager)
nssm install aaraa-form-server "C:\production\server\server.js"
nssm start aaraa-form-server

# Or use PM2
npm install -g pm2
pm2 start server.js --name "aaraa-form-server"
pm2 startup
pm2 save
```

### Linux

```bash
# Using PM2
npm install -g pm2
pm2 start server.js --name "aaraa-form-server"
pm2 startup
pm2 save

# Or using systemd
# Create /etc/systemd/system/aaraa-form-server.service
[Unit]
Description=AARAA Form Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/server
ExecStart=/usr/bin/node server.js
Restart=always

[Install]
WantedBy=multi-user.target
```

---

## Environment Variables Reference

| Variable | Value | Purpose |
|----------|-------|---------|
| SMTP_HOST | smtp.gmail.com | Email server |
| SMTP_PORT | 587 | Email server port |
| SMTP_SECURE | false | Use TLS |
| SMTP_USER | aaraainfrastructure@gmail.com | Gmail account |
| SMTP_PASS | aumcvlriokritkwt | Gmail app password |
| EMAIL_USER | aaraainfrastructure@gmail.com | Email sender |
| EMAIL_PASS | aumcvlriokritkwt | Email password |
| RECIPIENT_EMAIL | aaraainfrastructure@gmail.com | Where to send submissions |
| PORT | 3001 | Server port |
| ALLOWED_ORIGINS | http://localhost:3001 | CORS origins |

---

## Summary

**To deploy Node.js server:**

1. **Option A (Recommended):** Copy entire server/ folder with node_modules
   - Upload: 500 MB
   - Ready immediately after upload
   
2. **Option B (Lightweight):** Copy only essential files
   - Upload: 61 KB
   - Run `npm install` on production server

**Then:**
1. Verify .env has correct values
2. Start: `npm start`
3. Verify: `curl http://localhost:3001/api/health`

**That's it!** Server will be ready to receive form submissions.

