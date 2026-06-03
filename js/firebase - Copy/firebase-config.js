/**
 * Firebase Configuration - Browser Compatible CDN Version
 * Uses Firebase CDN modules instead of ES6 imports
 */

const firebaseConfig = {
  apiKey: "AIzaSyCjousdSRR0SJS3Qzv2sac-x7O-KnAzOAM",
  authDomain: "aaraa-infra-web.firebaseapp.com",
  projectId: "aaraa-infra-web",
  storageBucket: "aaraa-infra-web.firebasestorage.app",
  messagingSenderId: "1097946746049",
  appId: "1:1097946746049:web:66255acd518f19b2a9d840",
  measurementId: "G-DHGDK2T2VR"
}

// Initialize Firebase using global firebase object from CDN
const app = firebase.initializeApp(firebaseConfig)

// Get Firebase services from global firebase object
const db = firebase.firestore()
const auth = firebase.auth()
const storage = firebase.storage()

// Enable persistence
db.enablePersistence().catch(err => {
  if (err.code === 'failed-precondition') {
    console.warn('[Firebase] Multiple tabs open — persistence enabled in one tab only')
  } else if (err.code === 'unimplemented') {
    console.warn('[Firebase] Browser does not support persistence')
  }
})

// Make services available globally for other scripts
window.firebaseServices = {
  app,
  db,
  auth,
  storage,
  firebase
}
