/**
 * AARAA Infrastructure - Unified Serverless Form Submission SDK
 * This script handles client-side validation, honeypot protection, file constraints,
 * and sends payloads to Firebase Cloud Functions v2.
 */

// Custom UI state helpers
function showFormLoading(form, text) {
  // Show spinner overlay inside the form container if available
  const overlay = form.querySelector('.form-loading-overlay');
  const textEl = form.querySelector('.form-loading-text');
  if (overlay && textEl) {
    textEl.innerText = text;
    overlay.style.display = 'flex';
  }

  // Also disable the submit button and show spinner inside it
  const btn = form.querySelector('button[type="submit"]');
  if (btn) {
    btn.disabled = true;
    const spinner = btn.querySelector('.submit-btn-loading');
    if (spinner) spinner.style.display = 'inline-block';
  }
}

function hideFormLoading(form) {
  const overlay = form.querySelector('.form-loading-overlay');
  if (overlay) overlay.style.display = 'none';

  const btn = form.querySelector('button[type="submit"]');
  if (btn) {
    btn.disabled = false;
    const spinner = btn.querySelector('.submit-btn-loading');
    if (spinner) spinner.style.display = 'none';
  }
}

function displayFieldError(form, fieldName, message) {
  const errorEl = document.getElementById(`${fieldName}-error`) || form.querySelector(`[name="${fieldName}"] ~ .form-error-msg`);
  if (errorEl) {
    errorEl.innerText = message;
    errorEl.style.display = 'block';
  }
}

function clearFormErrors(form) {
  form.querySelectorAll('.form-error-msg').forEach(el => {
    el.style.display = 'none';
    el.innerText = '';
  });
}

// Validation helpers
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Phone validator compatible with standard formats
function isValidPhone(phone) {
  return /^[6789]\d{9}$/.test(phone.replace(/[-+ ]/g, '').slice(-10));
}

function checkFileValidity(file, allowedExtensions, maxSizeMB) {
  if (!file) return { valid: false, message: "File is required." };
  
  const ext = '.' + file.name.split('.').pop().toLowerCase();
  if (!allowedExtensions.includes(ext)) {
    return { valid: false, message: `Invalid file type. Allowed: ${allowedExtensions.join(', ').toUpperCase()}` };
  }
  
  if (file.size > maxSizeMB * 1024 * 1024) {
    return { valid: false, message: `File size exceeds limit (${maxSizeMB}MB).` };
  }
  
  return { valid: true };
}

