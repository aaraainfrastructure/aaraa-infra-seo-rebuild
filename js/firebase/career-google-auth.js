/**
 * Career Form Google Authentication
 * FIXED VERSION — All audit issues resolved
 *
 * Fixes applied:
 * - [FIX 1] getConfig() now references AUTH_CONFIG (was undefined CONFIG)
 * - [FIX 2] Sign-In button restores full innerHTML (icon + text) on failure
 * - [FIX 3] auth/popup-blocked error handled with clear user message
 * - [FIX 4] Firebase init race condition resolved with retry guard
 * - [FIX 5] File input no longer disabled on auth — only submit button gated
 * - [FIX 6] Initials generation safe for email-only Google accounts
 *
 * @module career-google-auth
 */

const AUTH_CONFIG = {
  debug: window.location.hostname === 'localhost' || window.location.search.includes('firebase_debug=true'),
  formId: 'applyForm',
  authModalId: 'career-google-auth-modal',
  signInBtnId: 'career-google-signin-btn',
  signOutBtnId: 'career-google-signout-btn',
  userDisplayId: 'career-user-display',
  formContainerId: 'career-form-container',
  firebaseRetryDelay: 300,  // ms between retries
  firebaseMaxRetries: 10    // max retries waiting for Firebase
}

// Google sign-in button inner HTML — preserved so icon is never lost on reset
const SIGNIN_BTN_HTML = `
  <svg class="career-auth-google-icon" viewBox="0 0 24 24" width="20" height="20">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
  Sign In with Google
`

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
 * [FIX 4] Wait for Firebase to be available with retry guard
 * Prevents race condition between firebase-config.js and this script
 */
function getAuth(retryCount = 0) {
  if (window.firebaseServices && window.firebaseServices.auth) {
    return window.firebaseServices.auth
  }
  if (retryCount < AUTH_CONFIG.firebaseMaxRetries) {
    logDebug(`Firebase not ready, retrying... (${retryCount + 1}/${AUTH_CONFIG.firebaseMaxRetries})`)
    return null // caller should retry
  }
  logError('Firebase failed to initialize after maximum retries')
  return null
}

/**
 * Retry wrapper for Firebase auth operations
 */
function withFirebaseAuth(callback, retries = 0) {
  const auth = getAuth(retries)
  if (auth) {
    callback(auth)
    return
  }
  if (retries < AUTH_CONFIG.firebaseMaxRetries) {
    setTimeout(() => withFirebaseAuth(callback, retries + 1), AUTH_CONFIG.firebaseRetryDelay)
  } else {
    logError('Firebase Auth unavailable — could not initialize after retries')
  }
}

/**
 * Create the authentication modal HTML
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
      <div class="career-auth-logo">
        <svg viewBox="0 0 24 24" width="48" height="48">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
      </div>
      <h2 id="career-auth-title" class="career-auth-title">Sign In to Apply</h2>
      <p class="career-auth-subtitle">
        Please sign in with your Google account to apply for positions at AARAA Infrastructure
      </p>
      <button id="${AUTH_CONFIG.signInBtnId}" class="career-auth-signin-btn">
        ${SIGNIN_BTN_HTML}
      </button>
      <p class="career-auth-info">
        We use Google Sign-In to verify your email and ensure secure applications
      </p>
    </div>
  `
  return overlay
}

/**
 * Inject modal styles
 */
