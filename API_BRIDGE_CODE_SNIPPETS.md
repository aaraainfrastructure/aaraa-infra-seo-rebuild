# API Bridge - Exact Code Integration Snippets

This document contains ready-to-copy code snippets for integrating the API Bridge into your project.

---

## 1. HTML Integration (Add to contact-us.html and all pages with forms)

### Location: `<head>` section

```html
<!DOCTYPE html>
<html>
<head>
  <!-- ... other head content ... -->

  <!-- Firebase Import Map (CDN-based module resolution) -->
  <script type="importmap">
  {
    "imports": {
      "firebase/app": "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js",
      "firebase/firestore": "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js",
      "firebase/analytics": "https://www.gstatic.com/firebasejs/11.10.0/firebase-analytics.js",
      "firebase/auth": "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js",
      "firebase/storage": "https://www.gstatic.com/firebasejs/11.10.0/firebase-storage.js"
    }
  }
  </script>

  <!-- ⭐ API BRIDGE (MUST be before app.js) ⭐ -->
  <script src="js/api-bridge.js"></script>

  <!-- Firebase Configuration (if using CDN) -->
  <script src="https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js"></script>
  <script src="https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js"></script>
  <script src="https://www.gstatic.com/firebasejs/11.10.0/firebase-analytics.js"></script>
  <script src="https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js"></script>
  <script src="https://www.gstatic.com/firebasejs/11.10.0/firebase-storage.js"></script>

  <!-- Firebase Config Script -->
  <script src="js/firebase/firebase-config.js"></script>

  <!-- EmailJS Library (for notifications) -->
  <script src="https://cdn.emailjs.com/sdk/3.13.0/email.min.js"></script>

  <!-- Main Firebase Application Handler -->
  <script src="js/firebase/app.js" type="module"></script>

</head>
<body>
  <!-- ... rest of body ... -->
</body>
</html>
```

---

## 2. App.js Integration (Modify handleFormSubmit function)

### File: `js/firebase/app.js`

**Find this function** (around line 350-380):

```javascript
function handleFormSubmit(form, event) {
  // This function handles form submission
}
```

**Replace the entire function with this version that uses API Bridge**:

