import { db, analytics } from './firebase-config.js'
import {
  collection,
  addDoc,
  serverTimestamp,
  runTransaction,
  doc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  updateDoc
} from 'firebase/firestore'
import { logEvent } from 'firebase/analytics'
import { FORM_COLLECTIONS, FAILED_EMAIL_QUEUE } from './form-config.js'
import { sendEmailNotification } from './email-service.js'

const COLLECTIONS = {
  leads: 'leads',
  newsletter: 'newsletter',
  callbackRequests: 'callback_requests',
  contactMessages: 'contact_messages',
  contactEnquiries: 'contact_enquiries',
  quickEnquiries: 'quick_enquiries',
  vendorRegistrations: 'vendor_registrations',
  careerApplications: 'career_applications'
}

const LEAD_STATUS = {
  NEW: 'new',
  CONTACTED: 'contacted',
  QUALIFIED: 'qualified',
  PROPOSAL: 'proposal',
  WON: 'won',
  LOST: 'lost',
  SPAM: 'spam'
}

const OFFLINE_QUEUE_KEY = 'aaraa_firebase_offline_queue'
const EMAIL_RETRY_MAX = 3

const FORM_TYPE_TO_COLLECTION = {
  'Contact Form': FORM_COLLECTIONS.contact,
  'Quick Enquiry Form': FORM_COLLECTIONS.quick,
  'Vendor Registration Form': FORM_COLLECTIONS.vendor,
  'Career Form': FORM_COLLECTIONS.career,
  'Call Back Request Form': FORM_COLLECTIONS.callback,
  'Popup Lead Form': FORM_COLLECTIONS.contact,
  'Newsletter Form': FORM_COLLECTIONS.newsletter,
  'Blog Comment Form': FORM_COLLECTIONS.comment,
  'Free Consultation Form': FORM_COLLECTIONS.general,
  'WhatsApp Inquiry Form': FORM_COLLECTIONS.general,
  'General Enquiry': FORM_COLLECTIONS.general
}

function getCollectionForFormType(formType) {
  return FORM_TYPE_TO_COLLECTION[formType] || FORM_COLLECTIONS.general
}

function generateLeadId() {
  const prefix = 'AAR'
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  const counter = String(Math.floor(Math.random() * 1000)).padStart(3, '0')
  return `${prefix}-${timestamp}-${random}-${counter}`
}

function enrichWithTracking(formType) {
  const u = navigator.userAgent || ''
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(u)
  const isTablet = /iPad|Android(?!.*Mobile)/i.test(u)

  let device = 'desktop'
  if (isMobile) device = 'mobile'
  if (isTablet) device = 'tablet'

  let browser = 'unknown'
  if (u.includes('Chrome') && !u.includes('Edg')) browser = 'Chrome'
  else if (u.includes('Firefox')) browser = 'Firefox'
  else if (u.includes('Safari') && !u.includes('Chrome')) browser = 'Safari'
  else if (u.includes('Edg')) browser = 'Edge'
  else if (u.includes('MSIE') || u.includes('Trident')) browser = 'Internet Explorer'

  const urlParams = new URLSearchParams(window.location.search)
  const now = new Date().toISOString()

  return {
    leadId: generateLeadId(),
    sourcePage: window.location.href,
    pageTitle: document.title,
    formType: formType || 'unknown',
    device,
    browser,
    submittedCity: guessCity(),
    createdAt: now,
    status: LEAD_STATUS.NEW,
    utm_source: urlParams.get('utm_source') || '',
    utm_medium: urlParams.get('utm_medium') || '',
    utm_campaign: urlParams.get('utm_campaign') || '',
    utm_term: urlParams.get('utm_term') || '',
    utm_content: urlParams.get('utm_content') || '',
    gclid: urlParams.get('gclid') || '',
    fbclid: urlParams.get('fbclid') || '',
    timestamp: now
  }
}

function guessCity() {
  const selectors = [
    'input[name="city"]',
    'input[name="location"]',
    'input[name="submittedCity"]',
    '[data-city]',
    '#city',
    '#location'
  ]
  for (const sel of selectors) {
    const el = document.querySelector(sel)
    if (el) {
      const val = el.value || el.textContent || el.dataset.city || ''
      if (val.trim()) return val.trim()
    }
  }

  const meta = document.querySelector('meta[name="geo.placename"]')
  if (meta) return meta.content

  return ''
}

