const multer = require('multer');
const upload = multer();
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const nodemailer = require('nodemailer');
require('dotenv').config({ path: path.join(__dirname, '.env') });

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

/* ---------- New Join AARAA Rate Limiter ---------- */
const joinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 submissions per 15 minutes
  message: { success: false, message: 'Too many submissions. Please try again later.' }
});

/* ---------- Helper: HTML escaping for XSS protection ---------- */
function sanitizeInput(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/* ---------- Helper: Validate File URL and Extension ---------- */
function validateFileUrl(url, allowedExtensions) {
  if (!url || typeof url !== 'string') return false;
  // Must be a valid URL pointing to our Firebase Storage bucket
  if (!url.startsWith('https://firebasestorage.googleapis.com/')) return false;
  
  // Extract file path from URL (before any query parameters)
  const cleanUrl = url.split('?')[0];
  const ext = cleanUrl.split('.').pop().toLowerCase();
  return allowedExtensions.includes(ext);
}

/* ---------- API Endpoint: Join AARAA forms ---------- */
app.post('/api/submit-join', joinLimiter, async (req, res) => {
  try {
    const rawData = req.body;
    
    // 1. CSRF/Origin checks
    const origin = req.headers.origin;
    const referer = req.headers.referer;
    const hostname = req.hostname;
    if (origin && !origin.includes(hostname) && !origin.includes('localhost') && !origin.includes('127.0.0.1')) {
      return res.status(403).json({ success: false, message: 'CSRF validation failed: Invalid origin.' });
    }

    // 2. Honeypot check (double check on server)
    if (rawData._honeypot && rawData._honeypot.trim() !== '') {
      console.warn(`[Anti-Spam] Blocked submission with honeypot field filled: ${rawData._honeypot}`);
      return res.status(400).json({ success: false, message: 'Spam detected.' });
    }

    // 3. XSS Sanitization
    const data = {};
    for (const [key, value] of Object.entries(rawData)) {
      if (key === 'files') {
        data.files = {};
        for (const [fileKey, fileVal] of Object.entries(rawData.files || {})) {
          data.files[fileKey] = sanitizeInput(fileVal);
        }
      } else {
        data[key] = sanitizeInput(value);
      }
    }

    // 4. Validate core fields
    const formType = data.formType;
    if (!formType || !['career', 'partnership', 'jv', 'subcontractor', 'internship'].includes(formType)) {
      return res.status(400).json({ success: false, message: 'Invalid or missing form type.' });
    }

    // Core validation helpers
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const cleanPhone = (data.phone || data.mobile || '').replace(/[-+ ]/g, '').slice(-10);
    const phoneRegex = /^[6789]\d{9}$/;

    if (data.email && !emailRegex.test(data.email)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email address.' });
    }
    if ((data.phone || data.mobile) && !phoneRegex.test(cleanPhone)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid 10-digit mobile number.' });
    }

    // Define field lists and file requirements
    const fileConfigs = {
      career: {
        required: ['resume'],
        allowed: {
          resume: ['pdf', 'doc', 'docx'],
          portfolio: ['pdf', 'docx', 'zip']
        }
      },
      partnership: {
        required: ['company_profile', 'capability_statement'],
        allowed: {
          company_profile: ['pdf'],
          capability_statement: ['pdf'],
          brochure: ['pdf', 'zip']
        }
      },
      jv: {
        required: ['company_profile', 'reg_certificate', 'financial_doc'],
        allowed: {
          company_profile: ['pdf'],
          reg_certificate: ['pdf'],
          financial_doc: ['pdf']
        }
      },
      subcontractor: {
        required: ['gst_cert', 'pan_copy', 'company_profile', 'work_orders'],
        allowed: {
          gst_cert: ['pdf', 'jpg', 'jpeg', 'png'],
          pan_copy: ['pdf', 'jpg', 'jpeg', 'png'],
          company_profile: ['pdf'],
          work_orders: ['pdf', 'zip'],
          safety_cert: ['pdf']
        }
      },
      internship: {
        required: ['resume', 'bonafide_cert', 'transcript'],
        allowed: {
          resume: ['pdf', 'doc', 'docx'],
          bonafide_cert: ['pdf', 'jpg', 'jpeg', 'png'],
          transcript: ['pdf']
        }
      }
    };

    const config = fileConfigs[formType];
    
    // Check files on server-side
    const userFiles = data.files || {};
    for (const reqFile of config.required) {
      if (!userFiles[reqFile]) {
        return res.status(400).json({ success: false, message: `The required file '${reqFile}' is missing.` });
      }
    }

    // Validate file extensions and domains
    for (const [fileKey, fileVal] of Object.entries(userFiles)) {
      if (fileKey.endsWith('Name')) continue; // Skip string filename attributes
      const allowedExts = config.allowed[fileKey];
      if (allowedExts) {
        if (!validateFileUrl(fileVal, allowedExts)) {
          return res.status(400).json({ success: false, message: `Invalid file format or unauthorized source for file: ${fileKey}.` });
        }
      }
    }

    // Generate unique application ID
    const prefix = {
      career: 'CAR',
      partnership: 'PRT',
      jv: 'JV',
      subcontractor: 'SUB',
      internship: 'INT'
    }[formType];
    const applicationId = `${prefix}-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;

    // Get client IP and Submission details
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'Unknown';
    const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    // Subject lines
    let subject = '';
    if (formType === 'career') {
      subject = `[AARAA Career Application] - ${data.name || ''}`;
    } else if (formType === 'partnership') {
      subject = `[AARAA Strategic Partnership] - ${data.company || ''}`;
    } else if (formType === 'jv') {
      subject = `[AARAA Joint Venture Proposal] - ${data.company || ''}`;
    } else if (formType === 'subcontractor') {
      subject = `[AARAA Subcontractor Registration] - ${data.company || ''}`;
    } else if (formType === 'internship') {
      subject = `[AARAA Internship Application] - ${data.name || ''}`;
    }

    // Construct pretty field rows
    const labelMap = {
      name: 'Full Name / Representative',
      email: 'Email Address',
      phone: 'Mobile/Phone Number',
      location: 'Current Location',
      position: 'Position Applied For',
      experience: 'Years of Experience / Business Age',
      current_employer: 'Current Employer',
      current_ctc: 'Current CTC',
      expected_ctc: 'Expected CTC',
      notice_period: 'Notice Period',
      qualification: 'Highest Qualification',
      skills: 'Skills / Trade Expertise',
      message: 'Cover Letter / Proposal Summary / JV Objective / Statement of Purpose',
      company: 'Company / Organization Name',
      designation: 'Designation',
      website: 'Website URL',
      industry: 'Industry Segment',
      partnership_type: 'Partnership Type',
      turnover: 'Annual Turnover',
      geo_presence: 'Geographic Presence',
      reg_number: 'Company Registration Number',
      years_operation: 'Years in Operation',
      collaboration_areas: 'Areas of Collaboration',
      gst: 'GSTIN Number',
      pan: 'PAN Number',
      state: 'State',
      city: 'City',
      trade_category: 'Trade Category',
      employees: 'Number of Employees',
      clients: 'Major Clients Served',
      safety_declaration: 'Safety Declaration Accepted',
      college: 'College / University Name',
      degree: 'Degree Program',
      department: 'Department',
      year_study: 'Year of Study',
      internship_area: 'Internship Area',
      duration: 'Preferred Duration',
      cgpa: 'Current CGPA / Percentage',
      verifiedEmail: 'Google Verified Email'
    };

    let fieldRows = '';
    for (const [key, value] of Object.entries(data)) {
      if (['files', 'formType', 'sourceUrl', 'pageTitle'].includes(key)) continue;
      const label = labelMap[key] || key.charAt(0).toUpperCase() + key.slice(1);
      fieldRows += `
        <tr>
          <td style="padding: 10px; border: 1px solid #dddddd; font-weight: bold; background-color: #f9f9f9; width: 35%; font-family: sans-serif;">${label}</td>
          <td style="padding: 10px; border: 1px solid #dddddd; font-family: sans-serif;">${value}</td>
        </tr>
      `;
    }

    // Add File Links to table
    let fileRows = '';
    const attachments = [];
    if (userFiles) {
      for (const [key, val] of Object.entries(userFiles)) {
        if (!key.endsWith('Name') && userFiles[`${key}Name`]) {
          const fileName = userFiles[`${key}Name`];
          const label = labelMap[key] || key.charAt(0).toUpperCase() + key.slice(1);
          fileRows += `
            <tr>
              <td style="padding: 10px; border: 1px solid #dddddd; font-weight: bold; background-color: #f2f7fa; width: 35%; font-family: sans-serif;">${label}</td>
              <td style="padding: 10px; border: 1px solid #dddddd; font-family: sans-serif;">
                <a href="${val}" target="_blank" style="color: #ed2f39; font-weight: bold; text-decoration: none;">Download ${fileName}</a>
              </td>
            </tr>
          `;
          
          attachments.push({
            filename: fileName,
            path: val // Nodemailer resolves and downloads HTTPS URLs automatically
          });
        }
      }
    }

    const htmlContent = `
      <div style="max-width: 650px; margin: 0 auto; font-family: sans-serif; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
        <div style="background-color: #ed2f39; color: #ffffff; padding: 24px; text-align: center;">
          <h2 style="margin: 0; font-size: 22px; letter-spacing: 0.5px;">${subject}</h2>
          <p style="margin: 6px 0 0 0; font-size: 14px; opacity: 0.9;">Application ID: <strong>${applicationId}</strong></p>
        </div>
        
        <div style="padding: 20px;">
          <h3 style="color: #333333; border-bottom: 2px solid #ed2f39; padding-bottom: 6px; margin-top: 0; font-family: sans-serif;">Submission Details</h3>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px; color: #444444;">
            ${fieldRows}
          </table>

          <h3 style="color: #333333; border-bottom: 2px solid #ed2f39; padding-bottom: 6px; margin-top: 24px; font-family: sans-serif;">Uploaded Documents</h3>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px;">
            ${fileRows || '<tr><td style="padding: 10px; text-align: center; color: #888;" colspan="2">No files uploaded.</td></tr>'}
          </table>

          <h3 style="color: #333333; border-bottom: 2px solid #ed2f39; padding-bottom: 6px; margin-top: 24px; font-family: sans-serif;">System Metadata</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #666666;">
            <tr>
              <td style="padding: 8px; border: 1px solid #eeeeee; font-weight: bold; background-color: #fafafa; width: 35%; font-family: sans-serif;">Submission Time (IST)</td>
              <td style="padding: 8px; border: 1px solid #eeeeee; font-family: sans-serif;">${timestamp}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #eeeeee; font-weight: bold; background-color: #fafafa; font-family: sans-serif;">Applicant IP Address</td>
              <td style="padding: 8px; border: 1px solid #eeeeee; font-family: sans-serif;">${clientIp}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #eeeeee; font-weight: bold; background-color: #fafafa; font-family: sans-serif;">Form Source URL</td>
              <td style="padding: 8px; border: 1px solid #eeeeee; font-family: sans-serif;"><a href="${data.sourceUrl}" target="_blank" style="color: #ed2f39;">${data.sourceUrl}</a></td>
            </tr>
          </table>
        </div>
        
        <div style="padding: 16px; text-align: center; color: #888888; font-size: 12px; background-color: #f5f5f5; border-top: 1px solid #e0e0e0; font-family: sans-serif;">
          This is an automated system notification for AARAA Infrastructure. Please do not reply directly to this email.
        </div>
      </div>
    `;

    const recipient = 'aaraainfrastructure@gmail.com';
    const mailOptions = {
      from: '"AARAA Career & Partnerships Portal" <no-reply@aaraainfrastructure.com>',
      replyTo: data.email || undefined,
      to: recipient,
      subject: `${subject} [ID: ${applicationId}]`,
      html: htmlContent,
      attachments: attachments
    };

    await transporter.sendMail(mailOptions);
    console.log(`[${new Date().toISOString()}] Join AARAA mail dispatched successfully: ${subject}`);

    res.json({
      success: true,
      message: 'Your application has been received and emailed successfully.',
      applicationId: applicationId
    });

  } catch (err) {
    console.error('\n[Error] /api/submit-join Mail Delivery Failed:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to process application. Email delivery failed, but files were successfully uploaded. Please contact support.'
    });
  }
});

/* ---------- Start ---------- */
app.listen(PORT, '0.0.0.0', () => {
  console.log(`AARAA Server running on port ${PORT}`);
});