import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";

// Initialize Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCjousdSRR0SJS3Qzv2sac-x7O-KnAzOAM",
  authDomain: "aaraa-infra-web.firebaseapp.com",
  projectId: "aaraa-infra-web",
  storageBucket: "aaraa-infra-web.firebasestorage.app",
  messagingSenderId: "1097946746049",
  appId: "1:1097946746049:web:66255acd518f19b2a9d840"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const storage = getStorage(app);
const provider = new GoogleAuthProvider();

// Custom UI state helpers
function showOverlay(text) {
  const overlay = document.getElementById('formOverlay');
  if (overlay) {
    overlay.querySelector('.form-loading-text').innerText = text;
    overlay.style.display = 'flex';
  }
}

function hideOverlay() {
  const overlay = document.getElementById('formOverlay');
  if (overlay) overlay.style.display = 'none';
}

function displayError(fieldId, message) {
  const errorEl = document.getElementById(`${fieldId}-error`);
  if (errorEl) {
    errorEl.innerText = message;
    errorEl.style.display = 'block';
  }
}

function clearErrors() {
  document.querySelectorAll('.form-error-msg').forEach(el => {
    el.style.display = 'none';
    el.innerText = '';
  });
}

// Validation helpers
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone) {
  return /^[6789]\d{9}$/.test(phone.replace(/[-+ ]/g, '').slice(-10));
}

function checkFileValidity(file, allowedExtensions, maxSizeMB) {
  if (!file) return { valid: false, message: "File is required." };
  
  const ext = file.name.split('.').pop().toLowerCase();
  if (!allowedExtensions.includes(ext)) {
    return { valid: false, message: `Invalid file type. Allowed: ${allowedExtensions.join(', ').toUpperCase()}` };
  }
  
  if (file.size > maxSizeMB * 1024 * 1024) {
    return { valid: false, message: `File size exceeds limit (${maxSizeMB}MB).` };
  }
  
  return { valid: true };
}

// File Upload helper
async function uploadToFirebase(file, folderName) {
  const sanitizedName = file.name.replace(/\s+/g, '_');
  const path = `join_aaraa/${folderName}/${Date.now()}_${sanitizedName}`;
  const storageRef = ref(storage, path);
  const result = await uploadBytes(storageRef, file);
  return await getDownloadURL(result.ref);
}

// Main Submit Form handler
async function handleFormSubmission(e, formId, formType, fileConfig) {
  e.preventDefault();
  clearErrors();

  const form = document.getElementById(formId);
  const formData = new FormData(form);

  // 1. Honeypot check (anti-spam)
  if (formData.get('_honeypot') && formData.get('_honeypot') !== '') {
    console.warn("Spam submission blocked via honeypot.");
    alert("Submission ignored.");
    return;
  }

  // 2. Client-side field validations
  let hasErrors = false;
  
  // Dynamic validation based on form fields
  for (const [key, value] of formData.entries()) {
    if (key === '_honeypot') continue;
    
    // Check required fields
    const inputEl = form.querySelector(`[name="${key}"]`);
    if (inputEl && inputEl.hasAttribute('required') && (!value || value.toString().trim() === '')) {
      displayError(key, "This field is required.");
      hasErrors = true;
    }

    // Validate email
    if (key === 'email' && value) {
      if (!isValidEmail(value.toString().trim())) {
        displayError(key, "Please enter a valid email address.");
        hasErrors = true;
      }
    }

    // Validate phone number
    if ((key === 'phone' || key === 'mobile') && value) {
      if (!isValidPhone(value.toString().trim())) {
        displayError(key, "Please enter a valid 10-digit mobile number.");
        hasErrors = true;
      }
    }
  }

  // File validations
  const uploadedUrls = {};
  for (const [fieldName, config] of Object.entries(fileConfig)) {
    const file = formData.get(fieldName);
    const required = form.querySelector(`[name="${fieldName}"]`)?.hasAttribute('required');

    if (file && file.size > 0) {
      const check = checkFileValidity(file, config.allowed, config.maxSize);
      if (!check.valid) {
        displayError(fieldName, check.message);
        hasErrors = true;
      }
    } else if (required) {
      displayError(fieldName, "This file is mandatory.");
      hasErrors = true;
    }
  }

  if (hasErrors) {
    const firstError = document.querySelector('.form-error-msg[style*="display: block"]');
    if (firstError) {
      firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    return;
  }

  // 3. Trigger Google Sign-In Popup
  let user = null;
  try {
    showOverlay("Authenticating with Google Sign-In...");
    const authResult = await signInWithPopup(auth, provider);
    user = authResult.user;
  } catch (authErr) {
    hideOverlay();
    console.error("Google Auth failed:", authErr);
    if (authErr.code !== 'auth/popup-closed-by-user') {
      alert("Authentication failed: " + authErr.message);
    } else {
      alert("Google Sign-In is required to submit this form securely.");
    }
    return;
  }

  // 4. Upload Files
  try {
    for (const [fieldName, config] of Object.entries(fileConfig)) {
      const file = formData.get(fieldName);
      if (file && file.size > 0) {
        showOverlay(`Uploading ${config.label}...`);
        const url = await uploadToFirebase(file, config.folder);
        uploadedUrls[fieldName] = url;
        uploadedUrls[`${fieldName}Name`] = file.name;
      }
    }
  } catch (uploadErr) {
    hideOverlay();
    console.error("Upload failed:", uploadErr);
    alert("File upload failed. Please check your internet connection.");
    return;
  }

  // 5. Submit Payload to API
  try {
    showOverlay("Submitting application...");
    
    // Construct clean payload
    const payload = {};
    for (const [key, value] of formData.entries()) {
      if (key === '_honeypot' || value instanceof File) continue;
      payload[key] = value.toString().trim();
    }

    // Add files metadata
    payload.files = uploadedUrls;
    payload.verifiedEmail = user.email;
    payload.formType = formType;
    payload.sourceUrl = window.location.href;
    payload.pageTitle = document.title;

    // Send CSRF dummy token for compliance
    const csrfToken = btoa(Date.now().toString());

    const response = await fetch('/api/submit-join', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken
      }
    });

    hideOverlay();

    if (!response.ok) {
      let errorMessage = `Server error (Status ${response.status})`;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        try {
          const errRes = await response.json();
          errorMessage = errRes.message || errorMessage;
        } catch (e) {
          // ignore parsing error
        }
      } else {
        try {
          const textRes = await response.text();
          if (textRes && textRes.trim().length < 150) {
            errorMessage = textRes.trim();
          }
        } catch (e) {
          // ignore reading error
        }
      }
      throw new Error(errorMessage);
    }

    let result = {};
    const responseContentType = response.headers.get("content-type");
    if (responseContentType && responseContentType.includes("application/json")) {
      result = await response.json();
    } else {
      throw new Error("Invalid response format from server (expected JSON).");
    }
    alert(`Success! Application ID: ${result.applicationId}\n${result.message}`);
    form.reset();
    document.querySelectorAll('.file-selected-name').forEach(el => el.style.display = 'none');

  } catch (submitErr) {
    hideOverlay();
    console.error("Submission failed:", submitErr);
    alert("Failed to submit form: " + submitErr.message);
  }
}

