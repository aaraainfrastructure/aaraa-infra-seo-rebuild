# AARAA API Bridge Integration Guide

## Overview

The **API Bridge** (`js/api-bridge.js`) is a middleware layer that bridges Firebase form submissions to the Express backend `/api/submit` endpoint. It solves:

- ✅ HTTP 405 errors on form submission
- ✅ Missing submitted values in emails
- ✅ Field name mismatches (mail vs email, etc.)
- ✅ Missing leadType categorization
- ✅ Forms not reaching the backend
- ✅ Fallback mechanism if backend is unavailable

---

## Architecture

```
[HTML Form] → [Firebase Handler (app.js)] → [API Bridge] → [Express Backend (/api/submit)]
                                                    ↓
                                          [Nodemailer Email]
                                                    ↓
                                          [AARAA Inbox]
```

### Data Flow

1. **Form Submission**: User submits form on contact-us.html or other pages
2. **Firebase Intercept**: Firebase form handler captures the submission
3. **API Bridge**: Normalizes field names, validates data, converts to FormData
4. **Backend Submission**: Sends POST request to `/api/submit`
5. **Email Notification**: Backend sends email via Nodemailer
6. **Response**: Success/failure message returned to frontend

---

## Installation

### Step 1: Include the API Bridge Script

Add this line to your HTML `<head>` section (after Firebase config but before app.js):

```html
<!-- Firebase Configuration -->
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

<!-- API Bridge (MUST be before app.js) -->
<script src="js/api-bridge.js"></script>

<!-- Firebase Application Handler -->
<script src="js/firebase/app.js" type="module"></script>
```

### Step 2: Update app.js Integration Point

In `js/firebase/app.js`, modify the `handleFormSubmit` function to use the API bridge:

**Location**: Around line 380-420 in app.js

**Original Code** (BEFORE):
```javascript
async function handleFormSubmit(form, event) {
  // ... validation code ...
  
  try {
    // ... existing code ...
    let result = await submitLead(form, formType);
  } catch (err) {
    // ... error handling ...
  }
}
```

**Updated Code** (AFTER):
```javascript
async function handleFormSubmit(form, event) {
  // ... validation code remains the same ...
  
  try {
    // NEW: Use API Bridge for backend submission
    let bridgeResult = null;
    const formData = new FormData(form);
    
    if (window.AARAA_BRIDGE && window.AARAA_BRIDGE.preprocess) {
      try {
        bridgeResult = await window.AARAA_BRIDGE.preprocess(formData, formType);
        logDebug('API Bridge result:', bridgeResult);
        
        if (bridgeResult && bridgeResult.success && bridgeResult.backend) {
          // Backend submission successful
          console.log('[API Bridge] Backend submission succeeded:', bridgeResult.backendResponse);
          Toast.success('Thank You!', SUCCESS_MESSAGE);
          showFormSuccess(form);
          return;
        }
      } catch (bridgeError) {
        console.warn('[API Bridge] Bridge preprocessing failed:', bridgeError);
        // Fall back to Firebase
      }
    }
    
    // ORIGINAL: Fallback to Firebase submission if bridge fails
    let result;
    if (formType === 'Newsletter Form') {
      // ... existing Firebase logic ...
    } else {
      // ... existing Firebase logic ...
    }
    
    // Rest of existing code continues...
    
  } catch (err) {
    // ... existing error handling ...
  }
}
```

---

## Field Mapping

The API Bridge automatically maps various field name variations to standard names:

### Supported Field Mappings

| Input Names | Standard Name | Example |
|---|---|---|
| name, fullname, full_name, full-name, clientName, signatoryName | **name** | "John Doe" |
| email, mail, email_address, clientEmail, sender_email | **email** | "john@example.com" |
| phone, mobile, telephone, tel, phone_number, phoneNumber, clientPhone | **phone** | "+91 8681003111" |
| message, description, requirement, comment, notes, inquiry, enquiry | **message** | "I need your services..." |
| leadType, lead_type, reason, category, service, project_type, inquiry_type | **leadType** | "Vendor Inquiry" |
| company, company_name, companyName | **company** | "Acme Corp" |
| aadhaar, aadhaar_number | **aadhaar** | "123456789012" |
| pan, pan_number | **pan** | "ABCDE1234F" |
| gst, gst_number | **gst** | "18AABCE1234F1Z5" |

### Lead Type Auto-Mapping

The bridge automatically determines the leadType based on form type:

| Form Type | Lead Type |
|---|---|
| vendor, vendor registration | Vendor Inquiry |
| subcontractor | Subcontractor Inquiry |
| partner | Partnership Inquiry |
| career | Career Inquiry |
| callback, call back | Callback Request |
| newsletter | Newsletter Subscription |
| quick | Quick Inquiry |
| contact, enquiry | Project Enquiry |
| (default) | General Inquiry |

