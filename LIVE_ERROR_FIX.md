# 🚨 Live Website Error - Fix Guide

## Error Detected

**Message:** "Network Error - Unable to reach server. Please try again later."

**Root Cause:** Backend server (Node.js) is not responding on port 3001

---

## Quick Fix (Immediate)

### Step 1: Kill any existing Node processes

```powershell
# Find Node process
tasklist | findstr node

# Kill the process
taskkill /PID [PID_NUMBER] /F

# Example: taskkill /PID 3132 /F
```

### Step 2: Start the backend server

```bash
cd d:\Web_Projects\aaraa-infra-seo-rebuild\server
npm start
```

### Step 3: Wait for this output:

```
[DEBUG - SMTP Auth Success]: Nodemailer is ready to send messages
AARAA Server running on http://localhost:3001
API: POST http://localhost:3001/api/submit
Health: GET http://localhost:3001/api/health
```

### Step 4: Test the API

```bash
curl http://localhost:3001/api/health
```

**Expected response:**
```json
{"status":"ok","timestamp":"2026-06-04T..."}
```

---

## If Server Still Won't Start

### Check 1: Port Already in Use

```powershell
netstat -ano | findstr :3001
```

If port is in use:
- Kill process using that port
- Or change PORT in .env to 3002

### Check 2: .env File Issues

Verify `server/.env` has:

```env
SMTP_USER=aaraainfrastructure@gmail.com
SMTP_PASS=aumcvlriokritkwt
EMAIL_USER=aaraainfrastructure@gmail.com
EMAIL_PASS=aumcvlriokritkwt
RECIPIENT_EMAIL=aaraainfrastructure@gmail.com
PORT=3001
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
ALLOWED_ORIGINS=http://localhost:3001
```

### Check 3: Node.js Installation

```powershell
node --version
npm --version
```

Both should show version numbers.

---

## Why This Happened

1. **Backend not started** - npm start was not run
2. **Process crashed** - Node process may have crashed
3. **Port conflict** - Another app using port 3001
4. **Configuration issue** - .env variables missing

---

## Current Status

✅ **API Bridge:** Deployed to GitHub  
✅ **HTML Files:** Updated with script tags  
✅ **Backend:** Ready to start  
⏳ **Server:** NEEDS TO BE STARTED NOW

---

## Permanent Fix (For Production)

Use PM2 or Windows Service to run server 24/7:

### Option A: Using PM2 (Recommended)

```bash
cd server
npm install -g pm2
pm2 start server.js --name "aaraa-form-server"
pm2 startup
pm2 save
```

### Option B: Using Windows Service (NSSM)

```bash
# Download NSSM from: https://nssm.cc/download
nssm install aaraa-form-server "D:\Web_Projects\aaraa-infra-seo-rebuild\server\server.js"
nssm start aaraa-form-server
```

---

## Testing Form Submission After Fix

1. **Go to:** contact-us.html on live site
2. **Fill form:**
   - Name: Gowri (test)
   - Email: gowri7282@gmail.com
   - Phone: 9841867282
   - Lead Type: Want to Became a Vendor
   - Message: test

3. **Submit**
   - Should see: "Thank You!" modal
   - Should NOT see: "Network Error"

4. **Verify email:**
   - Check: aaraainfrastructure@gmail.com
   - Should have: All form fields

---

## Verification Checklist

After restarting server:

- [ ] Node process running (tasklist | findstr node)
- [ ] Port 3001 responding (curl http://localhost:3001/api/health)
- [ ] SMTP Auth Success in logs
- [ ] Form submits without error
- [ ] Email received in inbox
- [ ] All fields in email

---

## Emergency Contacts

If still not working:
1. Check server logs for error messages
2. Verify .env file is correct
3. Verify Gmail credentials are valid
4. Check internet connection
5. Restart computer if needed

---

## Action Required NOW

**Go to:** `d:\Web_Projects\aaraa-infra-seo-rebuild\server`

**Run:** `npm start`

**Then test the form on the live site**