function extractFormData(form) {
  const data = {}
  const formData = new FormData(form)

  for (const [key, value] of formData.entries()) {
    if (key.startsWith('_') || key.startsWith('utm_') || key === 'gclid' || key === 'fbclid') continue
    if (value instanceof File) {
      if (value.name) {
        data[key] = { fileName: value.name, fileSize: value.size, fileType: value.type }
      }
      continue
    }
    const trimmed = value.trim()
    if (trimmed) {
      data[key] = trimmed
    }
  }

  const fieldMap = {
    name: ['name', 'fullname', 'clientName', 'contactPerson', 'signatoryName', 'your-name'],
    email: ['email', 'mail', 'clientEmail', 'emailAddress', 'your-email'],
    phone: ['phone', 'mobile', 'telephone', 'tel', 'clientPhone', 'callback-phone', 'lead-phone', 'phoneNumber', 'your-phone', 'signatoryContact'],
    message: ['message', 'description', 'comment', 'details', 'requirement', 'projectBrief', 'your-message', 'comments', 'productDetails'],
    company: ['company', 'companyName', 'organization', 'organisation', 'company_name'],
    city: ['city', 'location', 'submittedCity'],
    projectType: ['project_type', 'projectType', 'service', 'sector', 'reason', 'subject', 'budget'],
    position: ['position', 'job', 'jobTitle', 'applyingFor'],
    aadhaar: ['aadhaar', 'aadhar'],
    pan: ['pan', 'panNumber'],
    gst: ['gst', 'gstNumber']
  }

  const normalized = {}
  for (const [standard, aliases] of Object.entries(fieldMap)) {
    for (const alias of aliases) {
      if (data[alias] !== undefined) {
        normalized[standard] = typeof data[alias] === 'object' ? data[alias] : data[alias]
        break
      }
    }
  }

  const subjectSelect = form.querySelector('select[name="subject"]')
  if (subjectSelect) {
    const selected = subjectSelect.options[subjectSelect.selectedIndex]
    normalized.projectType = normalized.projectType || (selected ? selected.text : '')
  }

  const niceSelect = form.querySelector('.nice-select .current')
  if (niceSelect && niceSelect.textContent && niceSelect.textContent !== 'Subject wants to support') {
    normalized.projectType = normalized.projectType || niceSelect.textContent.trim()
  }

  return { raw: data, normalized }
}

function normalizeLeadData(form, formType) {
  const { raw, normalized } = extractFormData(form)
  const tracking = enrichWithTracking(formType)

  const leadData = {
    ...tracking,
    name: normalized.name || '',
    email: normalized.email || '',
    mobile: normalized.phone || normalized.mobile || '',
    phone: normalized.phone || normalized.mobile || '',
    requirement: normalized.message || raw.message || raw.requirement || '',
    city: normalized.city || tracking.submittedCity || '',
    projectType: normalized.projectType || '',
    company: normalized.company || '',
    position: normalized.position || '',
    aadhaar: normalized.aadhaar || '',
    pan: normalized.pan || '',
    gst: normalized.gst || '',
    rawData: JSON.stringify(raw),
    updatedAt: tracking.createdAt
  }

  if (form.dataset.service) leadData.service = form.dataset.service
  if (form.dataset.city) leadData.city = form.dataset.city

  Object.assign(leadData, raw)

  return leadData
}

function addToOfflineQueue(data, collectionName) {
  try {
    const queue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]')
    queue.push({ data, collection: collectionName, timestamp: Date.now() })
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue))
    return true
  } catch {
    return false
  }
}

async function processOfflineQueue() {
  try {
    const queue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]')
    if (queue.length === 0) return { processed: 0, failed: 0 }

    let processed = 0
    let failed = 0
    const remaining = []

    for (const item of queue) {
      try {
        const colRef = collection(db, item.collection)
        await addDoc(colRef, {
          ...item.data,
          createdAt: serverTimestamp(),
          restoredFromQueue: true,
          restoredAt: new Date().toISOString()
        })
        processed++
      } catch {
        if (Date.now() - item.timestamp < 86400000) {
          remaining.push(item)
        }
        failed++
      }
    }

    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining))
    return { processed, failed }
  } catch {
    return { processed: 0, failed: 1 }
  }
}

