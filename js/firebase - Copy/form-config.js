const FORM_COLLECTIONS = {
  contact: 'contact_enquiries',
  quick: 'quick_enquiries',
  vendor: 'vendor_registrations',
  career: 'career_applications',
  callback: 'callback_requests',
  newsletter: 'newsletter',
  comment: 'blog_comments',
  general: 'leads'
}

const FAILED_EMAIL_QUEUE = 'failed_email_queue'

const SUCCESS_MESSAGE = 'Thank you! Your enquiry has been submitted successfully. Our team will contact you shortly.'

const EMAIL_FAILURE_MESSAGE = 'Your information was saved, but the email notification failed to send. Our team has been alerted and will follow up.'

const SUBJECT_LINE = 'WEB ENQUIRY'

const RECIPIENT_EMAIL = 'aaraainfrastructure@gmail.com'

// Form-specific recipient emails for routing applications to appropriate departments
const FORM_RECIPIENT_EMAILS = {
  'Career Form': 'hr@aaraainfrastructure.com',
  'Vendor Registration Form': 'aaraainfrastructure@gmail.com',
  'Contact Form': 'aaraainfrastructure@gmail.com',
  'Quick Enquiry Form': 'aaraainfrastructure@gmail.com',
  'Popup Lead Form': 'aaraainfrastructure@gmail.com',
  'Call Back Request Form': 'aaraainfrastructure@gmail.com',
  'Newsletter Form': 'aaraainfrastructure@gmail.com',
  'Blog Comment Form': 'aaraainfrastructure@gmail.com'
}

export { FORM_COLLECTIONS, FAILED_EMAIL_QUEUE, SUCCESS_MESSAGE, EMAIL_FAILURE_MESSAGE, SUBJECT_LINE, RECIPIENT_EMAIL, FORM_RECIPIENT_EMAILS }