---

## Form Structure Requirements

### Minimum Required Fields

Every form must have these fields for successful backend submission:

```html
<form id="contactform" data-form-handler="aaraa" data-form-type="contact">
  <!-- Required: Name -->
  <input type="text" name="name" placeholder="Full name" required>
  
  <!-- Required: Email -->
  <input type="email" name="email" placeholder="Email address" required>
  
  <!-- Required: Phone -->
  <input type="tel" name="phone" placeholder="Phone number" required>
  
  <!-- Required: Lead Type (for categorization) -->
  <select name="leadType" required>
    <option value="">Select reason for contact</option>
    <option value="Vendor Inquiry">Vendor Inquiry</option>
    <option value="General Inquiry">General Inquiry</option>
  </select>
  
  <!-- Recommended: Message -->
  <textarea name="message" placeholder="Your Message" required></textarea>
  
  <button type="submit">Send</button>
</form>
```

### Field Name Flexibility

The bridge handles various field names automatically:

```html
<!-- These all work - names are normalized to standard names -->
<input name="fullname">       <!-- → normalized to 'name' -->
<input name="email_address">  <!-- → normalized to 'email' -->
<input name="phone_number">   <!-- → normalized to 'phone' -->
<input name="msg">            <!-- → normalized to 'message' -->
```

---

## Backend Endpoint Specification

### Endpoint: POST /api/submit

**Request Format**: `multipart/form-data` (handled by multer)

**Required Fields**:
```
- name: string (required)
- email: string (required, valid email)
- phone: string (required)
- message: string (optional)
- leadType: string (optional, defaults to "General Inquiry")
```

**Example Request**:
```javascript
const formData = new FormData();
formData.append('name', 'John Doe');
formData.append('email', 'john@example.com');
formData.append('phone', '+91 8681003111');
formData.append('message', 'I am interested in your services');
formData.append('leadType', 'Vendor Inquiry');

fetch('/api/submit', {
  method: 'POST',
  body: formData
});
```

**Success Response** (200 OK):
```json
{
  "success": true,
  "message": "Your enquiry has been submitted successfully.",
  "formType": "contact"
}
```

**Error Response** (500 Internal Server Error):
```json
{
  "success": false,
  "message": "Failed to send email. Please try again later."
}
```

---

## Fixing contact-us.html

The main contact form is already configured correctly but verify these points:

### ✅ Current Status

```html
<form id="contactform" class="form-contact-us" method="post" 
      data-form-handler="aaraa" data-form-type="contact">
  
  <input type="text" name="name" id="name" 
         placeholder="*Full name" required>
  
  <input type="email" name="email" id="email" 
         placeholder="*Email address" required>
  
  <input type="tel" name="phone" id="phone" 
         placeholder="*Phone number" required>
  
  <select name="leadType" id="leadType" class="nice-select" required>
    <option value="">Select reason for contact</option>
    <option value="Vendor Inquiry">Want to Became a Vendor</option>
    <option value="Subcontractor Inquiry">Want to Became a Subcontractor</option>
    <option value="Partnership Inquiry">Want to Became a Potential Partner</option>
    <option value="General Inquiry">General Inquiry</option>
  </select>
  
  <textarea name="message" id="message" 
            placeholder="Your Message*" required></textarea>
  
  <button type="submit" class="tf-btn">
    <span>send message</span>
  </button>
</form>
```

### ✅ Why It Works Now

- ✅ All field names match API requirements (name, email, phone, leadType)
- ✅ `data-form-handler="aaraa"` triggers Firebase handler
- ✅ `data-form-type="contact"` identifies form type
- ✅ leadType select provides proper categorization
- ✅ API Bridge will intercept and route to `/api/submit`

---

## Testing and Verification

### Test 1: Check Bridge Availability

Open browser console and run:
```javascript
console.log(window.AARAA_BRIDGE.getStatus());
```

Expected output:
```
{
  version: "1.0.0",
  bridgeActive: true,
  fieldMappingsCount: 28,
  leadTypesCount: 8,
  timestamp: "2024-01-15T10:30:00.000Z"
}
```

### Test 2: Check Backend Connectivity

```javascript
window.AARAA_BRIDGE.testBackendConnectivity().then(result => {
  console.log('Backend status:', result);
});
```

Expected output (if server is running):
```
{
  connected: true,
  status: 200,
  timestamp: "2024-01-15T10:30:00.000Z"
}
```

### Test 3: Debug Form Data

