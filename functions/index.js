const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const Busboy = require("busboy");
const he = require("he");
const path = require("path");

// Initialize Firebase Admin SDK
admin.initializeApp();
const db = admin.firestore();
const storage = admin.storage();

/* ---------- SMTP CONFIG (Gmail Backup) ---------- */
const SMTP_USER = "aaraainfrastructure@gmail.com";
const SMTP_PASS = "aumcvlriokritkwt"; // Existing Gmail app password

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS
  }
});

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

/* ---------- Helper: Stateless Rate Limiter via Firestore ---------- */
async function checkIpRateLimit(ipAddress, limitCount = 10, windowMinutes = 15) {
  const collections = ["enquiries", "careerApplications", "strategicPartnerships", "jointVentures", "subcontractorApplications", "internshipApplications"];
  const windowMs = windowMinutes * 60 * 1000;
  const cutoffTime = new Date(Date.now() - windowMs).toISOString();
  
  let totalSubmissions = 0;

  for (const collName of collections) {
    const q = db.collection(collName)
      .where("ipAddress", "==", ipAddress)
      .where("createdAt", ">", cutoffTime);
    const snap = await q.get();
    totalSubmissions += snap.size;
    
    if (totalSubmissions >= limitCount) {
      return false; // Rate limit exceeded
    }
  }

  return true;
}

/* ---------- Helper: Send Email (Dual Mode) ---------- */
async function sendNotificationEmail(subject, htmlContent, attachments = [], replyToEmail = null) {
  const recipient = "aaraainfrastructure@gmail.com";
  
  // 1. Try Resend API if API Key is configured in environment
  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey) {
    try {
      console.log("[Mailer] Attempting Resend API dispatch...");
      
      // Build attachments payload for Resend
      const resendAttachments = [];
      for (const att of attachments) {
        // Fetch document buffer to send via Resend
        if (att.path && att.path.startsWith("http")) {
          const res = await fetch(att.path);
          const buffer = await res.arrayBuffer();
          resendAttachments.push({
            filename: att.filename,
            content: Buffer.from(buffer).toString("base64")
          });
        }
      }

      const resendPayload = {
        from: "AARAA Portal <no-reply@aaraainfrastructure.com>",
        to: recipient,
        subject: subject,
        html: htmlContent,
        attachments: resendAttachments
      };
      if (replyToEmail) {
        resendPayload.reply_to = replyToEmail;
      }

      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(resendPayload)
      });

      if (response.ok) {
        console.log("[Mailer] Resend API email sent successfully.");
        return true;
      } else {
        const errorData = await response.json();
        console.warn("[Mailer] Resend API failed:", errorData);
      }
    } catch (err) {
      console.error("[Mailer] Resend API error:", err);
    }
  }

  // 2. Fallback to Gmail Nodemailer SMTP
  console.log("[Mailer] Attempting Nodemailer Gmail SMTP dispatch...");
  const mailOptions = {
    from: `"AARAA Serverless Portal" <${SMTP_USER}>`,
    to: recipient,
    subject: subject,
    html: htmlContent,
    attachments: attachments // Nodemailer handles remote URLs out-of-the-box
  };
  if (replyToEmail) {
    mailOptions.replyTo = replyToEmail;
  }

  await transporter.sendMail(mailOptions);
  console.log("[Mailer] Nodemailer Gmail SMTP email sent successfully.");
  return true;
}

