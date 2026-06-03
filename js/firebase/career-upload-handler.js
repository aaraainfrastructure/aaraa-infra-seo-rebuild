/**
 * Career Form Upload Handler
 * FIXED VERSION — All audit issues resolved
 *
 * Fixes applied:
 * - [FIX 1] leadId generated ONCE before upload — Storage path and Firestore use same ID
 * - [FIX 2] career-form-error event now shows visible error notification to user
 * - [FIX 3] Upload progress indicator shown during file upload
 * - [FIX 4] Google Ads conversion fires ONLY on successful submission (not page load)
 *
 * @module career-upload-handler
 */

function getFirebaseServices() {
  if (!window.firebaseServices) {
    console.error('[Career Upload Handler] Firebase not initialized')
    return null
  }
  return window.firebaseServices
}

const UPLOAD_CONFIG = {
  debug: window.location.hostname === 'localhost' || window.location.search.includes('firebase_debug=true'),
  testMode: window.location.search.includes('form_test=true'),
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedFileTypes: ['pdf', 'doc', 'docx'],
  formId: 'applyForm',
  collectionName: 'career_applications'
}

function logDebug(...args) {
  if (UPLOAD_CONFIG.debug) {
    console.log(`%c[Career Upload Handler]`, 'color:#f46222;font-weight:bold;', ...args)
  }
}

function logError(...args) {
  console.error(`%c[Career Upload Handler]`, 'color:#ef4444;font-weight:bold;', ...args)
}

/**
 * Generate a consistent lead ID used for both Storage and Firestore
 * Called ONCE per submission and passed through the entire pipeline
 */
