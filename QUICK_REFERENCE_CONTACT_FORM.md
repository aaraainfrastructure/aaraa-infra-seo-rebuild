# Quick Reference: Contact Form Fixes

## Problem
Contact form at `/contact-us.html` was returning: **"Cannot POST /contact-us.html"**

## Root Causes (5 issues)
1. ❌ Form wasn't recognized by centralized handler
2. ❌ Email field named `mail` instead of `email`
3. ❌ No `leadType` field to categorize inquiry
4. ❌ Phone input was `type="number"` instead of `type="tel"`
5. ❌ Checkbox had wrong name (`save` instead of `accept_terms`)

## Changes Made

### File: `contact-us.html` (Lines 451-489)

| Issue | Before | After |
|-------|--------|-------|
| **Handler** | `<form id="contactform" ... method="post" data-form-type="contact">` | `<form id="contactform" ... method="post" data-form-handler="aaraa" data-form-type="contact">` |
| **Email field** | `<input type="email" name="mail" id="mail">` | `<input type="email" name="email" id="email" required>` |
| **Phone field** | `<input type="number" name="phone">` | `<input type="tel" name="phone" required>` |
| **Subject dropdown** | Non-standard `<div class="nice-select">` structure | Proper `<select name="leadType" required>` with options |
| **Checkbox** | `<input type="checkbox" name="save">` | `<input type="checkbox" name="accept_terms" required>` |

## Backend Support
✅ Server already configured correctly:
- Multer parsing FormData
- `/api/submit` endpoint ready
- Email sending configured
- No backend changes needed

## Form Data Submitted to Backend

```javascript
{
  "name": "User Name",
  "email": "user@example.com",        // ← Fixed from "mail"
  "phone": "9123456789",
  "leadType": "Vendor Inquiry",       // ← New field
  "message": "Message text",
  "accept_terms": "on"
}
```

## Email Subject Generated
```
[AARAA Website] Project Enquiry | User Name
```

## Form Submission Flow

```
Form Submit
    ↓
aaraa-modals.js (detects via data-form-handler="aaraa")
    ↓
Client-side Validation ✅
    ↓
POST /api/submit
    ↓
server.js (/api/submit endpoint)
    ↓
multer (parses FormData)
    ↓
Email sent via Nodemailer ✅
    ↓
Response: { success: true, message: "..." }
    ↓
Success Toast & Form Reset
```

## Required Field Values

| Field | Type | Required | Example |
|-------|------|----------|---------|
| name | text | ✅ | "John Doe" |
| email | email | ✅ | "john@example.com" |
| phone | tel | ✅ | "9123456789" |
| leadType | select | ✅ | "Vendor Inquiry" |
| message | textarea | ✅ | "I want to inquire about..." |
| accept_terms | checkbox | ✅ | checked |

## Testing

1. Navigate to: `/contact-us.html`
2. Fill all form fields
3. Click "Send Message"
4. Expected: ✅ Success notification
5. Verify: Email received at `info@aaraainfrastructure.com`

## Validation Rules

### Phone Number
- Minimum 10 digits
- Must start with 6, 7, 8, or 9
- Accepts formatting: `9123456789`, `91-234-567-89`, `+91 9123456789`

### Email
- Standard format: `user@domain.com`
- Must contain @ and .

### Aadhaar (if needed)
- Exactly 12 digits

### PAN (if needed)
- Format: ABCDE1234F (5 letters, 4 numbers, 1 letter)

### GST (if needed)
- 15-character GST format

## Success Indicators

✅ Form has `data-form-handler="aaraa"`  
✅ Email field is `name="email"`  
✅ Phone field is `type="tel"`  
✅ LeadType select exists with options  
✅ Accept terms checkbox is required  
✅ Form submits without page reload  
✅ Success toast appears  
✅ Email received at backend  

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Form submits normally instead of via handler | Ensure `data-form-handler="aaraa"` is present |
| Email not received | Check that field is named `email` not `mail` |
| Wrong email subject | Ensure `leadType` select has proper values |
| Phone validation fails | Use `type="tel"` not `type="number"` |
| Form won't submit | Check all required fields are filled |
| Checkbox not working | Ensure `required` attribute is present |

## Files Modified

- ✅ `contact-us.html` (Lines 451-489)

## Files Not Modified

- ✅ `server/server.js` (No changes needed - working correctly)
- ✅ `js/aaraa-modals.js` (No changes needed - handler works)
- ✅ `js/firebase/app.js` (No changes needed)
- ✅ All CSS files (No changes needed)

## Status

**✅ COMPLETE AND TESTED**

All issues fixed. Form now:
- ✅ Recognizes and uses centralized handler
- ✅ Submits to correct `/api/submit` endpoint
- ✅ Sends all required fields with correct names
- ✅ Backend receives and processes data
- ✅ Emails generated with proper subject and content
- ✅ User receives success notification

**Ready for production use.**
