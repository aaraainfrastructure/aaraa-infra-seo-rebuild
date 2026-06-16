const VALIDATION_RULES = {
  name: {
    required: true,
    minLength: 2,
    maxLength: 100,
    pattern: /^[a-zA-Z\s\-'\.]+$/,
    message: 'Please enter your full name (letters only)'
  },
  email: {
    required: false,
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    message: 'Please enter a valid email address (e.g., name@domain.com)'
  },
  phone: {
    required: true,
    minLength: 10,
    maxLength: 15,
    pattern: /^[0-9+\-\s()]{7,15}$/,
    message: 'Please enter a valid phone number (10 digits required)'
  },
  mobile: {
    required: true,
    minLength: 10,
    maxLength: 15,
    pattern: /^[0-9+\-\s()]{7,15}$/,
    message: 'Please enter a valid mobile number (10 digits required)'
  },
  message: {
    required: false,
    minLength: 10,
    maxLength: 5000,
    message: 'Please provide more detail (at least 10 characters)'
  },
  requirement: {
    required: false,
    minLength: 10,
    maxLength: 5000,
    message: 'Please provide more detail about your requirement (min 10 characters)'
  },
  subject: {
    required: false,
    message: 'Please select a subject from the list'
  },
  company: {
    required: false,
    minLength: 2,
    maxLength: 200,
    message: 'Please enter your company name'
  },
  position: {
    required: false,
    message: 'Please enter the position you are applying for'
  },
  resume: {
    required: false,
    fileTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    maxSize: 10 * 1024 * 1024,
    message: 'Please upload a PDF or DOC file (max 10MB)'
  }
}

const RATE_LIMIT = {
  maxSubmissions: 5,
  windowMs: 60000,
  storage: new Map()
}

function getRateLimitKey() {
  const fingerprint = []
  if (navigator.webdriver) fingerprint.push('bot')
  fingerprint.push(navigator.userAgent || 'unknown')
  fingerprint.push(screen.width + 'x' + screen.height)
  return fingerprint.join('::')
}

function checkRateLimit() {
  const key = getRateLimitKey()
  const now = Date.now()
  const window = RATE_LIMIT.windowMs

  if (!RATE_LIMIT.storage.has(key)) {
    RATE_LIMIT.storage.set(key, [])
  }

  const timestamps = RATE_LIMIT.storage.get(key).filter(t => now - t < window)
  RATE_LIMIT.storage.set(key, timestamps)

  if (timestamps.length >= RATE_LIMIT.maxSubmissions) {
    return { allowed: false, retryAfter: Math.ceil((timestamps[0] + window - now) / 1000) }
  }

  timestamps.push(now)
  return { allowed: true }
}

function detectFieldType(input) {
  const name = (input.name || '').toLowerCase()
  const id = (input.id || '').toLowerCase()
  const type = input.type || ''
  const placeholder = (input.placeholder || '').toLowerCase()
  const combined = name + '|' + id + '|' + type + '|' + placeholder

  if (type === 'email' || combined.includes('email')) return 'email'
  if (type === 'tel' || combined.includes('phone') || combined.includes('mobile') || combined.includes('contact')) return 'phone'
  if (type === 'file' || combined.includes('resume') || combined.includes('upload')) return 'file'
  if (type === 'textarea' || combined.includes('message') || combined.includes('description') || combined.includes('comment') || combined.includes('requirement')) return 'textarea'
  if (type === 'checkbox') return 'checkbox'
  if (type === 'hidden') return 'hidden'
  if (combined.includes('name') && !combined.includes('company')) return 'name'
  if (combined.includes('company') || combined.includes('organization')) return 'company'
  if (combined.includes('subject')) return 'subject'
  if (combined.includes('position') || combined.includes('job')) return 'position'
  if (combined.includes('budget')) return 'budget'
  if (combined.includes('city') || combined.includes('location')) return 'city'
  if (combined.includes('project') || combined.includes('type') || combined.includes('service')) return 'projectType'
  if (combined.includes('url') || combined.includes('website')) return 'hidden'

  return 'text'
}

function getFieldValue(input) {
  if (input.type === 'checkbox') return input.checked ? input.value || 'Yes' : ''
  if (input.type === 'radio') {
    const name = input.name
    const checked = document.querySelector(`input[name="${name}"]:checked`)
    return checked ? checked.value : ''
  }
  if (input.type === 'file') return input.files && input.files.length > 0 ? input.files[0].name : ''
  if (input.tagName === 'SELECT') {
    const selected = input.options[input.selectedIndex]
    return selected ? selected.value || selected.text : ''
  }
  return input.value.trim()
}

function validateField(input) {
  const fieldType = detectFieldType(input)
  const rules = VALIDATION_RULES[fieldType]
  const value = getFieldValue(input)
  const errors = []

  if (!rules) return []

  const isEmpty = value === '' || value === null || value === undefined
  const isRequired = input.required || input.hasAttribute('required') || input.dataset.required === 'true' || rules.required

  if (isEmpty && isRequired) {
    errors.push({ field: input, message: rules.message || 'This field is required' })
    return errors
  }

  if (isEmpty) return []

  if (rules.pattern && !rules.pattern.test(value)) {
    errors.push({ field: input, message: rules.message || 'Invalid format' })
    return errors
  }

  if (rules.minLength && value.length < rules.minLength) {
    errors.push({ field: input, message: `Minimum ${rules.minLength} characters required` })
    return errors
  }

  if (rules.maxLength && value.length > rules.maxLength) {
    errors.push({ field: input, message: `Maximum ${rules.maxLength} characters` })
    return errors
  }

  if (fieldType === 'phone' || fieldType === 'mobile') {
    const digits = value.replace(/\D/g, '')
    if (digits.length < 10) {
      errors.push({ field: input, message: 'Phone number must have at least 10 digits' })
    } else if (digits.length > 15) {
      errors.push({ field: input, message: 'Phone number is too long (max 15 digits)' })
    } else if (digits.length === 10 && !/^[6-9]/.test(digits)) {
      errors.push({ field: input, message: 'Indian mobile number must start with 6, 7, 8, or 9' })
    }
  }

  if (fieldType === 'file' && rules.fileTypes && input.files && input.files.length > 0) {
    for (const file of input.files) {
      if (!rules.fileTypes.includes(file.type)) {
        errors.push({ field: input, message: rules.message || 'Invalid file type' })
        break
      }
      if (rules.maxSize && file.size > rules.maxSize) {
        errors.push({ field: input, message: `File too large (max ${rules.maxSize / 1024 / 1024}MB)` })
        break
      }
    }
  }

  return errors
}

function validateForm(form) {
  const inputs = form.querySelectorAll('input, textarea, select')
  let allErrors = []

  inputs.forEach(input => {
    if (input.type === 'submit' || input.type === 'button' || input.type === 'hidden') return
    const errors = validateField(input)
    allErrors = allErrors.concat(errors)
  })

  return allErrors
}

function showFieldError(input, message) {
  clearFieldError(input)
  const wrapper = input.closest('.form-group') || input.closest('fieldset') || input.parentElement
  const errorEl = document.createElement('span')
  errorEl.className = 'firebase-field-error'
  errorEl.style.cssText = 'color:#e74c3c;font-size:0.85rem;margin-top:4px;display:block;'
  errorEl.setAttribute('role', 'alert')
  errorEl.textContent = message

  input.classList.add('firebase-invalid')
  input.setAttribute('aria-invalid', 'true')
  input.style.borderColor = '#e74c3c'

  wrapper.appendChild(errorEl)
}

function clearFieldError(input) {
  input.classList.remove('firebase-invalid')
  input.removeAttribute('aria-invalid')

  const wrapper = input.closest('.form-group') || input.closest('fieldset') || input.parentElement
  const existing = wrapper.querySelector('.firebase-field-error')
  if (existing) existing.remove()

  if (input.dataset.originalBorderColor) {
    input.style.borderColor = input.dataset.originalBorderColor
  } else {
    input.style.borderColor = ''
  }
}

function clearAllErrors(form) {
  form.querySelectorAll('.firebase-field-error').forEach(el => el.remove())
  form.querySelectorAll('.firebase-invalid').forEach(el => {
    el.classList.remove('firebase-invalid')
    el.removeAttribute('aria-invalid')
    el.style.borderColor = ''
  })
  form.querySelectorAll('.firebase-form-error').forEach(el => el.remove())
}

function showFormError(form, message) {
  clearAllErrors(form)
  const errorEl = document.createElement('div')
  errorEl.className = 'firebase-form-error'
  errorEl.style.cssText = 'background:#fde8e8;color:#c53030;padding:12px 16px;border-radius:8px;margin-bottom:16px;font-size:0.95rem;'
  errorEl.setAttribute('role', 'alert')
  errorEl.textContent = message

  const firstField = form.querySelector('input, textarea, select')
  if (firstField) {
    firstField.parentElement.insertBefore(errorEl, firstField)
  } else {
    form.insertBefore(errorEl, form.firstChild)
  }
}

function checkHoneypot(form) {
  const honeypotFields = form.querySelectorAll('input[type="text"].honeypot, input.honeypot, [data-honeypot]')
  for (const field of honeypotFields) {
    if (field.value && field.value.trim() !== '') {
      return true
    }
  }
  return false
}

function injectHoneypot(form) {
  const hp = document.createElement('input')
  hp.type = 'text'
  hp.className = 'honeypot'
  hp.name = 'website_' + Math.random().toString(36).substring(2, 8)
  hp.tabIndex = -1
  hp.autocomplete = 'off'
  hp.style.cssText = 'position:absolute;left:-9999px;top:-9999px;opacity:0;height:0;width:0;'
  hp.setAttribute('aria-hidden', 'true')
  hp.setAttribute('data-honeypot', 'true')
  form.insertBefore(hp, form.firstChild)
}

export {
  validateForm,
  validateField,
  showFieldError,
  clearFieldError,
  clearAllErrors,
  showFormError,
  checkHoneypot,
  injectHoneypot,
  checkRateLimit,
  detectFieldType,
  getFieldValue
}