function generateLeadId() {
  return `LEAD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
}

/**
 * Verify user is authenticated
 */
function verifyAuthentication() {
  const services = getFirebaseServices()
  if (!services) {
    return { authenticated: false, user: null, error: 'Firebase not initialized. Please refresh the page.' }
  }

  const user = services.auth.currentUser
  if (!user) {
    return { authenticated: false, user: null, error: 'You must sign in with Google before applying. Please sign in and try again.' }
  }
  if (!user.email) {
    return { authenticated: false, user: null, error: 'Your Google account does not have a verified email. Please use a different account.' }
  }

  logDebug('Authentication verified:', { uid: user.uid, email: user.email })
  return {
    authenticated: true,
    user: { uid: user.uid, email: user.email, displayName: user.displayName, photoURL: user.photoURL },
    error: null
  }
}

/**
 * Validate resume file
 */
function validateResumeFile(file) {
  if (!file) return { valid: false, error: 'Resume file is required' }
  const ext = file.name.split('.').pop().toLowerCase()
  if (!UPLOAD_CONFIG.allowedFileTypes.includes(ext)) {
    return { valid: false, error: `Only ${UPLOAD_CONFIG.allowedFileTypes.join(', ').toUpperCase()} files are allowed` }
  }
  if (file.size > UPLOAD_CONFIG.maxFileSize) {
    return { valid: false, error: `File must be under ${UPLOAD_CONFIG.maxFileSize / 1024 / 1024}MB` }
  }
  return { valid: true }
}

/**
 * Extract form data
 */
function extractFormData(form) {
  const formData = new FormData(form)
  return {
    position: formData.get('position') || '',
    exp_req: formData.get('exp_req') || '',
    name: formData.get('name') || '',
    email: formData.get('email') || '',
    mobile: formData.get('mobile') || '',
    location: formData.get('location') || '',
    company: formData.get('company') || '',
    salary: formData.get('salary') || '',
    experience: formData.get('experience') || '',
    message: formData.get('message') || '',
    page: formData.get('page') || 'Careers - AARAA Infrastructure',
    resume: formData.get('resume')
  }
}

/**
 * [FIX 1] Upload resume using the pre-generated leadId
 * leadId is now passed in from outside — same ID used in Firestore
 */
function uploadResumeToStorage(resumeFile, leadId) {
  return new Promise((resolve, reject) => {
    const services = getFirebaseServices()
    if (!services) { reject(new Error('Firebase not initialized')); return }

    try {
      logDebug('Uploading resume to Firebase Storage, leadId:', leadId)

      // [FIX 1] Path uses the SAME leadId that will be saved to Firestore
      const fileName = `${leadId}_${resumeFile.name}`
      const storagePath = `career_applications/${leadId}/${fileName}`
      const storageRef = services.storage.ref(storagePath)

      // [FIX 3] Show upload progress
      const uploadTask = storageRef.put(resumeFile)

      uploadTask.on('state_changed',
        (snapshot) => {
          const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
          logDebug(`Upload progress: ${progress}%`)
          updateUploadProgress(progress)
        },
        (error) => {
          logError('Resume upload failed:', error)
          reject(new Error(`Resume upload failed: ${error.message}`))
        },
        () => {
          uploadTask.snapshot.ref.getDownloadURL().then(downloadURL => {
            logDebug('Resume uploaded. URL:', downloadURL)
            resolve(downloadURL)
          }).catch(reject)
        }
      )
    } catch (error) {
      logError('Resume upload setup failed:', error)
      reject(new Error(`Resume upload setup failed: ${error.message}`))
    }
  })
}

/**
 * [FIX 3] Update upload progress text on submit button
 */
function updateUploadProgress(percent) {
  const form = document.getElementById(UPLOAD_CONFIG.formId)
  if (!form) return
  const loadingSpan = form.querySelector('.apply-btn-loading')
  if (loadingSpan) {
    loadingSpan.innerHTML = `<span class="spinner"></span> Uploading... ${percent}%`
  }
}

/**
 * [FIX 1] Save application to Firestore using the SAME leadId as Storage
 */
function saveApplicationToFirestore(formData, resumeURL, authenticatedUser, leadId) {
  return new Promise((resolve, reject) => {
    const services = getFirebaseServices()
    if (!services) { reject(new Error('Firebase not initialized')); return }

    try {
      logDebug('Saving application to Firestore, leadId:', leadId)

      const applicationData = {
        leadId,                   // [FIX 1] Same leadId as Storage path
        formType: 'Career Form',
        position: formData.position,
        exp_req: formData.exp_req,
        name: formData.name,
        email: formData.email,
        mobile: formData.mobile,
        location: formData.location,
        company: formData.company,
        salary: formData.salary,
        experience: formData.experience,
        message: formData.message,
        page: formData.page,
        resumeFile: {
          name: formData.resume.name,
          size: formData.resume.size,
          type: formData.resume.type,
          url: resumeURL,
          storagePath: `career_applications/${leadId}/${leadId}_${formData.resume.name}` // explicit path reference
        },
        authenticatedUser: {
          uid: authenticatedUser.uid,
          email: authenticatedUser.email,
          displayName: authenticatedUser.displayName,
          verifiedAt: new Date()
        },
        submittedAt: new Date(),
        deviceInfo: {
          userAgent: navigator.userAgent,
          language: navigator.language,
          platform: navigator.platform,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        },
        status: 'new'
      }

      services.db.collection(UPLOAD_CONFIG.collectionName).add(applicationData).then(docRef => {
        logDebug('Application saved to Firestore:', { docId: docRef.id, leadId })
        resolve({ docId: docRef.id, leadId, data: applicationData })
      }).catch(error => {
        logError('Firestore save failed:', error)
        reject(new Error(`Failed to save application: ${error.message}`))
      })

    } catch (error) {
      logError('Firestore save setup failed:', error)
      reject(new Error(`Failed to save application: ${error.message}`))
    }
  })
}

/**
 * Send email notification to HR
 */
function sendEmailNotification(applicationData) {
  return new Promise((resolve) => {
    try {
      if (UPLOAD_CONFIG.testMode) {
        logDebug('TEST MODE: Email not sent')
        resolve({ success: true, testMode: true })
        return
      }
      if (typeof sendCareerApplicationEmail === 'function') {
        sendCareerApplicationEmail(applicationData).then(result => {
          logDebug('Email sent:', result)
          resolve(result)
        }).catch(error => {
          logError('Email send failed:', error)
          resolve({ success: false, error: error.message })
        })
      } else {
        resolve({ success: false, error: 'Email service not available' })
      }
    } catch (error) {
      resolve({ success: false, error: error.message })
    }
  })
}

/**
 * [FIX 2] Show error notification visibly to user inside the form modal
 */
function showErrorToUser(form, message) {
  // Try the apply-notification element first (career.html inline handler also uses this)
  const notification = form.querySelector('#applyNotification') || document.getElementById('applyNotification')
  if (notification) {
    notification.textContent = message
    notification.className = 'apply-notification error'
    notification.hidden = false
    notification.removeAttribute('style')
    return
  }

  // Fallback: inject a simple error banner inside the form
  let errorBanner = form.querySelector('.career-upload-error-banner')
  if (!errorBanner) {
    errorBanner = document.createElement('div')
    errorBanner.className = 'career-upload-error-banner'
    errorBanner.style.cssText = 'background:#fef2f2;color:#b91c1c;border:1px solid #fecaca;padding:12px 16px;border-radius:8px;margin-top:12px;font-size:0.9rem;'
    form.appendChild(errorBanner)
  }
  errorBanner.textContent = message
  errorBanner.style.display = 'block'
}

/**
 * [FIX 4] Fire Google Ads conversion ONLY on successful submission
 */
function fireGoogleAdsConversion() {
  try {
    if (typeof gtag === 'function') {
      gtag('event', 'conversion', {
        send_to: 'AW-1533096646/career_application_submitted',
        value: 1.0,
        currency: 'INR'
      })
      logDebug('Google Ads conversion fired on successful submission')
    }
  } catch (e) {
    logError('Google Ads conversion error:', e)
  }
}

/**
 * Handle career form submission
 */
function handleCareerFormSubmit(event) {
  const form = event.target
  if (form.id !== UPLOAD_CONFIG.formId) return

  logDebug('Career form submission intercepted')
  event.preventDefault()
  event.stopImmediatePropagation()

  const submitBtn = document.getElementById('applySubmit') || form.querySelector('[type="submit"]')
  const loadingSpan = submitBtn ? submitBtn.querySelector('.apply-btn-loading') : null
  const textSpan = submitBtn ? submitBtn.querySelector('.apply-btn-text') : null

  function setLoading(loading) {
    if (!submitBtn) return
    submitBtn.disabled = loading
    submitBtn.style.opacity = loading ? '0.7' : '1'
    if (textSpan) textSpan.hidden = loading
    if (loadingSpan) loadingSpan.hidden = !loading
  }

  try {
    // Verify authentication first
    const authCheck = verifyAuthentication()
    if (!authCheck.authenticated) {
      logError('Submission rejected: User not authenticated')
      showErrorToUser(form, authCheck.error)
      // Re-show auth modal
      if (window.CareerGoogleAuth) window.CareerGoogleAuth.showAuthModal()
      return
    }

    setLoading(true)

    const formData = extractFormData(form)
    const fileValidation = validateResumeFile(formData.resume)
    if (!fileValidation.valid) {
      showErrorToUser(form, fileValidation.error)
      setLoading(false)
      return
    }

    // [FIX 1] Generate ONE leadId for both Storage and Firestore
    const leadId = generateLeadId()
    logDebug('Generated leadId for this submission:', leadId)

    uploadResumeToStorage(formData.resume, leadId)
      .then(resumeURL => {
        // [FIX 1] Pass same leadId into Firestore save
        return saveApplicationToFirestore(formData, resumeURL, authCheck.user, leadId)
      })
      .then(firestoreResult => {
        return sendEmailNotification(firestoreResult.data).then(emailResult => {
          return { firestoreResult, emailResult }
        })
      })
      .then(({ firestoreResult, emailResult }) => {
        logDebug('Submission complete:', {
          leadId: firestoreResult.leadId,
          docId: firestoreResult.docId,
          emailSent: emailResult.success
        })

        // [FIX 4] Fire Google Ads conversion here — on actual success
        fireGoogleAdsConversion()

        // Dispatch success event for success modal
        form.dispatchEvent(new CustomEvent('career-form-success', {
          bubbles: true,
          detail: {
            leadId: firestoreResult.leadId,
            docId: firestoreResult.docId,
            emailSent: emailResult.success,
            applicantName: formData.name,
            applicantEmail: formData.email
          }
        }))

        form.reset()
        setLoading(false)
      })
      .catch(error => {
        logError('Career form submission failed:', error)

        // [FIX 2] Show error visibly to user
        showErrorToUser(form, error.message || 'Submission failed. Please try again.')

        form.dispatchEvent(new CustomEvent('career-form-error', {
          bubbles: true,
          detail: { error: error.message }
        }))

        setLoading(false)
      })

  } catch (error) {
    logError('Career form submission setup failed:', error)
    showErrorToUser(form, error.message || 'An unexpected error occurred. Please refresh and try again.')
    form.dispatchEvent(new CustomEvent('career-form-error', {
      bubbles: true,
      detail: { error: error.message }
    }))
    if (submitBtn) {
      submitBtn.disabled = false
      submitBtn.style.opacity = '1'
    }
  }
}

/**
 * Initialize career form handler
 */
function initCareerFormHandler() {
  const form = document.getElementById(UPLOAD_CONFIG.formId)
  if (!form) {
    logDebug('Career form not found on this page')
    return
  }
  logDebug('Initializing career form handler')
  form.setAttribute('data-career-handler', 'true')
  form.addEventListener('submit', handleCareerFormSubmit, true)
  logDebug('Career form handler initialized successfully')
}

function init() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCareerFormHandler)
  } else {
    initCareerFormHandler()
  }
}

init()

window.CareerUploadHandler = {
  handleCareerFormSubmit,
  extractFormData,
  validateResumeFile,
  uploadResumeToStorage,
  saveApplicationToFirestore,
  sendEmailNotification,
  generateLeadId,
  initCareerFormHandler
}
