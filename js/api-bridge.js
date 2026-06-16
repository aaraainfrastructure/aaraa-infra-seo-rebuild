/**
 * AARAA API Bridge - Firebase to Backend Integration
 * =====================================================
 * Bridges Firebase form data to /api/submit endpoint
 * Ensures all forms send proper FormData with all required fields
 * Handles field name mismatches and provides fallback mechanism
 * 
 * Features:
 * - Field mapping configuration (mail -> email, etc.)
 * - FormData preparation for multer
 * - Network resilience with retry logic
 * - Comprehensive error handling
 * - Fallback to Firebase if backend fails
 */

// ============================================================================
// FIELD MAPPING CONFIGURATION
// ============================================================================
// Maps various field names used across forms to standardized API field names
const FIELD_MAPPING = {
  // Name variations
  'name': 'name',
  'fullname': 'name',
  'full_name': 'name',
  'full-name': 'name',
  'clientName': 'name',
  'client_name': 'name',
  'contactPerson': 'name',
  'contact_person': 'name',
  'signatoryName': 'name',
  'signatory_name': 'name',

  // Email variations
  'email': 'email',
  'mail': 'email',
  'email_address': 'email',
  'emailAddress': 'email',
  'email-address': 'email',
  'clientEmail': 'email',
  'client_email': 'email',
  'sender_email': 'email',

  // Phone variations
  'phone': 'phone',
  'mobile': 'phone',
  'telephone': 'phone',
  'tel': 'phone',
  'phone_number': 'phone',
  'phoneNumber': 'phone',
  'mobile_number': 'phone',
  'mobileNumber': 'phone',
  'clientPhone': 'phone',
  'client_phone': 'phone',
  'signatoryContact': 'phone',

  // Message variations
  'message': 'message',
  'description': 'message',
  'msg': 'message',
  'comment': 'message',
  'comments': 'message',
  'requirement': 'message',
  'requirements': 'message',
  'inquiry': 'message',
  'enquiry': 'message',
  'notes': 'message',

  // Lead type variations
  'leadType': 'leadType',
  'lead_type': 'leadType',
  'reason': 'leadType',
  'reason_for_contact': 'leadType',
  'reasonForContact': 'leadType',
  'category': 'leadType',
  'service': 'leadType',
  'project_type': 'leadType',
  'projectType': 'leadType',
  'inquiry_type': 'leadType',
  'inquiryType': 'leadType',

  // Additional fields
  'company': 'company',
  'company_name': 'company',
  'companyName': 'company',
  'aadhaar': 'aadhaar',
  'aadhaar_number': 'aadhaar',
  'aadhaarNumber': 'aadhaar',
  'pan': 'pan',
  'pan_number': 'pan',
  'panNumber': 'pan',
  'gst': 'gst',
  'gst_number': 'gst',
  'gstNumber': 'gst',
  'address': 'address',
  'location': 'location',
  'city': 'city'
};

// ============================================================================
// DEFAULT LEAD TYPE MAPPING
// ============================================================================
const DEFAULT_LEAD_TYPES = {
  'vendor': 'Vendor Inquiry',
  'subcontractor': 'Subcontractor Inquiry',
  'partner': 'Partnership Inquiry',
  'general': 'General Inquiry',
  'contact': 'Contact Inquiry',
  'quick': 'Quick Inquiry',
  'career': 'Career Inquiry',
  'callback': 'Callback Request',
  'newsletter': 'Newsletter Subscription',
  'enquiry': 'Project Enquiry'
};

// ============================================================================
// CORE API BRIDGE FUNCTIONS
// ============================================================================

/**
 * Resolve the backend URL based on the current environment
 */
function getBackendUrl(endpoint) {
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1' || host === '') {
    return `http://localhost:3001${endpoint}`;
  }
  return endpoint;
}

/**
 * Normalize field names from form data
 */