```javascript
async function handleFormSubmit(form, event) {
  if (form.getAttribute('data-firebase-processing') === 'true') {
    logDebug('Skipping duplicate submission', form.id || 'unknown')
    event.preventDefault()
    event.stopImmediatePropagation()
    return
  }

  if (shouldSkipForm(form)) {
    logDebug('Skipping excluded form', form.id || 'unknown')
    return
  }

  event.preventDefault()
  event.stopImmediatePropagation()

  const formType = detectFormType(form)
  logDebug('Intercepted form:', form.id || 'unnamed', 'Type:', formType)

  clearAllErrors(form)
  injectHoneypot(form)

  if (checkHoneypot(form)) {
    logDebug('Honeypot triggered — spam detected')
    showFormSuccess(form)
    return
  }

  const rateCheck = checkRateLimit()
  if (!rateCheck.allowed) {
    Toast.warning('Please wait', `Too many submissions. Try again in ${rateCheck.retryAfter} seconds.`)
    return
  }

  const errors = validateForm(form)
  if (errors.length > 0) {
    errors.forEach(({ field, message }) => showFieldError(field, message))
    const firstError = form.querySelector('.firebase-field-error')
    if (firstError) {
      const input = firstError.previousElementSibling || form.querySelector('input, textarea, select')
      if (input) input.focus()
    }
    Toast.error('Validation Error', errors.length === 1 ? errors[0].message : `${errors.length} fields need attention`)
    return
  }

  form.setAttribute('data-firebase-processing', 'true')
  const submitBtn = form.querySelector('[type="submit"], button:not([type="button"])')
  setButtonLoading(submitBtn, true)

  try {
    if (CONFIG.debug) {
      await new Promise(resolve => setTimeout(resolve, 800))
    }

    let result

    // ⭐ NEW: TRY API BRIDGE FIRST ⭐
    let bridgeResult = null
    const formData = new FormData(form)

    if (window.AARAA_BRIDGE && window.AARAA_BRIDGE.preprocess) {
      try {
        bridgeResult = await window.AARAA_BRIDGE.preprocess(formData, formType)
        logDebug('API Bridge result:', bridgeResult)

        if (bridgeResult && bridgeResult.success && bridgeResult.backend) {
          // Backend submission successful - skip Firebase
          console.log('[handleFormSubmit] Backend submission succeeded:', bridgeResult.backendResponse)
          
          if (analytics) {
            try {
              logEvent(analytics, 'form_submission', {
                form_type: formType,
                backend: true,
                success: true
              })
            } catch {}
          }

          Toast.success('Thank You!', SUCCESS_MESSAGE)
          setTimeout(() => {
            SuccessModal.show({ title: 'Thank You!', message: SUCCESS_MESSAGE })
          }, CONFIG.successModalDelay)
          
          showFormSuccess(form)
          dispatchFormResult(form, true, null)
          
          form.removeAttribute('data-firebase-processing')
          setButtonLoading(submitBtn, false)
          return  // Exit early - no need for Firebase submission
        }
      } catch (bridgeError) {
        console.warn('[handleFormSubmit] Bridge preprocessing failed, falling back to Firebase:', bridgeError)
        // Fall through to Firebase submission below
      }
    }

    // ⭐ FALLBACK: USE FIREBASE IF BRIDGE FAILS ⭐
    if (formType === 'Newsletter Form') {
      const emailInput = form.querySelector('[type="email"], input[name="email"], input[name="subscribeEmail"]')
      const email = emailInput ? emailInput.value.trim() : ''
      if (!email) {
        Toast.error('Validation Error', 'Email is required for newsletter subscription')
        setButtonLoading(submitBtn, false)
        form.removeAttribute('data-firebase-processing')
        return
      }
      result = await submitNewsletter(email)
    } else if (formType === 'Call Back Request Form') {
      result = await submitCallbackRequest(form, formType)
    } else if (formType === 'Contact Form' || formType === 'Popup Lead Form' || formType === 'Quick Enquiry Form') {
      result = await submitContactMessage(form, formType)
    } else {
      result = await submitLead(form, formType)
    }

    logDebug('Firebase submission result:', result)

    if (analytics) {
      try {
        logEvent(analytics, 'form_submission', {
          form_type: formType,
          lead_id: result.leadId,
          success: true,
          offline: result.offline || false,
          emailSent: result.emailSent || false,
          backend: false
        })
      } catch {}
    }

    if (result.offline) {
      Toast.info('Saved Offline', 'Your information will be sent when connection is restored.')
      dispatchFormResult(form, true, null)
    } else if (CONFIG.testMode) {
      console.log('[TEST MODE] Form submission result:', {
        formType,
        leadId: result.leadId,
        firestoreDocId: result.id,
        emailSent: result.emailSent,
        emailStatus: result.emailStatus
      })
      Toast.success('TEST: Form Submitted', `Lead: ${result.leadId} | Email: ${result.emailSent ? 'Delivered' : 'Failed'}`)
      dispatchFormResult(form, true, null)
    } else if (result.emailSent) {
      console.log('[Delivery Verified] Lead saved + email sent', {
        leadId: result.leadId,
        formType,
        firestoreDocId: result.id
      })
      Toast.success('Thank You!', SUCCESS_MESSAGE)
      setTimeout(() => {
        SuccessModal.show({ title: 'Thank You!', message: SUCCESS_MESSAGE })
      }, CONFIG.successModalDelay)
      dispatchFormResult(form, true, null)
    } else {
      const reason = result.emailStatus?.reason || 'Email delivery failed'
      console.error('[Delivery Failed] Lead saved but email notification failed', {
        leadId: result.leadId,
        formType,
        firestoreDocId: result.id,
        reason
      })
      const errorMsg = `Your information was saved successfully. However, the email notification encountered an issue: ${reason}`
      Toast.error('Submission Saved', errorMsg)
      dispatchFormResult(form, true, errorMsg)
    }

    showFormSuccess(form)
  } catch (err) {
    logDebug('Submission error:', err)

    if (analytics) {
      try {
        logEvent(analytics, 'form_error', {
          form_type: formType,
          error: err.code || err.message || 'unknown',
          page: window.location.href
        })
      } catch {}
    }

    let errorMessage = extractErrorMessage(err)
    Toast.error('Submission Failed', errorMessage)
    dispatchFormResult(form, false, errorMessage)
  } finally {
    setButtonLoading(submitBtn, false)
    form.removeAttribute('data-firebase-processing')
  }
}
```

---

## 3. Form Structure Examples

### Complete Contact Form

