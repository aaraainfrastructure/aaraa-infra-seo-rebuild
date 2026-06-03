/**
 * Career Form Google Authentication
 * 
 * Requires Google Sign-In verification before candidates can:
 * - Click "Apply" button
 * - Submit the form
 * - Upload resume
 * 
 * Uses Firebase Authentication with Google Sign-In provider
 * Browser-compatible CDN version
 * 
 * @module career-google-auth
 */

// Wait for Firebase to be available
function getAuth() {
  if (!window.firebaseServices || !window.firebaseServices.auth) {
    console.error('[Career Google Auth] Firebase not initialized')
    return null
  }
  return window.firebaseServices.auth
}

const AUTH_CONFIG = {
  debug: window.location.hostname === 'localhost' || window.location.search.includes('firebase_debug=true'),
  formId: 'applyForm',
  authModalId: 'career-google-auth-modal',
  signInBtnId: 'career-google-signin-btn',
  signOutBtnId: 'career-google-signout-btn',
  userDisplayId: 'career-user-display',
  formContainerId: 'career-form-container'
}

let currentUser = null
let authModalInstance = null

function logDebug(...args) {
  if (AUTH_CONFIG.debug) {
    console.log(`%c[Career Google Auth]`, 'color:#4285F4;font-weight:bold;', ...args)
  }
}

function logError(...args) {
  console.error(`%c[Career Google Auth]`, 'color:#ef4444;font-weight:bold;', ...args)
}

/**
 * Create the authentication modal HTML
 * @returns {HTMLElement} Modal overlay element
 */
function createAuthModalHTML() {
  const overlay = document.createElement('div')
  overlay.id = AUTH_CONFIG.authModalId
  overlay.className = 'career-google-auth-modal-overlay'
  overlay.setAttribute('role', 'dialog')
  overlay.setAttribute('aria-modal', 'true')
  overlay.setAttribute('aria-labelledby', 'career-auth-title')

  overlay.innerHTML = `
    <div class="career-google-auth-modal-card">
      <!-- Google Logo -->
      <div class="career-auth-logo">
        <svg viewBox="0 0 24 24" width="48" height="48">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
      </div>

      <!-- Title -->
      <h2 id="career-auth-title" class="career-auth-title">
        Sign In to Apply
      </h2>

      <!-- Subtitle -->
      <p class="career-auth-subtitle">
        Please sign in with your Google account to apply for positions at AARAA Infrastructure
      </p>

      <!-- Sign In Button -->
      <button id="${AUTH_CONFIG.signInBtnId}" class="career-auth-signin-btn">
        <svg class="career-auth-google-icon" viewBox="0 0 24 24" width="20" height="20">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Sign In with Google
      </button>

      <!-- Info Text -->
      <p class="career-auth-info">
        We use Google Sign-In to verify your email and ensure secure applications
      </p>
    </div>
  `

  return overlay
}

/**
 * Inject modal styles into the document
 */
