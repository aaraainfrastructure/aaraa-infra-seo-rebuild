const express = require('express');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

// Multer for memory upload handling
const upload = multer({
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

/* ---------- Firebase SDK Setup (Optional stand-alone fallback) ---------- */
let db = null;
let storage = null;
const STORAGE_BUCKET = "aaraa-infra-web.firebasestorage.app";

try {
  const admin = require('firebase-admin');
  if (admin.apps.length === 0) {
    admin.initializeApp();
  }
  db = admin.firestore();
  storage = admin.storage();
} catch (err) {
  console.log("Firebase Admin SDK not loaded or initialized. Falling back to local file persistence.");
}

/* ---------- Security Headers (CSP Hardening) ---------- */
app.use((req, res, next) => {
  res.setHeader("Content-Security-Policy", 
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://www.gstatic.com https://www.googletagmanager.com; " +
    "frame-src 'self' https://challenges.cloudflare.com; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; " +
    "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; " +
    "img-src 'self' data: https://www.aaraainfrastructure.com https://firebasestorage.googleapis.com https://www.facebook.com; " +
    "connect-src 'self' https://challenges.cloudflare.com https://aaraa-infra-web.web.app; " +
    "object-src 'none'; " +
    "base-uri 'self';"
  );
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "geolocation=(), camera=(), microphone=()");
  next();
});

app.use(helmet({
  contentSecurityPolicy: false, // Enforced manually above
  crossOriginEmbedderPolicy: false
}));

/* ---------- CORS ---------- */
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['POST', 'GET'],
  allowedHeaders: ['Content-Type']
}));

/* ---------- Body Parser ---------- */
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

/* ---------- Rate Limiting (5 requests per 15 minutes) ---------- */
const formsRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit to 5 submissions per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many submissions. Please wait 15 minutes." }
});

/* ---------- Static Files ---------- */
const ROOT_DIR = __dirname;
app.use(express.static(ROOT_DIR, {
  index: 'index.html',
  extensions: ['html'],
  setHeaders: function (res, filePath) {
    if (filePath.endsWith('.json')) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
    }
    if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    }
    if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
    }
  }
}));

// Route local uploads if they exist
app.use('/local_uploads', express.static(path.join(__dirname, 'local_uploads')));

/* ---------- Helper: HTML escape (XSS Protection) ---------- */
function sanitizeString(str) {
  if (typeof str !== "string") return str;
  return str.trim()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
}

/* ---------- Helper: Validate Phone ---------- */
function isValidPhone(phone) {
  if (!phone) return false;
  const clean = phone.replace(/[-+ ]/g, "").slice(-10);
  return /^[6789]\d{9}$/.test(clean);
}

/* ---------- Helper: Validate Email ---------- */
function isValidEmail(email) {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/* ---------- Helper: Validate File Upload Security ---------- */
function validateFile(filename, mimeType, bufferSize) {
  const allowedExtensions = ['.pdf', '.doc', '.docx'];
  const allowedMimeTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];

  const ext = path.extname(filename).toLowerCase();
  if (!allowedExtensions.includes(ext)) {
    return { valid: false, message: `Extension ${ext} is not allowed. Only PDF, DOC, DOCX are permitted.` };
  }

  if (!allowedMimeTypes.includes(mimeType)) {
    return { valid: false, message: `MIME type ${mimeType} is not allowed. Only PDF, DOC, DOCX are permitted.` };
  }

  const maxSizeBytes = 5 * 1024 * 1024; // 5MB limit
  if (bufferSize > maxSizeBytes) {
    return { valid: false, message: `File size exceeds the 5MB limit.` };
  }

  return { valid: true };
}

/* ---------- Helper: Verify Cloudflare Turnstile Token ---------- */
async function verifyTurnstile(token, ipAddress) {
  const secretKey = process.env.TURNSTILE_SECRET_KEY || "1x0000000000000000000000000000000AA";
  if (!token) return false;

  try {
    const verifyUrl = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
    const response = await fetch(verifyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `secret=${encodeURIComponent(secretKey)}&response=${encodeURIComponent(token)}&remoteip=${encodeURIComponent(ipAddress)}`
    });
    const data = await response.json();
    return !!data.success;
  } catch (err) {
    console.error("Turnstile verify call failed:", err);
    return false;
  }
}

