/**
 * AARAA Infrastructure — Universal Form Submission Handler
 *
 * Handles ALL form submissions across every page. Sends payload to:
 *   - /api/forms       → Processes all form types (JSON or Multipart)
 *   - /api/config      → Fetches dynamic Turnstile Site Key configuration
 *
 * All submissions are saved to: Firebase Firestore / Local Storage (persistence first)
 * All submissions are emailed to: aaraainfrastructure@gmail.com
 */

/* ============================================================
   Turnstile State & Initialization
   ============================================================ */
let turnstileSiteKey = null;
const turnstileWidgets = new Map();

async function loadConfigAndInitTurnstile() {
  try {
    const response = await fetch('/api/config');
    if (response.ok) {
      const data = await response.json();
      if (data.turnstileSiteKey) {
        turnstileSiteKey = data.turnstileSiteKey;
        renderAllTurnstiles();
      }
    }
  } catch (err) {
    console.error("Failed to load Turnstile configuration:", err);
  }
}

function renderAllTurnstiles() {
  if (!turnstileSiteKey || !window.turnstile) return;
  document.querySelectorAll('.cf-turnstile-placeholder').forEach(el => {
    if (!turnstileWidgets.has(el)) {
      try {
        const widgetId = window.turnstile.render(el, {
          sitekey: turnstileSiteKey,
          theme: 'light',
          callback: function(token) {
            const form = el.closest('form');
            if (form) {
              const errorEl = form.querySelector('.cf-turnstile-error');
              if (errorEl) {
                errorEl.style.display = 'none';
                errorEl.innerText = '';
              }
            }
          }
        });
        turnstileWidgets.set(el, widgetId);
      } catch (err) {
        console.error("Turnstile rendering failed for element:", el, err);
      }
    }
  });
}

function pollTurnstile() {
  if (window.turnstile) {
    renderAllTurnstiles();
  } else {
    setTimeout(pollTurnstile, 100);
  }
}

window.onloadTurnstileCallback = function() {
  renderAllTurnstiles();
};

/* ============================================================
   UI State Helpers
   ============================================================ */