function injectStyles() {
  if (document.getElementById('career-google-auth-styles')) return

  const style = document.createElement('style')
  style.id = 'career-google-auth-styles'
  style.textContent = `
    /* Auth Modal Overlay */
    .career-google-auth-modal-overlay {
      position: fixed;
      inset: 0;
      z-index: 999999;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(4px);
      display: none;
      align-items: center;
      justify-content: center;
      padding: 24px;
      animation: career-auth-fade-in 0.3s ease;
    }

    .career-google-auth-modal-overlay.active {
      display: flex;
    }

    /* Modal Card */
    .career-google-auth-modal-card {
      background: #fff;
      border-radius: 16px;
      padding: 48px 40px;
      max-width: 420px;
      width: 100%;
      text-align: center;
      box-shadow: 0 25px 60px rgba(0, 0, 0, 0.2);
      animation: career-auth-scale-in 0.4s cubic-bezier(0.22, 1, 0.36, 1);
    }

    /* Logo */
    .career-auth-logo {
      margin-bottom: 24px;
      display: flex;
      justify-content: center;
    }

    .career-auth-logo svg {
      width: 48px;
      height: 48px;
    }

    /* Title */
    .career-auth-title {
      font-size: 1.5rem;
      font-weight: 700;
      color: #111;
      margin: 0 0 12px;
      line-height: 1.3;
    }

    /* Subtitle */
    .career-auth-subtitle {
      font-size: 0.95rem;
      color: #666;
      margin: 0 0 28px;
      line-height: 1.6;
    }

    /* Sign In Button */
    .career-auth-signin-btn {
      width: 100%;
      padding: 14px 24px;
      border-radius: 9999px;
      border: 1px solid #dadce0;
      background: #fff;
      color: #3c4043;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      margin-bottom: 20px;
    }

    .career-auth-signin-btn:hover {
      background: #f8f9fa;
      box-shadow: 0 1px 1px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.3);
      transform: translateY(-2px);
    }

    .career-auth-signin-btn:active {
      transform: translateY(0);
    }

    .career-auth-signin-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .career-auth-google-icon {
      width: 20px;
      height: 20px;
    }

    /* Info Text */
    .career-auth-info {
      font-size: 0.85rem;
      color: #999;
      margin: 0;
      line-height: 1.5;
    }

    /* Animations */
    @keyframes career-auth-fade-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes career-auth-scale-in {
      from {
        transform: scale(0.85);
        opacity: 0;
      }
      to {
        transform: scale(1);
        opacity: 1;
      }
    }

    /* User Display */
    .career-user-display {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      background: #f0f7ff;
      border-radius: 8px;
      margin-bottom: 20px;
      font-size: 0.9rem;
    }

    .career-user-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: #4285F4;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-weight: 600;
      font-size: 0.8rem;
    }

    .career-user-info {
      flex: 1;
    }

    .career-user-name {
      font-weight: 600;
      color: #111;
      margin: 0;
    }

    .career-user-email {
      font-size: 0.85rem;
      color: #666;
      margin: 2px 0 0;
    }

    .career-signout-btn {
      padding: 8px 16px;
      background: #f0f0f0;
      border: none;
      border-radius: 6px;
      color: #666;
      font-size: 0.85rem;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .career-signout-btn:hover {
      background: #e0e0e0;
      color: #111;
    }

    /* Mobile Responsive */
    @media (max-width: 480px) {
      .career-google-auth-modal-card {
        padding: 40px 24px 32px;
      }

      .career-auth-title {
        font-size: 1.25rem;
      }

      .career-auth-subtitle {
        font-size: 0.9rem;
      }
    }

    /* Prevent body scroll when modal is open */
    body.career-auth-modal-open {
      overflow: hidden;
    }
  `

  document.head.appendChild(style)
  logDebug('Styles injected')
}

/**
 * Initialize the authentication modal
 */
function initAuthModal() {
  if (document.getElementById(AUTH_CONFIG.authModalId)) {
    authModalInstance = document.getElementById(AUTH_CONFIG.authModalId)
    return
  }

  injectStyles()
  authModalInstance = createAuthModalHTML()
  document.body.appendChild(authModalInstance)

  setupEventListeners()
  logDebug('Auth modal initialized')
}

/**
 * Setup event listeners for authentication
 */
function setupEventListeners() {
  if (!authModalInstance) return

  const signInBtn = document.getElementById(AUTH_CONFIG.signInBtnId)
  if (signInBtn) {
    signInBtn.addEventListener('click', handleGoogleSignIn)
  }

  // Click outside to close (optional - can be disabled)
  authModalInstance.addEventListener('click', (e) => {
    if (e.target === authModalInstance) {
      // Don't close on outside click for auth modal
    }
  })

  logDebug('Event listeners attached')
}

/**
 * Handle Google Sign-In
 */
function handleGoogleSignIn() {
  const signInBtn = document.getElementById(AUTH_CONFIG.signInBtnId)
  if (signInBtn) {
    signInBtn.disabled = true
    signInBtn.textContent = 'Signing in...'
  }

  const auth = getAuth()
  if (!auth) {
    alert('Firebase not initialized. Please refresh the page.')
    return
  }

  try {
    const provider = new firebase.auth.GoogleAuthProvider()
    provider.addScope('profile')
    provider.addScope('email')

    auth.signInWithPopup(provider).then(result => {
      const user = result.user

      currentUser = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL
      }

      logDebug('User signed in:', currentUser)

      // Close modal and show user info
      closeAuthModal()
      showUserInfo(currentUser)
      enableFormSubmission()

    }).catch(error => {
      logError('Sign-in error:', error)

      if (error.code === 'auth/popup-closed-by-user') {
        logDebug('Sign-in popup closed by user')
      } else if (error.code === 'auth/cancelled-popup-request') {
        logDebug('Sign-in popup cancelled')
      } else {
        alert('Sign-in failed: ' + error.message)
      }

    }).finally(() => {
      const signInBtn = document.getElementById(AUTH_CONFIG.signInBtnId)
      if (signInBtn) {
        signInBtn.disabled = false
        signInBtn.textContent = 'Sign In with Google'
      }
    })

  } catch (error) {
    logError('Sign-in setup error:', error)
    alert('Sign-in setup failed: ' + error.message)
    const signInBtn = document.getElementById(AUTH_CONFIG.signInBtnId)
    if (signInBtn) {
      signInBtn.disabled = false
      signInBtn.textContent = 'Sign In with Google'
    }
  }
}

/**
 * Show user information after sign-in
 */
