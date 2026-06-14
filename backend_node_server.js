const multer = require('multer');
const upload = multer();
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const nodemailer = require('nodemailer');
require('dotenv').config({ path: path.join(__dirname, 'server', '.env') });

const app = express();
const PORT = process.env.PORT || 3001;

/* ---------- Paths ---------- */
const ROOT_DIR = path.join(__dirname, '..'); // Adjust based on your folder structure

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
  max: 15,
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
    subject: 'Subject',
    service: 'Service Interested In',
    location: 'Project Location',
    vendorCategory: 'Vendor Category',
    experience: 'Years of Experience',
    website: 'Website',
    services: 'Services Provided'
  };

  let rows = '';
  for (const [key, value] of Object.entries(data)) {
    // Exclude system fields and terms checkboxes from the email
    if (!value || key.startsWith('_') || ['leadType', 'sourceUrl', 'terms'].includes(key)) continue;
    
    const label = labelMap[key] || key.charAt(0).toUpperCase() + key.slice(1);
    rows += `<tr>
      <td style="padding:10px 15px; border:1px solid #ddd; font-weight:600; background:#f9f9f9; width:35%; font-family:sans-serif;">${label}</td>
      <td style="padding:10px 15px; border:1px solid #ddd; font-family:sans-serif;">${value}</td>
    </tr>`;
  }

  const titles = {
    vendor: 'New Vendor Registration',
    enquiry: 'New Quick Enquiry',
    enquiry_bottom: 'New Project Enquiry',
    email: 'New Email Request',
    callback: 'New Call Back Request',
    contact: 'New General Contact'
  };

  return `
    <div style="max-width:650px; margin:0 auto; font-family:sans-serif; border: 1px solid #eee; border-radius: 8px; overflow: hidden;">
      <div style="background:#ed2f39; color:#fff; padding:24px; text-align:center;">
        <h2 style="margin:0; font-size:22px;">${titles[formType] || 'New Form Submission'}</h2>
        <p style="margin:4px 0 0; opacity:0.9;">AARAA Infrastructure</p>
      </div>
      <table style="width:100%; border-collapse:collapse;">
        ${rows}
      </table>
      <div style="padding:16px; text-align:center; color:#888; font-size:12px; background:#f5f5f5; border-top:1px solid #ddd;">
        Submitted via ${data.source || 'aaraainfrastructure.com'} &bull; ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
      </div>
    </div>
  `;
}

/* ---------- API Endpoint ---------- */
app.post('/api/submit', upload.none(), async (req, res) => {
  try {
    const data = req.body;
    const formType = data.leadType || detectFormType(data);

    data.source = req.hostname || 'aaraainfrastructure.com';
    data.submittedAt = new Date().toISOString();

    const subjects = {
      enquiry: `[AARAA Website] Quick Enquiry | ${data.name || ''}`,
      email: `[AARAA Website] Email Request | ${data.name || ''}`,
      callback: `[AARAA Website] Call Back Request | ${data.name || ''}`,
      contact: `[AARAA Website] General Enquiry | ${data.name || ''}`,
      vendor: `[AARAA Website] Vendor Registration | ${data.company || data.name || ''}`,
      enquiry_bottom: `[AARAA Website] Project Enquiry | ${data.name || ''}`
    };

    const subject = subjects[formType] || '[AARAA Website] New Form Submission';
    const html = buildEmailHTML(data, formType);
    
    // Explicitly enforce routing to standard email as per requirements
    const recipient = 'aaraainfrastructure@gmail.com'; 

    const mailOptions = {
      from: '"AARAA Infrastructure Website" <no-reply@aaraainfrastructure.com>',
      replyTo: data.email || undefined,
      to: recipient,
      subject,
      html
    };

    await transporter.sendMail(mailOptions);
    console.log(`[${new Date().toISOString()}] ${subject} – sent to ${recipient}`);

    res.json({
      success: true,
      message: 'Your enquiry has been submitted successfully.',
      formType: formType
    });

  } catch (err) {
    console.error('\n[Error] Mail Delivery Failed:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to send email. Please try again later or contact us directly.'
    });
  }
});

/* ---------- Start ---------- */
app.listen(PORT, '0.0.0.0', () => {
  console.log(`AARAA Server running on port ${PORT}`);
});