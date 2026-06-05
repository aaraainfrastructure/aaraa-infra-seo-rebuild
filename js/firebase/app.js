import { db, analytics } from './firebase-config.js'
import {
  submitLead,
  submitNewsletter,
  submitCallbackRequest,
  submitContactMessage,
  checkDuplicate,
  processOfflineQueue,
  processFailedEmailQueue,
  getCollectionStats,
  LEAD_STATUS,
  COLLECTIONS
} from './lead-service.js'
import {
  validateForm,
  checkHoneypot,
  injectHoneypot,
  checkRateLimit,
  clearAllErrors,
  showFieldError,
  showFormError
} from './validation.js'
import { logEvent } from 'firebase/analytics'
import { SUCCESS_MESSAGE, EMAIL_FAILURE_MESSAGE } from './form-config.js'

const CONFIG = {
  debug: window.location.hostname === 'localhost' || window.location.search.includes('firebase_debug=true'),
  testMode: window.location.search.includes('form_test=true'),
  interceptMode: 'auto',
  excludeSelectors: [
    '.form-search',
    '#searchForm',
    '.search-form',
    'form[action*="subscribe"]'
  ],
  formTypeMapping: getDefaultFormTypeMapping(),
  toastDuration: 5000,
  successModalDelay: 2000,
  leadStatus: LEAD_STATUS,
  collections: COLLECTIONS
}

function getDefaultFormTypeMapping() {
  return [
    { match: (form) => form.matches('#leadForm, [data-form-type="lead"]'), type: 'Hero Quote Form' },
    { match: (form) => form.matches('#callbackForm, [data-form-type="callback"], #callbackform'), type: 'Call Back Request Form' },
    { match: (form) => form.matches('#contactform, [data-form-type="contact"], #contactForm, .form-contact-us'), type: 'Contact Form' },
    { match: (form) => form.matches('[data-form-type="newsletter"], .subscribe-form, #subscribe-form'), type: 'Newsletter Form' },
    { match: (form) => form.matches('#enquiryForm, #quickEnquiryForm, [data-form-type="enquiry"]'), type: 'Popup Lead Form' },
    { match: (form) => form.matches('[data-form-type="vendor"], #vendorForm, #vendorRegistrationForm'), type: 'Vendor Registration Form' },
    { match: (form) => form.matches('[data-form-type="career"], #applyForm, #jobApplyForm'), type: 'Career Form' },
    { match: (form) => form.matches('[data-form-type="consultation"]'), type: 'Free Consultation Form' },
    { match: (form) => form.matches('[data-form-type="whatsapp"]'), type: 'WhatsApp Inquiry Form' },
    { match: (form) => form.matches('[data-form-type="brochure"]'), type: 'Download Brochure Form' },
    { match: (form) => form.matches('[data-form-type="comment"], #commentForm, #commentform'), type: 'Blog Comment Form' },
    { match: (form) => form.matches('[data-form-type="quick"]'), type: 'Quick Enquiry Form' },
    { match: (form) => form.matches('#quickform'), type: 'Quick Enquiry Form' },
    { match: (form) => form.matches('#sendEmailForm, #sendEmail form'), type: 'Quick Enquiry Form' },
    { match: () => true, type: 'General Enquiry' }
  ]
}

