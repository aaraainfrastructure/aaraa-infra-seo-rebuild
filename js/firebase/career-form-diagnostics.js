/**
 * Career Form Diagnostics Script
 * Run this in browser console to verify career form setup
 * 
 * Usage:
 * 1. Open career.html in browser
 * 2. Open browser console (F12)
 * 3. Copy and paste this entire script
 * 4. Press Enter to run diagnostics
 */

(function() {
  'use strict';

  const COLORS = {
    success: 'color: #10b981; font-weight: bold;',
    error: 'color: #ef4444; font-weight: bold;',
    warning: 'color: #f59e0b; font-weight: bold;',
    info: 'color: #3b82f6; font-weight: bold;',
    reset: 'color: inherit; font-weight: normal;'
  };

  function log(message, type = 'info') {
    const style = COLORS[type] || COLORS.info;
    console.log(`%c[Career Form Diagnostics] ${message}`, style);
  }

  function section(title) {
    console.log(`\n%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, 'color: #666;');
    console.log(`%c${title}`, 'color: #1f2937; font-weight: bold; font-size: 14px;');
    console.log(`%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, 'color: #666;');
  }

  // ============================================================================
  // 1. CHECK FORM ELEMENTS
  // ============================================================================
  section('1. FORM ELEMENTS');

  const applyForm = document.getElementById('applyForm');
  const applyModal = document.getElementById('applyModal');
  const applySubmit = document.getElementById('applySubmit');
  const applyResume = document.getElementById('applyResume');

  if (applyForm) {
    log('✓ Career form found (#applyForm)', 'success');
    log(`  - Form ID: ${applyForm.id}`, 'info');
    log(`  - Form type: ${applyForm.getAttribute('data-form-type') || 'not set'}`, 'info');
    log(`  - Enctype: ${applyForm.getAttribute('enctype')}`, 'info');
  } else {
    log('✗ Career form NOT found (#applyForm)', 'error');
  }

  if (applyModal) {
    log('✓ Apply modal found (#applyModal)', 'success');
  } else {
    log('✗ Apply modal NOT found (#applyModal)', 'error');
  }

  if (applySubmit) {
    log('✓ Submit button found (#applySubmit)', 'success');
  } else {
    log('✗ Submit button NOT found (#applySubmit)', 'error');
  }

  if (applyResume) {
    log('✓ Resume input found (#applyResume)', 'success');
    log(`  - Accept types: ${applyResume.getAttribute('accept')}`, 'info');
  } else {
    log('✗ Resume input NOT found (#applyResume)', 'error');
  }

  // ============================================================================
  // 2. CHECK FIREBASE LOADING
  // ============================================================================
  section('2. FIREBASE INITIALIZATION');

  if (typeof window.__aaraaFirebase !== 'undefined') {
    log('✓ Firebase debug tools available (window.__aaraaFirebase)', 'success');
    log(`  - Config: ${JSON.stringify(window.__aaraaFirebase.config).substring(0, 100)}...`, 'info');
  } else {
    log('⚠ Firebase debug tools not yet available', 'warning');
    log('  - This is normal if Firebase module is still loading', 'info');
  }

  if (typeof window.__aaraaFirebaseHandler !== 'undefined') {
    log('✓ Firebase form handler registered (window.__aaraaFirebaseHandler)', 'success');
  } else {
    log('⚠ Firebase form handler not yet registered', 'warning');
    log('  - This is normal if Firebase module is still loading', 'info');
  }

  // ============================================================================
  // 3. CHECK FORM EVENT LISTENERS
  // ============================================================================
  section('3. FORM EVENT LISTENERS');

  if (applyForm) {
    const listeners = getEventListeners(applyForm);
    if (listeners && listeners.submit) {
      log(`✓ Submit event listeners attached: ${listeners.submit.length}`, 'success');
      listeners.submit.forEach((listener, index) => {
        log(`  - Listener ${index + 1}: ${listener.listener.toString().substring(0, 80)}...`, 'info');
      });
    } else {
      log('⚠ No submit event listeners found', 'warning');
    }

    const firebaseBound = applyForm.getAttribute('data-firebase-bound');
    if (firebaseBound === 'true') {
      log('✓ Form marked as Firebase-bound (data-firebase-bound="true")', 'success');
    } else {
      log('⚠ Form not marked as Firebase-bound', 'warning');
    }
  }

  // ============================================================================
  // 4. CHECK EMAILJS
  // ============================================================================
  section('4. EMAILJS CONFIGURATION');

  if (typeof emailjs !== 'undefined') {
    log('✓ EmailJS library loaded', 'success');
    try {
      const userId = emailjs.init.toString().match(/init\('([^']+)'\)/);
      if (userId) {
        log(`  - User ID configured: ${userId[1]}`, 'info');
      }
    } catch (e) {
      log('  - Could not extract User ID from init', 'warning');
    }
  } else {
    log('✗ EmailJS library NOT loaded', 'error');
    log('  - Check: <script src="js/lib/emailjs.bundle.min.js"></script>', 'info');
  }

  // ============================================================================
  // 5. CHECK FORM VALIDATION
  // ============================================================================
  section('5. FORM VALIDATION');

  if (applyForm) {
    const requiredFields = applyForm.querySelectorAll('[required]');
    log(`✓ Required fields found: ${requiredFields.length}`, 'success');
    requiredFields.forEach(field => {
      log(`  - ${field.name || field.id}: ${field.type}`, 'info');
    });
  }

  // ============================================================================
  // 6. CHECK FIREBASE STORAGE
  // ============================================================================
  section('6. FIREBASE STORAGE');

  if (typeof firebase !== 'undefined' && firebase.storage) {
    log('✓ Firebase Storage available', 'success');
  } else {
    log('⚠ Firebase Storage not yet loaded', 'warning');
  }

  // ============================================================================
  // 7. CHECK FIRESTORE
  // ============================================================================
  section('7. FIRESTORE DATABASE');

  if (typeof firebase !== 'undefined' && firebase.firestore) {
    log('✓ Firestore available', 'success');
  } else {
    log('⚠ Firestore not yet loaded', 'warning');
  }

  // ============================================================================
  // 8. TEST FORM SUBMISSION (OPTIONAL)
  // ============================================================================
  section('8. MANUAL TEST SUBMISSION');

  window.testCareerFormSubmission = async function() {
    log('Starting test submission...', 'info');

    if (!applyForm) {
      log('✗ Form not found', 'error');
      return;
    }

    // Fill form with test data
    const testData = {
      position: 'Test Position',
      exp_req: 'Test Experience',
      name: 'Test Applicant',
      email: 'test@example.com',
      mobile: '+91 9876543210',
      location: 'Test City',
      company: 'Test Company',
      salary: '10 LPA',
      experience: '2 - 5 years',
      message: 'This is a test application'
    };

    Object.keys(testData).forEach(key => {
      const field = applyForm.querySelector(`[name="${key}"]`);
      if (field) {
        field.value = testData[key];
        log(`  - Set ${key}: ${testData[key]}`, 'info');
      }
    });

    // Create mock file for resume
    const mockFile = new File(['test resume content'], 'test-resume.pdf', { type: 'application/pdf' });
    const resumeInput = applyForm.querySelector('[name="resume"]');
    if (resumeInput) {
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(mockFile);
      resumeInput.files = dataTransfer.files;
      log('  - Set resume: test-resume.pdf', 'info');
    }

    log('Test data filled. Ready to submit.', 'success');
    log('To submit, run: document.getElementById("applyForm").dispatchEvent(new Event("submit"))', 'info');
  };

  log('Test submission function available: window.testCareerFormSubmission()', 'success');

  // ============================================================================
  // 9. SUMMARY
  // ============================================================================
  section('SUMMARY');

  const checks = {
    'Form Elements': !!applyForm && !!applyModal && !!applySubmit,
    'Firebase Handler': typeof window.__aaraaFirebaseHandler !== 'undefined',
    'EmailJS': typeof emailjs !== 'undefined',
    'Form Listeners': applyForm && getEventListeners(applyForm)?.submit?.length > 0
  };

  let allPassed = true;
  Object.keys(checks).forEach(check => {
    const passed = checks[check];
    allPassed = allPassed && passed;
    const status = passed ? '✓' : '✗';
    const type = passed ? 'success' : 'error';
    log(`${status} ${check}`, type);
  });

  console.log('\n');
  if (allPassed) {
    log('✓ All checks passed! Career form is ready.', 'success');
  } else {
    log('⚠ Some checks failed. See details above.', 'warning');
  }

  // ============================================================================
  // 10. HELPFUL COMMANDS
  // ============================================================================
  section('HELPFUL COMMANDS');

  log('Enable debug mode:', 'info');
  log('  window.location.href = window.location.href + "?firebase_debug=true"', 'reset');

  log('Enable test mode (no emails sent):', 'info');
  log('  window.location.href = window.location.href + "?form_test=true"', 'reset');

  log('Run test submission:', 'info');
  log('  window.testCareerFormSubmission()', 'reset');

  log('Submit form manually:', 'info');
  log('  document.getElementById("applyForm").dispatchEvent(new Event("submit"))', 'reset');

  log('View Firebase config:', 'info');
  log('  window.__aaraaFirebase.config', 'reset');

  log('View form stats:', 'info');
  log('  window.__aaraaFirebase.stats()', 'reset');

  console.log('\n');
})();