```html
<form id="contactform" class="form-contact-us" method="post" 
      data-form-handler="aaraa" data-form-type="contact">
  
  <div class="cols">
    <fieldset class="item">
      <input type="text" name="name" id="name" 
             placeholder="*Full name" required>
    </fieldset>
    <fieldset class="item">
      <input type="email" name="email" id="email" 
             placeholder="*Email address" required>
    </fieldset>
  </div>

  <div class="cols">
    <fieldset class="item">
      <input type="tel" name="phone" id="phone" 
             placeholder="*Phone number" required>
    </fieldset>
    <fieldset class="item">
      <select name="leadType" id="leadType" class="nice-select" required>
        <option value="">Select reason for contact</option>
        <option value="Vendor Inquiry">Want to Became a Vendor</option>
        <option value="Subcontractor Inquiry">Want to Became a Subcontractor</option>
        <option value="Partnership Inquiry">Want to Became a Potential Partner</option>
        <option value="General Inquiry">General Inquiry</option>
      </select>
    </fieldset>
  </div>

  <fieldset>
    <textarea name="message" id="message" 
              placeholder="Your Message*" required></textarea>
  </fieldset>

  <div class="bottom-form flex justify-content-between align-items-center flex-wrap gap-20">
    <fieldset class="check-box">
      <input type="checkbox" name="accept_terms" id="accept_terms" required>
      <label for="accept_terms">Accept terms and conditions from AARAA.</label>
    </fieldset>
    <button type="submit" class="tf-btn style-1 hover-bg-secondary text-uppercase">
      <span>send message</span>
      <span class="icon"><i class="icon-arrow-right"></i></span>
    </button>
  </div>
</form>
```

### Vendor Registration Form (from Popup)

```html
<div id="popupForm" class="ai-modal-overlay">
  <div class="ai-modal-box">
    <button class="ai-modal-close" onclick="closePopup()" aria-label="Close">&times;</button>
    <h3 class="ai-modal-title">Vendor Registration</h3>
    <form data-form-handler="aaraa" data-form-type="vendor">
      <div class="ai-form-row">
        <div class="ai-form-group">
          <input class="ai-form-control" name="name" type="text" 
                 placeholder="Full Name" required>
        </div>
        <div class="ai-form-group">
          <input class="ai-form-control" name="email" type="email" 
                 placeholder="Email" required>
        </div>
      </div>
      <div class="ai-form-row">
        <div class="ai-form-group">
          <input class="ai-form-control" name="phone" type="tel" 
                 placeholder="Phone Number" required>
        </div>
        <div class="ai-form-group">
          <input class="ai-form-control" name="company" type="text" 
                 placeholder="Company Name" required>
        </div>
      </div>
      <div class="ai-form-row">
        <div class="ai-form-group">
          <input class="ai-form-control" name="aadhaar" type="text" 
                 placeholder="Aadhaar Number" required>
        </div>
        <div class="ai-form-group">
          <input class="ai-form-control" name="pan" type="text" 
                 placeholder="PAN Number" required>
        </div>
      </div>
      <div class="ai-form-group">
        <input class="ai-form-control" name="gst" type="text" 
               placeholder="GST Number" required>
      </div>
      <!-- Hidden field to set lead type -->
      <input type="hidden" name="leadType" value="Vendor Inquiry">
      <button class="ai-btn-submit" type="submit">
        <span class="ai-btn-text">Register</span>
        <span class="ai-spinner"></span>
      </button>
    </form>
  </div>
</div>
```

### Quick Enquiry Form (from Header)

```html
<div id="headerEnquiryForm" class="ai-modal-overlay">
  <div class="ai-modal-box">
    <button class="ai-modal-close" onclick="closeEnquiry()" aria-label="Close">&times;</button>
    <h3 class="ai-modal-title">Quick Enquiry</h3>
    <form data-form-handler="aaraa" data-form-type="quick">
      <div class="ai-form-group">
        <input class="ai-form-control" name="name" type="text" 
               placeholder="Your Name" required>
      </div>
      <div class="ai-form-row">
        <div class="ai-form-group">
          <input class="ai-form-control" name="email" type="email" 
                 placeholder="Email Address" required>
        </div>
        <div class="ai-form-group">
          <input class="ai-form-control" name="phone" type="tel" 
                 placeholder="Phone Number" required>
        </div>
      </div>
      <div class="ai-form-group">
        <textarea class="ai-form-control" name="message" 
                  placeholder="Your Message" rows="4" required></textarea>
      </div>
      <!-- Hidden field to set lead type -->
      <input type="hidden" name="leadType" value="Quick Inquiry">
      <button class="ai-btn-submit" type="submit">
        <span class="ai-btn-text">Send Enquiry</span>
        <span class="ai-spinner"></span>
      </button>
    </form>
  </div>
</div>
```

---

## 4. Backend Server Configuration

### File: `server/.env`

```env
# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Alternative SMTP Services
# For Office 365:
# SMTP_HOST=smtp.office365.com
# SMTP_PORT=587

# For SendGrid:
# SMTP_HOST=smtp.sendgrid.net
# SMTP_USER=apikey
# SMTP_PASS=your-sendgrid-api-key

# Email Configuration
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
RECIPIENT_EMAIL=aaraainfrastructure@gmail.com

# Server Configuration
PORT=3001
NODE_ENV=production
```

