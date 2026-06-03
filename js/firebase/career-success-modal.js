/**
 * Career Form Success Modal
 * 
 * Professional success popup for career form submissions
 * - Listens for 'career-form-success' events from career-upload-handler.js
 * - Displays polished success modal with animations
 * - Handles form reset and modal lifecycle
 * - Mobile responsive with enterprise-grade UX
 * 
 * @module career-success-modal
 */

const CareerSuccessModal = (() => {
  const CONFIG = {
    debug: window.location.hostname === 'localhost' || window.location.search.includes('firebase_debug=true'),
    modalId: 'career-success-modal',
    formId: 'applyForm',
    autoCloseDelay: 8000, // Auto close after 8 seconds
    animationDuration: 300 // ms
  }

  const BRANDING = {
    primaryColor: '#ED2F39', // AARAA primary red
    successColor: '#10b981', // Green for success
    darkOverlay: 'rgba(0, 0, 0, 0.6)',
    borderRadius: '16px',
    boxShadow: '0 25px 60px rgba(0, 0, 0, 0.2)'
  }

  let modalInstance = null
  let autoCloseTimeout = null
  let isAnimating = false

  function logDebug(...args) {
    if (CONFIG.debug) {
      console.log(`%c[Career Success Modal]`, 'color:#10b981;font-weight:bold;', ...args)
    }
  }

  function logError(...args) {
    console.error(`%c[Career Success Modal]`, 'color:#ef4444;font-weight:bold;', ...args)
  }

  /**
   * Create the modal HTML structure
   * @returns {HTMLElement} Modal overlay element
   */
  function createModalHTML() {
    const overlay = document.createElement('div')
    overlay.id = CONFIG.modalId
    overlay.className = 'career-success-modal-overlay'
    overlay.setAttribute('role', 'dialog')
    overlay.setAttribute('aria-modal', 'true')
    overlay.setAttribute('aria-labelledby', 'career-success-title')

    overlay.innerHTML = `
      <div class="career-success-modal-card">
        <!-- Success Checkmark Animation -->
        <div class="career-success-checkmark-container">
          <svg class="career-success-checkmark" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>

        <!-- Title -->
        <h2 id="career-success-title" class="career-success-title">
          Application Submitted Successfully
        </h2>

        <!-- Subtitle -->
        <p class="career-success-subtitle">
          Thank you for applying to AARAA Infrastructure. Our HR team will review your application and contact you shortly.
        </p>

        <!-- Application Details (Optional) -->
        <div class="career-success-details" id="career-success-details" style="display: none;">
          <div class="career-success-detail-item">
            <span class="career-success-detail-label">Application ID:</span>
            <span class="career-success-detail-value" id="career-success-lead-id">-</span>
          </div>
        </div>

        <!-- Button Container -->
        <div class="career-success-buttons">
          <button class="career-success-btn career-success-btn-primary" id="career-success-close">
            Close
          </button>
          <button class="career-success-btn career-success-btn-secondary" id="career-success-apply-another">
            Apply Another Role
          </button>
        </div>

        <!-- Close Icon -->
        <button class="career-success-close-icon" id="career-success-close-icon" aria-label="Close modal">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    `

    return overlay
  }

  /**
   * Inject modal styles into the document
   */
  function injectStyles() {
    if (document.getElementById('career-success-modal-styles')) return

    const style = document.createElement('style')
    style.id = 'career-success-modal-styles'
    style.textContent = `
      /* Career Success Modal Overlay */
      .career-success-modal-overlay {
        position: fixed;
        inset: 0;
        z-index: 999999;
        background: ${BRANDING.darkOverlay};
        backdrop-filter: blur(4px);
        display: none;
        align-items: center;
        justify-content: center;
        padding: 24px;
        animation: career-success-fade-in 0.3s ease;
      }

      .career-success-modal-overlay.active {
        display: flex;
      }

      /* Modal Card */
      .career-success-modal-card {
        background: #fff;
        border-radius: ${BRANDING.borderRadius};
        padding: 48px 40px 40px;
        max-width: 480px;
        width: 100%;
        text-align: center;
        box-shadow: ${BRANDING.boxShadow};
        animation: career-success-scale-in 0.4s cubic-bezier(0.22, 1, 0.36, 1);
        position: relative;
      }

      /* Checkmark Container */
      .career-success-checkmark-container {
        width: 80px;
        height: 80px;
        border-radius: 50%;
        background: linear-gradient(135deg, ${BRANDING.successColor}, #059669);
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 24px;
        animation: career-success-pop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
      }

      .career-success-checkmark {
        width: 40px;
        height: 40px;
        stroke-dasharray: 60;
        stroke-dashoffset: 60;
        animation: career-success-checkmark-draw 0.6s ease-out 0.3s forwards;
      }

      /* Title */
      .career-success-title {
        font-size: 1.5rem;
        font-weight: 700;
        color: #111;
        margin: 0 0 12px;
        line-height: 1.3;
      }

      /* Subtitle */
      .career-success-subtitle {
        font-size: 0.95rem;
        color: #666;
        margin: 0 0 28px;
        line-height: 1.6;
      }

      /* Details Section */
      .career-success-details {
        background: #f9fafb;
        border-radius: 12px;
        padding: 16px;
        margin-bottom: 28px;
        text-align: left;
      }

      .career-success-detail-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 0.9rem;
      }

      .career-success-detail-label {
        color: #666;
        font-weight: 500;
      }

      .career-success-detail-value {
        color: #111;
        font-weight: 600;
        font-family: 'Monaco', 'Courier New', monospace;
      }

      /* Button Container */
      .career-success-buttons {
        display: flex;
        gap: 12px;
        flex-direction: column;
      }

      @media (min-width: 480px) {
        .career-success-buttons {
          flex-direction: row;
          gap: 12px;
        }
      }

      /* Buttons */
      .career-success-btn {
        padding: 14px 28px;
        border-radius: 9999px;
        border: none;
        font-size: 1rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        flex: 1;
      }

      .career-success-btn-primary {
        background: linear-gradient(135deg, ${BRANDING.successColor}, #059669);
        color: #fff;
      }

      .career-success-btn-primary:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 20px rgba(16, 185, 129, 0.3);
      }

      .career-success-btn-primary:active {
        transform: translateY(0);
      }

      .career-success-btn-secondary {
        background: #f3f4f6;
        color: #111;
        border: 1px solid #e5e7eb;
      }

      .career-success-btn-secondary:hover {
        background: #e5e7eb;
        transform: translateY(-2px);
      }

      .career-success-btn-secondary:active {
        transform: translateY(0);
      }

      /* Close Icon */
      .career-success-close-icon {
        position: absolute;
        top: 16px;
        right: 16px;
        width: 32px;
        height: 32px;
        border: none;
        background: none;
        color: #999;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
        padding: 0;
      }

      .career-success-close-icon:hover {
        color: #111;
        transform: rotate(90deg);
      }

      .career-success-close-icon svg {
        width: 20px;
        height: 20px;
      }

      /* Animations */
      @keyframes career-success-fade-in {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }

      @keyframes career-success-scale-in {
        from {
          transform: scale(0.85);
          opacity: 0;
        }
        to {
          transform: scale(1);
          opacity: 1;
        }
      }

      @keyframes career-success-pop {
        0% {
          transform: scale(0);
        }
        50% {
          transform: scale(1.1);
        }
        100% {
          transform: scale(1);
        }
      }

      @keyframes career-success-checkmark-draw {
        to {
          stroke-dashoffset: 0;
        }
      }

      @keyframes career-success-fade-out {
        from {
          opacity: 1;
          transform: scale(1);
        }
        to {
          opacity: 0;
          transform: scale(0.95);
        }
      }

      /* Mobile Responsive */
      @media (max-width: 480px) {
        .career-success-modal-card {
          padding: 40px 24px 32px;
        }

        .career-success-title {
          font-size: 1.25rem;
        }

        .career-success-subtitle {
          font-size: 0.9rem;
        }

        .career-success-btn {
          padding: 12px 20px;
          font-size: 0.95rem;
        }
      }

      /* Prevent body scroll when modal is open */
      body.career-success-modal-open {
        overflow: hidden;
      }
    `

    document.head.appendChild(style)
    logDebug('Styles injected')
  }

  /**
   * Initialize the modal in the DOM
   */
  function initModal() {
    if (document.getElementById(CONFIG.modalId)) {
      modalInstance = document.getElementById(CONFIG.modalId)
      return
    }

    injectStyles()
    modalInstance = createModalHTML()
    document.body.appendChild(modalInstance)

    setupEventListeners()
    logDebug('Modal initialized')
  }

  /**
   * Setup event listeners for modal interactions
   */
  function setupEventListeners() {
    if (!modalInstance) return

    // Close button
    const closeBtn = modalInstance.querySelector('#career-success-close')
    if (closeBtn) {
      closeBtn.addEventListener('click', () => closeModal())
    }

    // Close icon
    const closeIcon = modalInstance.querySelector('#career-success-close-icon')
    if (closeIcon) {
      closeIcon.addEventListener('click', () => closeModal())
    }

    // Apply another role button
    const applyAnotherBtn = modalInstance.querySelector('#career-success-apply-another')
    if (applyAnotherBtn) {
      applyAnotherBtn.addEventListener('click', () => {
        closeModal()
        resetForm()
      })
    }

    // Click outside to close
    modalInstance.addEventListener('click', (e) => {
      if (e.target === modalInstance) {
        closeModal()
      }
    })

    // ESC key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modalInstance && modalInstance.classList.contains('active')) {
        closeModal()
      }
    })

    logDebug('Event listeners attached')
  }

  /**
   * Show the success modal
   * @param {Object} data - Success data from career-upload-handler
   */
  function showModal(data = {}) {
    if (!modalInstance) {
      initModal()
    }

    if (isAnimating) return
    isAnimating = true

    // Clear any existing auto-close timeout
    if (autoCloseTimeout) {
      clearTimeout(autoCloseTimeout)
    }

    // Update details if leadId provided
    if (data.leadId) {
      const detailsEl = modalInstance.querySelector('#career-success-details')
      const leadIdEl = modalInstance.querySelector('#career-success-lead-id')
      if (detailsEl && leadIdEl) {
        leadIdEl.textContent = data.leadId
        detailsEl.style.display = 'block'
      }
    }

    // Show modal
    modalInstance.classList.add('active')
    document.body.classList.add('career-success-modal-open')

    logDebug('Modal shown', data)

    // Auto close after delay
    autoCloseTimeout = setTimeout(() => {
      closeModal()
    }, CONFIG.autoCloseDelay)

    setTimeout(() => {
      isAnimating = false
    }, CONFIG.animationDuration)
  }

  /**
   * Close the modal
   */
  function closeModal() {
    if (!modalInstance || isAnimating) return
    isAnimating = true

    if (autoCloseTimeout) {
      clearTimeout(autoCloseTimeout)
    }

    modalInstance.classList.remove('active')
    document.body.classList.remove('career-success-modal-open')

    logDebug('Modal closed')

    setTimeout(() => {
      isAnimating = false
    }, CONFIG.animationDuration)
  }

  /**
   * Reset the career form
   */
  function resetForm() {
    const form = document.getElementById(CONFIG.formId)
    if (form) {
      form.reset()
      form.removeAttribute('data-firebase-processing')
      logDebug('Form reset')
    }
  }

  /**
   * Handle career form success event
   * @param {CustomEvent} event - Career form success event
   */
  function handleCareerFormSuccess(event) {
    logDebug('Career form success event received', event.detail)
    showModal(event.detail)
  }

  /**
   * Initialize the modal system
   */
  function init() {
    logDebug('Initializing career success modal system')

    // Initialize modal on DOM ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        initModal()
        attachFormListener()
      })
    } else {
      initModal()
      attachFormListener()
    }
  }

  /**
   * Attach listener to career form for success events
   */
  function attachFormListener() {
    const form = document.getElementById(CONFIG.formId)
    if (!form) {
      logDebug('Career form not found on this page')
      return
    }

    form.addEventListener('career-form-success', handleCareerFormSuccess)
    logDebug('Form listener attached')
  }

  /**
   * Public API
   */
  return {
    init,
    show: showModal,
    close: closeModal,
    reset: resetForm,
    debug: {
      getConfig: () => CONFIG,
      getBranding: () => BRANDING,
      getModalInstance: () => modalInstance
    }
  }
})()

// Initialize on script load
CareerSuccessModal.init()

// Export for testing/debugging
if (typeof window !== 'undefined') {
  window.CareerSuccessModal = CareerSuccessModal
}
