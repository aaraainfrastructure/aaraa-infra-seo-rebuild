const EMAILJS_CONFIG = {
  publicKey: 'IjYG5p73utSCKM2iF',
  serviceId: 'service_fyhacbv',
  templateId: 'template_gm1koy9'
}

const MAX_RETRIES = 3
const RETRY_DELAY_MS = 1000

function ensureEmailJS() {
  if (typeof window.emailjs === 'undefined') {
    throw new Error('EmailJS SDK not loaded. Ensure js/lib/emailjs.bundle.min.js is included before this script.')
  }
  window.emailjs.init(EMAILJS_CONFIG.publicKey)
}

function formatFormDetails(formData, formType) {
  const lines = [`Form Type: ${formType}`, `Submitted From: ${window.location.href}`, `Page Title: ${document.title}`, `Submitted At: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`, '']

  for (const [key, value] of Object.entries(formData)) {
    if (key.startsWith('_') || key === 'gclid' || key === 'fbclid') continue
    if (value instanceof File) {
      if (value.name) {
        lines.push(`${formatLabel(key)}: ${value.name} (${(value.size / 1024).toFixed(1)} KB)`)
      }
      continue
    }
    if (value && value.trim()) {
      lines.push(`${formatLabel(key)}: ${value.trim()}`)
    }
  }

  return lines.join('\n')
}

function formatLabel(key) {
  const labels = {
    name: 'Name',
    fullname: 'Full Name',
    clientName: 'Client Name',
    contactPerson: 'Contact Person',
    signatoryName: 'Signatory Name',
    email: 'Email',
    mail: 'Email',
    clientEmail: 'Email',
    phone: 'Phone',
    mobile: 'Mobile',
    telephone: 'Telephone',
    clientPhone: 'Phone',
    signatoryContact: 'Signatory Contact',
    subject: 'Subject',
    message: 'Message',
    description: 'Description',
    requirement: 'Requirement',
    company: 'Company',
    companyName: 'Company Name',
    position: 'Position',
    aadhaar: 'Aadhaar Number',
    pan: 'PAN Number',
    gst: 'GST Number',
    cin: 'CIN',
    msme: 'MSME Number',
    bankAccount: 'Bank Account',
    ifsc: 'IFSC Code',
    bankName: 'Bank Name',
    bankBranch: 'Bank Branch',
    signatoryDesignation: 'Signatory Designation',
    address: 'Address',
    productDetails: 'Product Details',
    experience: 'Experience',
    exp_req: 'Experience Required',
    salary: 'Expected Salary',
    location: 'Location',
    resume: 'Resume',
    service: 'Service',
    project_type: 'Project Type',
    budget: 'Budget',
    city: 'City',
    terms: 'Terms Accepted',
    save: 'Save Info'
  }
  return labels[key] || key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')
}

function buildErrorDetail(err) {
  if (!err) return 'Unknown email service error'

  if (err.status === 412 || err.status === 413) {
    return `Email service configuration error (${err.status}). Please contact support.`
  }
  if (err.status === 429) {
    return 'Email service temporarily rate-limited. Please try again later.'
  }
  if (err.status && err.status >= 500) {
    return `Email server error (${err.status}). Please try again later.`
  }
  if (err.name === 'TypeError' && err.message.includes('fetch')) {
    return 'Network error: Could not reach email service. Please check your connection.'
  }
  if (err.name === 'TypeError' && err.message.includes('emailjs')) {
    return 'Email library not loaded. Please refresh the page.'
  }
  if (err.text) {
    return `Email error: ${err.text}`
  }
  const msg = err.message || String(err)
  return msg.length > 150 ? msg.substring(0, 150) + '...' : msg
}

function buildEmailParams(formData, formType) {
  const details = formatFormDetails(formData, formType)
  
  // Route career applications to HR email, all others to main email
  let recipientEmail = 'aaraainfrastructure@gmail.com'
  let emailSubject = 'WEB ENQUIRY'
  
  if (formType === 'Career Form') {
    recipientEmail = 'hr@aaraainfrastructure.com'
    emailSubject = 'NEW CAREER APPLICATION'
  }

  return {
    to_email: recipientEmail,
    subject: emailSubject,
    form_type: formType,
    form_details: details,
    page_url: window.location.href,
    page_title: document.title,
    submission_time: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
  }
}

function sendEmailNotification(formData, formType, retryCount = 0) {
  return new Promise((resolve, reject) => {
    try {
      ensureEmailJS()

      const templateParams = buildEmailParams(formData, formType)

      console.log('[Email Service] Sending email notification', {
        formType,
        to: templateParams.to_email,
        attempt: retryCount + 1,
        maxAttempts: MAX_RETRIES + 1
      })

      window.emailjs.send(
        EMAILJS_CONFIG.serviceId,
        EMAILJS_CONFIG.templateId,
        templateParams
      ).then(response => {
        if (response && response.status === 200) {
          console.log('[Email Service] EMAIL SEND SUCCESS', {
            formType,
            status: response.status,
            text: response.text,
            to: templateParams.to_email,
            timestamp: new Date().toISOString()
          })
          resolve({ sent: true, status: response.status })
        } else {
          throw new Error(`Email delivery failed (status ${response?.status || 'unknown'})`)
        }
      }).catch(err => {
        const errorDetail = buildErrorDetail(err)
        console.error('[Email Service] EMAIL SEND FAILED', {
          error: errorDetail,
          status: err.status || null,
          text: err.text || null,
          formType,
          retryCount,
          maxRetries: MAX_RETRIES,
          timestamp: new Date().toISOString()
        })

        if (retryCount < MAX_RETRIES) {
          const delay = RETRY_DELAY_MS * Math.pow(2, retryCount)
          console.log(`[Email Service] Retrying in ${delay}ms (attempt ${retryCount + 2}/${MAX_RETRIES + 1})`)
          setTimeout(() => {
            sendEmailNotification(formData, formType, retryCount + 1).then(resolve).catch(reject)
          }, delay)
        } else {
          console.error('[Email Service] EXHAUSTED ALL RETRIES — email permanently failed', {
            formType,
            retryCount: MAX_RETRIES,
            finalError: errorDetail
          })

          resolve({ sent: false, reason: errorDetail, retryCount })
        }
      })

    } catch (err) {
      const errorDetail = buildErrorDetail(err)
      console.error('[Email Service] EMAIL SERVICE ERROR', {
        error: errorDetail,
        formType,
        timestamp: new Date().toISOString()
      })
      resolve({ sent: false, reason: errorDetail })
    }
  })
}

/**
 * Send career application email to HR
 * Specialized wrapper for career form submissions
 * @param {Object} applicationData - Career application data
 * @returns {Promise<Object>} Email send result
 */
function sendCareerApplicationEmail(applicationData) {
  return sendEmailNotification(applicationData, 'Career Form')
}
