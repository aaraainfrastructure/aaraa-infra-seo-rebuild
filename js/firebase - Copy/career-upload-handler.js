/**
 * Career Form Upload Handler
 * 
 * Exclusive handler for career form submissions
 * - REQUIRES Firebase Authentication (Google Sign-In)
 * - Intercepts career form submit events
 * - Uploads resume to Firebase Storage
 * - Saves application data to Firestore
 * - Triggers EmailJS notification
 * 
 * Browser-compatible CDN version
 * 
 * @module career-upload-handler
 */

// Get Firebase services from global object
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
 * Verify user is authenticated
 * @returns {Object} { authenticated: boolean, user: Object|null, error: string }
 */
function verifyAuthentication() {
  const services = getFirebaseServices()
  if (!services) {
    logError('Firebase not initialized')
    return {
      authenticated: false,
      user: null,
      error: 'Firebase not initialized. Please refresh the page.'
    }
  }

  const user = services.auth.currentUser

  if (!user) {
    logError('Authentication verification failed: No authenticated user')
    return {
      authenticated: false,
      user: null,
      error: 'You must sign in with Google before applying. Please refresh the page and sign in.'
    }
  }

  if (!user.email) {
    logError('Authentication verification failed: No verified email')
    return {
      authenticated: false,
      user: null,
      error: 'Your Google account does not have a verified email. Please use a different account.'
    }
  }

  logDebug('Authentication verified:', {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName
  })

  return {
    authenticated: true,
    user: {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL
    },
    error: null
  }
}

/**
 * Validate resume file
 * @param {File} file - Resume file to validate
 * @returns {Object} { valid: boolean, error: string }
 */
function validateResumeFile(file) {
  if (!file) {
    return { valid: false, error: 'Resume file is required' }
  }

  const ext = file.name.split('.').pop().toLowerCase()
  if (!UPLOAD_CONFIG.allowedFileTypes.includes(ext)) {
    return { 
      valid: false, 
      error: `Only ${UPLOAD_CONFIG.allowedFileTypes.join(', ').toUpperCase()} files are allowed` 
    }
  }

  if (file.size > UPLOAD_CONFIG.maxFileSize) {
    return { 
      valid: false, 
      error: `File must be under ${UPLOAD_CONFIG.maxFileSize / 1024 / 1024}MB` 
    }
  }

  return { valid: true }
}

/**
 * Extract form data from career form
 * @param {HTMLFormElement} form - Career form element
 * @returns {Object} Form data
 */