function showFormLoading(form, text) {
  const overlay = form.querySelector('.form-loading-overlay');
  const textEl  = form.querySelector('.form-loading-text');
  if (overlay && textEl) {
    textEl.innerText = text;
    overlay.style.display = 'flex';
  }
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
  const errorEl = document.getElementById(`${fieldName}-error`) ||
                  form.querySelector(`[name="${fieldName}"] ~ .form-error-msg`);
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

/* ============================================================
   Validation Helpers
   ============================================================ */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

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

/* ============================================================
   Form Type Routing & Config
   ============================================================ */
const JOIN_FORM_TYPES = ['career', 'careers', 'partnership', 'jv', 'subcontractor', 'internship', 'vendor'];

const FILE_CONFIGS = {
  careers: {
    required: ['resume'],
    allowed:  { resume: ['.pdf', '.doc', '.docx'], portfolio: ['.pdf', '.doc', '.docx'] },
    sizeMB:   { resume: 5, portfolio: 5 }
  },
  career: {
    required: ['resume'],
    allowed:  { resume: ['.pdf', '.doc', '.docx'], portfolio: ['.pdf', '.doc', '.docx'] },
    sizeMB:   { resume: 5, portfolio: 5 }
  },
  partnership: {
    required: ['company_profile', 'capability_statement'],
    allowed:  { company_profile: ['.pdf', '.doc', '.docx'], capability_statement: ['.pdf', '.doc', '.docx'], brochure: ['.pdf', '.doc', '.docx'] },
    sizeMB:   { company_profile: 5, capability_statement: 5, brochure: 5 }
  },
  jv: {
    required: ['company_profile', 'reg_certificate', 'financial_doc'],
    allowed:  { company_profile: ['.pdf', '.doc', '.docx'], reg_certificate: ['.pdf', '.doc', '.docx'], financial_doc: ['.pdf', '.doc', '.docx'] },
    sizeMB:   { company_profile: 5, reg_certificate: 5, financial_doc: 5 }
  },
  subcontractor: {
    required: ['gst_cert', 'pan_copy', 'company_profile', 'work_orders'],
    allowed:  { gst_cert: ['.pdf', '.doc', '.docx'], pan_copy: ['.pdf', '.doc', '.docx'], company_profile: ['.pdf', '.doc', '.docx'], work_orders: ['.pdf', '.doc', '.docx'], safety_cert: ['.pdf', '.doc', '.docx'] },
    sizeMB:   { gst_cert: 5, pan_copy: 5, company_profile: 5, work_orders: 5, safety_cert: 5 }
  },
  internship: {
    required: ['resume', 'bonafide_cert', 'transcript'],
    allowed:  { resume: ['.pdf', '.doc', '.docx'], bonafide_cert: ['.pdf', '.doc', '.docx'], transcript: ['.pdf', '.doc', '.docx'] },
    sizeMB:   { resume: 5, bonafide_cert: 5, transcript: 5 }
  },
  vendor: {
    required: ['incorporationCert', 'identityProof', 'addressProof'],
    allowed:  { incorporationCert: ['.pdf', '.doc', '.docx'], identityProof: ['.pdf', '.doc', '.docx'], addressProof: ['.pdf', '.doc', '.docx'], tradeLicense: ['.pdf', '.doc', '.docx'] },
    sizeMB:   { incorporationCert: 5, identityProof: 5, addressProof: 5, tradeLicense: 5 }
  }
};

/* ============================================================
   Main Form Submit Handler
   ============================================================ */
async function handleFormSubmit(e) {
  e.preventDefault();
  const form = e.target;
  clearFormErrors(form);

  let formType = (form.dataset.formType || 'contact').toLowerCase();
  if (formType === 'enquiry' || formType === 'quickenquiry') formType = 'enquiry';
  if (formType === 'call-me-back' || formType === 'callmeback') formType = 'callback';
  if (formType === 'career') formType = 'careers';

  const isJoinForm = JOIN_FORM_TYPES.includes(formType);
  const formData = new FormData(form);

  if (formData.get('_honeypot') && formData.get('_honeypot').toString().trim() !== '') {
    console.warn("Spam submission blocked via honeypot.");
    return;
  }

  let hasErrors = false;
  for (const [key, value] of formData.entries()) {
    if (key === '_honeypot') continue;
    const inputEl = form.querySelector(`[name="${key}"]`);
    if (inputEl && inputEl.hasAttribute('required') && (!value || value.toString().trim() === '')) {
      displayFieldError(form, key, "This field is required.");
      hasErrors = true;
    }
    if (key === 'email' && value && !isValidEmail(value.toString().trim())) {
      displayFieldError(form, key, "Please enter a valid email address.");
      hasErrors = true;
    }
    if ((key === 'phone' || key === 'mobile' || key === 'clientPhone') && value) {
      if (!isValidPhone(value.toString().trim())) {
        displayFieldError(form, key, "Please enter a valid 10-digit mobile number.");
        hasErrors = true;
      }
    }
  }

  if (isJoinForm && FILE_CONFIGS[formType]) {
    const config = FILE_CONFIGS[formType];
    for (const [fieldName, allowedExts] of Object.entries(config.allowed)) {
      const file       = formData.get(fieldName);
      const isRequired = config.required.includes(fieldName);
      const limitMB    = config.sizeMB[fieldName] || 5;
      if (file && file.size > 0) {
        const check = checkFileValidity(file, allowedExts, limitMB);
        if (!check.valid) { displayFieldError(form, fieldName, check.message); hasErrors = true; }
      } else if (isRequired) {
        displayFieldError(form, fieldName, "This document is mandatory.");
        hasErrors = true;
      }
    }
  }

  const placeholder = form.querySelector('.cf-turnstile-placeholder');
  let turnstileToken = formData.get('cf-turnstile-response');

  if (!turnstileToken && placeholder && turnstileWidgets.has(placeholder)) {
    const widgetId = turnstileWidgets.get(placeholder);
    try {
      turnstileToken = window.turnstile.getResponse(widgetId);
    } catch (err) {
      console.warn("Could not retrieve Turnstile token:", err);
    }
  }

  if (!turnstileToken) {
    let errorEl = form.querySelector('.cf-turnstile-error');
    if (!errorEl) {
      errorEl = document.createElement('div');
      errorEl.className = 'form-error-msg cf-turnstile-error';
      errorEl.style.color = '#ed2f39';
      errorEl.style.fontSize = '12px';
      errorEl.style.marginTop = '8px';
      if (placeholder) {
        placeholder.appendChild(errorEl);
      } else {
        form.appendChild(errorEl);
      }
    }
    errorEl.innerText = "Please complete the security check.";
    errorEl.style.display = 'block';
    errorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  if (hasErrors) {
    const firstError = form.querySelector('.form-error-msg[style*="display: block"]');
    if (firstError) firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  try {
    const loadingText = isJoinForm ? "Uploading documents and submitting..." : formType === 'newsletter' ? "Subscribing..." : "Submitting your enquiry...";
    showFormLoading(form, loadingText);

    formData.append('formType',   formType);
    formData.append('sourceUrl',  window.location.href);
    formData.append('pageTitle',  document.title);
    formData.append('cf-turnstile-response', turnstileToken);

    let fetchOptions = {};
    if (isJoinForm) {
      fetchOptions = { method: 'POST', body: formData };
    } else {
      const jsonPayload = {};
      for (const [key, value] of formData.entries()) {
        if (key === '_honeypot') continue;
        if (value instanceof File) continue;
        jsonPayload[key] = value.toString().trim();
      }
      fetchOptions = { method: 'POST', body: JSON.stringify(jsonPayload), headers: { 'Content-Type': 'application/json' } };
    }

    const response = await fetch('/api/forms', fetchOptions);
    hideFormLoading(form);

    let result = {};
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      result = await response.json();
    } else {
      const text = await response.text();
      throw new Error(text || `Server returned status ${response.status}`);
    }

    if (!response.ok) throw new Error(result.message || "Failed to process form submission.");

    if (placeholder && turnstileWidgets.has(placeholder)) {
      window.turnstile.reset(turnstileWidgets.get(placeholder));
    }

    form.dispatchEvent(new CustomEvent(`${formType}-form-success`,  { detail: result }));
    form.dispatchEvent(new CustomEvent('form-submit-success',        { detail: { formType, result } }));

    const successMsg = result.message || "Your submission has been received. Our team will contact you shortly.";
    const successRef = result.submission_id ? `Reference: ${result.submission_id}` : "";

    if (window.AaraaModals && typeof window.AaraaModals.showToast === 'function') {
      window.AaraaModals.showToast('success', 'Submitted Successfully!', successMsg);
    } else {
      alert(`✅ ${successMsg}${successRef ? '\n' + successRef : ''}`);
    }

    form.reset();
    form.querySelectorAll('.file-selected-name').forEach(el => el.style.display = 'none');
    if (window.AaraaModals && typeof window.AaraaModals.closeActiveModal === 'function') setTimeout(() => window.AaraaModals.closeActiveModal(), 2000);
    ['closeEnquiry', 'closePopup', 'closeEnquiryModal'].forEach(fn => { if (typeof window[fn] === 'function') window[fn](); });

  } catch (submitErr) {
    hideFormLoading(form);
    console.error("Submission failed:", submitErr);
    form.dispatchEvent(new CustomEvent(`${formType}-form-error`,  { detail: { error: submitErr.message } }));
    form.dispatchEvent(new CustomEvent('form-submit-error',        { detail: { formType, error: submitErr.message } }));
    if (placeholder && turnstileWidgets.has(placeholder)) window.turnstile.reset(turnstileWidgets.get(placeholder));
    if (window.AaraaModals && typeof window.AaraaModals.showToast === 'function') window.AaraaModals.showToast('error', 'Submission Failed', submitErr.message);
    else alert("Submission Failed: " + submitErr.message);
  }
}

window.__aaraaFirebaseHandler = function(e) { handleFormSubmit(e); };

document.addEventListener('DOMContentLoaded', () => {
  loadConfigAndInitTurnstile();
  pollTurnstile();
  if (window.__firebaseSubmitEventListenersBound) return;
  window.__firebaseSubmitEventListenersBound = true;

  document.querySelectorAll('input[type="file"]').forEach(input => {
    input.addEventListener('change', (e) => {
      const file = e.target.files[0];
      const nameEl = e.target.closest('.file-upload-wrapper')?.querySelector('.file-selected-name') || document.getElementById(`${e.target.name}-selected`);
      if (nameEl) {
        nameEl.innerText = file ? `Selected: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)` : '';
        nameEl.style.display = file ? 'block' : 'none';
      }
    });
  });

  document.querySelectorAll('form[data-form-type]').forEach(form => {
    if (form.dataset.formHandler === 'aaraa' || form.closest('.ai-modal-box')) return;
    form.addEventListener('submit', handleFormSubmit);
  });

  ['contactform', 'contactForm', 'callbackForm', 'callbackform', 'callmeBackForm'].forEach(id => {
    const form = document.getElementById(id);
    if (form && !form.dataset.formType) {
      form.dataset.formType = id.toLowerCase().includes('callback') ? 'callback' : 'contact';
      if (!(form.dataset.formHandler === 'aaraa' || form.closest('.ai-modal-box'))) form.addEventListener('submit', handleFormSubmit);
    }
  });

  [
    { ids: ['quickform', 'quickEnquiryForm', 'enquiryForm', 'emailform'], type: 'enquiry' },
    { ids: ['vendorForm'], type: 'vendor' }
  ].forEach(({ ids, type }) => {
    ids.forEach(id => {
      const form = document.getElementById(id);
      if (form && !form.dataset.formType) {
        form.dataset.formType = type;
        if (!(form.dataset.formHandler === 'aaraa' || form.closest('.ai-modal-box'))) {
          const fresh = form.cloneNode(true);
          form.parentNode.replaceChild(fresh, form);
          fresh.dataset.formType = type;
          fresh.addEventListener('submit', handleFormSubmit);
        }
      }
    });
  });

  document.querySelectorAll('form.form-newsletter, form[id*="newsletter"]').forEach(form => {
    if (!form.dataset.formType) form.dataset.formType = 'newsletter';
    if (!(form.dataset.formHandler === 'aaraa' || form.closest('.ai-modal-box'))) form.addEventListener('submit', handleFormSubmit);
  });
});
