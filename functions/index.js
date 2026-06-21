const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const Busboy = require("busboy");
const he = require("he");
const path = require("path");
const crypto = require("crypto");

// Initialize Firebase Admin SDK
admin.initializeApp();
const db = admin.firestore();

// Firebase Storage Bucket
const STORAGE_BUCKET = "aaraa-infra-web.firebasestorage.app";
const storage = admin.storage();

/* ---------- Helper: Security Headers ---------- */
function setSecurityHeaders(res) {
  // Enforce the most restrictive CSP possible
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
}

/* ---------- Helper: HTML escape (XSS Protection) ---------- */
function sanitizeString(str) {
  if (typeof str !== "string") return str;
  return he.encode(str.trim());
}

/* ---------- Helper: Validate Phone Format ---------- */
function isValidPhone(phone) {
  if (!phone) return false;
  const clean = phone.replace(/[-+ ]/g, "").slice(-10);
  return /^[6789]\d{9}$/.test(clean);
}

/* ---------- Helper: Validate Email Format ---------- */
function isValidEmail(email) {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/* ---------- Helper: Get IP Hash ---------- */
function getIpHash(ip) {
  return crypto.createHash("sha256").update(ip || "").digest("hex");
}

/* ---------- Helper: Stateless Rate Limiter via Firestore ---------- */
async function checkIpRateLimit(ipAddress, limitCount = 5, windowMinutes = 15) {
  const formTypes = ['callback', 'contact', 'enquiry', 'careers', 'vendor', 'partnership', 'internship', 'subcontractor'];
  const windowMs = windowMinutes * 60 * 1000;
  const cutoffTime = new Date(Date.now() - windowMs).toISOString();

  const queries = formTypes.map(type => 
    db.collection("submissions").doc(type).collection("entries")
      .where("ipAddress", "==", ipAddress)
      .where("createdAt", ">", cutoffTime)
      .get()
  );

  const snaps = await Promise.all(queries);
  let totalSubmissions = 0;
  for (const snap of snaps) {
    totalSubmissions += snap.size;
    if (totalSubmissions >= limitCount) {
      return false;
    }
  }
  return true;
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

/* ---------- Helper: Verify Turnstile Token ---------- */
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
   MAIN CLOUD FUNCTION ENTRY POINT
   Routes:
     GET  /api/config         → Return client Turnstile sitekey
     POST /api/forms          → Handles JSON & multipart form submissions
 ========================================================================== */
exports.api = onRequest({ cors: true }, async (req, res) => {
  // Set security headers on all responses
  setSecurityHeaders(res);

  const pathName = req.path || "";
  const method = req.method;

  /* -----------------------------------------------------------------------
     ROUTE 1: GET /config — Expose sitekey
  ----------------------------------------------------------------------- */
  if ((pathName === "/config" || pathName.endsWith("/config")) && method === "GET") {
    const siteKey = process.env.TURNSTILE_SITE_KEY || "1x00000000000000000000AA";
    return res.json({
      success: true,
      turnstileSiteKey: siteKey
    });
  }

  /* -----------------------------------------------------------------------
     ROUTE 2: POST /forms — Handle form processing
  ----------------------------------------------------------------------- */
  if ((pathName === "/forms" || pathName.endsWith("/forms")) && method === "POST") {
    const ipAddress = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "Unknown";
    const userAgent = req.headers["user-agent"] || "Unknown";
    const ip_hash = getIpHash(ipAddress);

    // 1. IP-Based Rate Limiting (5 requests per 15 minutes)
    try {
      const underLimit = await checkIpRateLimit(ipAddress);
      if (!underLimit) {
        console.warn(`[Rate Limit Exceeded] IP: ${ipAddress}`);
        return res.status(429).json({ success: false, message: "Too many submissions. Please wait 15 minutes." });
      }
    } catch (limitErr) {
      console.error("Rate limiter check failed:", limitErr);
    }

    const contentType = req.headers["content-type"] || "";
    
    // JSON Form Submissions
    if (contentType.includes("application/json")) {
      try {
        const payload = req.body || {};

        // Honeypot spam check
        if (payload._honeypot && payload._honeypot.trim() !== "") {
          console.warn("[Spam Blocked] Honeypot triggered");
          return res.status(400).json({ success: false, message: "Spam detected." });
        }

        const formType = (payload.formType || "contact").toLowerCase();
        
        // Validate Turnstile token
        const turnstileToken = payload["cf-turnstile-response"];
        const isVerified = await verifyTurnstile(turnstileToken, ipAddress);
        if (!isVerified) {
          return res.status(400).json({ success: false, message: "Security verification failed." });
        }

        // Sanitize fields
        const name = sanitizeString(payload.name || "");
        const phone = sanitizeString(payload.phone || payload.mobile || "");
        const email = sanitizeString(payload.email || "");
        const message = sanitizeString(payload.message || "");
        const service = sanitizeString(payload.service || "");
        const company = sanitizeString(payload.company || "");

        // Backend Server-Side Validations
        if (!name || !phone) {
          return res.status(400).json({ success: false, message: "Name and Mobile Number are required." });
        }
        if (!isValidPhone(phone)) {
          return res.status(400).json({ success: false, message: "Please enter a valid 10-digit mobile number." });
        }
        if (email && !isValidEmail(email)) {
          return res.status(400).json({ success: false, message: "Please enter a valid email address." });
        }

        if (formType === "contact" && !message) {
          return res.status(400).json({ success: false, message: "Message is required." });
        }
        if (formType === "enquiry" && !service) {
          return res.status(400).json({ success: false, message: "Project / Service Interested In is required." });
        }

        // Generate Submission ID
        const timestamp = new Date().toISOString();
        const submissionId = `AAR-${formType.toUpperCase().slice(0, 3)}-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;

        // Build Record
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
          company: company || null,
          page_url: sanitizeString(payload.sourceUrl || req.headers.referer || "Unknown"),
          ipAddress,
          ip_hash,
          referrer: sanitizeString(payload.referrer || req.headers.referer || "Direct"),
          utm_source: sanitizeString(payload.utm_source || "none"),
          utm_medium: sanitizeString(payload.utm_medium || "none"),
          utm_campaign: sanitizeString(payload.utm_campaign || "none"),
          lead_status: "new"
        };

        // 1. Store lead in Firestore first (Persistence First)
        try {
          await db.collection("submissions").doc(formType).collection("entries").doc(submissionId).set(record);
        } catch (dbErr) {
          console.error("Firestore write failed:", dbErr);
          return res.status(500).json({ success: false, message: "Failed to store submission." });
        }

        // 2. Attempt Email Delivery
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
          const html = buildEmailHTML(record, formType, submissionId);

          await transporter.sendMail({
            from: `"AARAA Portal" <no-reply@aaraainfrastructure.com>`,
            replyTo: email || undefined,
            to: "aaraainfrastructure@gmail.com",
            subject,
            html
          });

          console.log(`[Email Success] Submission ${submissionId} emailed to receiver.`);
          return res.json({ success: true, message: "Your enquiry has been submitted successfully.", submission_id: submissionId });
        } catch (mailErr) {
          console.error(`[Email Failure] Failed to send email for ${submissionId}:`, mailErr);
          
          // Update status in Firestore to email_failed
          await db.collection("submissions").doc(formType).collection("entries").doc(submissionId).update({
            lead_status: "email_failed",
            email_error: mailErr.message
          });

          // Return partial success message
          return res.json({
            success: true,
            message: "Your enquiry has been received successfully. Our team has been notified and will contact you shortly.",
            submission_id: submissionId
          });
        }

      } catch (jsonErr) {
        console.error("JSON parse/process failed:", jsonErr);
        return res.status(400).json({ success: false, message: "Invalid payload." });
      }
    }

    // Multipart Form Submissions (Forms containing files)
    if (contentType.includes("multipart/form-data")) {
      const busboy = Busboy({ headers: req.headers });
      const fields = {};
      const uploads = [];
      let isFileError = false;
      let fileErrorMessage = "";

      busboy.on("field", (fieldname, val) => {
        fields[fieldname] = val;
      });

      busboy.on("file", (fieldname, file, info) => {
        const { filename, mimeType } = info;
        if (!filename) { file.resume(); return; }

        const fileBuffers = [];
        file.on("data", (data) => fileBuffers.push(data));
        file.on("end", () => {
          const buffer = Buffer.concat(fileBuffers);
          // Security checks for file uploads
          const check = validateFile(filename, mimeType, buffer.length);
          if (!check.valid) {
            isFileError = true;
            fileErrorMessage = check.message;
          }
          uploads.push({ fieldname, filename, mimeType, buffer });
        });
      });

      busboy.on("finish", async () => {
        if (isFileError) {
          return res.status(400).json({ success: false, message: fileErrorMessage });
        }

        // Honeypot spam check
        if (fields._honeypot && fields._honeypot.trim() !== "") {
          return res.status(400).json({ success: false, message: "Spam detected." });
        }

        const formType = (fields.formType || "careers").toLowerCase();

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

        // Validations
        if (!name || !phone || !email) {
          return res.status(400).json({ success: false, message: "Name, Phone, and Email are required." });
        }
        if (!isValidPhone(phone)) {
          return res.status(400).json({ success: false, message: "Please enter a valid 10-digit mobile number." });
        }
        if (!isValidEmail(email)) {
          return res.status(400).json({ success: false, message: "Please enter a valid email address." });
        }

        // Generate Submission ID
        const timestamp = new Date().toISOString();
        const submissionId = `AAR-${formType.toUpperCase().slice(0, 3)}-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;

        // Upload files to Firebase Storage
        const fileUrls = {};
        const emailAttachments = [];
        const bucket = storage.bucket(STORAGE_BUCKET);

        try {
          for (const up of uploads) {
            const sanitizedFilename = up.filename.replace(/\s+/g, "_");
            const storagePath = `submissions/${formType}/${submissionId}_${sanitizedFilename}`;
            const storageFile = bucket.file(storagePath);

            await storageFile.save(up.buffer, {
              metadata: { contentType: up.mimeType }
            });

            // Generate token
            const token = db.collection("temp").doc().id;
            await storageFile.setMetadata({
              metadata: { firebaseStorageDownloadTokens: token }
            });

            const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/${encodeURIComponent(storagePath)}?alt=media&token=${token}`;
            
            fileUrls[up.fieldname] = publicUrl;
            fileUrls[`${up.fieldname}Name`] = up.filename;
            emailAttachments.push({ filename: up.filename, path: publicUrl });
          }
        } catch (uploadErr) {
          console.error("Storage upload failed:", uploadErr);
          return res.status(500).json({ success: false, message: "Failed to upload attachments." });
        }

        // Build Record
        const record = {
          submission_id: submissionId,
          form_type: formType,
          timestamp,
          createdAt: timestamp,
          name,
          phone,
          email,
          message: message || null,
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

        // Add additional form fields
        for (const [key, val] of Object.entries(fields)) {
          if (['name', 'phone', 'mobile', 'email', 'message', 'description', '_honeypot', 'cf-turnstile-response', 'formType', 'sourceUrl', 'pageTitle', 'referrer', 'utm_source', 'utm_medium', 'utm_campaign'].includes(key)) continue;
          record[key] = sanitizeString(val);
        }

        // 1. Store lead in Firestore first (Persistence First)
        try {
          await db.collection("submissions").doc(formType).collection("entries").doc(submissionId).set(record);
        } catch (dbErr) {
          console.error("Firestore write failed:", dbErr);
          return res.status(500).json({ success: false, message: "Failed to store submission." });
        }

        // 2. Attempt Email Delivery
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

          const subject = `[AARAA Web] ${formType.toUpperCase()} Application | ${name}`;
          const html = buildEmailHTML(record, formType, submissionId, fileUrls);

          await transporter.sendMail({
            from: `"AARAA Portal" <no-reply@aaraainfrastructure.com>`,
            replyTo: email,
            to: "aaraainfrastructure@gmail.com",
            subject,
            html,
            attachments: emailAttachments
          });

          console.log(`[Email Success] Submission ${submissionId} with attachments emailed to receiver.`);
          return res.json({ success: true, message: "Your application has been submitted successfully.", submission_id: submissionId });
        } catch (mailErr) {
          console.error(`[Email Failure] Failed to send email for ${submissionId}:`, mailErr);
          
          // Update status in Firestore to email_failed
          await db.collection("submissions").doc(formType).collection("entries").doc(submissionId).update({
            lead_status: "email_failed",
            email_error: mailErr.message
          });

          // Return partial success message
          return res.json({
            success: true,
            message: "Your enquiry has been received successfully. Our team has been notified and will contact you shortly.",
            submission_id: submissionId
          });
        }
      });

      if (req.rawBody) {
        busboy.end(req.rawBody);
      } else {
        req.pipe(busboy);
      }
      return;
    }

    return res.status(400).json({ success: false, message: "Unsupported Content-Type." });
  }

  // Route Not Found
  return res.status(404).json({ success: false, message: "Endpoint Not Found." });
});