/* ---------- Helper: Build Email HTML ---------- */
function buildEmailHTML(data, formType, submissionId, fileUrls = {}) {
  const labelMap = {
    name: 'Full Name',
    email: 'Email Address',
    phone: 'Phone Number',
    mobile: 'Mobile Number',
    message: 'Message',
    company: 'Company Name',
    aadhaar: 'Aadhaar Number',
    pan: 'PAN Number',
    gst: 'GST Number',
    service: 'Service Interested In',
    location: 'Project Location',
    experience: 'Years of Experience',
    position: 'Position Applied For',
    college: 'College Name',
    degree: 'Degree',
    department: 'Department',
    year_study: 'Year of Study',
    website: 'Website',
    turnover: 'Annual Turnover',
    trade_category: 'Trade Category',
    duration: 'Preferred Duration'
  };

  let rows = '';
  // Form fields
  for (const [key, value] of Object.entries(data)) {
    if (!value || key.startsWith('_') || ['cf-turnstile-response', 'formType', 'sourceUrl', 'pageTitle', 'referrer', 'utm_source', 'utm_medium', 'utm_campaign'].includes(key)) continue;
    const label = labelMap[key] || key.charAt(0).toUpperCase() + key.slice(1);
    rows += `<tr>
      <td style="padding:10px 15px; border:1px solid #ddd; font-weight:600; background:#f9f9f9; width:35%; font-family:sans-serif;">${label}</td>
      <td style="padding:10px 15px; border:1px solid #ddd; font-family:sans-serif;">${value}</td>
    </tr>`;
  }

  // Uploaded files
  for (const [key, url] of Object.entries(fileUrls)) {
    if (key.endsWith('Name')) continue;
    const originalName = fileUrls[`${key}Name`] || 'Download File';
    const label = labelMap[key] || key.charAt(0).toUpperCase() + key.slice(1);
    rows += `<tr>
      <td style="padding:10px 15px; border:1px solid #ddd; font-weight:600; background:#f2f7fa; width:35%; font-family:sans-serif;">${label}</td>
      <td style="padding:10px 15px; border:1px solid #ddd; font-family:sans-serif;">
        <a href="${url}" target="_blank" style="color:#ed2f39; font-weight:bold; text-decoration:none;">Download ${originalName}</a>
      </td>
    </tr>`;
  }

  const titles = {
    callback: 'New Call Back Request',
    contact: 'New General Contact Submission',
    enquiry: 'New Project/Service Enquiry',
    careers: 'New Career Application',
    vendor: 'New Vendor Registration',
    partnership: 'New Strategic Partnership Proposal',
    internship: 'New Internship Application',
    subcontractor: 'New Subcontractor Empanelment'
  };

  return `
    <div style="max-width:650px; margin:0 auto; font-family:sans-serif; border: 1px solid #eee; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,.05);">
      <div style="background:#ed2f39; color:#fff; padding:24px; text-align:center;">
        <h2 style="margin:0; font-size:22px;">${titles[formType] || 'New Form Submission'}</h2>
        <p style="margin:4px 0 0; opacity:0.9;">Submission ID: ${submissionId}</p>
      </div>
      <table style="width:100%; border-collapse:collapse;">
        ${rows}
      </table>
      <div style="padding:16px; text-align:center; color:#888; font-size:12px; background:#f5f5f5; border-top:1px solid #ddd;">
        Submitted via ${data.sourceUrl || 'aaraainfrastructure.com'} &bull; ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
      </div>
    </div>
  `;
}

/* ==========================================================================
   ROUTING
   ========================================================================== */

/* ---------- GET /api/config ---------- */
app.get('/api/config', (req, res) => {
  const siteKey = process.env.TURNSTILE_SITE_KEY || "1x00000000000000000000AA";
  res.json({
    success: true,
    turnstileSiteKey: siteKey
  });
});

