/**
 * Firebase Configuration - ES6 Module Version
 * Browser compatible with CDN import maps
 */

import { initializeApp } from 'firebase/app'
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: "AIzaSyCjousdSRR0SJS3Qzv2sac-x7O-KnAzOAM",
  authDomain: "aaraa-infra-web.firebaseapp.com",
  projectId: "aaraa-infra-web",
  storageBucket: "aaraa-infra-web.firebasestorage.app",
  messagingSenderId: "1097946746049",
  appId: "1:1097946746049:web:66255acd518f19b2a9d840",
  measurementId: "G-DHGDK2T2VR"
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)

// Get Firebase services
const db = getFirestore(app)
const auth = getAuth(app)
const storage = getStorage(app)
const analytics = null // analytics is optional and handled dynamically

// Enable persistence
enableIndexedDbPersistence(db).catch(err => {
  if (err.code === 'failed-precondition') {
    console.warn('[Firebase] Multiple tabs open — persistence enabled in one tab only')
  } else if (err.code === 'unimplemented') {
    console.warn('[Firebase] Browser does not support persistence')
  }
})

// Make services available globally for legacy scripts
window.firebaseServices = {
  app,
  db,
  auth,
  storage
}

export { app, db, auth, storage, analytics }