function normalizeFieldNames(data) {
  const normalized = {};
  
  // Convert FormData to Object if needed
  const dataObj = data instanceof FormData ? Object.fromEntries(data) : data;
  
  for (const [key, value] of Object.entries(dataObj)) {
    // Skip empty values and system fields
    if (!value || key.startsWith('_') || key === 'gclid' || key === 'fbclid') {
      continue;
    }
    
    // Map the field name
    const mappedKey = FIELD_MAPPING[key] || key;
    
    // Store the normalized value
    normalized[mappedKey] = typeof value === 'string' ? value.trim() : value;
  }
  
  return normalized;
}

/**
 * Ensure all required fields are present
 */
function ensureRequiredFields(data, formType) {
  const enriched = { ...data };
  
  if (!enriched.name || enriched.name === '') {
    enriched.name = 'Not provided';
  }
  
  if (!enriched.email || enriched.email === '') {
    enriched.email = 'noreply@aaraainfrastructure.com';
  }
  
  if (!enriched.phone || enriched.phone === '') {
    enriched.phone = 'Not provided';
  }
  
  if (!enriched.message) {
    enriched.message = formType || 'No message provided';
  }
  
  if (!enriched.leadType || enriched.leadType === '') {
    enriched.leadType = mapFormTypeToLeadType(formType);
  }
  
  return enriched;
}

/**
 * Map form type to lead type
 */
function mapFormTypeToLeadType(formType) {
  if (!formType) return DEFAULT_LEAD_TYPES.general;
  
  const type = formType.toLowerCase();
  
  if (type.includes('vendor')) return DEFAULT_LEAD_TYPES.vendor;
  if (type.includes('subcontractor')) return DEFAULT_LEAD_TYPES.subcontractor;
  if (type.includes('partner')) return DEFAULT_LEAD_TYPES.partner;
  if (type.includes('career')) return DEFAULT_LEAD_TYPES.career;
  if (type.includes('callback') || type.includes('call back')) return DEFAULT_LEAD_TYPES.callback;
  if (type.includes('newsletter')) return DEFAULT_LEAD_TYPES.newsletter;
  if (type.includes('quick')) return DEFAULT_LEAD_TYPES.quick;
  if (type.includes('contact') || type.includes('enquiry')) return DEFAULT_LEAD_TYPES.enquiry;
  
  return DEFAULT_LEAD_TYPES.general;
}

/**
 * Convert normalized data to FormData
 */
function createFormData(data) {
  const formData = new FormData();
  
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue;
    
    if (value instanceof File) {
      formData.append(key, value, value.name);
      continue;
    }
    
    if (value instanceof Blob) {
      formData.append(key, value);
      continue;
    }
    
    if (Array.isArray(value)) {
      formData.append(key, JSON.stringify(value));
      continue;
    }
    
    if (typeof value === 'object') {
      formData.append(key, JSON.stringify(value));
      continue;
    }
    
    formData.append(key, String(value));
  }
  
  return formData;
}

/**
 * Submit form data to /api/submit with retry logic
 */