const Toast = {
  container: null,

  init() {
    if (document.getElementById('aaraa-toast-container')) return
    this.container = document.createElement('div')
    this.container.id = 'aaraa-toast-container'
    this.container.setAttribute('aria-live', 'polite')
    this.container.setAttribute('role', 'status')
    this.container.style.cssText =
      'position:fixed;bottom:24px;right:24px;z-index:999999;display:flex;flex-direction:column-reverse;gap:12px;pointer-events:none;max-width:calc(100vw - 48px);'
    document.body.appendChild(this.container)
  },

  show({ type = 'success', title = '', message = '', duration } = {}) {
    this.init()
    duration = duration || CONFIG.toastDuration

    const colors = {
      success: { bg: '#065f46', border: '#059669', icon: '✓' },
      error: { bg: '#991b1b', border: '#dc2626', icon: '✕' },
      info: { bg: '#1e3a5f', border: '#2563eb', icon: 'ℹ' },
      warning: { bg: '#92400e', border: '#d97706', icon: '⚠' }
    }
    const c = colors[type] || colors.info

    const toast = document.createElement('div')
    toast.className = 'aaraa-toast'
    toast.setAttribute('role', 'alert')
    toast.style.cssText = `
      pointer-events:auto;
      display:flex;
      align-items:flex-start;
      gap:12px;
      min-width:320px;
      max-width:440px;
      padding:16px 20px;
      background:${c.bg};
      border-left:4px solid ${c.border};
      border-radius:12px;
      color:#fff;
      font-size:0.95rem;
      line-height:1.5;
      box-shadow:0 12px 40px rgba(0,0,0,0.3);
      transform:translateX(120%);
      opacity:0;
      transition:transform 0.4s cubic-bezier(0.22,1,0.36,1), opacity 0.4s ease;
    `

    const iconEl = document.createElement('span')
    iconEl.style.cssText = 'flex-shrink:0;width:24px;height:24px;border-radius:50%;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;font-size:0.8rem;font-weight:700;'
    iconEl.textContent = c.icon

    const content = document.createElement('div')
    content.style.cssText = 'flex:1;'

    if (title) {
      const titleEl = document.createElement('div')
      titleEl.style.cssText = 'font-weight:600;margin-bottom:2px;'
      titleEl.textContent = title
      content.appendChild(titleEl)
    }

    if (message) {
      const msgEl = document.createElement('div')
      msgEl.style.cssText = 'opacity:0.9;font-size:0.9rem;'
      msgEl.textContent = message
      content.appendChild(msgEl)
    }

    const closeBtn = document.createElement('button')
    closeBtn.innerHTML = '×'
    closeBtn.setAttribute('aria-label', 'Close notification')
    closeBtn.style.cssText = `
      flex-shrink:0;
      background:none;
      border:none;
      color:#fff;
      font-size:1.3rem;
      cursor:pointer;
      opacity:0.6;
      padding:0 0 0 8px;
      line-height:1;
    `
    closeBtn.onclick = () => this.dismiss(toast)

    toast.appendChild(iconEl)
    toast.appendChild(content)
    toast.appendChild(closeBtn)
    this.container.appendChild(toast)

    requestAnimationFrame(() => {
      toast.style.transform = 'translateX(0)'
      toast.style.opacity = '1'
    })

    if (duration > 0) {
      toast._timeout = setTimeout(() => this.dismiss(toast), duration)
    }

    return toast
  },

  success(title, message) {
    return this.show({ type: 'success', title, message })
  },

  error(title, message) {
    return this.show({ type: 'error', title, message })
  },

  info(title, message) {
    return this.show({ type: 'info', title, message })
  },

  warning(title, message) {
    return this.show({ type: 'warning', title, message })
  },

  dismiss(toast) {
    if (toast._dismissed) return
    toast._dismissed = true
    if (toast._timeout) clearTimeout(toast._timeout)
    toast.style.transform = 'translateX(120%)'
    toast.style.opacity = '0'
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast)
    }, 400)
  }
}

const SuccessModal = {
  init() {
    if (document.getElementById('aaraa-success-modal')) return

    const overlay = document.createElement('div')
    overlay.id = 'aaraa-success-modal'
    overlay.setAttribute('role', 'dialog')
    overlay.setAttribute('aria-modal', 'true')
    overlay.setAttribute('aria-labelledby', 'aaraa-success-title')
    overlay.style.cssText = `
      position:fixed;inset:0;z-index:999998;
      background:rgba(0,0,0,0.6);
      backdrop-filter:blur(4px);
      display:none;
      align-items:center;
      justify-content:center;
      padding:24px;
      animation:fadeIn 0.3s ease;
    `

    const card = document.createElement('div')
    card.style.cssText = `
      background:#fff;
      border-radius:24px;
      padding:40px 32px 32px;
      max-width:420px;
      width:100%;
      text-align:center;
      box-shadow:0 25px 60px rgba(0,0,0,0.2);
      animation:scaleIn 0.4s cubic-bezier(0.22,1,0.36,1);
      position:relative;
    `

    const checkmark = document.createElement('div')
    checkmark.innerHTML = `
      <div style="width:72px;height:72px;border-radius:50%;background:linear-gradient(135deg,#059669,#10b981);display:flex;align-items:center;justify-content:center;margin:0 auto 20px;">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </div>
    `

    const title = document.createElement('h3')
    title.id = 'aaraa-success-title'
    title.textContent = 'Thank You!'
    title.style.cssText = 'font-size:1.5rem;font-weight:700;color:#111;margin:0 0 8px;'

    const subtitle = document.createElement('p')
    subtitle.id = 'aaraa-success-subtitle'
    subtitle.textContent = 'Your enquiry has been received. Our team will contact you shortly.'
    subtitle.style.cssText = 'font-size:0.95rem;color:#666;margin:0 0 24px;line-height:1.6;'

    const btn = document.createElement('button')
    btn.textContent = 'Got it'
    btn.style.cssText = `
      background:linear-gradient(135deg,#059669,#10b981);
      color:#fff;
      border:none;
      padding:14px 40px;
      border-radius:9999px;
      font-size:1rem;
      font-weight:600;
      cursor:pointer;
      transition:transform 0.2s ease, box-shadow 0.2s ease;
    `
    btn.onmouseenter = () => { btn.style.transform = 'translateY(-2px)'; btn.style.boxShadow = '0 8px 20px rgba(5,150,105,0.3)' }
    btn.onmouseleave = () => { btn.style.transform = ''; btn.style.boxShadow = '' }
    btn.onclick = () => this.hide()

    card.appendChild(checkmark)
    card.appendChild(title)
    card.appendChild(subtitle)
    card.appendChild(btn)
    overlay.appendChild(card)
    document.body.appendChild(overlay)

    overlay.onclick = (e) => { if (e.target === overlay) this.hide() }

    const style = document.createElement('style')
    style.textContent = `
      @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes scaleIn { from { transform: scale(0.85); opacity: 0; } to { transform: scale(1); opacity: 1; } }
    `
    document.head.appendChild(style)
  },

  show({ title, message } = {}) {
    this.init()
    const overlay = document.getElementById('aaraa-success-modal')
    if (!overlay) return

    const titleEl = document.getElementById('aaraa-success-title')
    const subEl = document.getElementById('aaraa-success-subtitle')
    if (title && titleEl) titleEl.textContent = title
    if (message && subEl) subEl.textContent = message

    overlay.style.display = 'flex'
    if (!document.body.classList.contains('aaraa-popup-open') && !document.body.classList.contains('ai-modal-open')) {
      document.body.style.overflow = 'hidden'
    }
  },

  hide() {
    const overlay = document.getElementById('aaraa-success-modal')
    if (!overlay) return
    overlay.style.display = 'none'
    if (!document.body.classList.contains('aaraa-popup-open') && !document.body.classList.contains('ai-modal-open')) {
      document.body.style.overflow = ''
    }
  }
}

