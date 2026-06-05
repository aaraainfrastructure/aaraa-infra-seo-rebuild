const multer = require('multer');
const upload = multer();
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const nodemailer = require('nodemailer');
require('dotenv').config();

console.log('EMAIL_USER =', process.env.EMAIL_USER);
console.log('EMAIL_PASS exists =', !!process.env.EMAIL_PASS);
console.log('RECIPIENT_EMAIL =', process.env.RECIPIENT_EMAIL);

const app = express();
const PORT = process.env.PORT || 3001;

/* ---------- Paths ---------- */
const ROOT_DIR = path.join(__dirname, '..');

/* ---------- Security ---------- */
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

/* ---------- CORS ---------- */
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['POST', 'GET'],
  allowedHeaders: ['Content-Type']
}));

/* ---------- Language Routing Middleware ---------- */
const LANG_PREFIX = /^\/(en|hi|ta|te|kn|ml|mr)(\/|$)/;

app.use(function (req, res, next) {
  if (req.path.startsWith('/api/')) return next();
  if (req.path.startsWith('/locales/')) return next();

  const match = req.path.match(LANG_PREFIX);
  if (match) {
    const lang = match[1];
    const rest = match[2] ? req.path.slice(match[1].length + 1) : '/';
    req.aaraaLang = lang;
    req.url = rest;
    req._aaraaOriginalUrl = req.originalUrl;
    res.setHeader('X-AARAA-Lang', lang);
  }
  next();
});

/* ---------- Static Files ---------- */
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

/* ---------- Body Parser ---------- */
app.use(express.json({ limit: '1mb' }));

/* ---------- Rate Limit ---------- */
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many requests. Please wait before submitting again.' }
});
app.use('/api/submit', limiter);

/* ---------- Nodemailer Transporter ---------- */
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
 auth: {
  user: process.env.SMTP_USER,
  pass: process.env.SMTP_PASS
}
});


// --- DEBUGGING: Verify SMTP connection ---
transporter.verify((error, success) => {
  if (error) {
    console.error('[DEBUG - SMTP Auth Error]:', error);
  } else {
    console.log('[DEBUG - SMTP Auth Success]: Nodemailer is ready to send messages');
  }
});
// -----------------------------------------


/* ---------- Helper: Detect Form Type ---------- */
function detectFormType(data) {
  const hasAadhaar = data.aadhaar || data.pan || data.gst;
  const hasCompany = data.company;
  const hasClientName = data.clientName;
  const hasReason = data.reason;

  if (hasAadhaar || (hasCompany && data.name && data.phone)) return 'vendor';
  if (hasClientName || hasReason) return 'enquiry_bottom';
  return 'enquiry';
}

/* ---------- Helper: Build Email HTML ---------- */
function buildEmailHTML(data, formType) {
  const labelMap = {
    name: 'Name',
    email: 'Email',
    phone: 'Phone Number',
    mobile: 'Mobile Number',
    message: 'Message',
    company: 'Company Name',
    aadhaar: 'Aadhaar Number',
    pan: 'PAN Number',
    gst: 'GST Number',
    clientName: 'Full Name',
    clientPhone: 'Phone Number',
    reason: 'Reason for Connection',
    description: 'Description',
    subject: 'Subject'
  };

  let rows = '';
  for (const [key, value] of Object.entries(data)) {
    if (!value || key.startsWith('_')) continue;
    const label = labelMap[key] || key.charAt(0).toUpperCase() + key.slice(1);
    rows += `<tr><td style="padding:8px 12px;border:1px solid #ddd;font-weight:600;background:#f5f5f5;font-family:sans-serif;">${label}</td><td style="padding:8px 12px;border:1px solid #ddd;font-family:sans-serif;">${value}</td></tr>`;
  }

  const titles = {
    vendor: 'New Vendor Registration',
    enquiry: 'New Quick Enquiry',
    enquiry_bottom: 'New Project Enquiry'
  };

  return `
    <div style="max-width:600px;margin:0 auto;font-family:sans-serif;">
      <div style="background:#ed2f39;color:#fff;padding:24px;text-align:center;border-radius:8px 8px 0 0;">
        <h2 style="margin:0;font-size:22px;">${titles[formType] || 'New Form Submission'}</h2>
        <p style="margin:4px 0 0;opacity:0.9;">AARAA Infrastructure</p>
      </div>
      <table style="width:100%;border-collapse:collapse;border:1px solid #ddd;">
        ${rows}
      </table>
      <div style="padding:16px;text-align:center;color:#888;font-size:12px;border:1px solid #ddd;border-top:none;border-radius:0 0 8px 8px;">
        Submitted via ${data.source || 'aaraainfrastructure.com'} &bull; ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
      </div>
    </div>
  `;
}