/* ---------- MAIN API ENDPOINT ---------- */
exports.api = onRequest({ cors: true }, async (req, res) => {
  // Only accept POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method Not Allowed" });
  }

  const pathName = req.path || "";
  const ipAddress = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "Unknown";
  const userAgent = req.headers["user-agent"] || "Unknown";

  // Enforce Rate Limiting (stateless check)
  try {
    const underLimit = await checkIpRateLimit(ipAddress);
    if (!underLimit) {
      return res.status(429).json({ success: false, message: "Too many submissions. Please wait 15 minutes." });
    }
  } catch (err) {
    console.error("Rate limiter failure:", err);
  }

  // Route 1: Contact / Enquiries (JSON payload, no files)
  if (pathName === "/submit" || pathName.endsWith("/submit")) {
    try {
      const payload = req.body;

      // Anti-Spam Honeypot check
      if (payload._honeypot && payload._honeypot.trim() !== "") {
        console.warn(`[Spam Blocked] Honeypot field filled: ${payload._honeypot}`);
        return res.status(400).json({ success: false, message: "Spam detected." });
      }

      // Extract and sanitize fields
      const name = sanitizeString(payload.name);
      const email = sanitizeString(payload.email);
      const phone = sanitizeString(payload.phone);
      const message = sanitizeString(payload.message || "");
      const leadType = sanitizeString(payload.leadType || "General Inquiry");
      const sourcePage = sanitizeString(payload.sourcePage || req.headers.referer || "Unknown");

      // Validations
      if (!name || !email || !phone) {
        return res.status(400).json({ success: false, message: "Required fields (Name, Email, Phone) are missing." });
      }
      if (!isValidEmail(email)) {
        return res.status(400).json({ success: false, message: "Invalid email format." });
      }
      if (!isValidPhone(phone)) {
        return res.status(400).json({ success: false, message: "Invalid 10-digit mobile number." });
      }

      // Generate unique application/lead ID
      const timestamp = new Date().toISOString();
      const random = Math.floor(1000 + Math.random() * 9000);
      const leadId = `AAR-ENQ-${Date.now().toString().slice(-6)}-${random}`;

      const docData = {
        applicationId: leadId,
        name,
        email,
        phone,
        message,
        leadType,
        sourcePage,
        ipAddress,
        userAgent,
        createdAt: timestamp,
        status: "new"
      };

      // Write to Firestore
      await db.collection("enquiries").doc(leadId).set(docData);

      // Construct HTML Email
      const emailSubject = `[AARAA Website Inquiry] - ${name} (${leadType})`;
      const htmlContent = `
        <div style="max-width: 600px; margin: 0 auto; font-family: sans-serif; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #ed2f39; color: white; padding: 20px; text-align: center;">
            <h2 style="margin: 0;">New Enquiry Received</h2>
            <p style="margin: 4px 0 0 0; opacity: 0.9;">Lead ID: ${leadId}</p>
          </div>
          <div style="padding: 20px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; background: #f9f9f9; width: 35%;">Lead Type</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${leadType}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; background: #f9f9f9;">Name</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${name}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; background: #f9f9f9;">Email</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${email}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; background: #f9f9f9;">Mobile</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${phone}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; background: #f9f9f9;">Message</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${message || "N/A"}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; background: #f9f9f9;">Source Page</td>
                <td style="padding: 8px; border: 1px solid #ddd;"><a href="${sourcePage}" target="_blank">${sourcePage}</a></td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; background: #f9f9f9;">IP Address</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${ipAddress}</td>
              </tr>
            </table>
          </div>
        </div>
      `;

      await sendNotificationEmail(emailSubject, htmlContent, [], email);

      return res.json({ success: true, message: "Enquiry submitted successfully.", applicationId: leadId });

    } catch (err) {
      console.error("Enquiry submission handler error:", err);
      return res.status(500).json({ success: false, message: "Internal Server Error." });
    }
  }

  // Route 2: Join AARAA Forms (multipart/form-data with file attachments)
  if (pathName === "/submit-join" || pathName.endsWith("/submit-join")) {
    const busboy = Busboy({ headers: req.headers });
    const fields = {};
    const uploads = [];
    let fileError = null;

    const fileLimitConfigs = {
      career: { required: ["resume"], allowed: { resume: [".pdf", ".doc", ".docx"], portfolio: [".pdf", ".docx", ".zip"] }, sizeMB: { resume: 10, portfolio: 15 }, folder: "career" },
      partnership: { required: ["company_profile", "capability_statement"], allowed: { company_profile: [".pdf"], capability_statement: [".pdf"], brochure: [".pdf", ".zip"] }, sizeMB: { company_profile: 15, capability_statement: 15, brochure: 15 }, folder: "partnership" },
      jv: { required: ["company_profile", "reg_certificate", "financial_doc"], allowed: { company_profile: [".pdf"], reg_certificate: [".pdf"], financial_doc: [".pdf"] }, sizeMB: { company_profile: 15, reg_certificate: 10, financial_doc: 15 }, folder: "joint-venture" },
      subcontractor: { required: ["gst_cert", "pan_copy", "company_profile", "work_orders"], allowed: { gst_cert: [".pdf", ".jpg", ".jpeg", ".png"], pan_copy: [".pdf", ".jpg", ".jpeg", ".png"], company_profile: [".pdf"], work_orders: [".pdf", ".zip"], safety_cert: [".pdf"] }, sizeMB: { gst_cert: 10, pan_copy: 10, company_profile: 15, work_orders: 20, safety_cert: 10 }, folder: "subcontractor" },
      internship: { required: ["resume", "bonafide_cert", "transcript"], allowed: { resume: [".pdf", ".doc", ".docx"], bonafide_cert: [".pdf", ".jpg", ".jpeg", ".png"], transcript: [".pdf"] }, sizeMB: { resume: 10, bonafide_cert: 10, transcript: 10 }, folder: "internship" },
      vendor: { required: ["incorporationCert", "identityProof", "addressProof"], allowed: { incorporationCert: [".pdf"], identityProof: [".pdf", ".jpg", ".jpeg", ".png"], addressProof: [".pdf", ".jpg", ".jpeg", ".png"], tradeLicense: [".pdf", ".jpg", ".jpeg", ".png"] }, sizeMB: { incorporationCert: 10, identityProof: 10, addressProof: 10, tradeLicense: 10 }, folder: "vendor" }
    };

    busboy.on("field", (fieldname, val) => {
      fields[fieldname] = val;
    });

    busboy.on("file", (fieldname, file, info) => {
      const { filename, mimeType } = info;
      
      if (!filename) {
        file.resume();
        return;
      }

      const fileBuffers = [];
      file.on("data", (data) => {
        fileBuffers.push(data);
      });

      file.on("end", () => {
        uploads.push({
          fieldname,
          filename,
          mimeType,
          buffer: Buffer.concat(fileBuffers)
        });
      });
    });

    busboy.on("finish", async () => {
      // Check Spam
      if (fields._honeypot && fields._honeypot.trim() !== "") {
        return res.status(400).json({ success: false, message: "Spam detected." });
      }

      const formType = fields.formType || "";
      const config = fileLimitConfigs[formType];

      if (!config) {
        return res.status(400).json({ success: false, message: "Invalid or missing formType." });
      }

      // Validate uploads against configuration
      const validatedUploads = [];
      for (const up of uploads) {
        const ext = path.extname(up.filename).toLowerCase();
        const allowedExts = config.allowed[up.fieldname];

        if (!allowedExts) {
          return res.status(400).json({ success: false, message: `Unsupported file upload field: ${up.fieldname}` });
        }

        // Extension Validation
        if (!allowedExts.includes(ext)) {
          return res.status(400).json({ success: false, message: `Invalid file extension for ${up.fieldname}. Allowed: ${allowedExts.join(", ").toUpperCase()}` });
        }

        const limitMB = config.sizeMB[up.fieldname] || 10;
        const fileSize = up.buffer.length;

        if (fileSize > limitMB * 1024 * 1024) {
          return res.status(400).json({ success: false, message: `File ${up.fieldname} exceeds size limit of ${limitMB}MB.` });
        }

        validatedUploads.push({
          ...up,
          folder: config.folder
        });
      }

      // Verify Required Uploads exist in payload
      const uploadedFieldNames = validatedUploads.map(u => u.fieldname);
      for (const reqField of config.required) {
        if (!uploadedFieldNames.includes(reqField)) {
          return res.status(400).json({ success: false, message: `Required document is missing: ${reqField}` });
        }
      }

      // Sanitize fields
      const sanitizedData = {};
      for (const [key, value] of Object.entries(fields)) {
        if (key === "files" || key === "_honeypot") continue;
        sanitizedData[key] = sanitizeString(value);
      }

      // Custom validations
      if (sanitizedData.email && !isValidEmail(sanitizedData.email)) {
        return res.status(400).json({ success: false, message: "Invalid email format." });
      }
      if ((sanitizedData.phone || sanitizedData.mobile) && !isValidPhone(sanitizedData.phone || sanitizedData.mobile)) {
        return res.status(400).json({ success: false, message: "Invalid 10-digit mobile number." });
      }

      // Generate Unique Application ID
      const prefix = { career: "CAR", partnership: "PRT", jv: "JV", subcontractor: "SUB", internship: "INT", vendor: "VND" }[formType] || "JOIN";
      const randomId = Math.floor(1000 + Math.random() * 9000);
      const applicationId = `${prefix}-${Date.now().toString().slice(-6)}-${randomId}`;

      // Upload parsed files to Firebase Storage
      const fileUrls = {};
      const emailAttachments = [];
      const bucket = storage.bucket();

      try {
        for (const up of validatedUploads) {
          const sanitizedFilename = up.filename.replace(/\s+/g, "_");
          const storagePath = `${up.folder}/${applicationId}_${Date.now()}_${sanitizedFilename}`;
          const storageFile = bucket.file(storagePath);

          // Upload buffer
          await storageFile.save(up.buffer, {
            metadata: { contentType: up.mimeType }
          });

          // Generate public URL with download access token
          const token = admin.firestore().collection("temp").doc().id; // generate unique token
          await storageFile.setMetadata({
            metadata: {
              firebaseStorageDownloadTokens: token
            }
          });

          const publicUrl = `https://firebasestorage.googleapis.com/v1/b/${bucket.name}/o/${encodeURIComponent(storagePath)}?alt=media&token=${token}`;
          
          fileUrls[up.fieldname] = publicUrl;
          fileUrls[`${up.fieldname}Name`] = up.filename;

          emailAttachments.push({
            filename: up.filename,
            path: publicUrl // Nodemailer fetches the media directly
          });
        }
      } catch (uploadErr) {
        console.error("Storage upload failed:", uploadErr);
        return res.status(500).json({ success: false, message: "Failed to upload file attachments. Please try again." });
      }

      // Construct Firestore Record payload
      const timestamp = new Date().toISOString();
      const firestoreCollections = {
        career: "careerApplications",
        partnership: "strategicPartnerships",
        jv: "jointVentures",
        subcontractor: "subcontractorApplications",
        internship: "internshipApplications",
        vendor: "vendors"
      };

      const targetCollection = firestoreCollections[formType];
      const applicantRecord = {
        applicationId,
        ipAddress,
        userAgent,
        sourcePage: sanitizedData.sourceUrl || "Unknown",
        createdAt: timestamp,
        status: "new",
        fileUrls,
        details: sanitizedData
      };

      try {
        await db.collection(targetCollection).doc(applicationId).set(applicantRecord);
      } catch (dbErr) {
        console.error("Firestore database write failed:", dbErr);
        return res.status(500).json({ success: false, message: "Failed to save application details." });
      }

      // Build Notification Email Subject
      const emailSubjectPrefixes = {
        career: "[AARAA Career Application]",
        partnership: "[AARAA Strategic Partnership]",
        jv: "[AARAA Joint Venture Proposal]",
        subcontractor: "[AARAA Subcontractor Registration]",
        internship: "[AARAA Internship Application]",
        vendor: "[AARAA Vendor Registration]"
      };

      const emailSubject = `${emailSubjectPrefixes[formType]} - ${sanitizedData.name || sanitizedData.company || ""}`;

      // Build Pretty Email HTML Rows
      const labelMap = {
        incorporationCert: "Certificate of Incorporation",
        identityProof: "Proprietor Identity Proof",
        addressProof: "Company Address Proof",
        tradeLicense: "Trade License / Other Registration",
        name: "Full Name / Representative",
        college: "College Name",
        degree: "Degree",
        department: "Department",
        year_study: "Year of Study",
        phone: "Contact Number",
        mobile: "Mobile Number",
        email: "Email Address",
        location: "Current Location",
        position: "Position Applied For",
        experience: "Years of Experience",
        current_employer: "Current Employer",
        current_ctc: "Current CTC",
        expected_ctc: "Expected CTC",
        notice_period: "Notice Period",
        qualification: "Highest Qualification",
        skills: "Skills / Expertise",
        message: "Cover Letter / Statement of Purpose / Objective",
        company: "Company Name",
        designation: "Designation",
        website: "Website",
        industry: "Industry",
        partnership_type: "Partnership Type",
        turnover: "Annual Turnover",
        geo_presence: "Geographic Presence",
        reg_number: "Company Registration Number",
        years_operation: "Years in Operation",
        collaboration_areas: "Areas of Collaboration",
        gst: "GST Number",
        pan: "PAN Number",
        state: "State",
        city: "City",
        trade_category: "Trade Category",
        employees: "Number of Employees",
        clients: "Major Clients",
        safety_declaration: "Safety Compliance Accepted",
        internship_area: "Internship Area",
        duration: "Preferred Duration",
        cgpa: "Current CGPA"
      };

      let tableRows = "";
      for (const [key, val] of Object.entries(sanitizedData)) {
        if (["formType", "sourceUrl", "pageTitle"].includes(key)) continue;
        const label = labelMap[key] || key.charAt(0).toUpperCase() + key.slice(1);
        tableRows += `
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold; background-color: #f9f9f9; width: 35%;">${label}</td>
            <td style="padding: 10px; border: 1px solid #ddd;">${val}</td>
          </tr>
        `;
      }

      // Add File Links Row
      let fileRows = "";
      for (const reqField of Object.keys(config.allowed)) {
        if (fileUrls[reqField]) {
          const label = labelMap[reqField] || reqField.charAt(0).toUpperCase() + reqField.slice(1);
          fileRows += `
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold; background-color: #f2f7fa; width: 35%;">${label}</td>
              <td style="padding: 10px; border: 1px solid #ddd;">
                <a href="${fileUrls[reqField]}" target="_blank" style="color: #ed2f39; font-weight: bold; text-decoration: none;">Download ${fileUrls[`${reqField}Name`]}</a>
              </td>
            </tr>
          `;
        }
      }

      const emailHtml = `
        <div style="max-width: 650px; margin: 0 auto; font-family: sans-serif; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
          <div style="background-color: #ed2f39; color: white; padding: 24px; text-align: center;">
            <h2 style="margin: 0; font-size: 22px;">${emailSubject.split(" - ")[0]}</h2>
            <p style="margin: 6px 0 0 0; font-size: 14px; opacity: 0.9;">Application ID: <strong>${applicationId}</strong></p>
          </div>
          <div style="padding: 20px;">
            <h3 style="color: #333; border-bottom: 2px solid #ed2f39; padding-bottom: 6px; margin-top: 0;">Applicant Information</h3>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px; color: #444;">
              ${tableRows}
            </table>
            <h3 style="color: #333; border-bottom: 2px solid #ed2f39; padding-bottom: 6px; margin-top: 24px;">Uploaded Attachments</h3>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px;">
              ${fileRows}
            </table>
            <h3 style="color: #333; border-bottom: 2px solid #ed2f39; padding-bottom: 6px; margin-top: 24px;">Submission Metadata</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #666;">
              <tr>
                <td style="padding: 8px; border: 1px solid #eee; font-weight: bold; background-color: #fafafa; width: 35%;">Submission Time (IST)</td>
                <td style="padding: 8px; border: 1px solid #eee;">${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #eee; font-weight: bold; background-color: #fafafa;">Applicant IP Address</td>
                <td style="padding: 8px; border: 1px solid #eee;">${ipAddress}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #eee; font-weight: bold; background-color: #fafafa;">Form Source URL</td>
                <td style="padding: 8px; border: 1px solid #eee;"><a href="${sanitizedData.sourceUrl}" target="_blank" style="color: #ed2f39;">${sanitizedData.sourceUrl}</a></td>
              </tr>
            </table>
          </div>
        </div>
      `;

      try {
        await sendNotificationEmail(emailSubject, emailHtml, emailAttachments, sanitizedData.email);
      } catch (mailErr) {
        console.error("Mail dispatch failed:", mailErr);
        // Note: We still return success: true because the application was successfully saved to Storage and Firestore.
      }

      return res.json({
        success: true,
        message: "Application submitted and received successfully.",
        applicationId
      });
    });

    if (req.rawBody) {
      busboy.end(req.rawBody);
    } else {
      req.pipe(busboy);
    }
  } else {
    return res.status(404).json({ success: false, message: "Endpoint Not Found." });
  }
});