Before submitting a form, run:
```javascript
// Create sample form data
const testData = {
  fullname: 'John Doe',           // Will map to 'name'
  email_address: 'john@test.com', // Will map to 'email'
  phone_number: '+91 8681003111', // Will map to 'phone'
  msg: 'Test message',            // Will map to 'message'
  reason: 'Vendor Inquiry'        // Will map to 'leadType'
};

window.AARAA_BRIDGE.debug(testData, 'Contact Form');
```

Expected table output showing normalized fields.

### Test 4: Submit Test Form

1. Go to contact-us.html
2. Fill in the contact form with test data
3. Open browser console (F12)
4. Submit the form
5. Look for success message in console:
   ```
   [API Bridge] Backend submission successful
   ```

---

## Error Handling

### Common Issues and Solutions

#### Issue: HTTP 405 Method Not Allowed

**Cause**: Form is submitting via action attribute instead of API Bridge

**Solution**:
- Ensure `data-form-handler="aaraa"` is present on form
- Check that app.js is loaded
- Verify api-bridge.js is included before app.js

#### Issue: Missing Email Values

**Cause**: Field names don't match backend expectations

**Solution**:
- Check field names in form match API requirements
- Or let API Bridge normalize them automatically
- Verify leadType is set

#### Issue: 405 error on /api/submit

**Cause**: Backend server not running or route not configured

**Solution**:
- Start server: `cd server && npm start`
- Check server logs for errors
- Verify Express app has POST /api/submit endpoint

#### Issue: Emails not being sent

**Cause**: SMTP credentials not configured

**Solution**:
- Check `.env` file has EMAIL_USER, EMAIL_PASS
- Verify SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
- Run `node server/server.js` and check for [DEBUG - SMTP Auth Success]

---

## Deployment Checklist

- [ ] api-bridge.js copied to js/ directory
- [ ] Script tag added to HTML: `<script src="js/api-bridge.js"></script>`
- [ ] app.js modified to call `window.AARAA_BRIDGE.preprocess()`
- [ ] Backend server running with /api/submit endpoint
- [ ] SMTP credentials configured in .env
- [ ] Test form submission on contact-us.html
- [ ] Verify email received in inbox
- [ ] Check browser console for no errors
- [ ] Test on mobile devices
- [ ] Verify fallback mechanism (test with server stopped)

---

## API Bridge Methods Reference

### `window.AARAA_BRIDGE.preprocess(formData, formType)`

Preprocesses and submits form data to backend.

**Parameters**:
- `formData`: FormData or Object with form fields
- `formType`: String identifying form type (e.g., "Contact Form")

**Returns**: Promise resolving to result object with `success`, `backend`, `data` properties

**Example**:
```javascript
const formData = new FormData(document.querySelector('form'));
const result = await window.AARAA_BRIDGE.preprocess(formData, 'Contact Form');
console.log('Submitted:', result.success);
```

### `window.AARAA_BRIDGE.testBackendConnectivity()`

Tests connection to backend health check endpoint.

**Returns**: Promise with `connected` (boolean) and `status` (HTTP status code)

### `window.AARAA_BRIDGE.debug(formData, formType)`

Logs normalized field mappings for debugging.

**Parameters**:
- `formData`: Form data to debug
- `formType`: Form type string

### `window.normalizeFieldNames(data)`

Standalone function to normalize field names.

**Parameters**:
- `data`: Object or FormData with fields

**Returns**: Object with normalized field names

### `window.ensureRequiredFields(data, formType)`

Adds missing required fields with defaults.

**Parameters**:
- `data`: Normalized data object
- `formType`: Form type for lead type mapping

**Returns**: Object with all required fields

---

## Performance Considerations

- **Field Mapping**: O(1) lookup using object keys
- **Retry Logic**: Exponential backoff (1s, 2s, 4s for retries)
- **FormData Creation**: Handles file uploads efficiently
- **Network**: Concurrent with Firebase submissions

---

## Security Features

✅ **CORS Protection**: Backend uses CORS middleware
✅ **Rate Limiting**: `/api/submit` limited to 10 requests/min per IP
✅ **Input Validation**: Server validates all fields
✅ **XSS Prevention**: FormData prevents injection
✅ **CSRF Protection**: Firebase handles CSRF tokens
✅ **SMTP Auth**: Uses environment variables (no hardcoded credentials)

---

## Support and Debugging

Enable debug mode by adding to console:

```javascript
window.location.search += '&firebase_debug=true';
location.reload();
```

Then check console for detailed logs:
- `[API Bridge]` - Bridge operations
- `[Firebase]` - Firebase form handler
- `[Email Service]` - Email notifications

---

## Version History

- **v1.0.0** - Initial release with field mapping, retry logic, and error handling

---

## Additional Resources

- Server documentation: `server/server.js`
- Firebase config: `js/firebase/firebase-config.js`
- Form handler: `js/firebase/app.js`
- Email service: `js/firebase/email-service.js`