/* ---------- POST /api/forms ---------- */
app.post('/api/forms', formsRateLimiter, upload.any(), async (req, res) => {
  const ipAddress = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "127.0.0.1";
  const userAgent = req.headers["user-agent"] || "Unknown";
  const ip_hash = crypto.createHash("sha256").update(ipAddress).digest("hex");

  // Determine payload source based on content-type
  const fields = req.body || {};
  const uploads = req.files || [];

  // Honeypot spam check
  if (fields._honeypot && fields._honeypot.trim() !== "") {
    return res.status(400).json({ success: false, message: "Spam detected." });
  }

  const formType = (fields.formType || "contact").toLowerCase();

  // Validate Turnstile token
  const turnstileToken = fields["cf-turnstile-response"];
  const isVerified = await verifyTurnstile(turnstileToken, ipAddress);
  if (!isVerified) {
    return res.status(400).json({ success: false, message: "Security verification failed." });
  }

  // Sanitize fields
  const name = sanitizeString(fields.name || "");
  const phone = sanitizeString(fields.phone || fields.mobile || "");
  const email = sanitizeString(fields.email || "");
  const message = sanitizeString(fields.message || fields.description || "");
  const service = sanitizeString(fields.service || "");

  // Base Server-Side Validations
  if (!name || !phone) {
    return res.status(400).json({ success: false, message: "Name and Mobile Number are required." });
  }
  if (!isValidPhone(phone)) {
    return res.status(400).json({ success: false, message: "Please enter a valid 10-digit mobile number." });
  }
  if (email && !isValidEmail(email)) {
    return res.status(400).json({ success: false, message: "Please enter a valid email address." });
  }

  // Generate Submission ID
  const timestamp = new Date().toISOString();
  const submissionId = `AAR-${formType.toUpperCase().slice(0, 3)}-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;

  // File Upload Security & Handling
  const fileUrls = {};
  const emailAttachments = [];

  if (uploads.length > 0) {
    // Validate all uploaded files first
    for (const up of uploads) {
      const check = validateFile(up.originalname, up.mimetype, up.size);
      if (!check.valid) {
        return res.status(400).json({ success: false, message: check.message });
      }
    }

    // Process & Persist files
    for (const up of uploads) {
      const sanitizedFilename = up.originalname.replace(/\s+/g, "_");
      if (storage) {
        try {
          const bucket = storage.bucket(STORAGE_BUCKET);
          const storagePath = `submissions/${formType}/${submissionId}_${sanitizedFilename}`;
          const storageFile = bucket.file(storagePath);
          await storageFile.save(up.buffer, { metadata: { contentType: up.mimetype } });
          const token = db ? db.collection("temp").doc().id : Date.now().toString();
          await storageFile.setMetadata({ metadata: { firebaseStorageDownloadTokens: token } });
          const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/${encodeURIComponent(storagePath)}?alt=media&token=${token}`;
          fileUrls[up.fieldname] = publicUrl;
          fileUrls[`${up.fieldname}Name`] = up.originalname;
          emailAttachments.push({ filename: up.originalname, path: publicUrl });
        } catch (err) {
          console.error("Firebase Storage write failed. Falling back to local file system.", err);
        }
      }

      // Local filesystem upload fallback
      if (!fileUrls[up.fieldname]) {
        const uploadDir = path.join(__dirname, 'local_uploads');
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        const localFilePath = path.join(uploadDir, `${submissionId}_${sanitizedFilename}`);
        fs.writeFileSync(localFilePath, up.buffer);
        // Expose public local path relative to server root
        const publicUrl = `/local_uploads/${submissionId}_${sanitizedFilename}`;
        fileUrls[up.fieldname] = publicUrl;
        fileUrls[`${up.fieldname}Name`] = up.originalname;
        emailAttachments.push({ filename: up.originalname, path: localFilePath });
      }
    }
  }

  // Build Lead Record
  const record = {
    submission_id: submissionId,
    form_type: formType,
    timestamp,
    createdAt: timestamp,
    name,
    phone,
    email: email || null,
    message: message || null,
    service: service || null,
    fileUrls,
    page_url: sanitizeString(fields.sourceUrl || req.headers.referer || "Unknown"),
    ipAddress,
    ip_hash,
    referrer: sanitizeString(fields.referrer || req.headers.referer || "Direct"),
    utm_source: sanitizeString(fields.utm_source || "none"),
    utm_medium: sanitizeString(fields.utm_medium || "none"),
    utm_campaign: sanitizeString(fields.utm_campaign || "none"),
    lead_status: "new"
  };

  // Capture all other key-value inputs dynamically
  for (const [key, val] of Object.entries(fields)) {
    if (['name', 'phone', 'mobile', 'email', 'message', 'description', '_honeypot', 'cf-turnstile-response', 'formType', 'sourceUrl', 'pageTitle', 'referrer', 'utm_source', 'utm_medium', 'utm_campaign'].includes(key)) continue;
    record[key] = sanitizeString(val);
  }

  // 1. Persistence First: Write to Firestore or Local Storage file
  try {
    if (db) {
      await db.collection("submissions").doc(formType).collection("entries").doc(submissionId).set(record);
    } else {
      const localDir = path.join(__dirname, 'local_submissions');
      if (!fs.existsSync(localDir)) {
        fs.mkdirSync(localDir, { recursive: true });
      }
      const filePath = path.join(localDir, `${formType}_${submissionId}.json`);
      fs.writeFileSync(filePath, JSON.stringify(record, null, 2));
      console.log(`[Persistence First] Saved submission locally at ${filePath}`);
    }
  } catch (dbErr) {
    console.error("Persistence failed:", dbErr);
    return res.status(500).json({ success: false, message: "Failed to persist lead record." });
  }

  // 2. Email Dispatch via SMTP
  try {
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    if (!smtpUser || !smtpPass) {
      throw new Error("SMTP credentials are not configured in environment variables.");
    }

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: { user: smtpUser, pass: smtpPass }
    });

    const subject = `[AARAA Web] ${formType.toUpperCase()} Submission | ${name}`;
    const html = buildEmailHTML(record, formType, submissionId, fileUrls);

    await transporter.sendMail({
      from: `"AARAA Portal" <no-reply@aaraainfrastructure.com>`,
      replyTo: email || undefined,
      to: "aaraainfrastructure@gmail.com",
      subject,
      html,
      attachments: emailAttachments
    });

    console.log(`[Email Success] Submission ${submissionId} emailed.`);
    return res.json({ success: true, message: "Your enquiry has been submitted successfully.", submission_id: submissionId });
  } catch (mailErr) {
    console.error(`[Email Failure] Failed to send email for ${submissionId}:`, mailErr);

    // Update persistent status to email_failed
    try {
      if (db) {
        await db.collection("submissions").doc(formType).collection("entries").doc(submissionId).update({
          lead_status: "email_failed",
          email_error: mailErr.message
        });
      } else {
        const filePath = path.join(__dirname, 'local_submissions', `${formType}_${submissionId}.json`);
        if (fs.existsSync(filePath)) {
          const contents = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          contents.lead_status = "email_failed";
          contents.email_error = mailErr.message;
          fs.writeFileSync(filePath, JSON.stringify(contents, null, 2));
        }
      }
    } catch (saveErr) {
      console.error("Failed to update status after email failure:", saveErr);
    }

    // Return partial success message
    return res.json({
      success: true,
      message: "Your enquiry has been received successfully. Our team has been notified and will contact you shortly.",
      submission_id: submissionId
    });
  }
});

/* ---------- Legacy redirects to align compatibility ---------- */
app.post('/api/submit', (req, res, next) => {
  req.url = '/api/forms';
  next();
});
app.post('/api/submit-join', (req, res, next) => {
  req.url = '/api/forms';
  next();
});

/* ---------- Catch all fallback routing for SPA ---------- */
app.get('*', (req, res) => {
  res.sendFile(path.join(ROOT_DIR, 'index.html'));
});

/* ---------- Start Server ---------- */
app.listen(PORT, '0.0.0.0', () => {
  console.log(`AARAA Server running on port ${PORT}`);
});