### File: `server/server.js` (Verify /api/submit endpoint exists)

```javascript
/**
 * Verify this endpoint exists in your server.js
 */
app.post('/api/submit', upload.none(), async (req, res) => {
  try {
    console.log(`[DEBUG - Incoming Request to /api/submit]:`, JSON.stringify(req.body, null, 2));

    const data = req.body;
    const formType = data.leadType || detectFormType(data);

    // Add metadata
    data.source = req.hostname || 'aaraainfrastructure.com';
    data.submittedAt = new Date().toISOString();

    const subject = `[AARAA Website] ${formType} | ${data.name || ''}`;
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

    res.json({
      success: true,
      message: 'Your enquiry has been submitted successfully.',
      formType: formType
    });

  } catch (err) {
    console.error('\n[DEBUG - Full Mail Error Stack]:', err);
    
    res.status(500).json({
      success: false,
      message: 'Failed to send email. Please try again later.'
    });
  }
});
```

---

## 5. Console Testing Scripts

### Test 1: Check Bridge Status

```javascript
// Copy-paste into browser console
console.log('=== API BRIDGE STATUS ===');
console.log(window.AARAA_BRIDGE.getStatus());
console.log('=== BACKEND CONNECTIVITY ===');
window.AARAA_BRIDGE.testBackendConnectivity().then(r => console.log(r));
```

### Test 2: Normalize Sample Data

```javascript
// Copy-paste into browser console
const testData = {
  fullname: 'John Doe',
  email_address: 'john@test.com',
  phone_number: '+91 8681003111',
  msg: 'Test message',
  reason: 'Vendor Inquiry'
};

console.log('=== FIELD NORMALIZATION TEST ===');
console.log('Input:', testData);
const normalized = window.normalizeFieldNames(testData);
console.log('Normalized:', normalized);

const enriched = window.ensureRequiredFields(normalized, 'Contact Form');
console.log('Enriched:', enriched);
```

### Test 3: Submit Test Form

```javascript
// Copy-paste into browser console
const testFormData = new FormData();
testFormData.append('name', 'Test User');
testFormData.append('email', 'test@aaraainfrastructure.com');
testFormData.append('phone', '+91 9999999999');
testFormData.append('message', 'This is a test submission');
testFormData.append('leadType', 'General Inquiry');

console.log('=== TEST FORM SUBMISSION ===');
window.AARAA_BRIDGE.preprocess(testFormData, 'Contact Form')
  .then(result => {
    console.log('✅ Submission Result:', result);
  })
  .catch(error => {
    console.error('❌ Submission Error:', error);
  });
```

---

## 6. Environment Variable Configuration

### For Gmail SMTP

1. Enable 2-Factor Authentication in Gmail
2. Generate App Password: https://myaccount.google.com/apppasswords
3. Add to `.env`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-character-app-password
```

### For Office 365

```env
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@company.com
SMTP_PASS=your-password
```

### For SendGrid

1. Get API key from: https://app.sendgrid.com/settings/api_keys
2. Add to `.env`:

```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASS=SG.your-full-api-key
```

---

## 7. Quick Start Checklist

Copy this exact order of operations:

```bash
# 1. Copy api-bridge.js to js/
cp /path/to/api-bridge.js js/

# 2. Add to HTML <head> before app.js
# <script src="js/api-bridge.js"></script>

# 3. Update app.js with new handleFormSubmit() function
# (see Section 2 above)

# 4. Verify server .env has SMTP credentials
cat server/.env

# 5. Start server
cd server
npm install
npm start

# 6. Test form submission
# Open contact-us.html
# Fill form and submit
# Check console for: "[API Bridge] Backend submission successful"

# 7. Verify email received
# Check aaraainfrastructure@gmail.com inbox
```

---

## 8. Rollback Plan

If you need to rollback:

```bash
# 1. Restore original app.js (without API Bridge calls)
git checkout HEAD -- js/firebase/app.js

# 2. Remove API Bridge script from HTML
# Remove: <script src="js/api-bridge.js"></script>

# 3. Delete api-bridge.js
rm js/api-bridge.js

# 4. Firebase will continue to work as fallback
```

---

## Troubleshooting Commands

### Check if server is running:
```bash
curl -X GET http://localhost:3001/api/health
```

### Check API Bridge loaded:
```javascript
console.log(!!window.AARAA_BRIDGE);
```

### Monitor backend logs:
```bash
cd server && npm start 2>&1 | grep -E "\[API Bridge\]|\[DEBUG"
```

### Test email configuration:
```bash
cd server && node -e "require('dotenv').config(); console.log({host: process.env.SMTP_HOST, user: process.env.SMTP_USER})"
```