function injectStyles() {
  if (document.getElementById('career-google-auth-styles')) return

  const style = document.createElement('style')
  style.id = 'career-google-auth-styles'
  style.textContent = `
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
    }
    .career-google-auth-modal-overlay.active {
      display: flex;
      animation: career-auth-fade-in 0.3s ease;
    }
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
    .career-auth-logo { margin-bottom: 24px; display: flex; justify-content: center; }
    .career-auth-title { font-size: 1.5rem; font-weight: 700; color: #111; margin: 0 0 12px; line-height: 1.3; }
    .career-auth-subtitle { font-size: 0.95rem; color: #666; margin: 0 0 28px; line-height: 1.6; }
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
    .career-auth-signin-btn:hover { background: #f8f9fa; box-shadow: 0 1px 3px rgba(0,0,0,0.2); transform: translateY(-2px); }
    .career-auth-signin-btn:active { transform: translateY(0); }
    .career-auth-signin-btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .career-auth-google-icon { width: 20px; height: 20px; flex-shrink: 0; }
    .career-auth-info { font-size: 0.85rem; color: #999; margin: 0; line-height: 1.5; }
    .career-auth-error-msg {
      margin-top: 12px;
      padding: 10px 14px;
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 8px;
      color: #b91c1c;
      font-size: 0.85rem;
      display: none;
    }
    .career-auth-error-msg.visible { display: block; }
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
      width: 32px; height: 32px; border-radius: 50%;
      background: #4285F4; display: flex; align-items: center;
      justify-content: center; color: #fff; font-weight: 600;
      font-size: 0.8rem; flex-shrink: 0;
    }
    .career-user-info { flex: 1; text-align: left; }
    .career-user-name { font-weight: 600; color: #111; margin: 0; font-size: 0.9rem; }
    .career-user-email { font-size: 0.8rem; color: #666; margin: 2px 0 0; }
    .career-signout-btn {
      padding: 8px 16px; background: #f0f0f0; border: none;
      border-radius: 6px; color: #666; font-size: 0.85rem;
      cursor: pointer; transition: all 0.2s ease; white-space: nowrap;
    }
    .career-signout-btn:hover { background: #e0e0e0; color: #111; }
    @keyframes career-auth-fade-in { from { opacity: 0; } to { opacity: 1; } }
    @keyframes career-auth-scale-in {
      from { transform: scale(0.85); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }
    body.career-auth-modal-open { overflow: hidden; }
    @media (max-width: 480px) {
      .career-google-auth-modal-card { padding: 40px 24px 32px; }
      .career-auth-title { font-size: 1.25rem; }
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
 * Setup event listeners
 */
function setupEventListeners() {
  if (!authModalInstance) return
  const signInBtn = document.getElementById(AUTH_CONFIG.signInBtnId)
  if (signInBtn) {
    signInBtn.addEventListener('click', handleGoogleSignIn)
  }
  logDebug('Event listeners attached')
}

/**
 * [FIX 3] Handle Google Sign-In with popup-blocked support
 * [FIX 2] Button restores full innerHTML (icon + text) on any failure
 */
function handleGoogleSignIn() {
  const signInBtn = document.getElementById(AUTH_CONFIG.signInBtnId)
  const errorMsg = authModalInstance ? authModalInstance.querySelector('.career-auth-error-msg') : null

  if (signInBtn) {
    signInBtn.disabled = true
    signInBtn.innerHTML = '<span style="opacity:0.7">Signing in...</span>'
  }
  if (errorMsg) errorMsg.classList.remove('visible')

  withFirebaseAuth((auth) => {
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
        closeAuthModal()
        showUserInfo(currentUser)
        enableFormSubmission()

      }).catch(error => {
        logError('Sign-in error:', error)

        // [FIX 2] Restore full button HTML with icon
        if (signInBtn) {
          signInBtn.disabled = false
          signInBtn.innerHTML = SIGNIN_BTN_HTML
        }

        // [FIX 3] Handle popup-blocked specifically
        if (error.code === 'auth/popup-blocked') {
          showAuthError(errorMsg, 'Pop-up was blocked by your browser. Please allow pop-ups for this site and try again.')
        } else if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
          logDebug('Sign-in cancelled by user')
        } else {
          showAuthError(errorMsg, 'Sign-in failed. Please try again.')
          logError('Unexpected sign-in error:', error.message)
        }
      })

    } catch (error) {
      logError('Sign-in setup error:', error)
      if (signInBtn) {
        signInBtn.disabled = false
        signInBtn.innerHTML = SIGNIN_BTN_HTML
      }
      showAuthError(errorMsg, 'Sign-in setup failed. Please refresh the page.')
    }
  })
}

/**
 * Show inline error inside auth modal (no alert())
 */
function showAuthError(errorEl, message) {
  if (!errorEl) {
    // Inject error element if missing
    const card = authModalInstance ? authModalInstance.querySelector('.career-google-auth-modal-card') : null
    if (card) {
      let el = card.querySelector('.career-auth-error-msg')
      if (!el) {
        el = document.createElement('p')
        el.className = 'career-auth-error-msg'
        card.appendChild(el)
      }
      el.textContent = message
      el.classList.add('visible')
    }
    return
  }
  errorEl.textContent = message
  errorEl.classList.add('visible')
}

/**
 * [FIX 6] Show user info — safe initials for email-only accounts
 */
function showUserInfo(user) {
  const form = document.getElementById(AUTH_CONFIG.formId)
  if (!form) return

  let userDisplay = document.getElementById(AUTH_CONFIG.userDisplayId)
  if (!userDisplay) {
    userDisplay = document.createElement('div')
    userDisplay.id = AUTH_CONFIG.userDisplayId
    userDisplay.className = 'career-user-display'
    form.insertBefore(userDisplay, form.firstChild)
  }

  // [FIX 6] Safe initials — works for displayName and email-only accounts
  const source = user.displayName || user.email || 'U'
  const parts = source.includes(' ') ? source.split(' ') : [source]
  const initials = parts
    .map(n => (n[0] || '').toUpperCase())
    .join('')
    .slice(0, 2) || 'U'

  userDisplay.innerHTML = `
    <div class="career-user-avatar">${initials}</div>
    <div class="career-user-info">
      <p class="career-user-name">${user.displayName || 'Signed In'}</p>
      <p class="career-user-email">${user.email}</p>
    </div>
    <button class="career-signout-btn" id="${AUTH_CONFIG.signOutBtnId}" type="button">Sign Out</button>
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
  withFirebaseAuth((auth) => {
    auth.signOut().then(() => {
      currentUser = null
      const userDisplay = document.getElementById(AUTH_CONFIG.userDisplayId)
      if (userDisplay) userDisplay.remove()
      disableFormSubmission()
      showAuthModal()
      logDebug('User signed out')
    }).catch(error => {
      logError('Sign-out error:', error)
    })
  })
}