async function submitToBackend(normalizedData, formType, retryCount = 0) {
  const MAX_RETRIES = 3;
  const RETRY_DELAY_MS = 1000;
  
  try {
    // Ensure all required fields
    const dataWithFields = ensureRequiredFields(normalizedData, formType);
    
    // Convert to FormData
    const formData = createFormData(dataWithFields);
    
    const backendUrl = getBackendUrl('/api/submit');

    // Log submission
    console.log('[API Bridge] Submitting to ' + backendUrl, {
      formType,
      attempt: retryCount + 1,
      maxAttempts: MAX_RETRIES + 1
    });
    
    // Make the request
    const response = await fetch(backendUrl, {
      method: 'POST',
      body: formData,
      headers: {
        'Accept': 'application/json',
        'X-Form-Type': formType,
        'X-Request-Source': 'firebase-bridge'
      }
    });
    
    // Handle response
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    
    console.log('[API Bridge] Backend submission successful', {
      formType,
      success: result.success
    });
    
    return {
      success: true,
      backend: true,
      status: response.status,
      data: result
    };
    
  } catch (error) {
    console.error('[API Bridge] Backend submission error', {
      formType,
      attempt: retryCount + 1,
      error: error.message
    });
    
    // Retry logic
    if (retryCount < MAX_RETRIES) {
      const delay = RETRY_DELAY_MS * Math.pow(2, retryCount);
      console.log(`[API Bridge] Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return submitToBackend(normalizedData, formType, retryCount + 1);
    }
    
    throw error;
  }
}

/**
 * Main bridge function
 */
async function submitFormToBridge(formData, formType, options = {}) {
  try {
    // Normalize field names
    const normalized = normalizeFieldNames(formData);
    console.log('[API Bridge] Step 1 - Field names normalized');
    
    // Ensure required fields
    const enriched = ensureRequiredFields(normalized, formType);
    console.log('[API Bridge] Step 2 - Required fields ensured', {
      leadType: enriched.leadType,
      hasName: !!enriched.name,
      hasEmail: !!enriched.email,
      hasPhone: !!enriched.phone
    });
    
    // Attempt backend submission
    let backendResult = null;
    let backendError = null;
    
    if (options.useBackend !== false) {
      try {
        backendResult = await submitToBackend(enriched, formType);
        console.log('[API Bridge] Backend submission succeeded');
      } catch (error) {
        backendError = error;
        console.warn('[API Bridge] Backend submission failed, will fall back to Firebase', {
          error: error.message
        });
      }
    }
    
    // Return result
    const result = {
      success: !!backendResult,
      backend: !!backendResult,
      firebase: false,
      data: enriched,
      formType,
      timestamp: new Date().toISOString()
    };
    
    if (backendResult) {
      result.backendResponse = backendResult.data;
    }
    
    if (backendError) {
      result.backendError = backendError.message;
    }
    
    return result;
    
  } catch (error) {
    console.error('[API Bridge] Fatal bridge error', {
      error: error.message,
      formType
    });
    
    throw {
      success: false,
      bridge: true,
      error: error.message,
      formType
    };
  }
}

// ============================================================================
// FIREBASE INTEGRATION HOOKS
// ============================================================================

window.AARAA_BRIDGE = window.AARAA_BRIDGE || {
  preprocess: async function(formData, formType) {
    try {
      return await submitFormToBridge(formData, formType, { useBackend: true });
    } catch (error) {
      console.error('[AARAA Bridge] Preprocessing failed:', error);
      return null;
    }
  },

  getFieldMappings: function() {
    return FIELD_MAPPING;
  },

  getLeadTypes: function() {
    return DEFAULT_LEAD_TYPES;
  },

  normalizeFields: function(data) {
    return normalizeFieldNames(data);
  },

  testBackendConnectivity: async function() {
    try {
      const backendUrl = getBackendUrl('/api/health');
      const response = await fetch(backendUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      return {
        connected: response.ok,
        status: response.status,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        connected: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  },

  getStatus: function() {
    return {
      version: '1.0.0',
      bridgeActive: true,
      fieldMappingsCount: Object.keys(FIELD_MAPPING).length,
      leadTypesCount: Object.keys(DEFAULT_LEAD_TYPES).length,
      timestamp: new Date().toISOString()
    };
  },

  debug: function(formData, formType) {
    const normalized = normalizeFieldNames(formData);
    const enriched = ensureRequiredFields(normalized, formType);
    
    console.table({
      'Lead Type': enriched.leadType,
      'Has Name': !!enriched.name,
      'Has Email': !!enriched.email,
      'Has Phone': !!enriched.phone,
      'Has Message': !!enriched.message
    });
  }
};

// Global functions
window.submitFormToBridge = submitFormToBridge;
window.normalizeFieldNames = normalizeFieldNames;
window.ensureRequiredFields = ensureRequiredFields;

// Initialize
console.log('[API Bridge] Loaded and ready');
console.log('[API Bridge] Status:', window.AARAA_BRIDGE.getStatus());