// Bind upload labels updates
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('input[type="file"]').forEach(input => {
    input.addEventListener('change', (e) => {
      const file = e.target.files[0];
      const nameEl = document.getElementById(`${e.target.name}-selected`);
      if (file && nameEl) {
        nameEl.innerText = `Selected: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
        nameEl.style.display = 'block';
      } else if (nameEl) {
        nameEl.style.display = 'none';
      }
    });
  });

  // Attach submit listeners dynamically based on active page
  const careerForm = document.getElementById('careerForm');
  if (careerForm) {
    careerForm.addEventListener('submit', (e) => handleFormSubmission(e, 'careerForm', 'career', {
      'resume': { label: 'Resume/CV', folder: 'resumes', allowed: ['pdf', 'doc', 'docx'], maxSize: 10 },
      'portfolio': { label: 'Portfolio Document', folder: 'portfolios', allowed: ['pdf', 'doc', 'docx', 'zip'], maxSize: 15 }
    }));
  }

  const partnershipForm = document.getElementById('partnershipForm');
  if (partnershipForm) {
    partnershipForm.addEventListener('submit', (e) => handleFormSubmission(e, 'partnershipForm', 'partnership', {
      'company_profile': { label: 'Company Profile', folder: 'company_profiles', allowed: ['pdf'], maxSize: 15 },
      'capability_statement': { label: 'Capability Statement', folder: 'capabilities', allowed: ['pdf'], maxSize: 15 },
      'brochure': { label: 'Company Brochure', folder: 'brochures', allowed: ['pdf', 'zip'], maxSize: 15 }
    }));
  }

  const jvForm = document.getElementById('jvForm');
  if (jvForm) {
    jvForm.addEventListener('submit', (e) => handleFormSubmission(e, 'jvForm', 'jv', {
      'company_profile': { label: 'Company Profile', folder: 'company_profiles', allowed: ['pdf'], maxSize: 15 },
      'reg_certificate': { label: 'Registration Certificate', folder: 'registrations', allowed: ['pdf'], maxSize: 10 },
      'financial_doc': { label: 'Financial Capability Document', folder: 'financials', allowed: ['pdf'], maxSize: 15 }
    }));
  }

  const subcontractorForm = document.getElementById('subcontractorForm');
  if (subcontractorForm) {
    subcontractorForm.addEventListener('submit', (e) => handleFormSubmission(e, 'subcontractorForm', 'subcontractor', {
      'gst_cert': { label: 'GST Certificate', folder: 'gst_certificates', allowed: ['pdf', 'jpg', 'jpeg', 'png'], maxSize: 10 },
      'pan_copy': { label: 'PAN Copy', folder: 'pan_copies', allowed: ['pdf', 'jpg', 'jpeg', 'png'], maxSize: 10 },
      'company_profile': { label: 'Company Profile', folder: 'company_profiles', allowed: ['pdf'], maxSize: 15 },
      'work_orders': { label: 'Work Order Copies', folder: 'work_orders', allowed: ['pdf', 'zip'], maxSize: 20 },
      'safety_cert': { label: 'Safety Certification', folder: 'safety_certs', allowed: ['pdf'], maxSize: 10 }
    }));
  }

  const internshipForm = document.getElementById('internshipForm');
  if (internshipForm) {
    internshipForm.addEventListener('submit', (e) => handleFormSubmission(e, 'internshipForm', 'internship', {
      'resume': { label: 'Student Resume', folder: 'resumes', allowed: ['pdf', 'doc', 'docx'], maxSize: 10 },
      'bonafide_cert': { label: 'Bonafide Certificate', folder: 'bonafide_certs', allowed: ['pdf', 'jpg', 'jpeg', 'png'], maxSize: 10 },
      'transcript': { label: 'Academic Transcript', folder: 'transcripts', allowed: ['pdf'], maxSize: 10 }
    }));
  }
});