function detectFormType(form) {
  if (form.dataset.formType) return form.dataset.formType
  const formId = form.id || ''
  const formClass = form.className || ''

  for (const mapping of CONFIG.formTypeMapping) {
    try {
      if (mapping.match(form)) return mapping.type
    } catch {
      continue
    }
  }

  return 'General Enquiry'
}

function shouldSkipForm(form) {
  for (const sel of CONFIG.excludeSelectors) {
    try {
      if (form.matches(sel)) return true
    } catch {
      continue
    }
  }
  
  // Skip career forms - they are handled exclusively by career-upload-handler.js
  if (form.matches('[data-form-type="career"], #applyForm, #jobApplyForm')) {
    return true
  }
  
  return form.hasAttribute('data-firebase-skip') || form.dataset.firebaseSkip === 'true'
}

function setButtonLoading(btn, loading) {
  if (!btn) return
  var hasBuiltInSpinner = btn.querySelector('.aaraa-popup-spinner, .ai-spinner')
  if (loading) {
    btn._originalText = btn.innerHTML
    if (hasBuiltInSpinner) {
      btn.classList.add('loading')
    } else {
      btn.innerHTML = '<span style="display:inline-flex;align-items:center;gap:8px;">' +
        '<svg class="aaraa-spinner" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
        '<circle cx="12" cy="12" r="10" stroke-dasharray="31.4 31.4" stroke-linecap="round" style="animation:aaraa-spin 1s linear infinite;" />' +
        '</svg> Sending...</span>'
    }
    btn.disabled = true
    btn.style.opacity = '0.8'
    btn.style.cursor = 'not-allowed'
  } else {
    if (btn._originalText) btn.innerHTML = btn._originalText
    btn.disabled = false
    btn.style.opacity = ''
    btn.style.cursor = ''
    btn.classList.remove('loading')
  }
}

function injectSpinnerStyle() {
  if (document.getElementById('aaraa-spinner-style')) return
  const style = document.createElement('style')
  style.id = 'aaraa-spinner-style'
  style.textContent = `
    @keyframes aaraa-spin { from { transform:rotate(0); } to { transform:rotate(360deg); } }
    input.firebase-invalid, select.firebase-invalid, textarea.firebase-invalid {
      border-color:#e74c3c !important;
      box-shadow:0 0 0 3px rgba(231,76,60,0.15) !important;
    }
    .aaraa-toast { will-change: transform, opacity; }
  `
  document.head.appendChild(style)
}

function logDebug(...args) {
  if (CONFIG.debug) {
    console.log(`%c[Firebase]`, 'color:#f46222;font-weight:bold;', ...args)
  }
}

