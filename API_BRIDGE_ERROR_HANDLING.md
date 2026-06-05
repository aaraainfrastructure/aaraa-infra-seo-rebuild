# API Bridge - Error Handling & Recovery

## Overview

This document explains every error scenario and how the API Bridge handles it, including retry logic, fallback mechanisms, and user-facing messages.

---

## Error Recovery Architecture

```
Form Submission
    ↓
[API Bridge Validation] ← Catches field errors
    ↓
[Backend Attempt #1] ← Network attempt
    ↓ (failure)
[Retry #2: 1s delay]
    ↓ (failure)
[Retry #3: 2s delay]
    ↓ (failure)
[Retry #4: 4s delay]
    ↓ (failure)
[Fallback to Firebase] ← Graceful recovery
    ↓
[Success or Firebase Error]
```

---

## Error Categories & Handling

### 1. VALIDATION ERRORS (Client-Side)

#### Error: Missing Required Field

**Scenario**: User submits form without filling "name" field

**Error Flow**:
```
[API Bridge] Validation check
  ↓
Missing "name" field detected
  ↓
User-facing: "Validation Error: Name is required"
  ↓
Form not submitted, user corrects input
```

**Console Output**:
```
[Validation Error] Name is required
[Form] Cannot submit - please fix errors
```

**User Experience**:
- ❌ Form shows red border around required field
- ❌ Toast notification: "Validation Error"
- ❌ Form does NOT submit
- ✅ User corrects and retries

**Code Handling**:
```javascript
const errors = validateForm(form)
if (errors.length > 0) {
  errors.forEach(({ field, message }) => showFieldError(field, message))
  Toast.error('Validation Error', errors.length === 1 ? errors[0].message : `${errors.length} fields need attention`)
  return  // Stop submission
}
```

---

#### Error: Invalid Email Format

**Scenario**: User enters "not-an-email" in email field

**Error Flow**:
```
[API Bridge] Email validation
  ↓
Invalid format detected (no @ symbol)
  ↓
User-facing: "Please enter a valid email address"
  ↓
Form shows error, blocks submission
```

**Console Output**:
```
[Validation Error] Invalid email format
[Form] Email must be a valid email address
```

**Recovery**:
- User corrects email to valid format
- Form submits successfully

**Code**:
```javascript
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
if (!emailRegex.test(email)) {
  showFieldError('email', 'Please enter a valid email address')
}
```

---

### 2. NETWORK ERRORS (Connection Issues)

#### Error: No Internet Connection

**Scenario**: User submits form while offline

**Error Flow**:
```
[API Bridge] Attempts POST to /api/submit
  ↓
Network call fails: TypeError "fetch failed"
  ↓
Retry attempt #1 (1s delay)
  ↓
Still offline - connection error
  ↓
Retry attempt #2 (2s delay)
  ↓
Still offline - connection error
  ↓
Retry attempt #3 (4s delay)
  ↓
Still offline - exhausted retries
  ↓
[Fallback to Firebase] with offline persistence
  ↓
Firebase stores locally, syncs when online
```

**Console Output**:
```
[API Bridge] Submitting to /api/submit
  attempt: 1
  maxAttempts: 4

[API Bridge] Backend submission error
  error: "Network request failed"
  attempt: 1

[API Bridge] Retrying in 1000ms...

[API Bridge] Backend submission error
  error: "Network request failed"
  attempt: 2

[API Bridge] Retrying in 2000ms...

[API Bridge] Backend submission error
  error: "Network request failed"
  attempt: 3

[API Bridge] Retrying in 4000ms...

[API Bridge] Backend submission error
  error: "Network request failed"
  attempt: 4

[API Bridge] Fatal bridge error
  error: "Network request failed"
  formType: "Contact Form"

[handleFormSubmit] Bridge preprocessing failed, falling back to Firebase
  error: "Network request failed"

[Firebase] Submitting form to Firestore (offline mode)
  [Data stored locally - will sync when online]
```

**User Experience**:
- ⏳ Loading spinner shows for ~7 seconds (1+2+4s retries)
- ✅ Success message appears: "Your information will be sent when connection is restored"
- ✅ Data is stored locally
- ✅ Syncs automatically when online