// Main Submit Form handler
async function handleFormSubmit(e) {
  e.preventDefault();
  const form = e.target;
  clearFormErrors(form);

  const formData = new FormData(form);

  // 1. Honeypot check (anti-spam)
  if (formData.get('_honeypot') && formData.get('_honeypot').toString().trim() !== '') {
    console.warn("Spam submission blocked via honeypot.");
    alert("Submission ignored.");
    return;
  }

  // Determine Form Type & Path
  const apiBase = 'https://aaraa-infra-web.web.app';
  const targetPath = isJoinForm ? `${apiBase}/api/submit-join` : `${apiBase}/api/submit`;

  // 2. Client-side field validations
  let hasErrors = false;
  
  // Dynamic validation based on form fields
  for (const [key, value] of formData.entries()) {
    if (key === '_honeypot') continue;
    
    // Check required fields
    const inputEl = form.querySelector(`[name="${key}"]`);
    if (inputEl && inputEl.hasAttribute('required') && (!value || value.toString().trim() === '')) {
      displayFieldError(form, key, "This field is required.");
      hasErrors = true;
    }

    // Validate email
    if (key === 'email' && value) {
      if (!isValidEmail(value.toString().trim())) {
        displayFieldError(form, key, "Please enter a valid email address.");
        hasErrors = true;
      }
    }

    // Validate phone number
    if ((key === 'phone' || key === 'mobile') && value) {
      if (!isValidPhone(value.toString().trim())) {
        displayFieldError(form, key, "Please enter a valid 10-digit mobile number.");
        hasErrors = true;
      }
    }
  }

  // File validations (only for Join/Upload Forms)
  const fileConfigs = {
    career: {
      required: ['resume'],
      allowed: {
        resume: ['.pdf', '.doc', '.docx'],
        portfolio: ['.pdf', '.docx', '.zip']
      },
      sizeMB: { resume: 10, portfolio: 15 }
    },
    partnership: {
      required: ['company_profile', 'capability_statement'],
      allowed: {
        company_profile: ['.pdf'],
        capability_statement: ['.pdf'],
        brochure: ['.pdf', '.zip']
      },
      sizeMB: { company_profile: 15, capability_statement: 15, brochure: 15 }
    },
    jv: {
      required: ['company_profile', 'reg_certificate', 'financial_doc'],
      allowed: {
        company_profile: ['.pdf'],
        reg_certificate: ['.pdf'],
        financial_doc: ['.pdf']
      },
      sizeMB: { company_profile: 15, reg_certificate: 10, financial_doc: 15 }
    },
    subcontractor: {
      required: ['gst_cert', 'pan_copy', 'company_profile', 'work_orders'],
      allowed: {
        gst_cert: ['.pdf', '.jpg', '.jpeg', '.png'],
        pan_copy: ['.pdf', '.jpg', '.jpeg', '.png'],
        company_profile: ['.pdf'],
        work_orders: ['.pdf', '.zip'],
        safety_cert: ['.pdf']
      },
      sizeMB: { gst_cert: 10, pan_copy: 10, company_profile: 15, work_orders: 20, safety_cert: 10 }
    },
    internship: {
      required: ['resume', 'bonafide_cert', 'transcript'],
      allowed: {
        resume: ['.pdf', '.doc', '.docx'],
        bonafide_cert: ['.pdf', '.jpg', '.jpeg', '.png'],
        transcript: ['.pdf']
      },
      sizeMB: { resume: 10, bonafide_cert: 10, transcript: 10 }
    },
    vendor: {
      required: ['incorporationCert', 'identityProof', 'addressProof'],
      allowed: {
        incorporationCert: ['.pdf'],
        identityProof: ['.pdf', '.jpg', '.jpeg', '.png'],
        addressProof: ['.pdf', '.jpg', '.jpeg', '.png'],
        tradeLicense: ['.pdf', '.jpg', '.jpeg', '.png']
      },
      sizeMB: { incorporationCert: 10, identityProof: 10, addressProof: 10, tradeLicense: 10 }
    }
  };

  if (isJoinForm && fileConfigs[formType]) {
    const config = fileConfigs[formType];
    for (const [fieldName, allowedExts] of Object.entries(config.allowed)) {
      const file = formData.get(fieldName);
      const isRequired = config.required.includes(fieldName);
      const limitMB = config.sizeMB[fieldName] || 10;

      if (file && file.size > 0) {
        const check = checkFileValidity(file, allowedExts, limitMB);
        if (!check.valid) {
          displayFieldError(form, fieldName, check.message);
          hasErrors = true;
        }
      } else if (isRequired) {
        displayFieldError(form, fieldName, "This document is mandatory.");
        hasErrors = true;
      }
    }
  }

  if (hasErrors) {
    const firstError = form.querySelector('.form-error-msg[style*="display: block"]');
    if (firstError) {
      firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    return;
  }

  // 3. Submit Payload to serverless Firebase Function API
  try {
    showFormLoading(form, isJoinForm ? "Uploading and submitting application..." : "Submitting your enquiry...");
    
    // Add Client Metadata
    formData.append('sourceUrl', window.location.href);
    formData.append('pageTitle', document.title);

    let fetchOptions = {};
    if (isJoinForm) {
      // Send as multipart/form-data directly
      fetchOptions = {
        method: 'POST',
        body: formData
      };
    } else {
      // Send as regular JSON
      const jsonPayload = {};
      for (const [key, value] of formData.entries()) {
        if (key === '_honeypot') continue;
        jsonPayload[key] = value.toString().trim();
      }
      fetchOptions = {
        method: 'POST',
        body: JSON.stringify(jsonPayload),
        headers: {
          'Content-Type': 'application/json'
        }
      };
    }

    const response = await fetch(targetPath, fetchOptions);
    hideFormLoading(form);

    let result = {};
    const responseContentType = response.headers.get("content-type");
    if (responseContentType && responseContentType.includes("application/json")) {
      result = await response.json();
    } else {
      const textRes = await response.text();
      throw new Error(textRes || `Server returned status ${response.status}`);
    }

    if (!response.ok) {
      throw new Error(result.message || "Failed to process form submission.");
    }

    // Success Action
    form.dispatchEvent(new CustomEvent(`${formType}-form-success`, { detail: result }));
    form.dispatchEvent(new CustomEvent('career-form-success', { detail: { email: result.email || '' } })); // compatibility fallback
    form.dispatchEvent(new CustomEvent('form-submit-success', { detail: { formType, result } }));

    alert(`Success! Application ID: ${result.applicationId || 'Received'}\n${result.message}`);
    form.reset();
    
    // Reset file selected indicators
    form.querySelectorAll('.file-selected-name').forEach(el => el.style.display = 'none');

  } catch (submitErr) {
    hideFormLoading(form);
    console.error("Submission failed:", submitErr);

    form.dispatchEvent(new CustomEvent(`${formType}-form-error`, { detail: { error: submitErr.message } }));
    form.dispatchEvent(new CustomEvent('career-form-error', { detail: { error: submitErr.message } })); // compatibility fallback
    form.dispatchEvent(new CustomEvent('form-submit-error', { detail: { formType, error: submitErr.message } }));

    alert("Submission Failed: " + submitErr.message);
  }
}

// Bind upload labels updates and form events
document.addEventListener('DOMContentLoaded', () => {
  // Bind change events to all file inputs to show selected filenames
  document.querySelectorAll('input[type="file"]').forEach(input => {
    input.addEventListener('change', (e) => {
      const file = e.target.files[0];
      const nameEl = e.target.closest('.file-upload-wrapper')?.querySelector('.file-selected-name') || 
                     document.getElementById(`${e.target.name}-selected`);
      if (file && nameEl) {
        nameEl.innerText = `Selected: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
        nameEl.style.display = 'block';
      } else if (nameEl) {
        nameEl.style.display = 'none';
      }
    });
  });

  // Bind Submit listener to all Forms
  document.querySelectorAll('form[data-form-type]').forEach(form => {
    form.addEventListener('submit', handleFormSubmit);
  });

  // Legacy mappings: bind standard contact form IDs if present
  const legacyContactForm = document.getElementById('contactform') || document.getElementById('contactForm');
  if (legacyContactForm && !legacyContactForm.dataset.formType) {
    legacyContactForm.dataset.formType = 'contact';
    legacyContactForm.addEventListener('submit', handleFormSubmit);
  }

  const legacyCallbackForm = document.getElementById('callbackForm') || document.getElementById('callbackform');
  if (legacyCallbackForm && !legacyCallbackForm.dataset.formType) {
    legacyCallbackForm.dataset.formType = 'callback';
    legacyCallbackForm.addEventListener('submit', handleFormSubmit);
  }
});