async function submitToFirestore(data, collectionName) {
  const colRef = collection(db, collectionName)

  try {
    const docRef = await addDoc(colRef, {
      ...data,
      createdAt: serverTimestamp()
    })

    if (analytics) {
      logEvent(analytics, 'lead_generated', {
        form_type: data.formType,
        lead_id: data.leadId,
        source_page: data.sourcePage,
        collection: collectionName
      })
    }

    return { success: true, id: docRef.id, leadId: data.leadId }
  } catch (err) {
    if (err.code === 'unavailable' || err.code === 'failed-precondition') {
      const queued = addToOfflineQueue({ ...data, savedAt: new Date().toISOString() }, collectionName)
      if (queued) {
        return { success: true, offline: true, leadId: data.leadId, message: 'Saved offline. Will sync when connection restores.' }
      }
    }
    throw err
  }
}

async function storeFailedEmail(firestoreDocId, leadId, formType, formData, normalizedData, errorReason) {
  try {
    const colRef = collection(db, FAILED_EMAIL_QUEUE)
    await addDoc(colRef, {
      leadId,
      firestoreDocId: firestoreDocId || '',
      formType,
      formData,
      normalizedData,
      emailError: errorReason,
      retryCount: 0,
      maxRetries: EMAIL_RETRY_MAX,
      status: 'pending',
      sourcePage: window.location.href,
      pageTitle: document.title,
      createdAt: serverTimestamp(),
      nextRetryAt: new Date(Date.now() + 300000).toISOString()
    })
    console.log('[Lead Service] Stored failed email in failed_email_queue for lead:', leadId)
  } catch (queueErr) {
    console.error('[Lead Service] Failed to store email failure record in Firestore:', queueErr)
  }
}

async function processFailedEmailQueue() {
  try {
    const colRef = collection(db, FAILED_EMAIL_QUEUE)
    const q = query(
      colRef,
      where('status', '==', 'pending'),
      where('nextRetryAt', '<=', new Date().toISOString()),
      orderBy('nextRetryAt', 'asc'),
      limit(10)
    )
    const snapshot = await getDocs(q)

    let processed = 0
    let failed = 0

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data()
      try {
        const result = await sendEmailNotification(data.formData, data.formType)
        if (result.sent) {
          await updateDoc(docSnap.ref, {
            status: 'delivered',
            deliveredAt: serverTimestamp(),
            retryCount: data.retryCount + 1
          })
          console.log('[Lead Service] Retry succeeded for failed email, lead:', data.leadId)
          processed++
        } else {
          const newRetryCount = (data.retryCount || 0) + 1
          if (newRetryCount >= EMAIL_RETRY_MAX) {
            await updateDoc(docSnap.ref, {
              status: 'permanent_failure',
              retryCount: newRetryCount,
              lastError: result.reason,
              lastAttemptAt: serverTimestamp()
            })
            console.error('[Lead Service] Permanent failure for email retry, lead:', data.leadId)
          } else {
            await updateDoc(docSnap.ref, {
              retryCount: newRetryCount,
              lastError: result.reason,
              lastAttemptAt: serverTimestamp(),
              nextRetryAt: new Date(Date.now() + 300000).toISOString()
            })
          }
          failed++
        }
      } catch (retryErr) {
        console.error('[Lead Service] Retry attempt error for lead:', data.leadId, retryErr)
        failed++
      }
    }

    return { processed, failed }
  } catch {
    return { processed: 0, failed: 0 }
  }
}

async function sendEmailWithFallback(firestoreResult, formData, formType, normalizedData) {
  if (!firestoreResult.success || firestoreResult.offline) {
    return { sent: false, reason: 'offline_or_not_saved' }
  }

  try {
    const emailResult = await sendEmailNotification(formData, formType)

    if (emailResult.sent) {
      console.log('[Lead Service] Delivery verified — lead', firestoreResult.leadId, {
        firestoreDocId: firestoreResult.id,
        formType,
        emailStatus: emailResult.status
      })
      return { sent: true }
    }

    console.error('[Lead Service] Email sending failed after retries for lead:', firestoreResult.leadId, {
      reason: emailResult.reason,
      formType
    })

    await storeFailedEmail(
      firestoreResult.id,
      firestoreResult.leadId,
      formType,
      formData,
      normalizedData,
      emailResult.reason
    )

    return { sent: false, reason: emailResult.reason }
  } catch (err) {
    console.error('[Lead Service] Unexpected email error for lead:', firestoreResult.leadId, err)

    await storeFailedEmail(
      firestoreResult.id,
      firestoreResult.leadId,
      formType,
      formData,
      normalizedData,
      err.message || 'unknown'
    )

    return { sent: false, reason: err.message || 'unknown' }
  }
}