**Firebase Offline Persistence**:
```javascript
// Firebase automatically handles offline data
db.enablePersistence().then(() => {
  console.log('Persistence enabled - offline data will sync when online')
}).catch((err) => {
  console.warn('Persistence not available:', err.code)
})
```

---

#### Error: Server Not Running

**Scenario**: Backend server stopped or not listening on port 3001

**Error Flow**:
```
[API Bridge] Attempts POST to http://localhost:3001/api/submit
  ↓
Connection refused: ECONNREFUSED
  ↓
Retry #1: Same error
  ↓
Retry #2: Same error
  ↓
Retry #3: Same error
  ↓
All retries exhausted
  ↓
[Fallback to Firebase]
```

**Console Output**:
```
[API Bridge] Backend submission error
  error: "Error: connect ECONNREFUSED 127.0.0.1:3001"
  attempt: 1

[API Bridge] Retrying in 1000ms...

[API Bridge] Backend submission error
  error: "Error: connect ECONNREFUSED 127.0.0.1:3001"
  attempt: 4

[API Bridge] Fatal bridge error
  error: "API Error: 500 Internal Server Error"

[handleFormSubmit] Bridge preprocessing failed, falling back to Firebase
  error: "connect ECONNREFUSED"
```

**User Experience**:
- ⏳ 7 second delay while retrying
- ✅ Form still submits via Firebase
- ✅ Email still sent (via Firebase EmailJS)
- ✅ Data stored in Firestore

**Solution**:
```bash
# Check if server is running
curl http://localhost:3001/api/health

# Start server if not running
cd server
npm start
```

---

### 3. BACKEND ERRORS (Server Issues)

#### Error: SMTP Configuration Missing

**Scenario**: Backend has no SMTP credentials configured

**Error Flow**:
```
[API Bridge] Sends POST to /api/submit
  ↓
Server receives request ✓
  ↓
Request body parsed ✓
  ↓
Attempts nodemailer.sendMail()
  ↓
Error: SMTP_USER or SMTP_PASS missing
  ↓
Response: {success: false, message: "Failed to send email"}
  ↓
API Bridge receives error response
  ↓
Attempts retry #1
  ↓
Same error (SMTP still misconfigured)
  ↓
Exhausts retries, falls back to Firebase
```

**Console Output** (Server):
```
[DEBUG - Incoming Request to /api/submit]:
{
  "name": "John Doe",
  "email": "john@test.com",
  ...
}

[DEBUG - SMTP Auth Error]: Error: Invalid login: 535-5.7.8 Username and password not accepted

[DEBUG - Full Mail Error Stack]: SmtpError at...
  Error: Invalid login credentials
```

**Console Output** (Browser):
```
[API Bridge] Backend submission error
  error: "API Error: 500 Internal Server Error"

[handleFormSubmit] Bridge preprocessing failed, falling back to Firebase
```

**User Experience**:
- ⏳ 7 second delay
- ✅ Form submits (fallback to Firebase)
- ⚠️ Backend email fails, but Firebase email works
- ✅ Data saved to Firestore

**Solution**:
```bash
# 1. Check .env file
cat server/.env

# 2. Verify SMTP credentials
echo "SMTP_USER: $SMTP_USER"
echo "SMTP_PASS: $SMTP_PASS"

# 3. Restart server
npm restart

# 4. Check for SMTP Auth Success in logs
npm start | grep "SMTP Auth Success"
```

---

#### Error: Database Connection Failed

**Scenario**: Firestore not accessible (network issue between server and Firebase)

**Error Flow**:
```
[API Bridge] → Server ✓
Server → Firestore ✗ (connection refused)
  ↓
Error: Firestore connection failed
  ↓
But Nodemailer still sends email ✓
  ↓
Response: {success: true, message: "..."}
```

**Note**: This is **NOT** an error because:
- Email is still sent successfully (via Nodemailer)
- Form data was processed
- Firestore sync happens later

---

### 4. RETRY LOGIC & EXPONENTIAL BACKOFF

The API Bridge implements smart retry logic:

```javascript
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;  // Start at 1 second

// Attempt 1: Immediate (0ms)
// Failure
// Wait 1000ms (1 second)

// Attempt 2: 1000ms delay
// Failure
// Wait 2000ms (2 seconds)

// Attempt 3: 2000ms delay
// Failure
// Wait 4000ms (4 seconds)

// Attempt 4: 4000ms delay
// Failure
// Give up, fallback to Firebase

// Total wait time: 1000 + 2000 + 4000 = 7000ms (7 seconds)
```

**Benefits**:
- ✅ Handles temporary network glitches
- ✅ Prevents server overload (exponential backoff)
- ✅ Gives network time to recover
- ✅ Graceful degradation to Firebase

**Code**:
```javascript
const delay = RETRY_DELAY_MS * Math.pow(2, retryCount);
// Attempt 0: 1000 * 2^0 = 1000ms
// Attempt 1: 1000 * 2^1 = 2000ms
// Attempt 2: 1000 * 2^2 = 4000ms
```

---

### 5. FIELD MAPPING ERRORS

#### Error: Unrecognized Field Name

**Scenario**: Form uses field name not in mapping (e.g., "fullname_en" for English)

**Error Flow**:
```
Form submitted with field: fullname_en
  ↓
[API Bridge] Field mapping lookup
  ↓
Not found in FIELD_MAPPING
  ↓
Field kept as-is: fullname_en
  ↓
Backend receives field (may not process it)
  ↓
Email sent with field visible
```

**Console Output**:
```
[API Bridge] Step 1 - Field names normalized
  originalFields: ["fullname_en", "email", "phone"]
  normalizedFields: ["fullname_en", "email", "phone"]
  // Note: fullname_en NOT normalized because not in mapping
```

**Solution**:
Add to `FIELD_MAPPING` in api-bridge.js:
```javascript
'fullname_en': 'name',
'fullname_es': 'name',
// etc.
```

---

#### Error: Required Field Missing After Mapping

**Scenario**: Form submitted with field "mail" (gets mapped to "email") but no actual email provided

**Error Flow**:
```
Form field: mail = ""  (empty)
  ↓
[API Bridge] Maps to: email = ""
  ↓
[ensureRequiredFields] Detects empty email
  ↓
Sets default: email = "noreply@aaraainfrastructure.com"
  ↓
Submission continues
  ↓
Email received BUT reply-to is wrong
```

**Console Output**:
```
[API Bridge] Missing email field
  [Field normalized to empty value]
  [Setting default: noreply@aaraainfrastructure.com]
```