function extractErrorMessage(err) {
  if (!err) return 'Something went wrong. Please try again or call us directly.'

  if (err.code === 'permission-denied') {
    return 'Access Denied: Firebase security rules rejected this submission. Please contact the site administrator.'
  }
  if (err.code === 'unavailable' || err.code === 'failed-precondition') {
    return 'You appear to be offline. Your information will be saved locally and submitted when connection restores.'
  }
  if (err.code === 'not-found') {
    return 'The target collection was not found. Please contact support.'
  }
  if (err.code === 'already-exists') {
    return 'This record already exists. Please try with different information.'
  }
  if (err.code === 'invalid-argument') {
    return 'Invalid data provided. Please check your inputs and try again.'
  }
  if (err.name === 'FirebaseError') {
    return `Firebase Error: ${err.message || 'Unknown error'}`
  }
  if (err.message && err.message.includes('EmailJS')) {
    return `Email service error: ${err.message.replace('EmailJS', '').trim() || 'Failed to send notification'}`
  }
  if (err.message && err.message.includes('network')) {
    return 'Network error. Please check your internet connection and try again.'
  }
  if (err.message) {
    return err.message.length > 200 ? err.message.substring(0, 200) + '...' : err.message
  }
  if (typeof err === 'string') {
    return err
  }
  return 'Something went wrong. Please try again or call us directly.'
}

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

function dispatchFormResult(form, success, errorMessage) {
  try {
    form.dispatchEvent(new CustomEvent('aaraa-form-result', {
      bubbles: false,
      detail: { success: success, error: errorMessage || '' }
    }))
  } catch (e) {
    console.warn('[Firebase] Failed to dispatch form result event:', e)
  }
}

function showFormSuccess(form) {
  if (typeof form.reset === 'function') {
    try { form.reset() } catch {}
  }
  clearAllErrors(form)
  var submitBtn = form.querySelector('[type="submit"], button:not([type="button"])')
  setButtonLoading(submitBtn, false)
}

function bindForms() {
  const forms = document.querySelectorAll('form')
  logDebug(`Found ${forms.length} form(s) on page`)

  if (forms.length === 0) return

  forms.forEach(form => {
    if (form.getAttribute('data-firebase-bound') === 'true') return
    form.setAttribute('data-firebase-bound', 'true')
    
    // CRITICAL: Prevent default form submission for all forms
    // This ensures POST requests don't go to the form's action attribute
    form.addEventListener('submit', (e) => {
      if (!shouldSkipForm(form)) {
        e.preventDefault()
        e.stopImmediatePropagation()
      }
    }, true)
  })

  const handler = (event) => {
    const form = event.target.closest ? event.target.closest('form') : event.target
    if (!form || !form.tagName || form.tagName.toLowerCase() !== 'form') return
    handleFormSubmit(form, event)
  }

  document.removeEventListener('submit', handler, true)
  document.addEventListener('submit', handler, true)

  window.__aaraaFirebaseHandler = handler
  logDebug('Form binding active (capture phase)')
}

async function processRetryQueue() {
  try {
    const result = await processOfflineQueue()
    if (result.processed > 0) {
      logDebug(`Restored ${result.processed} offline submission(s)`)
      Toast.info('Synced', `${result.processed} offline submission(s) synced successfully.`)
    }
    if (result.failed > 0) {
      logDebug(`${result.failed} offline submission(s) failed to sync`)
    }
  } catch {
    logDebug('Offline queue processing failed')
  }
}

function initDebugTools() {
  if (!CONFIG.debug) return

  window.__aaraaFirebase = {
    config: CONFIG,
    stats: getCollectionStats(),
    submitLead: (form) => handleFormSubmit(form, { preventDefault() {}, stopImmediatePropagation() {} }),
    Toast,
    SuccessModal,
    refreshBinding: bindForms,
    checkHoneypot,
    processOfflineQueue: processRetryQueue,
    processFailedEmailQueue,
    collections: COLLECTIONS,
    leadStatus: LEAD_STATUS
  }

  logDebug('Debug tools available via window.__aaraaFirebase')
  console.log('%c[AARAA Firebase Lead System]', 'background:#f46222;color:#fff;padding:4px 12px;border-radius:4px;font-weight:bold;', 'v2.0 Production')
}

function init() {
  injectSpinnerStyle()
  Toast.init()
  SuccessModal.init()

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      bindForms()
      processRetryQueue()
      processFailedEmailQueue()
      initDebugTools()
    })
  } else {
    bindForms()
    processRetryQueue()
    processFailedEmailQueue()
    initDebugTools()
  }

  window.addEventListener('online', () => {
    logDebug('Connection restored — processing offline queue')
    processRetryQueue()
    processFailedEmailQueue()
  })

  document.addEventListener('aaraa-firebase-rebind', () => {
    bindForms()
    logDebug('Forms rebound on request')
  })
}

init()

export {
  CONFIG,
  Toast,
  SuccessModal,
  detectFormType,
  handleFormSubmit,
  bindForms,
  init
}