async function submitLead(form, formType) {
  const collectionName = getCollectionForFormType(formType)
  const leadData = normalizeLeadData(form, formType)
  const firestoreResult = await submitToFirestore(leadData, collectionName)

  let emailSent = false
  let emailStatus = { sent: false, reason: 'not_attempted' }

  if (firestoreResult.success && !firestoreResult.offline) {
    const rawFormData = extractFormData(form).raw
    const emailResult = await sendEmailWithFallback(firestoreResult, rawFormData, formType, leadData)
    emailSent = emailResult.sent
    emailStatus = emailResult
  }

  return { ...firestoreResult, emailSent, emailStatus }
}

async function submitNewsletter(email) {
  const data = {
    email,
    subscribedAt: new Date().toISOString(),
    sourcePage: window.location.href,
    pageTitle: document.title,
    ...enrichWithTracking('newsletter')
  }
  const firestoreResult = await submitToFirestore(data, COLLECTIONS.newsletter)

  let emailSent = false
  let emailStatus = { sent: false, reason: 'not_attempted' }

  if (firestoreResult.success && !firestoreResult.offline) {
    const emailResult = await sendEmailWithFallback(firestoreResult, { email }, 'Newsletter Form', data)
    emailSent = emailResult.sent
    emailStatus = emailResult
  }

  return { ...firestoreResult, emailSent, emailStatus }
}

async function submitCallbackRequest(form, formType) {
  const { normalized, raw } = extractFormData(form)
  const tracking = enrichWithTracking(formType)
  const data = {
    ...tracking,
    name: normalized.name || '',
    phone: normalized.phone || '',
    email: normalized.email || '',
    message: normalized.message || '',
    requestedAt: tracking.createdAt,
    status: LEAD_STATUS.NEW,
    calledBack: false
  }
  const firestoreResult = await submitToFirestore(data, FORM_COLLECTIONS.callback)

  let emailSent = false
  let emailStatus = { sent: false, reason: 'not_attempted' }

  if (firestoreResult.success && !firestoreResult.offline) {
    const emailResult = await sendEmailWithFallback(firestoreResult, raw, formType, data)
    emailSent = emailResult.sent
    emailStatus = emailResult
  }

  return { ...firestoreResult, emailSent, emailStatus }
}

async function submitContactMessage(form, formType) {
  const collectionName = getCollectionForFormType(formType)
  const leadData = normalizeLeadData(form, formType)
  const firestoreResult = await submitToFirestore(leadData, collectionName)

  let emailSent = false
  let emailStatus = { sent: false, reason: 'not_attempted' }

  if (firestoreResult.success && !firestoreResult.offline) {
    const rawFormData = extractFormData(form).raw
    const emailResult = await sendEmailWithFallback(firestoreResult, rawFormData, formType, leadData)
    emailSent = emailResult.sent
    emailStatus = emailResult
  }

  return { ...firestoreResult, emailSent, emailStatus }
}

async function checkDuplicate(form, formType) {
  const { normalized } = extractFormData(form)
  if (!normalized.phone && !normalized.email) return false

  const colRef = collection(db, COLLECTIONS.leads)
  const constraints = []

  if (normalized.phone) {
    constraints.push(where('mobile', '==', normalized.phone))
  }
  if (normalized.email) {
    constraints.push(where('email', '==', normalized.email))
  }

  try {
    const q = query(colRef, ...constraints, orderBy('createdAt', 'desc'), limit(1))
    const snapshot = await getDocs(q)
    if (!snapshot.empty) {
      const existing = snapshot.docs[0].data()
      const timeDiff = Date.now() - new Date(existing.createdAt).getTime()
      return timeDiff < 300000
    }
  } catch {
  }
  return false
}

function getCollectionStats() {
  return {
    collections: Object.values(COLLECTIONS),
    leadStatuses: Object.values(LEAD_STATUS),
    offlineQueueKey: OFFLINE_QUEUE_KEY
  }
}

export {
  submitLead,
  submitNewsletter,
  submitCallbackRequest,
  submitContactMessage,
  checkDuplicate,
  processOfflineQueue,
  processFailedEmailQueue,
  generateLeadId,
  normalizeLeadData,
  enrichWithTracking,
  extractFormData,
  getCollectionStats,
  getCollectionForFormType,
  LEAD_STATUS,
  COLLECTIONS
}