**User Experience**:
- ✅ Form submits (doesn't block on empty email)
- ⚠️ Reply-to address is generic default
- ✅ Fallback email address provided

**Best Practice**: Require email field in HTML:
```html
<input type="email" name="email" required>
<!-- This prevents empty email before API Bridge even runs -->
```

---

## User-Facing Error Messages

### Success Messages

#### Backend Success (API Bridge)
```
"Thank You!
Your enquiry has been submitted successfully.
Our team will contact you shortly."

Duration: 5 seconds
Modal: Yes
Toast: Yes (green checkmark)
```

#### Firebase Success (Fallback)
```
"Thank You!
Your enquiry has been submitted successfully.
Our team will contact you shortly."

Duration: 5 seconds
Modal: Yes
Toast: Yes (green checkmark)
Same as backend success
```

#### Offline Success
```
"Saved Offline
Your information will be sent when connection is restored."

Duration: 5 seconds
Modal: No (toast only)
Toast: Yes (blue info icon)
Data syncs automatically when online
```

---

### Error Messages

#### Validation Error
```
"Validation Error
[Field name] is required"

Toast: Yes (red X)
Form: Not submitted
Action: User fixes field and retries
```

#### Network Error
```
"Submission Failed
Network error. Please check your internet connection and try again."

Toast: Yes (red X)
Retries: 3 automatic retries before showing this
Fallback: Firebase attempt after this message
```

#### Backend Error
```
"Submission Failed
Failed to send email. Please try again later."

Toast: Yes (red X)
Retries: Already did 3 retries
Fallback: Tries Firebase
User action: Can retry or contact support
```

#### Server Not Running
```
"Submission Failed
Connection refused. Please try again later."

Toast: Yes (red X)
Fallback: Firebase will handle submission
User action: Wait for server restart or contact support
```

---

## Debugging Error Scenarios

### Enable Debug Mode

```javascript
// Add to browser console
window.location.search += '&firebase_debug=true';
location.reload();
```

Then check console for detailed logs:
```
[API Bridge] Submitting to /api/submit
  formType: "Contact Form"
  attempt: 1/4
  fields: ["name", "email", "phone", "message", "leadType"]

[API Bridge] Backend submission error
  formType: "Contact Form"
  attempt: 1/4
  error: "Error message here"

[API Bridge] Retrying in 1000ms...
```

---

### Test Error Scenarios

#### Simulate Network Error
```javascript
// Temporarily disable API Bridge
window.AARAA_BRIDGE = null;

// Submit form - should fall back to Firebase
// Check console for fallback message
```

#### Simulate Missing Field
```javascript
// Create form without required field
const form = document.createElement('form');
form.innerHTML = '<input type="text" name="name">';
// Missing: email, phone

// Try to submit
// Should show validation error
```

#### Simulate Server Error
```bash
# Stop the server
# cd server && npm stop

# Submit form
# Watch for retries in console
# Should fall back to Firebase after 7 seconds
```

---

## Error Recovery Flow Chart

```
                    Form Submitted
                           ↓
                   ┌─────────────────┐
                   │ Validate Input  │
                   └────────┬────────┘
                            ↓ (valid)
                   ┌─────────────────┐
                   │ Try API Bridge  │
                   │ (Backend POST)  │
                   └────────┬────────┘
                            ↓
                ┌───────────────────────┐
                │ Success (200 OK)?     │
                └───────┬───────────────┘
                        │
            ┌───────────┴────────────┐
            ↓ YES                    ↓ NO
      ┌──────────────┐         ┌──────────────┐
      │ Show Success │         │ Retry? (1-4) │
      │ Return       │         └──────┬───────┘
      └──────────────┘                ↓
                              ┌─────────────────┐
                              │ Max Retries     │
                              │ Exhausted?      │
                              └────────┬────────┘
                                       ↓ YES
                              ┌─────────────────┐
                              │ Fallback to     │
                              │ Firebase        │
                              └────────┬────────┘
                                       ↓
                              ┌─────────────────┐
                              │ Firebase Send   │
                              │ Email           │
                              └────────┬────────┘
                                       ↓
                              ┌─────────────────┐
                              │ Show Result     │
                              │ (Success/Error) │
                              └─────────────────┘
```

---

## Monitoring & Alerting

### What to Monitor

1. **Submission Success Rate**
   ```
   Ideal: > 99% of forms submitted successfully
   Alert: If < 95% for 1 hour
   ```

2. **Backend Response Time**
   ```
   Ideal: < 1 second
   Alert: If > 5 seconds consistently
   ```

3. **Retry Rate**
   ```
   Ideal: < 1% of submissions need retry
   Alert: If > 5% need retry
   ```

4. **Firebase Fallback Rate**
   ```
   Ideal: < 1% fallback to Firebase
   Alert: If > 5% fall back
   ```

### Console Logs to Watch

```javascript
// Success
"[API Bridge] Backend submission successful"

// Failure with recovery
"[API Bridge] Backend submission error"
"[API Bridge] Retrying in Xms..."
"[handleFormSubmit] Bridge preprocessing failed, falling back to Firebase"

// Critical error
"[API Bridge] Fatal bridge error"
```

---

## Performance During Errors

| Scenario | Total Time | User Experience |
|----------|-----------|-----------------|
| Successful backend submit | 1-2s | Fast, smooth |
| 1 retry needed | 3-4s | Slight delay visible |
| 4 retries exhausted | 7s | Loading spinner shown |
| Firebase fallback | 2-3s | Slower than backend |
| Offline with persistence | 2s | Immediate confirmation |

---

## Summary

The API Bridge handles errors gracefully:

✅ **Validates early** - Catches errors before network attempt
✅ **Retries smart** - Exponential backoff for transient errors
✅ **Fallback ready** - Firebase handles permanent failures
✅ **User-friendly** - Clear messages for all scenarios
✅ **Data preservation** - No data loss in any scenario
✅ **Transparent logging** - Debug console shows everything

**Result**: Robust form submission system that works even when things go wrong!