function extractFormData(form) {
  const formData = new FormData(form)
  const data = {
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

  logDebug('Extracted form data:', {
    ...data,
    resume: data.resume ? `${data.resume.name} (${data.resume.size} bytes)` : null
  })

  return data
}

/**
 * Upload resume to Firebase Storage
 * @param {File} resumeFile - Resume file to upload
 * @param {string} leadId - Lead ID for organizing storage
 * @returns {Promise<string>} Download URL of uploaded file
 */
function uploadResumeToStorage(resumeFile, leadId) {
  return new Promise((resolve, reject) => {
    const services = getFirebaseServices()
    if (!services) {
      reject(new Error('Firebase not initialized'))
      return
    }

    try {
      logDebug('Uploading resume to Firebase Storage...')

      const fileName = `${leadId}_${resumeFile.name}`
      const storagePath = `career_applications/${leadId}/${fileName}`
      const storageRef = services.storage.ref(storagePath)

      storageRef.put(resumeFile).then(snapshot => {
        logDebug('Resume uploaded successfully:', snapshot.metadata.fullPath)

        return snapshot.ref.getDownloadURL()
      }).then(downloadURL => {
        logDebug('Resume download URL:', downloadURL)
        resolve(downloadURL)
      }).catch(error => {
        logError('Resume upload failed:', error)
        reject(new Error(`Resume upload failed: ${error.message}`))
      })

    } catch (error) {
      logError('Resume upload setup failed:', error)
      reject(new Error(`Resume upload setup failed: ${error.message}`))
    }
  })
}

/**
 * Save career application to Firestore
 * @param {Object} formData - Form data to save
 * @param {string} resumeURL - Download URL of uploaded resume
 * @param {Object} authenticatedUser - Authenticated user object
 * @returns {Promise<Object>} Saved document data
 */
function saveApplicationToFirestore(formData, resumeURL, authenticatedUser) {
  return new Promise((resolve, reject) => {
    const services = getFirebaseServices()
    if (!services) {
      reject(new Error('Firebase not initialized'))
      return
    }

    try {
      logDebug('Saving application to Firestore...')

      // Generate lead ID
      const leadId = `LEAD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

      const applicationData = {
        leadId,
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
          url: resumeURL
        },
        // SECURITY: Store authenticated user information
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
        logDebug('Application saved to Firestore:', {
          docId: docRef.id,
          leadId,
          applicant: formData.name,
          authenticatedUser: authenticatedUser.email
        })

        resolve({
          docId: docRef.id,
          leadId,
          data: applicationData
        })
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
 * @param {Object} applicationData - Application data to include in email
 * @returns {Promise<Object>} Email send result
 */
function sendEmailNotification(applicationData) {
  return new Promise((resolve) => {
    try {
      logDebug('Sending email notification to HR...')

      if (UPLOAD_CONFIG.testMode) {
        logDebug('TEST MODE: Email not sent')
        resolve({ success: true, testMode: true })
        return
      }

      // Call email service if available
      if (typeof sendCareerApplicationEmail === 'function') {
        sendCareerApplicationEmail(applicationData).then(result => {
          logDebug('Email sent successfully:', result)
          resolve(result)
        }).catch(error => {
          logError('Email send failed:', error)
          // Don't throw - email failure shouldn't block the submission
          resolve({ success: false, error: error.message })
        })
      } else {
        logDebug('Email service not available')
        resolve({ success: false, error: 'Email service not available' })
      }

    } catch (error) {
      logError('Email send setup failed:', error)
      // Don't throw - email failure shouldn't block the submission
      resolve({ success: false, error: error.message })
    }
  })
}

/**
 * Handle career form submission
 * @param {Event} event - Form submit event
 */
function handleCareerFormSubmit(event) {
  const form = event.target

  // Verify this is the career form
  if (form.id !== UPLOAD_CONFIG.formId) {
    return
  }

  logDebug('Career form submission intercepted')

  // Prevent default form submission
  event.preventDefault()
  event.stopImmediatePropagation()

  const submitBtn = form.querySelector('[type="submit"], button:not([type="button"])')

  try {
    // SECURITY: Verify authentication FIRST before any processing
    const authCheck = verifyAuthentication()
    if (!authCheck.authenticated) {
      logError('Submission rejected: User not authenticated')
      throw new Error(authCheck.error)
    }

    // Show loading state
    if (submitBtn) {
      submitBtn.disabled = true
      submitBtn.style.opacity = '0.6'
    }

    // Extract form data
    const formData = extractFormData(form)

    // Validate resume file
    const fileValidation = validateResumeFile(formData.resume)
    if (!fileValidation.valid) {
      throw new Error(fileValidation.error)
    }

    // Upload resume to Firebase Storage
    uploadResumeToStorage(formData.resume, `LEAD-${Date.now()}`).then(resumeURL => {
      // Save application to Firestore with authenticated user info
      return saveApplicationToFirestore(formData, resumeURL, authCheck.user)
    }).then(firestoreResult => {
      // Send email notification
      return sendEmailNotification(firestoreResult.data).then(emailResult => {
        return { firestoreResult, emailResult }
      })
    }).then(({ firestoreResult, emailResult }) => {
      logDebug('Career form submission completed successfully', {
        leadId: firestoreResult.leadId,
        docId: firestoreResult.docId,
        emailSent: emailResult.success,
        authenticatedUser: authCheck.user.email
      })

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

      // Reset form
      form.reset()

      // Restore button state
      if (submitBtn) {
        submitBtn.disabled = false
        submitBtn.style.opacity = '1'
      }

    }).catch(error => {
      logError('Career form submission failed:', error)

      // Dispatch error event for modal/toast handling
      form.dispatchEvent(new CustomEvent('career-form-error', {
        detail: {
          error: error.message
        }
      }))

      // Restore button state
      if (submitBtn) {
        submitBtn.disabled = false
        submitBtn.style.opacity = '1'
      }
    })

  } catch (error) {
    logError('Career form submission setup failed:', error)

    // Dispatch error event for modal/toast handling
    form.dispatchEvent(new CustomEvent('career-form-error', {
      detail: {
        error: error.message
      }
    }))

    // Restore button state
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

  // Mark form as handled by this module
  form.setAttribute('data-career-handler', 'true')

  // Attach submit listener with capture phase
  form.addEventListener('submit', handleCareerFormSubmit, true)

  logDebug('Career form handler initialized successfully')
}

/**
 * Wait for DOM to be ready and initialize
 */
function init() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCareerFormHandler)
  } else {
    initCareerFormHandler()
  }
}

// Initialize on module load
init()

// Make functions available globally for testing/debugging
window.CareerUploadHandler = {
  handleCareerFormSubmit,
  extractFormData,
  validateResumeFile,
  uploadResumeToStorage,
  saveApplicationToFirestore,
  sendEmailNotification,
  initCareerFormHandler
}