/**
 * Show the authentication modal
 */
function showAuthModal() {
  if (!authModalInstance) initAuthModal()
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
 * [FIX 5] Disable ONLY submit button — file input stays enabled
 * Candidate can still select their resume before signing in
 */
function disableFormSubmission() {
  const form = document.getElementById(AUTH_CONFIG.formId)
  if (!form) return

  const submitBtn = form.querySelector('#applySubmit, [type="submit"]')
  if (submitBtn) {
    submitBtn.disabled = true
    submitBtn.style.opacity = '0.5'
    submitBtn.style.cursor = 'not-allowed'
    submitBtn.title = 'Please sign in with Google to apply'
  }
  logDebug('Submit button disabled (file input left enabled)')
}

/**
 * Enable form submission after sign-in
 */
function enableFormSubmission() {
  const form = document.getElementById(AUTH_CONFIG.formId)
  if (!form) return

  const submitBtn = form.querySelector('#applySubmit, [type="submit"]')
  if (submitBtn) {
    submitBtn.disabled = false
    submitBtn.style.opacity = '1'
    submitBtn.style.cursor = 'pointer'
    submitBtn.title = ''
  }
  logDebug('Form submission enabled')
}

/**
 * [FIX 4] Check auth state with Firebase retry guard
 */
function checkAuthState() {
  withFirebaseAuth((auth) => {
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
        logDebug('No user signed in — showing auth modal')
        disableFormSubmission()
        showAuthModal()
      }
    })
  })
}

/**
 * Initialize the authentication system
 */
function init() {
  logDebug('Initializing career Google authentication')
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

// [FIX 1] Export with correct variable name AUTH_CONFIG (was CONFIG — ReferenceError)
if (typeof window !== 'undefined') {
  window.CareerGoogleAuth = {
    init,
    showAuthModal,
    closeAuthModal,
    getCurrentUser: () => currentUser,
    debug: {
      getConfig: () => AUTH_CONFIG  // FIX: was CONFIG (undefined)
    }
  }
}