function showUserInfo(user) {
  const form = document.getElementById(AUTH_CONFIG.formId)
  if (!form) return

  // Create user display element
  let userDisplay = document.getElementById(AUTH_CONFIG.userDisplayId)
  if (!userDisplay) {
    userDisplay = document.createElement('div')
    userDisplay.id = AUTH_CONFIG.userDisplayId
    userDisplay.className = 'career-user-display'
    form.insertBefore(userDisplay, form.firstChild)
  }

  const initials = (user.displayName || user.email)
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  userDisplay.innerHTML = `
    <div class="career-user-avatar">${initials}</div>
    <div class="career-user-info">
      <p class="career-user-name">${user.displayName || 'User'}</p>
      <p class="career-user-email">${user.email}</p>
    </div>
    <button class="career-signout-btn" id="${AUTH_CONFIG.signOutBtnId}">Sign Out</button>
  `

  const signOutBtn = document.getElementById(AUTH_CONFIG.signOutBtnId)
  if (signOutBtn) {
    signOutBtn.addEventListener('click', handleSignOut)
  }

  logDebug('User info displayed')
}

/**
 * Handle sign out
 */
function handleSignOut() {
  const auth = getAuth()
  if (!auth) {
    logError('Firebase not initialized')
    return
  }

  auth.signOut().then(() => {
    currentUser = null

    // Remove user display
    const userDisplay = document.getElementById(AUTH_CONFIG.userDisplayId)
    if (userDisplay) {
      userDisplay.remove()
    }

    // Disable form submission
    disableFormSubmission()

    // Show auth modal again
    showAuthModal()

    logDebug('User signed out')
  }).catch(error => {
    logError('Sign-out error:', error)
  })
}

/**
 * Show the authentication modal
 */
function showAuthModal() {
  if (!authModalInstance) {
    initAuthModal()
  }

  authModalInstance.classList.add('active')
  document.body.classList.add('career-auth-modal-open')

  logDebug('Auth modal shown')
}

/**
 * Close the authentication modal
 */
function closeAuthModal() {
  if (!authModalInstance) return

  authModalInstance.classList.remove('active')
  document.body.classList.remove('career-auth-modal-open')

  logDebug('Auth modal closed')
}

/**
 * Disable form submission
 */
function disableFormSubmission() {
  const form = document.getElementById(AUTH_CONFIG.formId)
  if (!form) return

  const submitBtn = form.querySelector('[type="submit"], button:not([type="button"])')
  if (submitBtn) {
    submitBtn.disabled = true
    submitBtn.style.opacity = '0.5'
    submitBtn.style.cursor = 'not-allowed'
    submitBtn.title = 'Please sign in with Google to apply'
  }

  // Disable file input
  const fileInput = form.querySelector('input[type="file"]')
  if (fileInput) {
    fileInput.disabled = true
    fileInput.style.opacity = '0.5'
    fileInput.style.cursor = 'not-allowed'
  }

  logDebug('Form submission disabled')
}

/**
 * Enable form submission
 */
function enableFormSubmission() {
  const form = document.getElementById(AUTH_CONFIG.formId)
  if (!form) return

  const submitBtn = form.querySelector('[type="submit"], button:not([type="button"])')
  if (submitBtn) {
    submitBtn.disabled = false
    submitBtn.style.opacity = '1'
    submitBtn.style.cursor = 'pointer'
    submitBtn.title = ''
  }

  // Enable file input
  const fileInput = form.querySelector('input[type="file"]')
  if (fileInput) {
    fileInput.disabled = false
    fileInput.style.opacity = '1'
    fileInput.style.cursor = 'pointer'
  }

  logDebug('Form submission enabled')
}

/**
 * Check authentication state on page load
 */
function checkAuthState() {
  const auth = getAuth()
  if (!auth) {
    logError('Firebase not initialized')
    return
  }

  auth.onAuthStateChanged((user) => {
    if (user) {
      currentUser = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL
      }

      logDebug('User already signed in:', currentUser)

      showUserInfo(currentUser)
      enableFormSubmission()
    } else {
      currentUser = null

      logDebug('No user signed in')

      disableFormSubmission()
      showAuthModal()
    }
  })
}

/**
 * Initialize the authentication system
 */
function init() {
  logDebug('Initializing career Google authentication')

  // Initialize modal on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initAuthModal()
      checkAuthState()
    })
  } else {
    initAuthModal()
    checkAuthState()
  }
}

// Initialize on script load
init()

// Export for testing/debugging
if (typeof window !== 'undefined') {
  window.CareerGoogleAuth = {
    init,
    showAuthModal,
    closeAuthModal,
    getCurrentUser: () => currentUser,
    debug: {
      getConfig: () => CONFIG
    }
  }
}