/* ---------- API Endpoint ---------- */
app.post('/api/submit', upload.none(), async (req, res) => {
  try {
    // --- DEBUGGING: Log incoming request body ---
    console.log(`\n[DEBUG - Incoming Request to /api/submit]:`, JSON.stringify(req.body, null, 2));

const data = req.body;

const formType =
  data.leadType ||
  detectFormType(data);

    // Add metadata
    data.source =
  req.hostname ||
  'aaraainfrastructure.com';
    data.submittedAt = new Date().toISOString();

   const subjects = {
  enquiry: `[AARAA Website] Quick Enquiry | ${data.name || ''}`,

  email: `[AARAA Website] Email Request | ${data.name || ''}`,

  callback: `[AARAA Website] Call Back Request | ${data.name || ''}`,

  contact: `[AARAA Website] Project Enquiry | ${data.name || ''}`,

  vendor: `[AARAA Website] Vendor Registration | ${data.company || data.name || ''}`,

  enquiry_bottom: `[AARAA Website] Project Enquiry | ${data.name || ''}`
};

    const subject = subjects[formType] || '[AARAA Website] New Form Submission';
    const html = buildEmailHTML(data, formType);
    const recipient = process.env.RECIPIENT_EMAIL || 'aaraainfrastructure@gmail.com';

    const mailOptions = {
  from: '"AARAA Infrastructure Website" <aaraainfrastructure@gmail.com>',
  replyTo: data.email || undefined,
  to: recipient,
  subject,
  html
};

    await transporter.sendMail(mailOptions);

    console.log(`[${new Date().toISOString()}] ${subject} – sent to ${recipient}`);

    const successResponse = {
      success: true,
      message: 'Your enquiry has been submitted successfully.',
      formType: formType
    };
    
    // --- DEBUGGING: Log success response ---
    console.log(`[DEBUG - Outgoing Success Response]:`, JSON.stringify(successResponse));
    res.json(successResponse);

  } catch (err) {
    // --- DEBUGGING: Log exact Nodemailer error stack ---
    console.error('\n[DEBUG - Full Mail Error Stack]:', err);
    
    const errorResponse = {
      success: false,
      message: 'Failed to send email. Please try again later.'
    };

    // --- DEBUGGING: Log error response ---
    console.error(`[DEBUG - Outgoing Error Response]:`, JSON.stringify(errorResponse));
    res.status(500).json(errorResponse);
  }
});

/* ---------- Health Check ---------- */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/* ---------- Start ---------- */
app.listen(PORT, '0.0.0.0', () => {
  console.log(`AARAA Server running on http://localhost:${PORT}`);
  console.log(`API: POST http://localhost:${PORT}/api/submit`);
  console.log(`Health: GET http://localhost:${PORT}/api/health`);
  console.log(`Language routes:`);
  console.log(`  /        – English (default)`);
  console.log(`  /en/     – English`);
  console.log(`  /hi/     – Hindi`);
  console.log(`  /ta/     – Tamil`);
  console.log(`  /te/     – Telugu`);
  console.log(`  /kn/     – Kannada`);
  console.log(`  /ml/     – Malayalam`);
  console.log(`  /mr/     – Marathi`);
  console.log(`Static root: ${ROOT_DIR}`);
});
