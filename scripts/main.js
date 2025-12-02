// ==========================================
// CLOUDINARY CONFIGURATION (unsigned uploads)
// ==========================================
const CLOUDINARY_CLOUD_NAME = 'dxt3u0ezq'; // Replace with your Cloudinary cloud name
const CLOUDINARY_UPLOAD_PRESET = 'TaskQuest'; // Your unsigned upload preset

// ==========================================
// FIREBASE INITIALIZATION
// ==========================================

const firebaseConfig = {
  apiKey: "AIzaSyBWpXGT8Hc0xWTziYzSRzmDazonxy7zrVc",
  authDomain: "taskquest-ef595.firebaseapp.com",
  projectId: "taskquest-ef595",
  storageBucket: "taskquest-ef595.firebasestorage.app",
  messagingSenderId: "752042896046",
  appId: "1:752042896046:web:ab3522fd3311d624009b3f",
  measurementId: "G-DMCN91PWTZ",
}

// Declare the firebase variable
let db, storage, auth
// Unsubscribe handle for child profile realtime watcher
let childProfileUnsubscribe = null
// Unsubscribe handle for child points realtime watcher
let childPointsUnsubscribe = null

// Feature flag: disable Firebase Storage uploads when running on GitHub Pages
// or when Firebase Storage CORS isn't configured. Set to true to re-enable.
const USE_FIREBASE_STORAGE = false

if (typeof firebase !== "undefined" && firebase) {
  try {
    firebase.initializeApp(firebaseConfig)
    db = firebase.firestore()
    storage = firebase.storage()
    auth = firebase.auth()
    
    // Enable persistent login: user stays logged in across browser sessions
    // Using LOCAL persistence means login persists even after browser close
    firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL)
      .catch((error) => {
        console.warn("[TaskQuest] Persistence setup failed:", error)
      })
    
    // Configure Google Sign-In provider
    const googleProvider = new firebase.auth.GoogleAuthProvider()
    googleProvider.addScope('profile')
    googleProvider.addScope('email')
    
    console.log("[TaskQuest] Firebase initialized successfully")
  } catch (e) {
    console.warn("[TaskQuest] Firebase present but initialization failed:", e)
  }
} else {
  console.warn("[TaskQuest] Firebase SDK not loaded")
  // Leave db/auth/storage undefined — the app will show user-friendly messages when operations fail.
}

// ==========================================
// GITHUB PAGES COMPATIBILITY
// ==========================================

// Helper function to get the correct path for redirects (handles GitHub Pages subdirectories)
function getBasePath() {
  const path = window.location.pathname
  console.log('[TaskQuest] getBasePath() - current pathname:', path)
  
  // If path is just "/" or contains only the filename, we're at root
  if (path === '/' || path === '') {
    console.log('[TaskQuest] getBasePath() - at root, returning empty string')
    return ''
  }
  
  // Split by '/' and filter out empty parts
  const parts = path.split('/').filter(p => p)
  console.log('[TaskQuest] getBasePath() - path parts:', parts)
  
  // If the last part is an HTML file, remove it to get the base directory
  if (parts.length > 0 && parts[parts.length - 1].endsWith('.html')) {
    parts.pop()
  }
  
  // Join remaining parts and prefix with /
  if (parts.length > 0) {
    const basePath = '/' + parts.join('/')
    return basePath
  }
  
  return ''
}

// Navigate to a page relative to the base path (handles GitHub Pages)
function navigateTo(page) {
  const base = getBasePath()
  const url = base + '/' + page
  window.location.href = url
}

// Expose navigateTo on window to ensure it's available in all contexts
try { window.navigateTo = navigateTo } catch (e) {}

// Enhanced toast notification system with auto-dismiss and animations
function showToast(message, type = 'success', duration = 4000) {
  let container = document.getElementById('toastContainer')
  if (!container) {
    container = document.createElement('div')
    container.id = 'toastContainer'
    container.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 10px;
      pointer-events: none;
    `
    document.body.appendChild(container)
  }
  }
// ==========================================
// SESSION & AUTH STATE MANAGEMENT
// ==========================================

// Flag to prevent redirect loop during sign-in redirect processing
let isProcessingRedirect = false

// Real-time listener for parent profile updates (co-parents sync)
let parentProfileUnsubscribe = null
let familyMembersUnsubscribe = null

function setupFamilyMembersListener(familyCode) {
  // Clean up previous listener if exists
  if (familyMembersUnsubscribe) {
    try { familyMembersUnsubscribe() } catch (e) {}
    familyMembersUnsubscribe = null
  }
  
  // Only set up on parent dashboard
  if (!window.location.pathname.includes('parent-dashboard') || !familyCode) return
  
  // Listen for changes to any user in the family
  familyMembersUnsubscribe = db.collection('users')
    .where('familyCode', '==', familyCode)
    .onSnapshot(
      (snapshot) => {
        // Reload coparents and children when family members change
        if (typeof loadCoparents === 'function' && document.getElementById('coparentsGrid')) {
          loadCoparents()
        }
        if (typeof loadChildren === 'function' && document.getElementById('childrenGrid')) {
          loadChildren()
        }
      },
      (error) => {
        if (error.code !== 'permission-denied') {
          console.error('[TaskQuest] Family members listener error:', error)
        }
      }
    )
}

function setupParentProfileListener(userId) {
  // Clean up previous listener if exists
  if (parentProfileUnsubscribe) {
    try { parentProfileUnsubscribe() } catch (e) {}
  }
  
  // Only set up listener on parent dashboard
  if (!window.location.pathname.includes('parent-dashboard')) return
  
  console.log('[TaskQuest] Setting up real-time parent profile listener for:', userId)
  parentProfileUnsubscribe = db.collection('users').doc(userId).onSnapshot(
    (doc) => {
      if (!doc.exists) return
      const newData = doc.data()
      
      // Set up family members listener when familyCode is available
      const familyCode = newData.familyCode
      if (familyCode) {
        setupFamilyMembersListener(familyCode)
      }
      
      // Reload profile if familyCode changed (means co-parent was approved)
      if (typeof loadParentProfile === 'function' && typeof loadCoparents === 'function') {
        loadParentProfile()
        // Reload co-parents list to reflect new co-parent count
        if (document.getElementById('coparentsGrid')) {
          loadCoparents()
        }
      }
    },
    (error) => {
      console.warn('[TaskQuest] Parent profile listener error:', error)
    }
  )
}

// Set up auth state persistence listener
if (auth) {
  auth.onAuthStateChanged((user) => {
    // Check if this tab was explicitly logged out
    if (sessionStorage.getItem('loggedOut') === 'true') {
      return // Don't restore session for this tab
    }
    
    // If user exists, set up real-time listeners and check if their account has been disabled by a parent
    if (user) {
      // Set up real-time profile listener for co-parents sync
      if (window.location.pathname.includes('parent-dashboard')) {
        setupParentProfileListener(user.uid)
      }
      
      db.collection('users').doc(user.uid).get().then((doc) => {
        if (doc.exists) {
          const data = doc.data()
          // Cache loaded user data for quick use by listeners
          try { window.loadedUserData = data } catch (e) {}
          if (data.disabled === true && data.role === 'child') {
            showNotification('This account has been disabled by a parent. You have been signed out.', 'error')
            // Force sign out for disabled child accounts
            auth.signOut().then(() => {
              sessionStorage.setItem('loggedOut', 'true')
              navigateTo('index.html')
            }).catch((e) => console.warn('[TaskQuest] Sign-out after disable failed:', e))
          }
        }
      }).catch((err) => {
        console.warn('[TaskQuest] Could not verify disabled status:', err)
      })
    }
    
    // If user is logged in and we're on the login page, redirect
      // But skip if we're processing a redirect sign-in to avoid interference
      if (user && window.location.pathname.includes('index.html') && !isProcessingRedirect) {
      console.log('[TaskQuest] User already logged in, redirecting...')
      // Determine if parent or child by checking their role
      db.collection('users').doc(user.uid).get().then((doc) => {
        if (doc.exists && doc.data().role === 'parent') {
          navigateTo('parent-dashboard.html')
        } else {
          navigateTo('child-dashboard.html')
        }
      }).catch((err) => {
        console.error('[TaskQuest] Failed to determine user role:', err)
      })
    }
    
    // If user is NOT logged in but we're on a dashboard, redirect to login
    // BUT: Don't redirect if we're processing a redirect sign-in result (to avoid redirect loop)
    if (!user && !isProcessingRedirect && (window.location.pathname.includes('parent-dashboard') || window.location.pathname.includes('child-dashboard'))) {
      console.log('[TaskQuest] User not logged in, redirecting to login...')
      sessionStorage.removeItem('loggedOut')
      navigateTo('index.html')
    }
  })

  // Handle redirect sign-in results (if user used redirect fallback)
  // This runs on every page load to catch redirect completions
  isProcessingRedirect = true
  handleRedirectSignIn().finally(() => { isProcessingRedirect = false })
}

// Profile menu toggle helper used by nav dropdowns
function toggleProfileMenu(show) {
  const menu = document.getElementById('profileMenu')
  const btn = document.getElementById('profileBtn')
  if (!menu || !btn) return
  if (typeof show === 'boolean') {
    if (show) {
      menu.classList.add('show')
      menu.setAttribute('aria-hidden', 'false')
      btn.setAttribute('aria-expanded', 'true')
    } else {
      menu.classList.remove('show')
      menu.setAttribute('aria-hidden', 'true')
      btn.setAttribute('aria-expanded', 'false')
    }
    return
  }
  // toggle
  const isShown = menu.classList.contains('show')
  menu.classList.toggle('show', !isShown)
  menu.setAttribute('aria-hidden', String(isShown))
  btn.setAttribute('aria-expanded', String(!isShown))
}

// Close profile menu when clicking outside
document.addEventListener('click', (e) => {
  const menu = document.getElementById('profileMenu')
  const btn = document.getElementById('profileBtn')
  if (!menu || !btn) return
  if (btn.contains(e.target)) return // clicking the button handled elsewhere
  if (menu.contains(e.target)) return
  menu.classList.remove('show')
  menu.setAttribute('aria-hidden', 'true')
  btn.setAttribute('aria-expanded', 'false')
})

// Attach listener to profile button when DOM ready (safe to call multiple times)
document.addEventListener('DOMContentLoaded', () => {
  try {
    const btn = document.getElementById('profileBtn')
    if (btn) btn.addEventListener('click', (e) => { e.stopPropagation(); toggleProfileMenu() })
    // Fill profile initials from signed-in user if available
    try {
      const user = auth && auth.currentUser
      if (user) {
        const name = user.displayName || (user.email ? user.email.split('@')[0] : '')
        const initial = name ? name.trim().charAt(0).toUpperCase() : '👤'
        document.querySelectorAll('.profile-initial').forEach(el => { el.textContent = initial })
      }
    } catch (e) {
      // ignore
    }
  } catch (e) {
    console.warn('[TaskQuest] profile menu init failed:', e)
  }
})
// Lightweight input modal (returns Promise<string|null>)
function showInputModal(title, placeholder = '', defaultValue = '') {
  return new Promise((resolve) => {
    const modal = document.createElement('div')
    modal.className = 'modal modal-prompt'
    modal.style.display = 'block'
    const content = document.createElement('div')
    content.className = 'modal-content'
    content.style.maxWidth = '420px'
    content.innerHTML = `
      <span class="close" style="cursor:pointer;">&times;</span>
      <h3 style="margin-top:0">${title}</h3>
      <input id="__inputModalInput" style="width:100%; padding:8px; margin-top:8px;" placeholder="${placeholder}" />
      <div style="margin-top:12px; text-align:right;">
        <button id="__inputModalCancel" class="secondary-btn">Cancel</button>
        <button id="__inputModalOk" class="primary-btn">OK</button>
      </div>
    `
    modal.appendChild(content)
    document.body.appendChild(modal)

    const inp = content.querySelector('#__inputModalInput')
    const ok = content.querySelector('#__inputModalOk')
    const cancel = content.querySelector('#__inputModalCancel')
    const close = content.querySelector('.close')
    if (inp) { inp.value = defaultValue || ''; inp.focus() }

    function cleanup(val) {
      try { document.body.removeChild(modal) } catch (e) {}
      resolve(val)
    }

    ok.addEventListener('click', () => cleanup(document.getElementById('__inputModalInput').value))
    cancel.addEventListener('click', () => cleanup(null))
    close.addEventListener('click', () => cleanup(null))
    modal.addEventListener('click', (ev) => { if (ev.target === modal) cleanup(null) })
  })
}

// Lightweight confirm modal (returns Promise<boolean>)
function showConfirmModal(title, message) {
  return new Promise((resolve) => {
    const modal = document.createElement('div')
    modal.className = 'modal modal-prompt'
    modal.style.display = 'block'
    const content = document.createElement('div')
    content.className = 'modal-content'
    content.style.maxWidth = '420px'
    content.innerHTML = `
      <span class="close" style="cursor:pointer;">&times;</span>
      <h3 style="margin-top:0">${title}</h3>
      <p style="margin-top:8px">${message}</p>
      <div style="margin-top:12px; text-align:right;">
        <button id="__confirmCancel" class="secondary-btn">Cancel</button>
        <button id="__confirmOk" class="primary-btn">OK</button>
      </div>
    `
    modal.appendChild(content)
    document.body.appendChild(modal)

    const ok = content.querySelector('#__confirmOk')
    const cancel = content.querySelector('#__confirmCancel')
    const close = content.querySelector('.close')

    function cleanup(val) {
      try { document.body.removeChild(modal) } catch (e) {}
      resolve(val)
    }

    ok.addEventListener('click', () => cleanup(true))
    cancel.addEventListener('click', () => cleanup(false))
    close.addEventListener('click', () => cleanup(false))
    modal.addEventListener('click', (ev) => { if (ev.target === modal) cleanup(false) })
  })
}

// ==========================================
// AUTHENTICATION FUNCTIONS
// ==========================================

let currentAuthMode = "login" // 'login' or 'signup'
let currentUserType = "child" // 'child' or 'parent'

// Track current task state for child workflow
let currentTaskInfo = { id: null, title: null, inProgressSubmissionId: null, inProgressFamilyCode: null }
let uploadedPhotos = { before: null, after: null }

function generateFamilyCode() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// Try to reliably get or create a familyCode for the current user
async function getFamilyCodeForUser(user) {
  if (!user) return null
  try {
    // Try direct doc lookup
    const userRef = db.collection("users").doc(user.uid)
    const userDoc = await userRef.get()
    if (userDoc.exists) {
      const data = userDoc.data()
      if (data.familyCode) return data.familyCode
      // If parent without a familyCode, generate one and persist
      if (data.role === "parent") {
        const code = generateFamilyCode()
        await userRef.update({ familyCode: code })
        return code
      }
    }
    return null
  } catch (e) {
    console.warn("getFamilyCodeForUser error", e)
    return null
  }
}

async function loginAsParent() {
  const email = document.getElementById("username").value
  const password = document.getElementById("password").value

  if (!email || !password) {
    showNotification("Please fill in all fields", "error")
    return
  }

  try {
    const userCredential = await auth.signInWithEmailAndPassword(email, password)
    const user = userCredential.user
    console.log('[TaskQuest] loginAsParent user:', user)

    // Check if user is a parent
    const userDoc = await db.collection("users").doc(user.uid).get()
    if (userDoc.exists && userDoc.data().role === "parent") {
      closeLoginModal()
      showParentPinVerification()
    } else {
      showNotification("Invalid parent account", "error")
      await auth.signOut()
    }
  } catch (error) {
    console.error("[TaskQuest] Parent login error:", error)
    showNotification("Login failed. Please check your credentials.", "error")
  }
}

async function loginAsChild() {
  const email = document.getElementById("username").value
  const password = document.getElementById("password").value

  if (!email || !password) {
    showNotification("Please fill in all fields", "error")
    return
  }

  try {
    const userCredential = await auth.signInWithEmailAndPassword(email, password)
    const user = userCredential.user
    console.log('[TaskQuest] loginAsChild user:', user)

    // Check if user is a child
    const userDoc = await db.collection("users").doc(user.uid).get()
    if (userDoc.exists && userDoc.data().role === "child") {
      showNotification("Welcome back!", "success")
      if (typeof navigateTo === 'function') {
        navigateTo("child-dashboard.html")
      } else {
        window.location.href = getBasePath() + '/child-dashboard.html'
      }
    } else {
      showNotification("Invalid child account", "error")
      await auth.signOut()
    }
  } catch (error) {
    console.error("[TaskQuest] Child login error:", error)
    showNotification("Login failed. Please check your credentials.", "error")
  }
}

async function signupAsParent() {
  const email = document.getElementById("username").value
  const password = document.getElementById("password").value
  const name = document.getElementById("name").value

  if (!email || !password || !name) {
    showNotification("Please fill in all fields", "error")
    return
  }

  if (password.length < 6) {
    showNotification("Password must be at least 6 characters", "error")
    return
  }

  try {
    const passcode = await showInputModal('Create a 6-digit PASSCODE for additional security (only you should know this):', '6-digit passcode')

    if (!passcode || passcode.length !== 6 || isNaN(passcode)) {
      showNotification('Invalid passcode. Please use exactly 6 digits.', 'error')
      return
    }

    // Create user account
    const userCredential = await auth.createUserWithEmailAndPassword(email, password)
    const user = userCredential.user

    const familyCode = generateFamilyCode()

    // Store user data in Firestore with error handling
    try {
      await db.collection("users").doc(user.uid).set({
        name: name,
        email: email,
        role: "parent",
        passcode: passcode,
        familyCode: familyCode,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      })
    } catch (dbError) {
      console.error("[TaskQuest] Firestore write error:", dbError)
      // If Firestore fails, delete the auth account to keep things in sync
      await user.delete().catch(e => console.warn("Could not delete auth user", e))
      
      if (dbError.code === "permission-denied") {
        showNotification("Database setup incomplete. Please publish Firestore rules in Firebase Console.", "error")
      } else {
        showNotification("Signup failed: " + dbError.message, "error")
      }
      return
    }

    showNotification(`Account created! Your Family Code is: ${familyCode} - Share this with your children!`, "success")
    closeLoginModal()
    setTimeout(() => {
      navigateTo("parent-dashboard.html")
    }, 1500)
  } catch (error) {
    console.error("[TaskQuest] Parent signup error:", error)
    if (error.code === "auth/email-already-in-use") {
      showNotification("Email already in use. Please login instead.", "error")
    } else if (error.code === "auth/invalid-email") {
      showNotification("Invalid email address.", "error")
    } else if (error.code === "auth/weak-password") {
      showNotification("Password is too weak. Use at least 6 characters.", "error")
    } else {
      showNotification("Signup failed: " + error.message, "error")
    }
  }
}

async function signupAsChild() {
  const email = document.getElementById("username").value
  const password = document.getElementById("password").value
  const name = document.getElementById("name").value

  if (!email || !password || !name) {
    showNotification("Please fill in all fields", "error")
    return
  }

  if (password.length < 6) {
    showNotification("Password must be at least 6 characters", "error")
    return
  }

  try {
    // Create user account FIRST
    const userCredential = await auth.createUserWithEmailAndPassword(email, password)
    const user = userCredential.user

    // NOW try to create the profile (will be linked to family later by parent)
    try {
      await db.collection("users").doc(user.uid).set({
        name: name,
        email: email,
        role: "child",
        points: 0,
        familyCode: null, // Will be set when parent adds them
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      })
    } catch (dbError) {
      console.error("[TaskQuest] Firestore write error:", dbError)
      // If Firestore fails, delete the auth account
      await user.delete().catch(e => console.warn("Could not delete auth user", e))
      
      if (dbError.code === "permission-denied") {
        showNotification("Database setup incomplete. Please contact administrator.", "error")
      } else {
        showNotification("Signup failed: " + dbError.message, "error")
      }
      return
    }

    showNotification("Account created! Ask your parent to add you to the family.", "success")
    closeLoginModal()
    setTimeout(() => {
      navigateTo("child-dashboard.html")
    }, 1500)
  } catch (error) {
    console.error("[TaskQuest] Child signup error:", error)
    if (error.code === "auth/email-already-in-use") {
      showNotification("Email already in use. Please login instead.", "error")
    } else if (error.code === "auth/invalid-email") {
      showNotification("Invalid email address.", "error")
    } else if (error.code === "auth/weak-password") {
      showNotification("Password is too weak. Use at least 6 characters.", "error")
    } else {
      showNotification("Signup failed: " + error.message, "error")
    }
  }
}

// ==========================================
// TASK UPLOAD FUNCTIONS
// ==========================================

async function uploadBeforePhoto(event) {
  const file = event.target.files[0]
  if (!file) return

  // Preview the image
  const reader = new FileReader()
  reader.onload = (e) => {
    const preview = document.getElementById("beforePreview")
    preview.innerHTML = `<img src="${e.target.result}" alt="Before photo">`
    preview.style.display = "block"
    const label = document.querySelector("#beforeUploadBox .upload-label")
    if (label) label.style.display = "none"
  }
  reader.readAsDataURL(file)

  // Store file for later upload
  uploadedPhotos.before = file
  console.log("[TaskQuest] Before photo selected")
}

async function uploadAfterPhoto(event) {
  const file = event.target.files[0]
  if (!file) return

  // Preview the image
  const reader = new FileReader()
  reader.onload = (e) => {
    const preview = document.getElementById("afterPreview")
    preview.innerHTML = `<img src="${e.target.result}" alt="After photo">`
    preview.style.display = "block"
    const label = document.querySelector("#afterUploadBox .upload-label")
    if (label) label.style.display = "none"
  }
  reader.readAsDataURL(file)

  // Store file for later upload
  uploadedPhotos.after = file
  console.log("[TaskQuest] After photo selected")
}

async function submitTaskForReview() {
  if (!uploadedPhotos.before || !uploadedPhotos.after) {
    showNotification("Please upload both before and after photos", "error")
    return
  }

  if (!currentTaskInfo.id) {
    showNotification("Task ID not found. Please try again.", "error")
    return
  }

  try {
    const user = auth.currentUser
    if (!user) {
      showNotification("Please login first", "error")
      return
    }

    showNotification("Uploading photos...", "success")

    // Upload photos to Firebase Storage
    const timestamp = Date.now()
    const familyCode = await getFamilyCodeForUser(user)
    if (!familyCode) {
      showNotification("Unable to determine family code. Ask your parent to set up the family.", "error")
      return
    }

    // Helper to convert and resize image to data URL (client-side fallback)
    async function fileToDataUrlAndResize(file, maxWidth = 1200, maxHeight = 900, quality = 0.7) {
      return new Promise((resolve, reject) => {
        try {
          const img = new Image()
          const reader = new FileReader()
          reader.onload = (e) => {
            img.onload = () => {
              // calculate new size
              let { width, height } = img
              const aspect = width / height
              if (width > maxWidth) {
                width = maxWidth
                height = Math.round(width / aspect)
              }
              if (height > maxHeight) {
                height = maxHeight
                width = Math.round(height * aspect)
              }
              const canvas = document.createElement('canvas')
              canvas.width = width
              canvas.height = height
              const ctx = canvas.getContext('2d')
              ctx.drawImage(img, 0, 0, width, height)
              const dataUrl = canvas.toDataURL('image/jpeg', quality)
              resolve(dataUrl)
            }
            img.onerror = (err) => reject(err)
            img.src = e.target.result
          }
          reader.onerror = (err) => reject(err)
          reader.readAsDataURL(file)
        } catch (err) {
          reject(err)
        }
      })
    }

    // Helper to upload image to Cloudinary (unsigned)
    async function uploadToCloudinary(file) {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET)
      formData.append('resource_type', 'auto')
      const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/upload`
      const response = await fetch(url, { method: 'POST', body: formData })
      if (!response.ok) {
        throw new Error(`Cloudinary upload failed: ${response.statusText}`)
      }
      const data = await response.json()
      return data.secure_url
    }

    // Three-tier fallback: 1) Firebase Storage, 2) Cloudinary unsigned, 3) data-URL
    let beforeURL = null
    let afterURL = null
    let beforeDataUrl = null
    let afterDataUrl = null

    // Tier 1: Try Firebase Storage (only if enabled)
    try {
      if (USE_FIREBASE_STORAGE && typeof storage !== 'undefined' && storage) {
        const beforeRef = storage.ref(`tasks/${user.uid}/${timestamp}_before.jpg`)
        const afterRef = storage.ref(`tasks/${user.uid}/${timestamp}_after.jpg`)
        await beforeRef.put(uploadedPhotos.before)
        await afterRef.put(uploadedPhotos.after)
        beforeURL = await beforeRef.getDownloadURL()
        afterURL = await afterRef.getDownloadURL()
        console.log('[TaskQuest] Photos uploaded to Firebase Storage')
      } else {
        // Skip Firebase Storage (likely CORS issue on static hosting)
        throw new Error('StorageUnavailable')
      }
    } catch (storageErr) {
      console.warn('[TaskQuest] Storage upload failed or skipped, attempting Cloudinary/data-URL fallback:', storageErr)
      // Tier 2: Try Cloudinary unsigned upload
      try {
        if (CLOUDINARY_CLOUD_NAME && CLOUDINARY_UPLOAD_PRESET) {
          // Try Cloudinary unsigned upload as the second tier
          beforeURL = await uploadToCloudinary(uploadedPhotos.before)
          afterURL = await uploadToCloudinary(uploadedPhotos.after)
          console.log('[TaskQuest] Photos uploaded to Cloudinary')
        } else {
          throw new Error('CloudinaryNotConfigured')
        }
      } catch (cloudinaryErr) {
        console.warn('[TaskQuest] Cloudinary upload failed, using Firestore data-url fallback:', cloudinaryErr)
        // Tier 3: Fallback to data URLs (resized)
        try {
          beforeDataUrl = await fileToDataUrlAndResize(uploadedPhotos.before, 1200, 900, 0.7)
        } catch (e) {
          console.warn('Failed to convert before photo to dataURL:', e)
        }
        try {
          afterDataUrl = await fileToDataUrlAndResize(uploadedPhotos.after, 1200, 900, 0.7)
        } catch (e) {
          console.warn('Failed to convert after photo to dataURL:', e)
        }
      }
    }

    // Create submission data object (will be used for both update and create)
    const submissionData = {
      beforePhoto: beforeURL || null,
      afterPhoto: afterURL || null,
      beforeDataUrl: beforeDataUrl || null,
      afterDataUrl: afterDataUrl || null,
      status: "pending",
      submittedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }

    // Check if we have an in-progress submission to update, or create a new one
    if (currentTaskInfo.inProgressSubmissionId) {
      // Update the existing in-progress submission with photos and ensure taskId/taskTitle are set
      try {
        await db.collection("submissions").doc(currentTaskInfo.inProgressSubmissionId).update({
          ...submissionData,
          taskId: currentTaskInfo.id,
          taskTitle: currentTaskInfo.title,
        })
        console.log('[TaskQuest] Updated in-progress submission with photos and confirmed taskId:', currentTaskInfo.id)
      } catch (updateErr) {
        console.warn('[TaskQuest] Update existing submission failed, attempting fresh create:', updateErr)
        // If update fails (e.g. doc deleted), create a new submission
        await db.collection("submissions").add({
          userId: user.uid,
          taskId: currentTaskInfo.id,
          taskTitle: currentTaskInfo.title,
          ...submissionData,
          familyCode: familyCode,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        })
        console.log('[TaskQuest] Created new submission as fallback')
      }
    } else {
      // Create a new submission (fallback if workflow wasn't followed)
      await db.collection("submissions").add({
        userId: user.uid,
        taskId: currentTaskInfo.id,
        taskTitle: currentTaskInfo.title,
        ...submissionData,
        familyCode: familyCode,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      })
      console.log('[TaskQuest] Created new submission with photos')
    }

    // Show success notification and close modal
    showNotification("Submitted successfully!", "success")
    closeUploadModal()

    setTimeout(() => {
      loadAvailableTasks()
      loadChildProfile()
    }, 500)
  } catch (error) {
    console.error("[TaskQuest] Submit task error:", error)

    // Detect common Storage / CORS issues and give actionable guidance
    const msg = (error && (error.message || String(error))) || String(error)
    if (msg.toLowerCase().includes("cors") || msg.toLowerCase().includes("preflight") || msg.includes("net::ERR_FAILED")) {
      showNotification("Upload blocked by CORS or storage configuration. See console for details.", "error")
      console.warn("Possible CORS/storage issue. Check these steps:")
      console.warn("1) In Firebase Console > Storage, confirm your bucket name matches `firebaseConfig.storageBucket`.")
      console.warn("2) Configure CORS for your Storage bucket to allow your app origin (e.g. http://127.0.0.1:5500 or http://localhost:5500).")
      console.warn("   - Use GCP Console > Cloud Storage > Browse > select bucket > Edit CORS configuration (or use gsutil cors set cors.json gs://<bucket>)")
      console.warn("3) Example CORS JSON:\n[ {\n  \"origin\": [\"http://localhost:5500\", \"http://127.0.0.1:5500\"],\n  \"method\": [\"GET\", \"POST\", \"PUT\", \"HEAD\", \"DELETE\", \"OPTIONS\"],\n  \"responseHeader\": [\"Content-Type\", \"Authorization\"],\n  \"maxAgeSeconds\": 3600\n} ]")
    } else {
      showNotification("Submission failed: " + msg, "error")
    }
  }
}

// ==========================================
// PARENT TASK APPROVAL FUNCTIONS
// ==========================================

async function approveTask(taskId, element) {
  try {
    const submissionRef = db.collection("submissions").doc(taskId)
    const submission = await submissionRef.get()

    if (!submission.exists) {
      showNotification("Task not found", "error")
      return
    }

    const data = submission.data()

    // Update submission status
    await submissionRef.update({
      status: "approved",
      approvedAt: firebase.firestore.FieldValue.serverTimestamp(),
    })

    // Get task points
    const taskDoc = await db.collection("taskTemplates").doc(data.taskId).get()
    const points = taskDoc.exists ? taskDoc.data().points : 50

    // Add points to child's account
    const userRef = db.collection("users").doc(data.userId)
    await userRef.update({
      points: firebase.firestore.FieldValue.increment(points),
    })

    showNotification(`Task approved! +${points} points added. ✅`, "success")

    setTimeout(() => {
      loadPendingApprovals()
      loadOngoingTasks()
    }, 1000)
  } catch (error) {
    console.error("[TaskQuest] Approve task error:", error)
    showNotification("Approval failed: " + error.message, "error")
  }
}

async function declineTask(taskId, element) {
  try {
    await db.collection("submissions").doc(taskId).update({
      status: "declined",
      declinedAt: firebase.firestore.FieldValue.serverTimestamp(),
    })

    showNotification("Task declined. ❌", "error")

    setTimeout(() => {
      loadPendingApprovals()
      loadOngoingTasks()
    }, 1000)
  } catch (error) {
    console.error("[TaskQuest] Decline task error:", error)
    showNotification("Decline failed: " + error.message, "error")
  }
}

// ==========================================
// REWARD FUNCTIONS
// ==========================================

async function redeemReward(rewardId) {
  try {
    const user = auth.currentUser
    if (!user) {
      showNotification("Please login first", "error")
      return
    }

    const rewardDoc = await db.collection("rewards").doc(rewardId).get()
    if (!rewardDoc.exists) {
      showNotification("Reward not found", "error")
      return
    }

    const reward = rewardDoc.data()
    const userDoc = await db.collection("users").doc(user.uid).get()
    const currentPoints = (userDoc.exists && userDoc.data().points) || 0
    const familyCode = await getFamilyCodeForUser(user)
    if (!familyCode) {
      showNotification("Unable to determine family code.", "error")
      return
    }

    if (currentPoints < reward.cost) {
      showNotification("Not enough points!", "error")
      return
    }

    // Deduct points
    await db
      .collection("users")
      .doc(user.uid)
      .update({
        points: firebase.firestore.FieldValue.increment(-reward.cost),
      })

    await db.collection("redeemedRewards").add({
      userId: user.uid,
      rewardId: rewardId,
      rewardName: reward.name,
      cost: reward.cost,
      familyCode: familyCode,
      redeemedAt: firebase.firestore.FieldValue.serverTimestamp(),
    })

    showNotification("Reward redeemed! 🎁", "success")

    setTimeout(() => {
      setupChildPointsListener()
      loadRewards()
      loadChildProfile()
    }, 1000)
  } catch (error) {
    console.error("[TaskQuest] Redeem reward error:", error)
    showNotification("Redemption failed: " + error.message, "error")
  }
}

// ==========================================
// TASK TEMPLATE & REWARD CREATION
// ==========================================

async function createTaskTemplate(event) {
  if (event) event.preventDefault()

  const title = document.getElementById("taskTitle").value
  const description = document.getElementById("taskDescription").value
  const points = Number.parseInt(document.getElementById("taskPoints").value)
  const icon = document.getElementById("taskImage").value || "📋"

  try {
    const user = auth.currentUser
    const familyCode = await getFamilyCodeForUser(user)
    if (!familyCode) {
      showNotification("Unable to determine family code. Create or join a family first.", "error")
      return
    }

    await db.collection("taskTemplates").add({
      title,
      description,
      points,
      icon,
      familyCode: familyCode,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    })

    showNotification("Task template created! ✅", "success")
    closeCreateTaskModal()

    setTimeout(() => {
      loadParentTasks()
    }, 1000)
  } catch (error) {
    console.error("[TaskQuest] Create task error:", error)
    showNotification("Creation failed: " + error.message, "error")
  }
}

async function addReward(event) {
  if (event) event.preventDefault()

  const name = document.getElementById("rewardName").value
  const cost = Number.parseInt(document.getElementById("rewardCost").value)
  const icon = document.getElementById("rewardIcon").value || "🎁"

  try {
    const user = auth.currentUser
    const familyCode = await getFamilyCodeForUser(user)
    if (!familyCode) {
      showNotification("Unable to determine family code. Create or join a family first.", "error")
      return
    }

    await db.collection("rewards").add({
      name,
      cost,
      icon,
      familyCode: familyCode,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    })

    showNotification("Reward added! 🎁", "success")
    closeAddRewardModal()

    setTimeout(() => {
      loadParentRewards()
    }, 1000)
  } catch (error) {
    console.error("[TaskQuest] Add reward error:", error)
    showNotification("Failed to add reward: " + error.message, "error")
  }
}

// ==========================================
// CHILD MANAGEMENT FUNCTIONS
// ==========================================

async function resetPoints(childId) {
  const ok = await showConfirmModal('Reset points', "Are you sure you want to reset this child's points to 0?")
  if (!ok) return

  try {
    await db.collection("users").doc(childId).update({
      points: 0,
    })
    showNotification("Points reset successfully.", "success")
    setTimeout(() => {
      loadChildren()
    }, 1000)
  } catch (error) {
    console.error("[TaskQuest] Reset points error:", error)
    showNotification("Reset failed: " + error.message, "error")
  }
}

async function sendRewardNotification(childId) {
  try {
    await db.collection("notifications").add({
      userId: childId,
      message: "You have a new reward available!",
      type: "reward",
      read: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    })
    showNotification("Reward notification sent! 📬", "success")
  } catch (error) {
    console.error("[TaskQuest] Send notification error:", error)
    showNotification("Failed to send notification: " + error.message, "error")
  }
}

// Parent management actions
async function unlinkChild(childId) {
  const ok = await showConfirmModal('Unlink child', "Are you sure you want to unlink this child from your family? They will need to re-request linking.")
  if (!ok) return
  try {
    await db.collection('users').doc(childId).update({
      familyCode: null,
    })
    showNotification('Child unlinked from family.', 'success')
    setTimeout(() => loadChildren(), 800)
  } catch (err) {
    console.error('[TaskQuest] Unlink child error:', err)
    showNotification('Failed to unlink child: ' + err.message, 'error')
  }
}

async function deactivateChild(childId) {
  const ok = await showConfirmModal('Deactivate child', "Deactivate this child account? They will be signed out and unable to use the app until reactivated.")
  if (!ok) return
  try {
    await db.collection('users').doc(childId).update({
      disabled: true,
    })
    showNotification('Child account deactivated.', 'success')
    setTimeout(() => loadChildren(), 800)
  } catch (err) {
    console.error('[TaskQuest] Deactivate child error:', err)
    showNotification('Failed to deactivate child: ' + err.message, 'error')
  }
}

function editChildNamePrompt(childId, currentName) {
  showInputModal('Enter new name for child:', 'Child name', currentName || '').then((newName) => {
    if (newName === null || newName === undefined) return
    const trimmed = String(newName).trim()
    if (!trimmed) {
      showNotification('Name cannot be empty.', 'error')
      return
    }
    editChildName(childId, trimmed)
  })
}

async function editChildName(childId, newName) {
  try {
    await db.collection('users').doc(childId).update({
      name: newName,
    })
    showNotification('Child name updated.', 'success')
    setTimeout(() => loadChildren(), 800)
  } catch (err) {
    console.error('[TaskQuest] Edit child name error:', err)
    showNotification('Failed to update name: ' + err.message, 'error')
  }
}

// ==========================================
// MODAL FUNCTIONS
// ==========================================

function showLoginForm(type) {
  currentUserType = type
  currentAuthMode = "login"

  const modal = document.getElementById("loginModal")
  if (!modal) return
  modal.style.display = "block"

  const formTitle = document.getElementById("formTitle")
  if (formTitle) formTitle.textContent = type === "child" ? "Child Login" : "Parent Login"
  const submitBtn = document.getElementById("submitBtn")
  if (submitBtn) submitBtn.textContent = "Login"
  const nameGroup = document.getElementById("nameGroup")
  if (nameGroup) nameGroup.style.display = "none"
  const familyGroupEl = document.getElementById("familyCodeGroup")
  if (familyGroupEl) familyGroupEl.style.display = "none"
  document.getElementById("toggleAuth").innerHTML =
    'Don\'t have an account? <a href="#" onclick="toggleAuthMode(event)">Sign up</a>'

  document.getElementById("loginForm").onsubmit = (e) => {
    e.preventDefault()
    if (type === "child") {
      loginAsChild()
    } else {
      loginAsParent()
    }
  }
}

function toggleAuthMode(event) {
  if (event) event.preventDefault()

  currentAuthMode = currentAuthMode === "login" ? "signup" : "login"

  const formTitle = document.getElementById("formTitle")
  const submitBtn = document.getElementById("submitBtn")
  const nameGroup = document.getElementById("nameGroup")
  const toggleAuth = document.getElementById("toggleAuth")
  const loginForm = document.getElementById("loginForm")

  if (currentAuthMode === "signup") {
    formTitle.textContent = currentUserType === "child" ? "Child Sign Up" : "Parent Sign Up"
    submitBtn.textContent = "Sign Up"
    nameGroup.style.display = "block"
    nameGroup.querySelector("input").required = true
    toggleAuth.innerHTML = 'Already have an account? <a href="#" onclick="toggleAuthMode(event)">Login</a>'

    loginForm.onsubmit = (e) => {
      e.preventDefault()
      if (currentUserType === "child") {
        signupAsChild()
      } else {
        signupAsParent()
      }
    }
  } else {
    formTitle.textContent = currentUserType === "child" ? "Child Login" : "Parent Login"
    submitBtn.textContent = "Login"
    nameGroup.style.display = "none"
    nameGroup.querySelector("input").required = false
    toggleAuth.innerHTML = 'Don\'t have an account? <a href="#" onclick="toggleAuthMode(event)">Sign up</a>'

    loginForm.onsubmit = (e) => {
      e.preventDefault()
      if (currentUserType === "child") {
        loginAsChild()
      } else {
        loginAsParent()
      }
    }
  }

  // Clear form
  document.getElementById("username").value = ""
  document.getElementById("password").value = ""
  document.getElementById("name").value = ""
  const fc = document.getElementById('familyCode')
  if (fc) fc.value = ''
}

function handleFormSubmit(event) {
  if (event) event.preventDefault()
  
  if (currentAuthMode === "login") {
    if (currentUserType === "child") {
      loginAsChild()
    } else {
      loginAsParent()
    }
  } else {
    if (currentUserType === "child") {
      signupAsChild()
    } else {
      signupAsParent()
    }
  }
}

async function signInWithGoogle() {
  try {
    console.log('[TaskQuest] signInWithGoogle() called')
    
    if (!auth) {
      showNotification('Firebase not initialized. Please refresh the page.', 'error')
      return
    }
    
    const googleProvider = new firebase.auth.GoogleAuthProvider()
    googleProvider.addScope('profile')
    googleProvider.addScope('email')

    // Try popup first (better UX). If it fails (popup blocker), fall back to redirect.
    try {
      console.log('[TaskQuest] Attempting popup sign-in...')
      const result = await auth.signInWithPopup(googleProvider)
      console.log('[TaskQuest] Popup sign-in successful, user:', result.user?.email)
      await processGoogleSignInResult(result)
    } catch (popupErr) {
      console.warn('[TaskQuest] Popup sign-in failed, falling back to redirect:', popupErr?.code, popupErr?.message)
      // Inform user about popup blockers in case that's the cause
      if (popupErr.code === 'auth/popup-blocked' || popupErr.code === 'auth/popup-closed-by-user' || popupErr.code === 'auth/cancelled-popup-request') {
        showNotification('Popup blocked or cancelled. Using redirect sign-in as a fallback.', 'warning')
      }
      // For some errors (unauthorized-domain) redirect won't fix the problem, but we still attempt
      // redirect because it may work where popup was blocked.
      try {
        console.log('[TaskQuest] Attempting redirect sign-in...')
        await auth.signInWithRedirect(googleProvider)
      } catch (redirectErr) {
        console.error('[TaskQuest] Redirect sign-in also failed:', redirectErr?.code, redirectErr?.message)
        if (redirectErr.code === 'auth/unauthorized-domain') {
          showNotification('Google Sign-In blocked: unauthorized domain. Add your site domain in the Firebase Console (Auth → Authorized domains).', 'error')
        } else {
          showNotification('Google Sign-In failed: ' + redirectErr.message, 'error')
        }
      }
    }
  } catch (error) {
    console.error("[TaskQuest] Google Sign-In outer error:", error)
    showNotification('Google Sign-In failed: ' + (error?.message || String(error)), 'error')
  }
}
// Ensure global accessibility
window.signInWithGoogle = signInWithGoogle

// Dedicated handler for redirect sign-in results (called on every page load)
async function handleRedirectSignIn() {
  try {
    console.log('[TaskQuest] handleRedirectSignIn: checking for redirect result...')
    const result = await auth.getRedirectResult()
    if (result && result.user) {
      const providerFromResult = result.providerId || result.credential?.providerId
      const providerList = result.user.providerData || []
      const inferredProvider = providerFromResult || (providerList.length ? providerList[providerList.length - 1].providerId : null)
      console.log('[TaskQuest] Redirect sign-in result detected, user:', result.user.email, 'provider:', inferredProvider)
      if (inferredProvider === 'apple.com') {
        console.log('[TaskQuest] Apple redirect detected, processing...')
        await processAppleSignInResult(result)
      } else if (inferredProvider === 'google.com') {
        console.log('[TaskQuest] Google redirect detected, processing...')
        await processGoogleSignInResult(result)
      } else {
        console.log('[TaskQuest] No provider info, attempting Google processing as fallback')
        await processGoogleSignInResult(result)
      }
    } else {
      console.log('[TaskQuest] No redirect result found - may be popup or first load')
    }
  } catch (err) {
    console.warn('[TaskQuest] getRedirectResult error:', err?.code, err?.message)
    if (err && err.code === 'auth/unauthorized-domain') {
      showNotification('Sign-In blocked: unauthorized domain. Add your site domain in the Firebase Console (Auth → Authorized domains).', 'error')
    } else if (err && err.code === 'auth/account-exists-with-different-credential') {
      showNotification('This email is already used with a different sign-in provider. Please sign in with your original provider (e.g., Google) and then link Apple in your account settings.', 'error')
    }
  }
}

// Centralized processing for a Google sign-in result (popup or redirect)
async function processGoogleSignInResult(result) {
  if (!result || !result.user) {
    console.warn('[TaskQuest] processGoogleSignInResult: no user in result')
    return
  }
  const user = result.user
  console.log('[TaskQuest] processGoogleSignInResult: user =', user.uid, user.email)
  
  try {
    if (!db) {
      console.error('[TaskQuest] Firestore not initialized!')
      showNotification('Database not initialized. Please refresh the page.', 'error')
      return
    }
    
    console.log('[TaskQuest] Fetching user doc from Firestore...')
    const userDoc = await db.collection('users').doc(user.uid).get()
    console.log('[TaskQuest] User doc exists:', userDoc.exists)
    
    if (userDoc.exists) {
      const userData = userDoc.data()
      console.log('[TaskQuest] User data:', userData?.role)
      
      if (userData.role === 'parent') {
        console.log('[TaskQuest] Showing parent PIN verification')
        showNotification('Welcome back, Parent!', 'success')
        // Delay parent verification modal to ensure DOM is ready
        setTimeout(() => {
          showParentPinVerification()
          isProcessingRedirect = false
        }, 300)
      } else if (userData.role === 'child') {
        console.log('[TaskQuest] Navigating child to dashboard')
        showNotification('Welcome back!', 'success')
        // Close any open modal and delay navigation
        try {
          const modal = document.getElementById('loginModal')
          if (modal) modal.style.display = 'none'
        } catch (e) {}
        // Delay to allow UI to settle
        setTimeout(() => {
          console.log('[TaskQuest] Calling navigateTo child-dashboard.html')
          navigateTo('child-dashboard.html')
          isProcessingRedirect = false
        }, 800)
      }
    } else {
      // New user - need to determine role and complete profile
      console.log('[TaskQuest] New user, showing role selection')
      showGoogleRoleSelection(user)
    }
  } catch (err) {
    console.error('[TaskQuest] Failed processing Google sign-in result:', err)
    const errMsg = err?.message || String(err)
    if (errMsg.includes('Missing or insufficient permissions')) {
      showNotification('Permission denied reading user profile. Check Firestore rules.', 'error')
    } else {
      showNotification('Sign-in succeeded but processing failed: ' + errMsg, 'error')
    }
  }
}

// Store current Google user for role selection (avoid HTML escaping issues)
let pendingGoogleUser = null

function showGoogleRoleSelection(googleUser) {
  // Store the user in a variable to avoid HTML escaping issues
  pendingGoogleUser = googleUser
  
  const modal = document.getElementById("loginModal")
  if (!modal) return
  const modalContent = modal.querySelector(".modal-content")
  if (!modalContent) return
  
  // Clear and rebuild modal safely
  modalContent.innerHTML = `
    <span class="close" onclick="closeLoginModal()">&times;</span>
    <h2>Welcome to TaskQuest!</h2>
    <p style="color: var(--text-secondary); margin: 20px 0;">Are you a Parent or a Child?</p>
    <div style="display: flex; gap: 16px; flex-direction: column;">
      <button type="button" class="login-btn parent-login" onclick="completeGoogleSignupWithRole('parent'); return false;">
        <span class="btn-icon">👨‍👩‍👧‍👦</span>
        <span class="btn-text">I'm a Parent</span>
      </button>
      <button type="button" class="login-btn child-login" onclick="completeGoogleSignupWithRole('child'); return false;">
        <span class="btn-icon">🎮</span>
        <span class="btn-text">I'm a Child</span>
      </button>
    </div>
  `
}

// Wrapper to complete Google signup using the stored pendingGoogleUser
async function completeGoogleSignupWithRole(role) {
  if (!pendingGoogleUser) {
    showNotification('Session expired. Please sign in again.', 'error')
    return
  }
  await completeGoogleSignup(pendingGoogleUser.uid, pendingGoogleUser.displayName || pendingGoogleUser.email, role)
}

async function completeGoogleSignup(uid, displayName, role) {
  try {
    if (role === "parent") {
      // Parent needs to create a family code
      const passcode = await showInputModal('Create a 6-digit PASSCODE for additional security (only you should know this):', '6-digit passcode')

      if (!passcode || passcode.length !== 6 || isNaN(passcode)) {
        showNotification('Invalid passcode. Please use exactly 6 digits.', 'error')
        return
      }

      const familyCode = generateFamilyCode()
      
      await db.collection("users").doc(uid).set({
        name: displayName,
        email: auth.currentUser.email,
        role: "parent",
        passcode: passcode,
        familyCode: familyCode,
        authProvider: "google",
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      })
      
      showNotification(`Welcome! Your Family Code is: ${familyCode} - Share this with your children!`, "success")
      closeLoginModal()
      pendingGoogleUser = null
      // Small delay before showing parent verification to ensure DOM is ready
      setTimeout(() => {
        showParentPinVerification()
      }, 300)
    } else {
      // Child signup - will be added to family by parent
      await db.collection("users").doc(uid).set({
        name: displayName,
        email: auth.currentUser.email,
        role: "child",
        points: 0,
        familyCode: null,
        authProvider: "google",
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      })
      
      showNotification("Account created! Ask your parent to add you to the family.", "success")
      closeLoginModal()
      pendingGoogleUser = null
      // Delay navigation to ensure modal cleanup and DOM settlement
      setTimeout(() => {
        navigateTo("child-dashboard.html")
      }, 800)
    }
  } catch (error) {
    console.error("[TaskQuest] Google signup completion error:", error)
    showNotification("Signup failed: " + error.message, "error")
    // Reset pending user on error
    pendingGoogleUser = null
  }
}

function shouldUseAppleRedirect() {
  const ua = navigator.userAgent || ''
  const isIOS = /iP(hone|ad|od)/i.test(ua)
  const isMacSafari = /Macintosh/i.test(ua) && /Safari/i.test(ua) && !/Chrome|CriOS|FxiOS|OPiOS|EdgiOS/i.test(ua)
  const isStandalone = typeof navigator !== 'undefined' && navigator.standalone === true
  const isFirefoxIOS = /FxiOS/i.test(ua)
  const isEdgeIOS = /EdgiOS/i.test(ua)
  const isWebKitView = !!(window.webkit && window.webkit.messageHandlers)
  return isIOS || isMacSafari || isStandalone || isFirefoxIOS || isEdgeIOS || isWebKitView
}

function isApplePopupRecoverable(error) {
  const code = error?.code
  return code === 'auth/popup-blocked' || code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request' || code === 'auth/operation-not-supported-in-this-environment'
}

// Apple Sign-In Function
async function signInWithApple() {
  try {
    console.log('[TaskQuest] signInWithApple() called')
    console.log('[TaskQuest] firebase object:', typeof firebase)
    console.log('[TaskQuest] firebase.auth:', typeof firebase?.auth)
    console.log('[TaskQuest] auth variable:', typeof auth, auth ? 'INITIALIZED' : 'NULL')
    console.log('[TaskQuest] OAuthProvider:', typeof firebase?.auth?.OAuthProvider)
    
    if (!firebase) {
      console.error('[TaskQuest] Firebase SDK not loaded!')
      showNotification('Firebase SDK not loaded. Please refresh the page.', 'error')
      return
    }
    
    if (!auth) {
      console.error('[TaskQuest] Auth is not initialized!')
      showNotification('Firebase not initialized. Please refresh the page.', 'error')
      return
    }
    
    if (!firebase.auth.OAuthProvider) {
      console.error('[TaskQuest] OAuthProvider not available!')
      showNotification('Apple Sign-In not available in your Firebase SDK version.', 'error')
      return
    }
    
    console.log('[TaskQuest] All checks passed, creating Apple OAuth provider...')
    const appleProvider = new firebase.auth.OAuthProvider('apple.com')
    appleProvider.addScope('email')
    appleProvider.addScope('name')
    console.log('[TaskQuest] Apple provider created successfully')
    
    const mustRedirect = shouldUseAppleRedirect()
    if (mustRedirect) {
      console.log('[TaskQuest] Environment prefers redirect for Apple. Initiating redirect flow...')
      await auth.signInWithRedirect(appleProvider)
      return
    }

    // Try popup first where supported. If it fails for recoverable reasons, fall back to redirect.
    try {
      console.log('[TaskQuest] Attempting Apple popup sign-in...')
      const result = await auth.signInWithPopup(appleProvider)
      console.log('[TaskQuest] Apple popup sign-in successful, user:', result.user?.email)
      await processAppleSignInResult(result)
      return
    } catch (popupErr) {
      console.error('[TaskQuest] Apple popup sign-in caught error:', popupErr?.code, popupErr?.message)
      console.error('[TaskQuest] Full popup error:', popupErr)
      if (isApplePopupRecoverable(popupErr)) {
        console.log('[TaskQuest] Popup issue is recoverable, attempting redirect fallback...')
        showNotification('Having trouble with the sign-in popup. Switching to a full-page sign-in instead.', 'warning')
      } else {
        if (popupErr.code === 'auth/account-exists-with-different-credential') {
          showNotification('This email is already used with another sign-in provider. Please sign in with the original provider (e.g., Google) first, then link Apple.', 'error')
          return
        }
        if (popupErr.code === 'auth/unauthorized-domain') {
          showNotification('Apple Sign-In blocked: unauthorized domain. Add your domain in Firebase Console (Auth → Authorized domains).', 'error')
          return
        }
        if (popupErr.code === 'auth/invalid-oauth-provider') {
          showNotification('Apple Sign-In not enabled in Firebase. Go to Firebase Console → Authentication → Sign-in method → Enable Apple.', 'error')
          return
        }
        showNotification('Apple Sign-In failed: ' + (popupErr?.message || 'Unknown error'), 'error')
        return
      }
    }

    try {
      console.log('[TaskQuest] Attempting Apple redirect sign-in...')
      await auth.signInWithRedirect(appleProvider)
      console.log('[TaskQuest] Apple redirect initiated')
    } catch (redirectErr) {
      console.error('[TaskQuest] Apple redirect sign-in failed:', redirectErr?.code, redirectErr?.message)
      console.error('[TaskQuest] Full redirect error:', redirectErr)
      if (redirectErr.code === 'auth/unauthorized-domain') {
        showNotification('Apple Sign-In blocked: unauthorized domain. Add your domain in Firebase Console (Auth → Authorized domains).', 'error')
      } else if (redirectErr.code === 'auth/account-exists-with-different-credential') {
        showNotification('This email is already used with another sign-in provider. Please sign in with the original provider (e.g., Google) first, then link Apple.', 'error')
      } else if (redirectErr.code === 'auth/operation-not-supported-in-this-environment') {
        showNotification('Apple Sign-In not configured for this browser. Try using Safari on iOS or enable Apple in Firebase Console.', 'error')
      } else if (redirectErr.code === 'auth/invalid-oauth-provider') {
        showNotification('Apple Sign-In not enabled in Firebase. Go to Firebase Console → Authentication → Sign-in method → Enable Apple.', 'error')
      } else {
        showNotification('Apple Sign-In failed: ' + (redirectErr?.message || 'Unknown error'), 'error')
      }
    }
  } catch (error) {
    console.error("[TaskQuest] Apple Sign-In outer error:", error)
    console.error("[TaskQuest] Full outer error details:", error)
    showNotification('Apple Sign-In failed: ' + (error?.message || String(error)), 'error')
  }
}
// Ensure global accessibility
window.signInWithApple = signInWithApple

// Centralized processing for an Apple sign-in result (popup or redirect)
async function processAppleSignInResult(result) {
  if (!result || !result.user) {
    console.warn('[TaskQuest] processAppleSignInResult: no user in result')
    return
  }
  const user = result.user
  console.log('[TaskQuest] processAppleSignInResult: user =', user.uid, user.email)
  
  try {
    if (!db) {
      console.error('[TaskQuest] Firestore not initialized!')
      showNotification('Database not initialized. Please refresh the page.', 'error')
      return
    }
    
    console.log('[TaskQuest] Fetching user doc from Firestore...')
    const userDoc = await db.collection('users').doc(user.uid).get()
    console.log('[TaskQuest] User doc exists:', userDoc.exists)
    
    if (userDoc.exists) {
      const userData = userDoc.data()
      console.log('[TaskQuest] User data:', userData?.role)
      
      if (userData.role === 'parent') {
        console.log('[TaskQuest] Showing parent PIN verification')
        showNotification('Welcome back, Parent!', 'success')
        try {
          const modal = document.getElementById('loginModal')
          if (modal) modal.style.display = 'none'
        } catch (e) {}
        setTimeout(() => {
          console.log('[TaskQuest] Calling navigateTo parent-dashboard.html')
          navigateTo('parent-dashboard.html')
          isProcessingRedirect = false
        }, 800)
      } else if (userData.role === 'child') {
        console.log('[TaskQuest] Child user, loading dashboard')
        showNotification('Welcome back!', 'success')
        try {
          const modal = document.getElementById('loginModal')
          if (modal) modal.style.display = 'none'
        } catch (e) {}
        setTimeout(() => {
          console.log('[TaskQuest] Calling navigateTo child-dashboard.html')
          navigateTo('child-dashboard.html')
          isProcessingRedirect = false
        }, 800)
      }
    } else {
      // New user - need to determine role and complete profile
      console.log('[TaskQuest] New Apple user, showing role selection')
      showAppleRoleSelection(user)
    }
  } catch (err) {
    console.error('[TaskQuest] Failed processing Apple sign-in result:', err)
    const errMsg = err?.message || String(err)
    if (errMsg.includes('Missing or insufficient permissions')) {
      showNotification('Permission denied reading user profile. Check Firestore rules.', 'error')
    } else {
      showNotification('Sign-in succeeded but processing failed: ' + errMsg, 'error')
    }
  }
}

// Store current Apple user for role selection
let pendingAppleUser = null

function showAppleRoleSelection(appleUser) {
  // Store the user in a variable to avoid HTML escaping issues
  pendingAppleUser = appleUser
  
  const modal = document.getElementById("loginModal")
  if (!modal) return
  const modalContent = modal.querySelector(".modal-content")
  if (!modalContent) return
  
  // Clear and rebuild modal safely
  modalContent.innerHTML = `
    <span class="close" onclick="closeLoginModal()">&times;</span>
    <h2>Welcome to TaskQuest!</h2>
    <p style="color: var(--text-secondary); margin: 20px 0;">Are you a Parent or a Child?</p>
    <div style="display: flex; gap: 16px; flex-direction: column;">
      <button type="button" onclick="completeAppleSignup('parent')" style="padding: 14px; background: var(--primary); color: white; border: none; border-radius: var(--radius); font-weight: 600; cursor: pointer;">
        I'm a Parent
      </button>
      <button type="button" onclick="completeAppleSignup('child')" style="padding: 14px; background: var(--secondary); color: white; border: none; border-radius: var(--radius); font-weight: 600; cursor: pointer;">
        I'm a Child
      </button>
    </div>
  `
  modal.style.display = "block"
}

async function completeAppleSignup(role) {
  try {
    if (!pendingAppleUser) {
      showNotification('User session lost. Please try signing in again.', 'error')
      return
    }
    
    const user = pendingAppleUser
    const uid = user.uid
    const displayName = user.displayName || user.email?.split('@')[0] || 'User'
    
    if (role === 'parent') {
      const passcode = prompt('Set a PIN for parent account (4-6 digits):', '')
      if (!passcode || passcode.length < 4 || passcode.length > 6 || isNaN(passcode)) {
        showNotification('PIN must be 4-6 digits', 'error')
        return
      }

      const familyCode = generateFamilyCode()
      
      await db.collection("users").doc(uid).set({
        name: displayName,
        email: user.email,
        role: "parent",
        passcode: passcode,
        familyCode: familyCode,
        authProvider: "apple",
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      })
      
      showNotification(`Welcome! Your Family Code is: ${familyCode} - Share this with your children!`, "success")
      closeLoginModal()
      pendingAppleUser = null
      isProcessingRedirect = false
      setTimeout(() => {
        showParentPinVerification()
      }, 800)
    } else {
      // Child role
      await db.collection("users").doc(uid).set({
        name: displayName,
        email: user.email,
        role: "child",
        points: 0,
        authProvider: "apple",
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      })
      
      showNotification("Welcome, " + displayName + "!", "success")
      closeLoginModal()
      pendingAppleUser = null
      isProcessingRedirect = false
      setTimeout(() => {
        navigateTo("child-dashboard.html")
      }, 800)
    }
  } catch (error) {
    console.error("[TaskQuest] Apple signup completion error:", error)
    showNotification("Signup failed: " + error.message, "error")
    // Reset pending user on error
    pendingAppleUser = null
  }
}

function closeLoginModal() {
  document.getElementById("loginModal").style.display = "none"
  document.getElementById("loginForm").reset()
  currentAuthMode = "login"
}

function openCreateTaskModal() {
  document.getElementById("createTaskModal").style.display = "block"
}

function closeCreateTaskModal() {
  const modal = document.getElementById("createTaskModal")
  modal.style.display = "none"
  document.getElementById("createTaskForm").reset()
}

function openAddRewardModal() {
  document.getElementById("addRewardModal").style.display = "block"
}

function closeAddRewardModal() {
  const modal = document.getElementById("addRewardModal")
  modal.style.display = "none"
  document.getElementById("addRewardForm").reset()
}

async function startTask(taskId, taskTitle) {
  try {
    const user = auth.currentUser
    if (!user) {
      showNotification("Please login first", "error")
      return
    }

    // If an in-progress submission already exists for this user+task, reuse it to avoid duplicates
    try {
      const existing = await db.collection('submissions')
        .where('userId', '==', user.uid)
        .where('taskId', '==', taskId)
        .where('status', '==', 'in-progress')
        .limit(1)
        .get()
      if (!existing.empty) {
        const doc = existing.docs[0]
        currentTaskInfo = {
          id: taskId,
          title: taskTitle,
          inProgressSubmissionId: doc.id,
          inProgressFamilyCode: doc.data().familyCode || null,
        }
        showNotification(`Resuming task: ${taskTitle}`, 'info')
        // Open the finish modal to continue
        finishTask(taskId, taskTitle)
        return
      }
    } catch (e) {
      console.warn('[TaskQuest] Could not check existing in-progress submission:', e)
    }

    // Create an in-progress submission right away
    const familyCode = await getFamilyCodeForUser(user)
    if (!familyCode) {
      showNotification("Unable to determine family code. Ask your parent to set up the family.", "error")
      return
    }

    // Create a document with status "in-progress"
    const submission = await db.collection("submissions").add({
      userId: user.uid,
      taskId: taskId,
      taskTitle: taskTitle,
      beforePhoto: null,
      afterPhoto: null,
      beforeDataUrl: null,
      afterDataUrl: null,
      status: "in-progress",
      familyCode: familyCode,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    })

    // Store the submission info so we can update it later
    currentTaskInfo = {
      id: taskId,
      title: taskTitle,
      inProgressSubmissionId: submission.id,
      inProgressFamilyCode: familyCode,
    }

    showNotification(`Started task: ${taskTitle}`, "success")

    // Refresh the task list to show "Finish Task" button
    setTimeout(() => {
      loadAvailableTasks()
    }, 500)
  } catch (error) {
    console.error("[TaskQuest] Start task error:", error)
    showNotification("Failed to start task: " + error.message, "error")
  }
}

function finishTask(taskId, taskTitle) {
  // This function is called when the user clicks "Finish Task"
  // The submission ID was stored in currentTaskInfo when startTask was called
  // Ensure currentTaskInfo still has the task ID for submitTaskForReview
  
  currentTaskInfo.id = taskId
  currentTaskInfo.title = taskTitle
  
  const modal = document.getElementById("uploadModal")
  const titleElement = document.getElementById("uploadTaskTitle")

  if (titleElement) {
    titleElement.textContent = `Complete Task: ${taskTitle}`
  }

  if (modal) {
    modal.style.display = "block"
  }
}

function closeUploadModal() {
  const modal = document.getElementById("uploadModal")
  if (modal) {
    modal.style.display = "none"
    // Reset form inputs
    const beforeInput = document.getElementById("beforePhoto")
    const afterInput = document.getElementById("afterPhoto")
    if (beforeInput) beforeInput.value = ""
    if (afterInput) afterInput.value = ""
    
    // Clear preview images
    const beforePreview = document.getElementById("beforePreview")
    const afterPreview = document.getElementById("afterPreview")
    if (beforePreview) {
      beforePreview.innerHTML = ""
      beforePreview.style.display = "none"
    }
    if (afterPreview) {
      afterPreview.innerHTML = ""
      afterPreview.style.display = "none"
    }
    
    // Reset upload labels
    const beforeLabel = document.querySelector("#beforeUploadBox .upload-label")
    const afterLabel = document.querySelector("#afterUploadBox .upload-label")
    if (beforeLabel) beforeLabel.style.display = "flex"
    if (afterLabel) afterLabel.style.display = "flex"
    
    // Clear uploaded photos and task info
    uploadedPhotos = { before: null, after: null }
    currentTaskInfo = { id: null, title: null, inProgressSubmissionId: null, inProgressFamilyCode: null }
    
    console.log('[TaskQuest] Upload modal closed and state reset')
  }
}

function openUploadModal() {
  const modal = document.getElementById("uploadModal")
  if (modal) modal.style.display = "block"
}

// ==========================================
// NOTIFICATIONS
// ==========================================

function showNotification(message, type = "success") {
  const notification = document.getElementById("notification")
  if (notification) {
    notification.textContent = message
    notification.className = `notification ${type} show`

    setTimeout(() => {
      notification.classList.remove("show")
    }, 3000)
  }
}

// ==========================================
// UTILITY: CLOSE MODALS ON OUTSIDE CLICK
// ==========================================

window.onclick = (event) => {
  const modals = document.querySelectorAll(".modal")
  modals.forEach((modal) => {
    if (event.target === modal) modal.style.display = "none"
  })
}

// ==========================================
// DASHBOARD NAVIGATION & INITIALIZATION
// ==========================================

let parentTasksUnsubscribe = null

// Set up a realtime listener for parent task templates so parent view stays in sync
async function setupParentTasksListener() {
  try {
    const user = auth.currentUser
    if (!user || !db) return
    const familyCode = await getFamilyCodeForUser(user)
    if (!familyCode) return

    if (parentTasksUnsubscribe) {
      try { parentTasksUnsubscribe(); } catch(e){}
      parentTasksUnsubscribe = null
    }

    parentTasksUnsubscribe = db.collection('taskTemplates')
      .where('familyCode', '==', familyCode)
      .onSnapshot(() => {
        loadParentTasks().catch(() => {})
      }, (err) => {
        console.warn('[TaskQuest] parent tasks listener error:', err)
      })
  } catch (error) {
    console.error('[TaskQuest] setupParentTasksListener error:', error)
  }
}

document.addEventListener("DOMContentLoaded", () => {
  console.log("[TaskQuest] DOM loaded, initializing page...")

  // No demo seeding — app runs against Firebase only.

  // Check if user is authenticated
  let __authInitialized = false
  auth.onAuthStateChanged((user) => {
    if (user) {
      // Attach invite outcome listener globally so requester self-applies familyCode regardless of page
      try {
        if (window.parentInviteOutcomeUnsub) { try { window.parentInviteOutcomeUnsub() } catch(e){}; window.parentInviteOutcomeUnsub = null }
        window.parentInviteOutcomeUnsub = setupParentInviteOutcomeListener()
      } catch (e) {
        console.warn('[TaskQuest] Failed to attach parentInvite outcome listener (global):', e)
      }
      const currentPage = window.location.pathname.split("/").pop()
      if (currentPage === "child-dashboard.html") {
        // Load child page and attach real-time listeners
        setupChildPointsListener()
        loadAvailableTasks()
        loadRewards()
        loadChildProfile()
        initializeSectionVisibility()

        // Attach listeners for tasks, rewards and submissions so child sees updates live
        try {
          if (window.tasksUnsubscribe) { try { window.tasksUnsubscribe() } catch(e){}; window.tasksUnsubscribe = null }
          if (window.rewardsUnsubscribe) { try { window.rewardsUnsubscribe() } catch(e){}; window.rewardsUnsubscribe = null }
          if (window.submissionsUnsubscribe) { try { window.submissionsUnsubscribe() } catch(e){}; window.submissionsUnsubscribe = null }
          window.tasksUnsubscribe = setupTasksListener()
          window.rewardsUnsubscribe = setupRewardsListener()
          window.submissionsUnsubscribe = setupSubmissionsListener()
        } catch (e) {
          console.warn('[TaskQuest] Failed to attach child realtime listeners:', e)
        }

      } else if (currentPage === "parent-dashboard.html") {
        loadPendingApprovals()
        loadOngoingTasks()
        loadChildren()
        loadParentTasks()
        loadParentRewards()
        // Keep parent tasks view in sync in real-time
        setupParentTasksListener()
        // Keep ongoing tasks in sync (auto-refresh when status changes)
        setupOngoingTasksListener()
        initializeSectionVisibility()
        displayFamilyCode()
        try {
          // Attach family requests listener for real-time updates
          if (window.familyRequestsUnsubscribe) {
            try { window.familyRequestsUnsubscribe() } catch(e){}
            window.familyRequestsUnsubscribe = null
          }
          window.familyRequestsUnsubscribe = setupFamilyRequestsListener()
        } catch (e) {
          console.warn('[TaskQuest] Failed to attach familyRequests listener on load:', e)
        }
        try {
          // Attach children listener for real-time updates when child updates their user doc
          if (window.childrenUnsubscribe) {
            try { window.childrenUnsubscribe() } catch(e){}
            window.childrenUnsubscribe = null
          }
          window.childrenUnsubscribe = setupChildrenListener()
        } catch (e) {
          console.warn('[TaskQuest] Failed to attach children listener on load:', e)
        }
        try {
          if (window.parentInviteOutcomeUnsub) { try { window.parentInviteOutcomeUnsub() } catch(e){}; window.parentInviteOutcomeUnsub = null }
          window.parentInviteOutcomeUnsub = setupParentInviteOutcomeListener()
        } catch (e) {
          console.warn('[TaskQuest] Failed to attach parentInvite outcome listener:', e)
        }
        try {
          // Attach parents listener so Family section updates instantly
          if (window.parentsUnsubscribe) { try { window.parentsUnsubscribe() } catch(e){}; window.parentsUnsubscribe = null }
          window.parentsUnsubscribe = setupParentsListener()
        } catch (e) {
          console.warn('[TaskQuest] Failed to attach parents listener on load:', e)
        }
      }
    } else {
      // User not logged in, redirect to index if not already there
      const currentPage = window.location.pathname.split("/").pop()
      if (currentPage !== "index.html" && currentPage !== "") {
        navigateTo("index.html")
      }
    }
    __authInitialized = true
  })
})

function initializeSectionVisibility() {
  const path = window.location.pathname

  if (path.includes("child-dashboard")) {
    // Child dashboard: show tasks section by default
    hideAllSections()
    const pointsHero = document.querySelector(".points-hero")
    const tasksSection = document.getElementById("tasks-section")
    if (pointsHero) pointsHero.style.display = "block"
    if (tasksSection) tasksSection.style.display = "block"
  } else if (path.includes("parent-dashboard")) {
    // Parent dashboard: show approvals section by default
    hideAllSections()
    const approvalsSection = document.getElementById("approvals-section")
    if (approvalsSection) approvalsSection.style.display = "block"
  }
}

function hideAllSections() {
  const sections = document.querySelectorAll(".child-section, .points-hero, .dashboard-section")
  sections.forEach((section) => {
    section.style.display = "none"
  })
}

function navigateToSection(target) {
  hideAllSections()

  const navLinks = document.querySelectorAll(".nav-link")
  navLinks.forEach((link) => {
    link.classList.remove("active")
    if (link.getAttribute("href") === `#${target}`) {
      link.classList.add("active")
    }
  })

  switch (target) {
    case "tasks":
      const pointsHero = document.querySelector(".points-hero")
      const tasksSection = document.getElementById("tasks-section")
      if (pointsHero) pointsHero.style.display = "block"
      if (tasksSection) tasksSection.style.display = "block"
      break
    case "rewards":
      const rewardsSection = document.getElementById("rewards-section")
      if (rewardsSection) rewardsSection.style.display = "block"
      break
    case "profile":
      const profileSection = document.getElementById("profile-section")
      if (profileSection) profileSection.style.display = "block"
      // Load either child or parent profile depending on page
      if (typeof loadParentProfile === 'function' && window.location.pathname.includes('parent-dashboard')) {
        loadParentProfile()
      } else {
        if (typeof loadChildProfile === 'function') loadChildProfile()
      }
      break
    case "coparents":
      const coparentsSection = document.getElementById("coparents-section")
      if (coparentsSection) coparentsSection.style.display = "block"
      if (typeof loadCoparents === 'function') loadCoparents()
      break
    case "approvals":
      const approvalsSection = document.getElementById("approvals-section")
      if (approvalsSection) approvalsSection.style.display = "block"
      loadPendingApprovals()
      loadOngoingTasks()
      // Ensure the familyRequests listener is active when viewing approvals
      try {
        if (window.familyRequestsUnsubscribe) {
          try { window.familyRequestsUnsubscribe() } catch(e){}
          window.familyRequestsUnsubscribe = null
        }
        window.familyRequestsUnsubscribe = setupFamilyRequestsListener()
      } catch (e) {
        console.warn('[TaskQuest] Failed to attach familyRequests listener on approvals:', e)
      }
      break
    case "manage":
      const manageSection = document.getElementById("manage-section")
      if (manageSection) manageSection.style.display = "block"
      loadParentTasks()
      loadParentRewards()
      loadChildren()
      break
    case "settings":
      const settingsSection = document.getElementById("settings-section")
      if (settingsSection) settingsSection.style.display = "block"
      displayFamilyCode()
      break
    default:
      const section = document.getElementById(`${target}-section`)
      if (section) section.style.display = "block"
  }
}

async function showParentPinVerification() {
  const passcode = await showInputModal('Enter your 6-digit parent PASSCODE to access the dashboard:', '6-digit passcode')

  if (!passcode) {
    await auth.signOut()
    showNotification("Access denied", "error")
    return
  }

  try {
    const user = auth.currentUser
    const userDoc = await db.collection("users").doc(user.uid).get()
    const storedPasscode = userDoc.data().passcode

    if (passcode === storedPasscode) {
      showNotification("Welcome back, Parent!", "success")
      navigateTo("parent-dashboard.html")
    } else {
      await auth.signOut()
      showNotification("Incorrect passcode. Access denied.", "error")
    }
  } catch (error) {
    console.error("[TaskQuest] Passcode verification error:", error)
    await auth.signOut()
    showNotification("Verification failed", "error")
  }
}

// Set up a realtime listener for the child's points so the UI updates automatically
function setupChildPointsListener() {
  try {
    const user = auth.currentUser
    if (!user || !db) return

    // Clean up any existing listener
    if (childPointsUnsubscribe) {
      try { childPointsUnsubscribe(); } catch (e) {}
      childPointsUnsubscribe = null
    }

    childPointsUnsubscribe = db.collection('users').doc(user.uid).onSnapshot((snap) => {
      if (!snap.exists) return
      const data = snap.data()
      const points = data.points || 0
      // Update the current points display
      const pointsValue = document.querySelector('.points-value')
      if (pointsValue) pointsValue.textContent = points
      // Also update total points display if it exists
      const totalPoints = document.getElementById('totalPoints')
      if (totalPoints) totalPoints.textContent = points
    }, (err) => {
      console.error('[TaskQuest] Child points listener error:', err)
    })
  } catch (error) {
    console.error('[TaskQuest] setupChildPointsListener error:', error)
  }
}

async function loadAvailableTasks() {
  try {
    const tasksGrid = document.querySelector(".child-tasks-grid")
    if (!tasksGrid) return

    const user = auth.currentUser
    const familyCode = await getFamilyCodeForUser(user)
    if (!familyCode) {
      if (tasksGrid) tasksGrid.innerHTML = "<p>No tasks available yet. Ask your parent to create tasks!</p>"
      return
    }

    // Get in-progress submissions for this user
    const inProgressSnapshot = await db.collection("submissions")
      .where("userId", "==", user.uid)
      .where("status", "==", "in-progress")
      .get()

    const inProgressTaskIds = new Set()
    inProgressSnapshot.forEach((doc) => {
      inProgressTaskIds.add(doc.data().taskId)
    })

    // Get all in-progress submissions for the family (to check if other children are working on tasks)
    const allInProgressSnapshot = await db.collection("submissions")
      .where("familyCode", "==", familyCode)
      .where("status", "==", "in-progress")
      .get()

    const inProgressByOthers = {}
    for (const doc of allInProgressSnapshot.docs) {
      const data = doc.data()
      if (data.userId !== user.uid) {
        // Get child name
        let childName = "Unknown"
        try {
          const childDoc = await db.collection("users").doc(data.userId).get()
          childName = childDoc.exists ? childDoc.data().name : "Unknown"
        } catch (e) {
          console.warn('[TaskQuest] Failed to load child name for in-progress task:', e)
        }
        inProgressByOthers[data.taskId] = childName
      }
    }

    // Get approved submissions for this user to hide completed tasks
    const approvedSnapshot = await db.collection("submissions")
      .where("userId", "==", user.uid)
      .where("status", "==", "approved")
      .get()

    // Also get pending submissions (submitted but awaiting parent) so child cannot resubmit
    const pendingSnapshot = await db.collection("submissions")
      .where("userId", "==", user.uid)
      .where("status", "==", "pending")
      .get()

    const approvedTaskIds = new Set()
    approvedSnapshot.forEach((doc) => {
      approvedTaskIds.add(doc.data().taskId)
    })

    const pendingTaskIds = new Set()
    pendingSnapshot.forEach((doc) => {
      pendingTaskIds.add(doc.data().taskId)
    })

    // Get declined submissions for this user (so we can reset button to Start)
    const declinedSnapshot = await db.collection("submissions")
      .where("userId", "==", user.uid)
      .where("status", "==", "declined")
      .get()

    const declinedTaskIds = new Set()
    declinedSnapshot.forEach((doc) => {
      declinedTaskIds.add(doc.data().taskId)
    })

    const tasksSnapshot = await db.collection("taskTemplates").where("familyCode", "==", familyCode).get()

    // Cache-based short-circuit to avoid flicker when nothing changed
    try { window.__cache = window.__cache || {} } catch(e) {}
    const tasksKey = [
      'tasks:', ...tasksSnapshot.docs.map(d => d.id).sort(),
      '|inprog:', ...Array.from(inProgressTaskIds).sort(),
      '|approved:', ...Array.from(approvedTaskIds).sort(),
      '|pending:', ...Array.from(pendingTaskIds).sort(),
      '|declined:', ...Array.from(declinedTaskIds).sort()
    ].join('')

    if (tasksSnapshot.empty) {
      // Only rewrite if changed
      if (window.__cache.childTasksKey !== tasksKey) {
        tasksGrid.innerHTML = "<p>No tasks available yet. Ask your parent to create tasks!</p>"
      }
      window.__cache.childTasksKey = tasksKey
      return
    }

    if (window.__cache.childTasksKey && window.__cache.childTasksKey === tasksKey) {
      return
    }
    window.__cache.childTasksKey = tasksKey

    tasksGrid.innerHTML = ""

    tasksSnapshot.forEach((doc) => {
      const task = doc.data()
      const taskId = doc.id
      const isInProgress = inProgressTaskIds.has(taskId)
      const isApproved = approvedTaskIds.has(taskId)
      const isDeclined = declinedTaskIds.has(taskId)
      const inProgressByOther = inProgressByOthers[taskId]

      // Skip tasks that this child has already completed and approved or already submitted (pending)
      if (isApproved || pendingTaskIds.has(taskId)) return

      const taskCard = document.createElement("div")
      taskCard.className = `child-task-card ${isInProgress ? 'in-progress' : ''}`

      let buttonHtml = ''
      if (inProgressByOther) {
        buttonHtml = `<span class="in-progress-status">⏳ In progress by ${inProgressByOther}</span>`
      } else if (isInProgress && !isDeclined) {
        buttonHtml = `<button class="finish-task-btn" onclick="finishTask('${taskId}', '${task.title.replace(/'/g, "\\'")}')">⏳ Finish Task</button>`
      } else {
        buttonHtml = `<button class="start-task-btn" onclick="startTask('${taskId}', '${task.title.replace(/'/g, "\\'")}')">Start Task</button>`
      }

      taskCard.innerHTML = `
        <div class="task-icon-large">${task.icon || "📋"}</div>
        <h3>${task.title}</h3>
        <p>${task.description}</p>
        <div class="task-footer">
          <span class="task-points">+${task.points} pts</span>
          ${buttonHtml}
        </div>
      `
      tasksGrid.appendChild(taskCard)
    })
    // If after filtering there are no visible tasks, show the empty message
    if (!tasksGrid.hasChildNodes()) {
      tasksGrid.innerHTML = "<p>No tasks available yet. Ask your parent to create tasks!</p>"
    }
  } catch (error) {
    await handleFirestoreError(error, document.querySelector(".child-tasks-grid"))
  }
}

async function loadRewards() {
  try {
    const rewardsGrid = document.querySelector(".rewards-store-grid")
    if (!rewardsGrid) return

    const user = auth.currentUser
    const familyCode = await getFamilyCodeForUser(user)
    if (!familyCode) {
      const rewardsGrid = document.querySelector(".rewards-store-grid")
      if (rewardsGrid) rewardsGrid.innerHTML = "<p>No rewards available yet. Ask your parent to add rewards!</p>"
      return
    }

    const rewardsSnapshot = await db.collection("rewards").where("familyCode", "==", familyCode).get()

    // Cache-based early exit to avoid flicker
    try { window.__cache = window.__cache || {} } catch(e) {}
    const rewardsKey = ['rewards:', ...rewardsSnapshot.docs.map(d => d.id).sort(), '|points:', String(currentPoints)].join('')
    if (rewardsSnapshot.empty) {
      if (window.__cache.rewardsKey !== rewardsKey) {
        rewardsGrid.innerHTML = "<p>No rewards available yet. Ask your parent to add rewards!</p>"
      }
      window.__cache.rewardsKey = rewardsKey
      return
    }

    if (window.__cache.rewardsKey && window.__cache.rewardsKey === rewardsKey) {
      return
    }
    window.__cache.rewardsKey = rewardsKey

    const userDoc = await db.collection("users").doc(user.uid).get()
    const currentPoints = (userDoc.exists && userDoc.data().points) || 0

    rewardsGrid.innerHTML = ""

    rewardsSnapshot.forEach((doc) => {
      const reward = doc.data()
      const isLocked = currentPoints < reward.cost
      const rewardCard = document.createElement("div")
      rewardCard.className = `reward-store-card ${isLocked ? "locked" : ""}`
      rewardCard.innerHTML = `
        <div class="reward-image">${reward.icon || "🎁"}</div>
        <h3>${reward.name}</h3>
        <div class="reward-store-footer">
          <span class="reward-price">${reward.cost} pts</span>
          <button class="redeem-btn" ${isLocked ? "disabled" : ""} onclick="redeemReward('${doc.id}')">
            ${isLocked ? "🔒 Locked" : "Redeem"}
          </button>
        </div>
      `
      rewardsGrid.appendChild(rewardCard)
    })
  } catch (error) {
    console.error("[TaskQuest] Load rewards error:", error)
    const rewardsGrid = document.querySelector(".rewards-store-grid")
    if (rewardsGrid) {
      rewardsGrid.innerHTML = "<p>Error loading rewards. Please refresh the page.</p>"
    }
  }
}

async function loadPendingApprovals() {
  try {
    const grid = document.getElementById("pendingTasksGrid")
    if (!grid) return

    const user = auth.currentUser
    const familyCode = await getFamilyCodeForUser(user)
    if (!familyCode) {
      const grid = document.getElementById("pendingTasksGrid")
      if (grid) grid.innerHTML = "<p>No pending tasks to review. Great job keeping up with approvals! ✅</p>"
      return
    }

    const submissionsSnapshot = await db
      .collection("submissions")
      .where("familyCode", "==", familyCode)
      .where("status", "==", "pending")
      .orderBy("submittedAt", "desc")
      .get()

    // Cache-based early exit
    try { window.__cache = window.__cache || {} } catch(e) {}
    const pendingKey = submissionsSnapshot.docs.map(d => {
      const s = d.data();
      const t = s.submittedAt && s.submittedAt.seconds ? s.submittedAt.seconds : 0
      return `${d.id}:${t}`
    }).join('|') || 'empty'

    if (submissionsSnapshot.empty) {
      if (window.__cache.pendingApprovalsKey !== pendingKey) {
        grid.innerHTML = "<p>No pending tasks to review. Great job keeping up with approvals! ✅</p>"
      }
      window.__cache.pendingApprovalsKey = pendingKey
      return
    }

    if (window.__cache.pendingApprovalsKey && window.__cache.pendingApprovalsKey === pendingKey) {
      return
    }
    window.__cache.pendingApprovalsKey = pendingKey

    grid.innerHTML = ""

    for (const doc of submissionsSnapshot.docs) {
      const submission = doc.data()

      // Defensive check: ensure userId and taskId exist before querying
      if (!submission.userId) {
        console.warn('[TaskQuest] Skipping submission (missing userId):', doc.id)
        continue
      }
      if (!submission.taskId) {
        console.warn('[TaskQuest] Skipping submission (missing taskId):', doc.id)
        continue
      }

      // Get child name
      let childName = "Unknown"
      try {
        const childDoc = await db.collection("users").doc(submission.userId).get()
        childName = childDoc.exists ? childDoc.data().name : "Unknown"
      } catch (e) {
        console.warn('[TaskQuest] Failed to load child name:', e)
      }

      // Get task details
      let task = { title: submission.taskTitle || "Unknown Task", points: 0 }
      try {
        const taskDoc = await db.collection("taskTemplates").doc(submission.taskId).get()
        if (taskDoc.exists) {
          task = taskDoc.data()
        }
      } catch (e) {
        console.warn('[TaskQuest] Failed to load task details:', e)
      }

      const timestamp = submission.submittedAt ? getTimeAgo(submission.submittedAt.toDate()) : "Just now"

      const taskCard = document.createElement("div")
      taskCard.className = "task-verification-card"
      taskCard.innerHTML = `
        <div class="task-header">
          <h3>${task.title}</h3>
          <span class="points-badge">+${task.points} pts</span>
        </div>
        <div class="child-info">
          <span class="child-name">👤 ${childName}</span>
          <span class="submission-time">${timestamp}</span>
        </div>
        <div class="photo-comparison">
          <div class="photo-box">
                <label>Before</label>
                <img src="${submission.beforePhoto || submission.beforeDataUrl || '/before-task.jpg'}" alt="Before" onerror="this.src='/before-task.jpg'">
          </div>
          <div class="photo-box">
                <label>After</label>
                <img src="${submission.afterPhoto || submission.afterDataUrl || '/after-task.jpg'}" alt="After" onerror="this.src='/after-task.jpg'">
          </div>
        </div>
        <div class="action-buttons">
          <button class="approve-btn" onclick="approveTask('${doc.id}', this)">
            ✓ Approve
          </button>
          <button class="decline-btn" onclick="declineTask('${doc.id}', this)">
            ✗ Decline
          </button>
        </div>
      `
      grid.appendChild(taskCard)
    }
  } catch (error) {
    await handleFirestoreError(error, document.getElementById("pendingTasksGrid"))
  }
}

let ongoingTasksUnsubscribe = null

async function loadOngoingTasks() {
  try {
    const grid = document.getElementById("ongoingTasksGrid")
    if (!grid) return

    const user = auth.currentUser
    const familyCode = await getFamilyCodeForUser(user)
    if (!familyCode) {
      if (grid) grid.innerHTML = "<p>No on-going tasks at the moment.</p>"
      return
    }

    const submissionsSnapshot = await db
      .collection("submissions")
      .where("familyCode", "==", familyCode)
      .where("status", "==", "in-progress")
      .get()

    // Build cache key and avoid redundant renders
    try { window.__cache = window.__cache || {} } catch(e) {}
    const snapKeyBase = submissionsSnapshot.docs.map(d => {
      const x = d.data();
      return `${x.userId||''}:${x.taskId||''}:${x.createdAt && x.createdAt.seconds ? x.createdAt.seconds : 0}`
    }).sort().join('|')

    if (submissionsSnapshot.empty) {
      grid.innerHTML = "<p>No on-going tasks at the moment. 😴</p>"
      return
    }

    if (window.__cache.ongoingKey && window.__cache.ongoingKey === snapKeyBase) {
      return
    }
    window.__cache.ongoingKey = snapKeyBase
    grid.innerHTML = ""

    // De-duplicate by userId+taskId; keep the newest by createdAt
    const latestByKey = new Map()
    for (const doc of submissionsSnapshot.docs) {
      const submission = doc.data()
      const key = `${submission.userId || ''}:${submission.taskId || ''}`
      const existing = latestByKey.get(key)
      const createdAt = submission.createdAt?.toMillis ? submission.createdAt.toMillis() : (submission.createdAt?.seconds ? submission.createdAt.seconds * 1000 : 0)
      const prevCreatedAt = existing && existing.createdAt ? existing.createdAt : -1
      if (!existing || createdAt >= prevCreatedAt) {
        latestByKey.set(key, { doc, data: submission, createdAt })
      }
    }

    const deduped = Array.from(latestByKey.values())
    for (const entry of deduped) {
      const doc = entry.doc
      const submission = entry.data

      // Defensive check
      if (!submission.userId) continue
      if (!submission.taskId) continue
      
      // If there exists a newer submission for the same user/task where the child already submitted (pending) or it's approved,
      // then don't show this older in-progress entry — the child has effectively moved on.
      try {
        const otherSnap = await db.collection('submissions')
          .where('userId', '==', submission.userId)
          .where('taskId', '==', submission.taskId)
          .where('status', 'in', ['pending', 'approved'])
          .get()
        if (!otherSnap.empty) {
          // There is at least one pending/approved submission for this same task by this child; skip showing in-progress
          continue
        }
      } catch (e) {
        console.warn('[TaskQuest] Failed to check newer submissions for ongoing task:', e)
      }

      // Get child name
      let childName = "Unknown"
      try {
        const childDoc = await db.collection("users").doc(submission.userId).get()
        childName = childDoc.exists ? childDoc.data().name : "Unknown"
      } catch (e) {
        console.warn('[TaskQuest] Failed to load child name:', e)
      }

      // Get task details
      let task = { title: submission.taskTitle || "Unknown Task", points: 0 }
      try {
        const taskDoc = await db.collection("taskTemplates").doc(submission.taskId).get()
        if (taskDoc.exists) {
          task = taskDoc.data()
        }
      } catch (e) {
        console.warn('[TaskQuest] Failed to load task details:', e)
      }

      const timestamp = submission.createdAt ? getTimeAgo(submission.createdAt.toDate()) : "Just now"

      const taskCard = document.createElement("div")
      taskCard.className = "task-verification-card ongoing-card"
      taskCard.style.cssText = `
        padding: 16px;
        border-radius: 8px;
        background: #f9f9f9;
        border: 1px solid #e0e0e0;
        margin-bottom: 8px;
      `
      taskCard.innerHTML = `
        <div class="task-header" style="margin-bottom: 12px;">
          <h3 style="font-size: 14px; margin: 0 0 8px 0;">⏳ ${task.title}</h3>
          <span class="points-badge" style="font-size: 12px; background: #f0f0f0; padding: 4px 8px; border-radius: 4px;">+${task.points} pts</span>
        </div>
        <div class="child-info" style="margin-bottom: 10px; font-size: 12px;">
          <span class="child-name" style="display: block; margin-bottom: 4px;">👤 ${childName}</span>
          <span class="submission-time" style="color: #666; font-size: 11px;">Started ${timestamp}</span>
        </div>
        <div class="status-message" style="padding: 10px; background: #e8f4f8; border-radius: 4px; font-size: 12px; color: #333;">
          <p style="margin: 0;">Your child is working on this task. Waiting for submission...</p>
        </div>
      `
      grid.appendChild(taskCard)
    }
  } catch (error) {
    console.error('[TaskQuest] Load ongoing tasks error:', error)
    const grid = document.getElementById("ongoingTasksGrid")
    if (grid) grid.innerHTML = "<p>Error loading on-going tasks.</p>"
  }
}

// Set up real-time listener for ongoing tasks so parent sees when submissions change status
function setupOngoingTasksListener() {
  try {
    const user = auth.currentUser
    if (!user || !db) return
    getFamilyCodeForUser(user).then((familyCode) => {
      if (!familyCode) return

      if (ongoingTasksUnsubscribe) {
        try { ongoingTasksUnsubscribe(); } catch (e) {}
        ongoingTasksUnsubscribe = null
      }

      ongoingTasksUnsubscribe = db.collection('submissions')
        .where('familyCode', '==', familyCode)
        .where('status', 'in', ['in-progress', 'pending', 'approved', 'declined'])
        .onSnapshot(() => {
          loadOngoingTasks().catch(() => {})
        }, (err) => {
          console.warn('[TaskQuest] ongoing tasks listener error:', err)
        })
    })
  } catch (error) {
    console.error('[TaskQuest] setupOngoingTasksListener error:', error)
  }
}


async function loadChildren() {
  try {
    const childrenGrid = document.getElementById("childrenGrid")
    if (!childrenGrid) return

    const user = auth.currentUser
    const familyCode = await getFamilyCodeForUser(user)
    console.log('[TaskQuest] loadChildren - parent familyCode:', familyCode)
    if (!familyCode) {
      const childrenGrid = document.getElementById("childrenGrid")
      if (childrenGrid) childrenGrid.innerHTML = `
        <div class="empty-state">
          <p>No children in your family yet.</p>
          <p class="family-code-hint">Share your Family Code: <strong>------</strong> with your children to get started!</p>
        </div>
      `
      return
    }

    const childrenSnapshot = await db
      .collection("users")
      .where("familyCode", "==", familyCode)
      .where("role", "==", "child")
      .get()

    console.log('[TaskQuest] loadChildren - query returned', childrenSnapshot.docs.length, 'children')
    childrenSnapshot.docs.forEach(doc => {
      console.log('[TaskQuest] Child doc:', { id: doc.id, ...doc.data() })
    })

    // Build a lightweight key to detect changes and avoid flicker
    try { window.__cache = window.__cache || {} } catch(e) {}
    const snapshotKey = childrenSnapshot.docs.map(d => `${d.id}:${(d.data().points||0)}:${(d.data().name||'')}`).join('|')

    if (childrenSnapshot.empty) {
      childrenGrid.innerHTML = `
        <div class="empty-state">
          <p>No children in your family yet.</p>
          <p class="family-code-hint">Share your Family Code: <strong>${familyCode}</strong> with your children to get started!</p>
        </div>
      `
      return
    }

    // Avoid re-rendering identical content to reduce flash
    if (window.__cache.childrenKey && window.__cache.childrenKey === snapshotKey) {
      return
    }
    window.__cache.childrenKey = snapshotKey

    childrenGrid.innerHTML = ""

    for (const doc of childrenSnapshot.docs) {
      const child = doc.data()

      // Defensive: ensure child has required fields
      if (!doc.id) {
        console.warn('[TaskQuest] Child doc missing ID')
        continue
      }

      // Count completed tasks (with error handling)
      let completedCount = 0
      try {
        const completedSnapshot = await db
          .collection("submissions")
          .where("userId", "==", doc.id)
          .where("status", "==", "approved")
          .get()
        completedCount = completedSnapshot.size
      } catch (e) {
        console.warn('[TaskQuest] Failed to count completed tasks:', e)
        if (e.message && e.message.includes('Missing or insufficient permissions')) {
          console.error('[TaskQuest] IMPORTANT: Firestore rules not published. Go to Firebase Console and publish the rules from FIRESTORE_RULES_FINAL.txt')
          completedCount = 0
        }
      }

      // Count pending tasks (with error handling)
      let pendingCount = 0
      try {
        const pendingSnapshot = await db
          .collection("submissions")
          .where("userId", "==", doc.id)
          .where("status", "==", "pending")
          .get()
        pendingCount = pendingSnapshot.size
      } catch (e) {
        console.warn('[TaskQuest] Failed to count pending tasks:', e)
        if (e.message && e.message.includes('Missing or insufficient permissions')) {
          console.error('[TaskQuest] IMPORTANT: Firestore rules not published. Go to Firebase Console and publish the rules from FIRESTORE_RULES_FINAL.txt')
          pendingCount = 0
        }
      }

      const childCard = document.createElement("div")
      childCard.className = "child-card"
      childCard.innerHTML = `
        <div class="child-avatar">👤</div>
        <h3>${child.displayName || child.name}</h3>
        <div class="child-stats">
          <div class="stat">
            <span class="stat-label">Points</span>
            <span class="stat-value">${child.points || 0}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Completed</span>
            <span class="stat-value">${completedCount}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Pending</span>
            <span class="stat-value">${pendingCount}</span>
          </div>
        </div>
          <div class="child-actions">
            <button class="secondary-btn" onclick="resetPoints('${doc.id}')">Reset Points</button>
            <button class="primary-btn" onclick="addBonusPoints('${doc.id}')">Add Bonus</button>
            <button class="secondary-btn" onclick="unlinkChild('${doc.id}')">Unlink</button>
            <button class="secondary-btn" onclick="deactivateChild('${doc.id}')">Deactivate</button>
            <button class="secondary-btn" onclick="editChildNamePrompt('${doc.id}', '${child.name.replace(/'/g, "\\'")}')">Edit Name</button>
          </div>
      `
      childrenGrid.appendChild(childCard)
    }
  } catch (error) {
    console.error("[TaskQuest] Load children error:", error)
    const msg = (error && (error.message || String(error))) || String(error)
    if (msg.toLowerCase().includes("missing or insufficient permissions")) {
      console.warn("[TaskQuest] Permission denied when loading children. Ensure Firestore rules allow parents to read the users collection.")
      showNotification("Permission denied. Update Firestore rules to allow parents to view children.", "error")
    }
    const childrenGrid = document.getElementById("childrenGrid")
    if (childrenGrid) {
      childrenGrid.innerHTML = "<p>Error loading children. Please check Firestore rules or refresh the page.</p>"
    }
  }
}

async function addBonusPoints(childId) {
  const pointsRaw = await showInputModal('How many bonus points would you like to add?', 'e.g. 10')
  if (!pointsRaw) return
  const points = Number(pointsRaw)
  if (isNaN(points) || points <= 0) {
    showNotification('Invalid points amount', 'error')
    return
  }

  try {
    await db
      .collection("users")
      .doc(childId)
      .update({
        points: firebase.firestore.FieldValue.increment(Number(points)),
      })

    showNotification(`Added ${points} bonus points!`, "success")
    setTimeout(() => {
      loadChildren()
    }, 1000)
  } catch (error) {
    console.error("[TaskQuest] Add bonus points error:", error)
    showNotification("Failed to add bonus: " + error.message, "error")
  }
}

async function logout() {
  try {
    // Mark this specific tab/session as logged out
    sessionStorage.setItem('loggedOut', 'true')
    
    // Sign out from Firebase (this affects the user's auth state globally)
    await auth.signOut()
    showNotification("Logged out successfully", "success")
    setTimeout(() => {
      navigateTo("index.html")
    }, 1000)
  } catch (error) {
    console.error("[TaskQuest] Logout error:", error)
    showNotification("Logout failed: " + error.message, "error")
  }
}

async function loadParentRewards() {
  try {
    const rewardsGrid = document.getElementById("rewardsGrid")
    if (!rewardsGrid) return

    const user = auth.currentUser
    const familyCode = await getFamilyCodeForUser(user)
    if (!familyCode) {
      rewardsGrid.innerHTML = "<p>No rewards created yet. Click 'Add Reward' to create one.</p>"
      return
    }

    const rewardsSnapshot = await db
      .collection("rewards")
      .where("familyCode", "==", familyCode)
      .orderBy("createdAt", "desc")
      .get()

    if (rewardsSnapshot.empty) {
      rewardsGrid.innerHTML = "<p>No rewards created yet. Click 'Add Reward' to create one.</p>"
      return
    }

    rewardsGrid.innerHTML = ""

    rewardsSnapshot.forEach((doc) => {
      const reward = doc.data()
      const rewardCard = document.createElement("div")
      rewardCard.className = "reward-card"
      rewardCard.innerHTML = `
        <div class="reward-icon">${reward.icon || "🎁"}</div>
        <h3>${reward.name}</h3>
        <span class="reward-cost">${reward.cost} pts</span>
        <button class="delete-btn" onclick="deleteReward('${doc.id}')">Delete</button>
      `
      rewardsGrid.appendChild(rewardCard)
    })
  } catch (error) {
    await handleFirestoreError(error, document.getElementById("rewardsGrid"))
  }
}

async function deleteReward(rewardId) {
  if (!confirm("Are you sure you want to delete this reward?")) return

  try {
    await db.collection("rewards").doc(rewardId).delete()
    showNotification("Reward deleted successfully", "success")
    setTimeout(() => {
      loadParentRewards()
    }, 1000)
  } catch (error) {
    console.error("[TaskQuest] Delete reward error:", error)
    showNotification("Failed to delete reward: " + error.message, "error")
  }
}

async function changePasscode() {
  const user = auth.currentUser
  if (!user) return

  const currentPasscode = await showInputModal('Enter your current 6-digit passcode:', '6-digit passcode')
  if (!currentPasscode) return

  try {
    const userDoc = await db.collection("users").doc(user.uid).get()
    const storedPasscode = userDoc.data().passcode

    if (currentPasscode !== storedPasscode) {
      showNotification("Incorrect current passcode", "error")
      return
    }

    const newPasscode = await showInputModal('Enter your new 6-digit passcode:', '6-digit passcode')
    if (!newPasscode || newPasscode.length !== 6 || isNaN(newPasscode)) {
      showNotification("Invalid passcode. Please use exactly 6 digits.", "error")
      return
    }

    const confirmPasscode = await showInputModal('Confirm your new 6-digit passcode:', '6-digit passcode')
    if (newPasscode !== confirmPasscode) {
      showNotification("Passcodes do not match", "error")
      return
    }

    await db.collection("users").doc(user.uid).update({
      passcode: newPasscode,
    })

    showNotification("Passcode changed successfully!", "success")
  } catch (error) {
    console.error("[TaskQuest] Change passcode error:", error)
    showNotification("Failed to change passcode: " + error.message, "error")
  }
}

async function loadParentTasks() {
  try {
    const tasksGrid = document.getElementById("tasksGrid")
    if (!tasksGrid) return

    const user = auth.currentUser
    const familyCode = await getFamilyCodeForUser(user)
    if (!familyCode) {
      const tasksGrid = document.getElementById("tasksGrid")
      if (tasksGrid) tasksGrid.innerHTML = "<p>No tasks created yet. Click 'Create New Task' to add one.</p>"
      return
    }

    const tasksSnapshot = await db
      .collection("taskTemplates")
      .where("familyCode", "==", familyCode)
      .orderBy("createdAt", "desc")
      .get()

    // Cache key to avoid flicker when nothing changed
    try { window.__cache = window.__cache || {} } catch(e) {}
    const tasksKey = tasksSnapshot.docs.map(d => d.id).sort().join('|')

    if (tasksSnapshot.empty) {
      tasksGrid.innerHTML = "<p>No tasks created yet. Click 'Create New Task' to add one.</p>"
      return
    }

    if (window.__cache.parentTasksKey && window.__cache.parentTasksKey === tasksKey) {
      return
    }
    window.__cache.parentTasksKey = tasksKey
    tasksGrid.innerHTML = ""

    // Determine number of children in this family so we can detect when all children completed a task
    let childrenCount = 0
    try {
      const childrenSnap = await db.collection('users').where('familyCode', '==', familyCode).where('role', '==', 'child').get()
      childrenCount = childrenSnap.size || 0
    } catch (e) {
      console.warn('[TaskQuest] Failed to count children for family:', e)
    }

    // Use for..of so we can await per-task checks
    for (const doc of tasksSnapshot.docs) {
      const task = doc.data()

      // Check if all children have an approved submission for this task — if so, hide it from parent list
      let approvedByCount = 0
      try {
        const approvedSnap = await db.collection('submissions')
          .where('taskId', '==', doc.id)
          .where('status', '==', 'approved')
          .get()
        // Count distinct users who have approved submissions
        const users = new Set()
        approvedSnap.forEach((s) => { if (s.data().userId) users.add(s.data().userId) })
        approvedByCount = users.size
      } catch (e) {
        console.warn('[TaskQuest] Failed to check approved submissions for task:', e)
      }

      if (childrenCount > 0 && approvedByCount >= childrenCount) {
        // All children completed this task — skip showing it to parent
        continue
      }

      const taskCard = document.createElement("div")
      taskCard.className = "task-template-card"
      taskCard.innerHTML = `
        <div class="task-icon">${task.icon || "📋"}</div>
        <h3>${task.title}</h3>
        <p>${task.description}</p>
        <span class="points-badge">${task.points} pts</span>
        <button class="delete-btn" onclick="deleteTask('${doc.id}')">Delete</button>
      `
      tasksGrid.appendChild(taskCard)
    }
  } catch (error) {
    await handleFirestoreError(error, document.getElementById("tasksGrid"))
  }
}

async function deleteTask(taskId) {
  if (!confirm("Are you sure you want to delete this task?")) return

  try {
    await db.collection("taskTemplates").doc(taskId).delete()
    showNotification("Task deleted successfully", "success")
    setTimeout(() => {
      loadParentTasks()
    }, 1000)
  } catch (error) {
    console.error("[TaskQuest] Delete task error:", error)
    showNotification("Failed to delete task: " + error.message, "error")
  }
}

async function loadChildProfile() {
  try {
    const user = auth.currentUser
    if (!user) return

    const userDoc = await db.collection("users").doc(user.uid).get()
    if (!userDoc.exists) return

    const userData = userDoc.data()

    // Set up a realtime watcher so parent deactivation takes effect immediately
    try {
      if (childProfileUnsubscribe) {
        try { childProfileUnsubscribe(); } catch(e){}
        childProfileUnsubscribe = null
      }
      childProfileUnsubscribe = db.collection('users').doc(user.uid).onSnapshot((snap) => {
        if (!snap.exists) return
        const d = snap.data()
        if (d.disabled === true && d.role === 'child') {
          showNotification('Your account has been disabled by a parent. You will be signed out.', 'error')
          auth.signOut().then(() => navigateTo('index.html')).catch(() => {})
        }
        // Also refresh the family link UI in case familyCode or displayName changed (from parent approval)
        try {
          const familyCard = document.getElementById('childFamilyLinkCard')
          const linkedInfo = document.getElementById('linkedParentInfo')
          const codeInput = document.getElementById('childFamilyCodeInput')
          if (familyCard && linkedInfo && codeInput) {
            if (d.familyCode) {
              // Child is linked — show parent info
              codeInput.style.display = 'none'
              // Try to get parent name
              try {
                const parentSnap = db.collection('users').where('familyCode', '==', d.familyCode).where('role', '==', 'parent').limit(1).get().then((ps) => {
                  if (!ps.empty) {
                    const p = ps.docs[0].data()
                    const parentLabel = p.displayName || p.name || 'Parent'
                    linkedInfo.innerHTML = `<strong style="color: #4CAF50;">✓ Linked to ${parentLabel}</strong><br><small>Family Code: ${d.familyCode}</small>`
                  } else {
                    linkedInfo.textContent = `Linked to family: ${d.familyCode}`
                  }
                })
              } catch (err) {
                linkedInfo.textContent = `Linked to family: ${d.familyCode}`
              }
            } else {
              // Not linked (or was unlinked)
              codeInput.style.display = 'inline-block'
              linkedInfo.textContent = 'Not linked to a family yet.'
            }
          }
        } catch (e) {
          console.debug('[TaskQuest] Family link UI refresh failed:', e)
        }
      })
    } catch (watchErr) {
      // Not critical — continue without watcher
      console.warn('[TaskQuest] Could not attach child profile watcher:', watchErr)
    }

    // Update profile header
    const profileName = document.getElementById("profileName")
    const profileEmail = document.getElementById("profileEmail")
    if (profileName) profileName.textContent = userData.name || "Unknown"
    if (profileEmail) profileEmail.textContent = userData.email || ""

    // Get total points earned (including spent points)
    const redeemedSnapshot = await db.collection("redeemedRewards").where("userId", "==", user.uid).get()

    let totalSpent = 0
    redeemedSnapshot.forEach((doc) => {
      totalSpent += doc.data().cost || 0
    })

    const currentPoints = userData.points || 0
    const totalEarned = currentPoints + totalSpent

    const totalPointsEl = document.getElementById("totalPoints")
    if (totalPointsEl) totalPointsEl.textContent = totalEarned

    // Family code linking UI for children
    try {
      const familyCard = document.getElementById("childFamilyLinkCard")
      const linkedInfo = document.getElementById("linkedParentInfo")
      const codeInput = document.getElementById("childFamilyCodeInput")

      if (familyCard && linkedInfo && codeInput) {
        if (userData.familyCode) {
          // Child is linked — show parent info
          codeInput.style.display = "none"
          
          // Get parent name
          try {
            const parentSnap = await db
              .collection("users")
              .where("familyCode", "==", userData.familyCode)
              .where("role", "==", "parent")
              .limit(1)
              .get()
            
            if (!parentSnap.empty) {
              const p = parentSnap.docs[0].data()
              const parentLabel = p.displayName || p.name || 'Parent'
              linkedInfo.innerHTML = `<strong style="color: #4CAF50;">✓ Linked to ${parentLabel}</strong><br><small>Family Code: ${userData.familyCode}</small>`
            } else {
              linkedInfo.textContent = `Linked to family: ${userData.familyCode}`
            }
          } catch (err) {
            linkedInfo.textContent = `Linked to family: ${userData.familyCode}`
          }
        } else {
          // Check for pending requests
          const pendingReqs = await db
            .collection("familyRequests")
            .where("childId", "==", user.uid)
            .where("status", "==", "pending")
            .get()
          
          if (!pendingReqs.empty) {
            const req = pendingReqs.docs[0].data()
            codeInput.style.display = "none"
            // parentName may be null — show a generic waiting message
            linkedInfo.innerHTML = `<strong style="color: #FFA500;">⏳ Request pending...</strong><br><small>Waiting for parent approval</small>`
          } else {
            // Not linked and no pending request
            codeInput.style.display = "inline-block"
            linkedInfo.textContent = "Not linked to a family yet."
          }
        }
      }
    } catch (uiErr) {
      console.warn("Child profile family UI update failed:", uiErr)
    }

    // Attach a realtime listener for the child's own pending family requests so UI updates automatically
    try {
      if (window.childRequestsUnsubscribe) { try { window.childRequestsUnsubscribe() } catch(e){}; window.childRequestsUnsubscribe = null }
      window.childRequestsUnsubscribe = db.collection('familyRequests')
        .where('childId', '==', user.uid)
        .onSnapshot(async (snap) => {
          try {
            console.log('[TaskQuest] Child familyRequests snapshot update - docs:', snap.docs.map(d => ({ id: d.id, ...d.data() })))
            const familyCard = document.getElementById('childFamilyLinkCard')
            const linkedInfo = document.getElementById('linkedParentInfo')
            const codeInput = document.getElementById('childFamilyCodeInput')
            if (!familyCard || !linkedInfo || !codeInput) return
            // If any pending requests exist, show pending status
            const pending = snap.docs.filter(d => d.data().status === 'pending')
            const approved = snap.docs.filter(d => d.data().status === 'approved')

            console.log('[TaskQuest] Child pending:', pending.length, 'approved:', approved.length)

            if (pending.length > 0) {
              codeInput.style.display = 'none'
              linkedInfo.innerHTML = `<strong style="color: #FFA500;">⏳ Request pending...</strong><br><small>Waiting for parent approval</small>`
            } else if (approved.length > 0) {
              // If approved, the child (this client) should update their own user doc to set familyCode/role
              const reqDoc = approved[0]
              const req = reqDoc.data()
              console.log('[TaskQuest] Child detected approved request:', req)
              try {
                // Determine desired role (parent or child)
                const requestedRole = req.roleResponded || req.roleRequested || 'child'

                // Try to pick a sensible display/name: prefer name from the request, fall back to existing user doc
                let nameToUse = req.childName || req.requesterName || null
                if (!nameToUse) {
                  try {
                    const myDoc = await db.collection('users').doc(user.uid).get()
                    if (myDoc.exists) nameToUse = myDoc.data().name || null
                  } catch (e) {
                    // ignore - we'll fallback to a generic label
                  }
                }
                if (!nameToUse) nameToUse = 'Account'

                const roleLabel = (requestedRole === 'parent') ? 'parent' : 'child'
                const displayNameFormatted = `${nameToUse} (${roleLabel})`

                const updates = { familyCode: req.familyCode, displayName: displayNameFormatted }
                // Only change the canonical role if the request explicitly asked for parent role
                if (requestedRole === 'parent') updates.role = 'parent'

                console.log('[TaskQuest] Child updating own user doc with:', updates)
                await db.collection('users').doc(user.uid).update(updates)
                console.log('[TaskQuest] Child successfully updated own user doc')
                codeInput.style.display = 'none'
                linkedInfo.innerHTML = `<strong style="color: #4CAF50;">✓ Linked to family</strong><br><small>Family Code: ${req.familyCode}</small>`
                // Reload available tasks so child sees parent's existing tasks
                setTimeout(() => {
                  loadAvailableTasks()
                  loadRewards()
                }, 500)
                // Mark the request as completed (child acknowledges)
                await db.collection('familyRequests').doc(reqDoc.id).update({ status: 'completed', acknowledgedAt: firebase.firestore.FieldValue.serverTimestamp() }).catch(()=>{})
              } catch (e) {
                console.warn('[TaskQuest] Error applying approved request locally:', e)
              }
            } else {
              // Re-evaluate user doc to see if linked
              db.collection('users').doc(user.uid).get().then((ud) => {
                if (ud.exists && ud.data().familyCode) {
                  codeInput.style.display = 'none'
                  linkedInfo.innerHTML = `<strong style="color: #4CAF50;">✓ Linked to family</strong><br><small>Family Code: ${ud.data().familyCode}</small>`
                } else {
                  codeInput.style.display = 'inline-block'
                  linkedInfo.textContent = 'Not linked to a family yet.'
                }
              }).catch(() => {})
            }
          } catch (err) {
            console.warn('[TaskQuest] childRequests snapshot handler error:', err)
          }
        }, (error) => {
          if (error && error.code === 'permission-denied') {
            console.debug('[TaskQuest] childRequests listener permission denied')
          } else {
            console.warn('[TaskQuest] childRequests listener error:', error)
          }
        })
    } catch (e) {
      console.warn('[TaskQuest] Could not attach childRequests listener:', e)
    }

    // Get completed tasks count
    const completedSnapshot = await db
      .collection("submissions")
      .where("userId", "==", user.uid)
      .where("status", "==", "approved")
      .get()

    const completedTasksEl = document.getElementById("completedTasks")
    if (completedTasksEl) completedTasksEl.textContent = completedSnapshot.size

    // Get rewards redeemed count
    const rewardsRedeemedEl = document.getElementById("rewardsRedeemed")
    if (rewardsRedeemedEl) rewardsRedeemedEl.textContent = redeemedSnapshot.size

    // Load activity history
    await loadActivityHistory()
  } catch (error) {
    console.error("[TaskQuest] Load child profile error:", error)
  }
}

async function loadActivityHistory() {
  try {
    const user = auth.currentUser
    if (!user) return

    const activityList = document.getElementById("activityList")
    if (!activityList) return

    // Get submissions
    const submissionsSnapshot = await db
      .collection("submissions")
      .where("userId", "==", user.uid)
      .orderBy("submittedAt", "desc")
      .limit(20)
      .get()

    // Get redeemed rewards
    const redeemedSnapshot = await db
      .collection("redeemedRewards")
      .where("userId", "==", user.uid)
      .orderBy("redeemedAt", "desc")
      .limit(20)
      .get()

    const activities = []

    // Process submissions: include more details for richer history cards
    for (const doc of submissionsSnapshot.docs) {
      const submission = doc.data()
      const submissionId = doc.id
      // Defensive: fallback values
      let taskName = submission.taskTitle || "Unknown Task"
      let taskDescription = submission.taskDescription || ""
      let points = 0
      let beforePhoto = submission.beforePhoto || submission.beforeDataUrl || null
      let afterPhoto = submission.afterPhoto || submission.afterDataUrl || null

      if (submission.taskId) {
        try {
          const taskDoc = await db.collection("taskTemplates").doc(submission.taskId).get()
          if (taskDoc.exists) {
            const t = taskDoc.data()
            taskName = t.title || taskName
            taskDescription = t.description || taskDescription
            points = t.points || 0
          }
        } catch (e) {
          console.warn('[TaskQuest] Failed to load task template for activity history:', e)
        }
      }

      activities.push({
        id: submissionId,
        type: submission.status,
        title: taskName,
        description: taskDescription,
        time: submission.submittedAt?.toDate() || new Date(),
        points: points,
        beforePhoto: beforePhoto,
        afterPhoto: afterPhoto,
      })
    }

    // Process redeemed rewards
    redeemedSnapshot.forEach((doc) => {
      const reward = doc.data()
      activities.push({
        type: "redeemed",
        title: reward.rewardName,
        time: reward.redeemedAt?.toDate() || new Date(),
        cost: reward.cost,
      })
    })

    // Sort by time
    activities.sort((a, b) => b.time - a.time)

    if (activities.length === 0) {
      activityList.innerHTML = "<p>No activity yet. Start completing tasks to see your history!</p>"
      return
    }

    // Render as a responsive grid of cards (3 cols on desktop, 2 on tablet, 1 on mobile)
    activityList.innerHTML = ""
    activityList.style.display = 'grid'
    activityList.style.gridTemplateColumns = 'repeat(auto-fit, minmax(300px, 1fr))'
    activityList.style.gap = '12px'
    activityList.style.padding = '0'
    activityList.style.width = '100%'
    activityList.style.overflowX = 'visible'

    activities.forEach((activity) => {
      const card = document.createElement('div')
      card.className = `activity-card ${activity.type}`
      card.style.cssText = `
        border: 1px solid #e0e0e0;
        padding: 12px;
        border-radius: 8px;
        background: #fff;
        display: flex;
        flex-direction: column;
        gap: 8px;
        box-sizing: border-box;
        min-width: 0;
      `
      const timeAgo = getTimeAgo(activity.time)

      card.innerHTML = `
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; min-width: 0;">
          <h4 style="margin: 0; font-size: 14px; word-break: break-word; flex: 1;">${activity.title}</h4>
          <span class="activity-time" style="font-size: 12px; white-space: nowrap; flex-shrink: 0;">${timeAgo}</span>
        </div>
        <div class="card-body" style="display: flex; flex-direction: column; gap: 6px;">
          <p class="card-desc" style="margin: 0; font-size: 12px; color: #666; line-height: 1.3;">${activity.description || ''}</p>
          <div class="photo-row" style="display: flex; gap: 6px; justify-content: space-between;">
            <img class="history-photo" src="${activity.beforePhoto || '/before-task.jpg'}" alt="Before" onerror="this.src='/before-task.jpg'" style="width: 48%; height: auto; max-height: 100px; object-fit: cover; border-radius: 4px;">
            <img class="history-photo" src="${activity.afterPhoto || '/after-task.jpg'}" alt="After" onerror="this.src='/after-task.jpg'" style="width: 48%; height: auto; max-height: 100px; object-fit: cover; border-radius: 4px;">
          </div>
        </div>
        <div class="card-footer" style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; margin-top: 4px; padding-top: 8px; border-top: 1px solid #f0f0f0;">
          <span class="points" style="font-weight: bold;">+${activity.points} pts</span>
          <span class="status ${activity.type}" style="padding: 2px 6px; border-radius: 4px; font-size: 11px; background: #f0f0f0; color: #333;">${activity.type}</span>
        </div>
      `

      activityList.appendChild(card)
    })
  } catch (error) {
    console.error("[TaskQuest] Load activity history error:", error)
    const activityList = document.getElementById("activityList")
    // Use centralized Firestore error handler to provide actionable guidance (indexes / rules)
    try {
      await handleFirestoreError(error, activityList)
    } catch (handlerErr) {
      console.error('[TaskQuest] Error while handling Firestore error:', handlerErr)
      if (activityList) activityList.innerHTML = "<p>Error loading activity history.</p>"
    }
  }
}

function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000)

  let interval = Math.floor(seconds / 31536000)
  if (interval >= 1) return interval + " year" + (interval > 1 ? "s" : "") + " ago"

  interval = Math.floor(seconds / 2592000)
  if (interval >= 1) return interval + " month" + (interval > 1 ? "s" : "") + " ago"

  interval = Math.floor(seconds / 86400)
  if (interval >= 1) return interval + " day" + (interval > 1 ? "s" : "") + " ago"

  interval = Math.floor(seconds / 3600)
  if (interval >= 1) return interval + " hour" + (interval > 1 ? "s" : "") + " ago"

  interval = Math.floor(seconds / 60)
  if (interval >= 1) return interval + " minute" + (interval > 1 ? "s" : "") + " ago"

  return "Just now"
}

// Utility: friendly handling for Firestore errors (index & permissions guidance)
async function handleFirestoreError(error, uiElement) {
  console.error("[TaskQuest] Firestore error:", error)
  const msg = (error && (error.message || String(error))) || String(error)

  // Detect index URL in error message
  const urlMatch = msg.match(/https?:\/\/[^\s)"']+/)
  if (msg.includes("requires an index") || msg.includes("create it here") || urlMatch) {
    if (urlMatch && navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(urlMatch[0])
        showNotification("Query requires a Firestore index — link copied to clipboard", "error")
      } catch (e) {
        showNotification("Query requires a Firestore index — see console for link", "error")
      }
    } else {
      showNotification("Query requires a Firestore index — see console for link", "error")
    }
    if (urlMatch) console.error("Firestore create-index URL:", urlMatch[0])
    if (uiElement) uiElement.innerHTML = "<p>Error: Query requires a Firestore index. Check console for link.</p>"
    return
  }

  if (msg.toLowerCase().includes("insufficient permissions") || msg.toLowerCase().includes("missing or insufficient permissions")) {
    showNotification("Missing or insufficient permissions. Check your Firestore rules.", "error")
    if (uiElement) uiElement.innerHTML = "<p>Permission error: unable to load data. Check Firebase rules.</p>"
    return
  }

  showNotification("Error loading data: " + (error.message || error), "error")
  if (uiElement) uiElement.innerHTML = "<p>Error loading data. Please refresh the page.</p>"
}

async function displayFamilyCode() {
  try {
    const user = auth.currentUser
    if (!user) return

    const familyCode = await getFamilyCodeForUser(user)
    if (!familyCode) return

    const codeDisplay = document.getElementById("familyCodeDisplay")
    if (codeDisplay) {
      codeDisplay.textContent = familyCode
    }
  } catch (error) {
    console.error("[TaskQuest] Display family code error:", error)
  }
}

async function copyFamilyCode() {
  try {
    const user = auth.currentUser
    if (!user) return

    const familyCode = await getFamilyCodeForUser(user)
    if (!familyCode) return

    // Copy to clipboard
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(familyCode)
      showNotification("Family code copied to clipboard! 📋", "success")
    } else {
      // Fallback for older browsers
      const textArea = document.createElement("textarea")
      textArea.value = familyCode
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand("copy")
      document.body.removeChild(textArea)
      showNotification("Family code copied to clipboard! 📋", "success")
    }
  } catch (error) {
    console.error("[TaskQuest] Copy family code error:", error)
    showNotification("Failed to copy code", "error")
  }
}

// Allow child to set a parent's family code after signup
async function setFamilyCodeForChild() {
  try {
    const input = document.getElementById("childFamilyCodeInput")
    if (!input) return
    const code = input.value.trim()
    if (!code || code.length !== 6 || isNaN(code)) {
      showNotification("Please enter a valid 6-digit family code.", "error")
      return
    }

    const user = auth.currentUser
    if (!user) {
      showNotification("Please login first.", "error")
      return
    }

    // Do NOT attempt to read the users collection here — rules can block that.
    // Instead create a familyRequests doc with the provided code; parents will
    // filter by familyCode to find pending requests and approve/decline them.
    const childNameDisplay = user.displayName || (user.email ? user.email.split('@')[0] : 'Child')
    try {
      const requestRef = await db.collection("familyRequests").add({
        childId: user.uid,
        childName: childNameDisplay,
        childEmail: user.email || null,
        parentId: null,
        parentName: null,
        familyCode: code,
        roleRequested: 'child',
        status: "pending",
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        respondedAt: null,
      })

      console.log('[TaskQuest] Family request created (no parent lookup):', requestRef.id)
      showNotification("Request sent! Waiting for parent approval...", "success")
      input.value = ""

      // Refresh to show pending status
      setTimeout(() => loadChildProfile(), 1000)
    } catch (createErr) {
      console.error('[TaskQuest] Failed to create family request:', createErr)
      throw createErr
    }
  } catch (error) {
    console.error("[TaskQuest] setFamilyCodeForChild error:", error)
    const msg = error?.message || String(error)
    if (msg.includes('Missing or insufficient permissions')) {
      showNotification('Permission denied. Your Firestore rules may need to be updated. Contact your parent.', 'error')
    } else {
      await handleFirestoreError(error, document.getElementById("childFamilyLinkCard"))
    }
  }
}

// Prompt an existing user to request guardian (parent) access for a family
async function promptParentJoin() {
  try {
    const user = auth.currentUser
    if (!user) {
      showNotification('Please sign in before requesting guardian access.', 'error')
      return
    }

    const code = prompt('Enter the 6-digit family code you want to join as a guardian:')
    if (!code) return
    const trimmed = String(code).trim()
    if (!trimmed || trimmed.length !== 6 || isNaN(trimmed)) {
      showNotification('Please enter a valid 6-digit family code.', 'error')
      return
    }

    const displayName = user.displayName || (user.email ? user.email.split('@')[0] : 'User')

    // Create a familyRequests doc indicating a guardian/parent request
    await db.collection('familyRequests').add({
      requesterId: user.uid,
      requesterName: displayName,
      requesterEmail: user.email || null,
      roleRequested: 'parent',
      familyCode: trimmed,
      status: 'pending',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      respondedAt: null
    })

    showNotification('Guardian request sent — waiting for parent approval.', 'success')
  } catch (error) {
    console.error('[TaskQuest] promptParentJoin error:', error)
    if ((error && error.message && error.message.includes('permissions')) || String(error).includes('Missing or insufficient permissions')) {
      showNotification('Permission denied. Your Firestore rules may need updating.', 'error')
    } else {
      showNotification('Failed to send guardian request: ' + (error.message || String(error)), 'error')
    }
  }
}

// Parent: invite another parent/guardian by email (creates a familyInvites document)
async function addParentInvitePrompt() {
  try {
    const user = auth.currentUser
    if (!user) {
      showNotification('Please sign in as a parent to invite another parent.', 'error')
      return
    }

    // Ask for 4-digit invite code then email using modal inputs
    const inviteCode = await showInputModal('Enter a 4-digit invite code to assign to this parent (numbers only):', '4-digit code')
    if (!inviteCode || inviteCode.length !== 4 || isNaN(inviteCode)) {
      showNotification('Invalid invite code. Please enter 4 digits.', 'error')
      return
    }

    const email = await showInputModal('Enter the email address of the parent you want to invite:', 'email@example.com')
    if (!email) return
    const trimmed = String(email).trim()
    if (!trimmed || !trimmed.includes('@')) {
      showNotification('Please enter a valid email address.', 'error')
      return
    }

    // Get current parent's family code
    const parentDoc = await db.collection('users').doc(user.uid).get()
    if (!parentDoc.exists) {
      showNotification('Could not find your account details.', 'error')
      return
    }
    const familyCode = parentDoc.data().familyCode
    if (!familyCode) {
      showNotification('You do not have a family code. Create one first.', 'error')
      return
    }

    // Create an invite record — parents can later share invite codes or the invited user redeems
    await db.collection('familyInvites').add({
      inviterId: user.uid,
      inviterName: parentDoc.data().name || null,
      inviteeEmail: trimmed,
      inviteCode: String(inviteCode),
      familyCode: familyCode,
      status: 'pending',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    })

    showNotification('Parent invite created. The invited user can redeem the code and email when they sign up.', 'success')
  } catch (error) {
    console.error('[TaskQuest] addParentInvitePrompt error:', error)
    showNotification('Failed to create invite: ' + (error.message || String(error)), 'error')
  }
}

// ----- Parent invite: new 8-digit code flow -----
async function generateParentInviteCodeUI() {
  try {
    const user = auth.currentUser
    if (!user) { showNotification('Please sign in as a parent.', 'error'); return }
    showNotification('Generating invite code...', 'info')
    const code = await generateParentInviteCode()
    if (!code) throw new Error('Failed to create invite code')
    // Show code to user and allow copying
    const copied = await showInputModal(`Invite code created:\n\n${code}\n\nClick OK to copy it to clipboard.`, code)
    if (copied !== null) {
      try { await navigator.clipboard.writeText(code); showNotification('Invite code copied to clipboard!', 'success') } catch (e) { showNotification('Code: ' + code, 'success') }
    }
  } catch (error) {
    console.error('[TaskQuest] generateParentInviteCodeUI error:', error)
    showNotification('Failed to generate invite code: ' + (error.message || String(error)), 'error')
  }
}

async function generateParentInviteCode() {
  if (!auth.currentUser) throw new Error('Not signed in')
  const user = auth.currentUser
  const ownerId = user.uid
  // attempt up to 12 times to generate a unique 8-digit numeric code
  for (let attempt = 0; attempt < 12; attempt++) {
    const code = String(Math.floor(10000000 + Math.random() * 90000000)) // 8 digits
    try {
      const docRef = db.collection('parentInviteCodes').doc(code)
      const doc = await docRef.get()
      if (doc.exists) {
        continue
      }
      // get some owner info (familyCode/name) if available
      const ownerDoc = await db.collection('users').doc(ownerId).get()
      const ownerName = ownerDoc.exists ? (ownerDoc.data().name || null) : null
      const familyCode = ownerDoc.exists ? (ownerDoc.data().familyCode || null) : null
      await docRef.set({ ownerId, ownerName, familyCode: familyCode || null, createdAt: firebase.firestore.FieldValue.serverTimestamp(), used: false })
      return code
    } catch (err) {
      console.warn('[TaskQuest] generateParentInviteCode attempt failed:', err)
      continue
    }
  }
  throw new Error('Unable to generate unique invite code after several attempts')
}

// UI for entering someone else's parent-invite code (to request to join)
async function enterParentInviteCodeUI() {
  try {
    const code = await showInputModal('Enter the 8-digit parent invite code you received:', '12345678')
    if (!code) return
    const trimmed = String(code).trim()
    if (!/^[0-9]{8}$/.test(trimmed)) { showNotification('Please enter a valid 8-digit numeric code.', 'error'); return }
    await requestParentAccessByCode(trimmed)
  } catch (error) {
    console.error('[TaskQuest] enterParentInviteCodeUI error:', error)
    showNotification('Failed to request access: ' + (error.message || String(error)), 'error')
  }
}

async function requestParentAccessByCode(code) {
  try {
    const user = auth.currentUser
    if (!user) { showNotification('Please sign in to request access.', 'error'); return }
    // lookup code
    const codeDoc = await db.collection('parentInviteCodes').doc(code).get()
    if (!codeDoc.exists) { showNotification('Invite code not found.', 'error'); return }
    const ownerId = codeDoc.data().ownerId
    if (ownerId === user.uid) { showNotification('This code is your own. Share it with other parents.', 'info'); return }

    // create a parentInviteRequests document
    await db.collection('parentInviteRequests').add({
      code: code,
      targetOwnerId: ownerId,
      requesterId: user.uid,
      requesterName: user.displayName || user.email?.split('@')[0] || 'Parent',
      requesterEmail: user.email || null,
      status: 'pending',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      respondedAt: null
    })

    showNotification('Request sent! Once approved, you\'ll be linked to this family.', 'success')
  } catch (error) {
    console.error('[TaskQuest] requestParentAccessByCode error:', error)
    showNotification('Failed to request parent access: ' + (error.message || String(error)), 'error')
  }
}

// Requester-side: watch for approved parent invite requests and self-apply familyCode
function setupParentInviteOutcomeListener() {
  const user = auth.currentUser
  if (!user) return () => {}
  
  let processedRequestIds = new Set()
  let unsubscribe = null
  
  try {
    unsubscribe = db
      .collection('parentInviteRequests')
      .where('requesterId', '==', user.uid)
      .where('status', '==', 'approved')
      .onSnapshot(async (snap) => {
        try {
          if (snap.empty) return
          
          // Process each approved request only once
          for (const reqDoc of snap.docs) {
            const d = reqDoc.data()
            
            // Skip if already processed in this session or acknowledged
            if (processedRequestIds.has(reqDoc.id) || d.acknowledgedByRequesterAt) {
              continue
            }
            
            // Check if user already has this familyCode
            const currentUserDoc = await db.collection('users').doc(user.uid).get()
            const currentFamilyCode = currentUserDoc.exists ? currentUserDoc.data().familyCode : null
            
            // Get familyCode from request
            let familyCode = d.familyCode || null
            
            // Fallback to parentInviteCodes
            if (!familyCode && d.code) {
              try {
                const codeDoc = await db.collection('parentInviteCodes').doc(d.code).get()
                familyCode = codeDoc.exists ? (codeDoc.data().familyCode || null) : null
              } catch(e) { /* ignore */ }
            }
            
            // Fallback to owner's familyCode
            if (!familyCode && d.targetOwnerId) {
              try {
                const ownerDoc = await db.collection('users').doc(d.targetOwnerId).get()
                if (ownerDoc.exists) familyCode = ownerDoc.data().familyCode || null
              } catch(e) { /* ignore */ }
            }
            
            if (!familyCode) continue
            
            // Skip if already linked to this family
            if (currentFamilyCode === familyCode) {
              // Just mark as acknowledged without notification
              processedRequestIds.add(reqDoc.id)
              try { 
                await db.collection('parentInviteRequests').doc(reqDoc.id).update({ 
                  acknowledgedByRequesterAt: firebase.firestore.FieldValue.serverTimestamp() 
                }) 
              } catch(e) {}
              continue
            }
            
            // Apply familyCode
            await db.collection('users').doc(user.uid).update({ familyCode: familyCode, role: 'parent' })
            processedRequestIds.add(reqDoc.id)
            showNotification('You have been linked to this family as a parent!', 'success')
            
            // Mark as acknowledged
            try { 
              await db.collection('parentInviteRequests').doc(reqDoc.id).update({ 
                acknowledgedByRequesterAt: firebase.firestore.FieldValue.serverTimestamp() 
              }) 
            } catch(e) {}
            
            // Refresh UI if on parent dashboard
            if (window.location.pathname.includes('parent-dashboard')) {
              setTimeout(() => { loadCoparents(); loadParentProfile(); }, 500)
            }
          }
        } catch (e) {
          console.error('[TaskQuest] Error processing parent invite:', e)
        }
      }, (err) => {
        if (err && err.code !== 'permission-denied') {
          console.error('[TaskQuest] Parent invite listener error:', err)
        }
      })
  } catch (e) {
    console.error('[TaskQuest] Could not attach parent invite listener:', e)
  }
  return () => { try { if (unsubscribe) unsubscribe() } catch(e){} }
}

// Owner: view incoming parent requests
async function viewParentRequests() {
  try {
    const user = auth.currentUser
    if (!user) { showNotification('Please sign in as a parent to view requests.', 'error'); return }
    const snapshot = await db.collection('parentInviteRequests').where('targetOwnerId', '==', user.uid).get()
    if (snapshot.empty) { showNotification('No pending parent requests.', 'info'); return }
    // Build HTML list with more details - only show pending status
    let listHtml = ''
    snapshot.forEach(doc => {
      const data = doc.data()
      // Only show pending requests in the modal
      if (data.status !== 'pending') return
      const createdDate = data.createdAt ? new Date(data.createdAt.toDate()).toLocaleDateString() : 'N/A'
      listHtml += `<div style="padding:12px; margin-bottom:8px; border:1px solid var(--border); border-radius:var(--radius); background:var(--surface);">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
          <div style="flex:1;">
            <strong style="display:block; margin-bottom:4px;">${escapeHtml(data.requesterName || 'Parent')}</strong>
            <small style="display:block; color:var(--text-secondary); margin-bottom:4px;">Email: ${escapeHtml(data.requesterEmail || 'N/A')}</small>
            <small style="display:block; color:var(--text-secondary);">Requested: ${createdDate}</small>
          </div>
          <div style="display:flex; gap:6px; flex-shrink:0;">
            <button class='secondary-btn' onclick="approveParentRequest('${doc.id}')" style="font-size:12px; padding:6px 10px;">Approve</button>
            <button class='secondary-btn' onclick="declineParentRequest('${doc.id}')" style="font-size:12px; padding:6px 10px;">Decline</button>
          </div>
        </div>
      </div>`
    })
    if (!listHtml) { showNotification('No pending parent requests.', 'info'); return }
    // show in modal
    const modal = document.createElement('div')
    modal.className = 'modal'
    modal.style.display = 'block'
    const content = document.createElement('div')
    content.className = 'modal-content'
    content.style.maxWidth = '520px'
    content.innerHTML = `<span class="close">&times;</span><h3>Pending Parent Requests</h3><div style="margin-top:12px">${listHtml}</div>`
    modal.appendChild(content)
    document.body.appendChild(modal)
    content.querySelector('.close').addEventListener('click', () => { try { document.body.removeChild(modal) } catch(e){} })
  } catch (error) {
    console.error('[TaskQuest] viewParentRequests error:', error)
    showNotification('Failed to load parent requests: ' + (error.message || String(error)), 'error')
  }
}

async function approveParentRequest(requestId) {
  try {
    const reqRef = db.collection('parentInviteRequests').doc(requestId)
    const owner = auth.currentUser
    if (!owner) { showNotification('Please sign in as a parent to approve requests.', 'error'); return }

    console.log('[TaskQuest] approveParentRequest called for requestId:', requestId)

    // Step 1: mark request approved in a transaction (authoritative)
    let requesterId = null
    let familyCode = null
    let inviteCode = null
    await db.runTransaction(async (tx) => {
      const reqDoc = await tx.get(reqRef)
      if (!reqDoc.exists) throw new Error('Request not found')
      const data = reqDoc.data()
      console.log('[TaskQuest] Request data:', data)
      if (data.status !== 'pending') throw new Error('Request already handled')
      requesterId = data.requesterId
      inviteCode = data.code

      const ownerRef = db.collection('users').doc(owner.uid)
      const ownerDoc = await tx.get(ownerRef)
      if (!ownerDoc.exists) throw new Error('Owner profile not found')
      familyCode = ownerDoc.data().familyCode || null
      console.log('[TaskQuest] Owner familyCode:', familyCode)
      if (!familyCode) throw new Error('Owner has no family code')

      // Update request status AND store familyCode in the request for the requester to read
      tx.update(reqRef, { 
        status: 'approved', 
        familyCode: familyCode,
        respondedAt: firebase.firestore.FieldValue.serverTimestamp() 
      })
    })

    console.log('[TaskQuest] Request approved, now attempting to update requester', requesterId, 'with familyCode', familyCode)

    // Step 2: best-effort: attempt to set requester.user.familyCode (may be blocked by rules)
    // Note: We can't read the requester's doc (permission denied) so just try the update directly
    let directUpdateSuccess = false
    try {
      if (requesterId && familyCode) {
        console.log('[TaskQuest] Attempting direct update of requester', requesterId)
        await db.collection('users').doc(requesterId).update({ familyCode: familyCode, role: 'parent' })
        directUpdateSuccess = true
        console.log('[TaskQuest] Successfully updated requester with familyCode')
      }
    } catch (e) {
      const code = e && (e.code || '').toString()
      console.warn('[TaskQuest] Failed to update requester directly:', e.message || e)
      if (code === 'permission-denied') {
        console.debug('[TaskQuest] Owner cannot update other parent doc by rules; requester listener will self-apply family code.')
      }
    }

    showNotification(directUpdateSuccess ? 'Parent request approved and linked to family!' : 'Parent request approved — they will be linked when they refresh.', 'success')

    // Reload profile to reflect updated co-parents count
    setTimeout(() => { 
      if (typeof loadParentProfile === 'function') loadParentProfile()
      if (typeof loadCoparents === 'function') loadCoparents()
      // Close and refresh the modal
      const modals = document.querySelectorAll('.modal')
      if (modals.length > 0) {
        const lastModal = modals[modals.length - 1]
        try { lastModal.parentNode.removeChild(lastModal) } catch(e){}
      }
      // Reopen to show updated list
      setTimeout(() => { viewParentRequests() }, 300)
    }, 500)
  } catch (error) {
    console.error('[TaskQuest] approveParentRequest error:', error)
    const msg = String(error && (error.message || error))
    if (msg.includes('permission') || msg.includes('Missing or insufficient')) {
      showNotification('Failed to approve request: permission denied. Please deploy updated Firestore rules and ensure the approver is a parent.', 'error')
    } else {
      showNotification('Failed to approve request: ' + (error.message || String(error)), 'error')
    }
  }
}

async function declineParentRequest(requestId) {
  try {
    await db.collection('parentInviteRequests').doc(requestId).update({ status: 'declined', respondedAt: firebase.firestore.FieldValue.serverTimestamp() })
    showNotification('Parent request declined.', 'success')
    // Close and refresh the modal
    const modals = document.querySelectorAll('.modal')
    if (modals.length > 0) {
      const lastModal = modals[modals.length - 1]
      try { lastModal.parentNode.removeChild(lastModal) } catch(e){}
    }
    // Reopen to show updated list
    setTimeout(() => { viewParentRequests() }, 300)
  } catch (error) {
    console.error('[TaskQuest] declineParentRequest error:', error)
    showNotification('Failed to decline request: ' + (error.message || String(error)), 'error')
  }
}

function openManageParents() {
  // simple navigation helper — reuse viewParentRequests
  viewParentRequests()
}

// small helper to escape HTML when rendering user-provided strings
function escapeHtml(str) {
  if (!str) return ''
  return String(str).replace(/[&<>"'`]/g, function (s) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;', '`':'&#96;'})[s] })
}

// Load parent profile information (for parent-dashboard)
async function loadParentProfile() {
  try {
    const user = auth.currentUser
    if (!user) return
    const userDoc = await db.collection('users').doc(user.uid).get()
    if (!userDoc.exists) return
    const data = userDoc.data()
    const displayName = data.name || user.displayName || (user.email ? user.email.split('@')[0] : 'Parent')
    const nameEl = document.getElementById('parentProfileName')
    const emailEl = document.getElementById('parentProfileEmail')
    const familyEl = document.getElementById('familyCodeParent')
    if (nameEl) nameEl.textContent = displayName
    if (emailEl) emailEl.textContent = user.email || ''
    if (familyEl) familyEl.textContent = data.familyCode || '------'

    // Count managed children and parents
    let childrenCount = 0
    let parentsCount = 0
    if (data.familyCode) {
      const childrenSnap = await db.collection('users').where('familyCode', '==', data.familyCode).where('role', '==', 'child').get()
      childrenCount = childrenSnap.size
      const parentsSnap = await db.collection('users').where('familyCode', '==', data.familyCode).where('role', '==', 'parent').get()
      parentsCount = Math.max(0, parentsSnap.size - 1)
    }
    const childrenEl = document.getElementById('managedChildrenCount')
    const parentsEl = document.getElementById('linkedParentsCount')
    if (childrenEl) childrenEl.textContent = String(childrenCount)
    if (parentsEl) parentsEl.textContent = String(parentsCount)

    // Recent activity - inbox/outbox of parent invite requests
    const activityEl = document.getElementById('parentActivityList')
    if (!activityEl) return
    activityEl.innerHTML = '<p>Loading recent activity...</p>'
    // Avoid composite index requirement by removing orderBy and sorting client-side
    const inbox = await db.collection('parentInviteRequests').where('targetOwnerId', '==', user.uid).limit(12).get()
    const outbox = await db.collection('parentInviteRequests').where('requesterId', '==', user.uid).limit(12).get()
    let html = ''
    function byDateDesc(a,b){
      const ta = a?.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a?.createdAt?.seconds ? a.createdAt.seconds*1000 : 0)
      const tb = b?.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b?.createdAt?.seconds ? b.createdAt.seconds*1000 : 0)
      return tb - ta
    }
    const inboxItems = inbox.docs.map(x => x.data()).sort(byDateDesc).slice(0,6)
    const outboxItems = outbox.docs.map(x => x.data()).sort(byDateDesc).slice(0,6)
    inboxItems.forEach(d => { html += `<div class="activity-item">Request from <strong>${escapeHtml(d.requesterName||'Parent')}</strong> — <em>${escapeHtml(d.status)}</em></div>` })
    outboxItems.forEach(d => { html += `<div class="activity-item">Requested access to <strong>code ${escapeHtml(d.code||'')}</strong> — <em>${escapeHtml(d.status)}</em></div>` })
    if (!html) html = '<p>No recent activity.</p>'
    activityEl.innerHTML = html
  } catch (error) {
    console.error('[TaskQuest] loadParentProfile error:', error)
  }
}

// Load family parents list for parent dashboard
async function loadCoparents() {
  try {
    const user = auth.currentUser
    console.log('[TaskQuest] loadCoparents() called, user:', user?.uid)
    if (!user) { showNotification('Please sign in.', 'error'); return }
    
    const userDoc = await db.collection('users').doc(user.uid).get()
    if (!userDoc.exists) { console.warn('[TaskQuest] loadCoparents: user doc not found'); return }
    const familyCode = userDoc.data().familyCode
    console.log('[TaskQuest] loadCoparents: my familyCode =', familyCode)
    if (!familyCode) { 
      document.getElementById('coparentsGrid').innerHTML = '<p>No family code set.</p>'
      return 
    }

    // Determine family owner
    async function determineFamilyOwnerId(code) {
      try {
        const codeSnap = await db.collection('parentInviteCodes').where('familyCode', '==', code).limit(1).get()
        if (!codeSnap.empty) {
          const d = codeSnap.docs[0].data()
          if (d && d.ownerId) return d.ownerId
        }
      } catch (e) { console.debug('[TaskQuest] owner lookup by code failed:', e) }
      try {
        const parents = await db.collection('users')
          .where('familyCode', '==', code)
          .where('role', '==', 'parent')
          .get()
        if (!parents.empty) {
          // Choose earliest by createdAt client-side to avoid composite index
          const sorted = parents.docs.sort((a,b) => {
            const ta = a.data().createdAt?.toMillis ? a.data().createdAt.toMillis() : (a.data().createdAt?.seconds ? a.data().createdAt.seconds*1000 : 0)
            const tb = b.data().createdAt?.toMillis ? b.data().createdAt.toMillis() : (b.data().createdAt?.seconds ? b.data().createdAt.seconds*1000 : 0)
            return ta - tb
          })
          return sorted[0].id
        }
      } catch (e) { console.debug('[TaskQuest] owner fallback lookup failed:', e) }
      return null
    }

    // Get all parents in the family (excluding self)
    const parentsSnap = await db.collection('users').where('familyCode', '==', familyCode).where('role', '==', 'parent').get()
    const parents = []
    parentsSnap.forEach(doc => {
      if (doc.id !== user.uid) {
        parents.push({ id: doc.id, ...doc.data() })
      }
    })

    const gridEl = document.getElementById('coparentsGrid')
    if (!gridEl) return

    if (parents.length === 0) {
      gridEl.innerHTML = '<p style="padding:16px; text-align:center; color:var(--text-secondary);">No parents linked yet. Share your invite code to add guardians.</p>'
      return
    }

    // Determine if current user is the family owner
    let isOwner = false
    try {
      const codeSnap = await db.collection('parentInviteCodes').where('familyCode', '==', familyCode).limit(1).get()
      if (!codeSnap.empty && codeSnap.docs[0].data().ownerId === user.uid) {
        isOwner = true
      }
    } catch(e) {}

    let html = ''
    parents.forEach(parent => {
      const name = parent.name || parent.email?.split('@')[0] || 'Parent'
      const email = parent.email || 'N/A'
      const createdAt = parent.createdAt?.toDate ? new Date(parent.createdAt.toDate()).toLocaleDateString() : 'Unknown'
      
      let controls = ''
      if (isOwner) {
        controls = `<div style="display:flex; gap:8px;">
          <button class='secondary-btn' style='font-size:12px; padding:6px 10px; flex:1;' onclick="viewParentDetails('${parent.id}')">View</button>
          <button class='secondary-btn danger' style='font-size:12px; padding:6px 10px; flex:1; color:#e74c3c;' onclick="removeCoparent('${parent.id}')" title="Remove from family">Remove</button>
        </div>`
      } else {
        controls = `<div style="font-size:12px; color:var(--text-secondary); padding:6px; text-align:center;">Co-Parent</div>`
      }

      html += `<div style="
        padding:16px; 
        border:1px solid var(--border); 
        border-radius:var(--radius); 
        background:var(--surface);
        display:grid;
        grid-template-columns: 1fr 140px;
        gap:12px;
        align-items:start;
      ">
        <div>
          <div style="font-weight:600; font-size:16px;">${escapeHtml(name)}</div>
          <div style="font-size:13px; color:var(--text-secondary); margin-top:2px;">${escapeHtml(email)}</div>
          <div style="font-size:12px; color:var(--text-secondary); margin-top:6px;">Joined: ${createdAt}</div>
        </div>
        <div>${controls}</div>
      </div>`
    })
    gridEl.innerHTML = html
  } catch (error) {
    console.error('[TaskQuest] loadCoparents error:', error)
    const gridEl = document.getElementById('coparentsGrid')
    if (gridEl) gridEl.innerHTML = '<p>Error loading family.</p>'
  }
}

async function removeCoparent(parentId) {
  try {
    const owner = auth.currentUser
    if (!owner) { showNotification('Please sign in as a parent.', 'error'); return }
    
    const result = confirm('Remove this parent from the family?')
    if (!result) return

    const ownerDoc = await db.collection('users').doc(owner.uid).get()
    const familyCode = ownerDoc.exists ? (ownerDoc.data().familyCode || null) : null
    if (!familyCode) { showNotification('Your account has no family code.', 'error'); return }

    // Attempt the update
    await db.collection('users').doc(parentId).update({ familyCode: null, removedBy: owner.uid, removedAt: firebase.firestore.FieldValue.serverTimestamp() })
    showNotification('Parent removed from family.', 'success')
    setTimeout(() => { loadCoparents(); loadParentProfile() }, 300)
  } catch (error) {
    console.error('[TaskQuest] removeCoparent error:', error)
    const code = (error && error.code) || ''
    if (code === 'permission-denied') {
      showNotification('Permission denied. Ensure Firestore rules allow owner to remove parents.', 'error')
    } else {
      showNotification('Failed to remove parent: ' + (error.message || String(error)), 'error')
    }
  }
}

async function viewParentDetails(parentId) {
  try {
    const parentDoc = await db.collection('users').doc(parentId).get()
    if (!parentDoc.exists) {
      showNotification('Parent not found.', 'error')
      return
    }
    
    const data = parentDoc.data()
    const name = data.name || data.email?.split('@')[0] || 'Parent'
    const email = data.email || 'N/A'
    const createdAt = data.createdAt?.toDate ? new Date(data.createdAt.toDate()).toLocaleDateString() : 'Unknown'
    
    const modal = document.createElement('div')
    modal.className = 'modal'
    modal.style.display = 'block'
    const content = document.createElement('div')
    content.className = 'modal-content'
    content.style.maxWidth = '450px'
    content.innerHTML = `
      <span class="close">&times;</span>
      <h3>Parent Details</h3>
      <div style="margin-top:16px;">
        <div style="margin-bottom:12px;">
          <label style="font-size:12px; color:var(--text-secondary); text-transform:uppercase; font-weight:600;">Name</label>
          <div style="font-size:16px; margin-top:4px;">${escapeHtml(name)}</div>
        </div>
        <div style="margin-bottom:12px;">
          <label style="font-size:12px; color:var(--text-secondary); text-transform:uppercase; font-weight:600;">Email</label>
          <div style="font-size:16px; margin-top:4px;">${escapeHtml(email)}</div>
        </div>
        <div style="margin-bottom:12px;">
          <label style="font-size:12px; color:var(--text-secondary); text-transform:uppercase; font-weight:600;">Joined</label>
          <div style="font-size:16px; margin-top:4px;">${createdAt}</div>
        </div>
      </div>
    `
    modal.appendChild(content)
    document.body.appendChild(modal)
    content.querySelector('.close').addEventListener('click', () => { try { document.body.removeChild(modal) } catch(e){} })
    modal.addEventListener('click', (e) => { if (e.target === modal) { try { document.body.removeChild(modal) } catch(e){} } })
  } catch (error) {
    console.error('[TaskQuest] viewParentDetails error:', error)
    showNotification('Failed to load parent details.', 'error')
  }
}

// Setup real-time listener for tasks (auto-update when parent adds tasks)
function setupTasksListener() {
  if (!auth.currentUser) return
  const user = auth.currentUser
  let unsubscribe = null
  db.collection('users').doc(user.uid).get().then((doc) => {
    if (!doc.exists) return
    const familyCode = doc.data().familyCode
    if (!familyCode) return

    unsubscribe = db
      .collection('taskTemplates')
      .where('familyCode', '==', familyCode)
      .onSnapshot((snapshot) => {
        console.log('[TaskQuest] Tasks updated - reloading...')
        loadAvailableTasks()
      }, (error) => {
        if (error && error.code === 'permission-denied') {
          console.debug('[TaskQuest] Tasks listener permission denied')
        } else {
          console.warn('[TaskQuest] Tasks listener error:', error)
        }
      })
  }).catch((err) => {
    console.warn('[TaskQuest] Failed to attach tasks listener:', err)
  })

  return () => { try { if (unsubscribe) unsubscribe() } catch(e){} }
}

// Setup real-time listener for rewards (auto-update when parent adds rewards)
function setupRewardsListener() {
  if (!auth.currentUser) return
  const user = auth.currentUser
  let unsubscribe = null
  db.collection('users').doc(user.uid).get().then((doc) => {
    if (!doc.exists) return
    const familyCode = doc.data().familyCode
    if (!familyCode) return

    unsubscribe = db
      .collection('rewards')
      .where('familyCode', '==', familyCode)
      .onSnapshot((snapshot) => {
        console.log('[TaskQuest] Rewards updated - reloading...')
        loadRewards()
      }, (error) => {
        if (error && error.code === 'permission-denied') {
          console.debug('[TaskQuest] Rewards listener permission denied')
        } else {
          console.warn('[TaskQuest] Rewards listener error:', error)
        }
      })
  }).catch((err) => {
    console.warn('[TaskQuest] Failed to attach rewards listener:', err)
  })

  return () => { try { if (unsubscribe) unsubscribe() } catch(e){} }
}

// Setup real-time listener for submissions (auto-update when parent approves/declines)
function setupSubmissionsListener() {
  if (!auth.currentUser) return
  const user = auth.currentUser
  let unsubscribe = null
  db.collection('users').doc(user.uid).get().then((doc) => {
    if (!doc.exists) return
    const familyCode = doc.data().familyCode
    if (!familyCode) return

    unsubscribe = db
      .collection('submissions')
      .where('familyCode', '==', familyCode)
      .onSnapshot((snapshot) => {
        console.log('[TaskQuest] Submissions updated - reloading...')
        loadAvailableTasks()
        loadActivityHistory()
      }, (error) => {
        if (error && error.code === 'permission-denied') {
          console.debug('[TaskQuest] Submissions listener permission denied')
        } else {
          console.warn('[TaskQuest] Submissions listener error:', error)
        }
      })
  }).catch((err) => {
    console.warn('[TaskQuest] Failed to attach submissions listener:', err)
  })

  return () => { try { if (unsubscribe) unsubscribe() } catch(e){} }
}

// Get user's family code
function getUserFamilyCode() {
  if (!auth.currentUser) return null
  const userDoc = db.collection("users").doc(auth.currentUser.uid)
  // This will fetch from memory if already loaded, or you can cache it
  // Try to return familyCode from a cached userData object if present
  try {
    // If we previously loaded the user's doc into `loadedUserData`, prefer that.
    if (window.loadedUserData && window.loadedUserData.familyCode) return window.loadedUserData.familyCode
  } catch (e) {}
  return null // Will be set when user data is loaded elsewhere
}

// Setup listeners for pending family requests (parent side)
function setupFamilyRequestsListener() {
  if (!auth.currentUser) return
  const user = auth.currentUser
  // Fetch parent's familyCode and listen for requests matching it OR requests with parentId set
  let unsubscribeCode = null
  let unsubscribeParentId = null

  db.collection('users').doc(user.uid).get().then((doc) => {
    if (!doc.exists) return
    const data = doc.data()
    const familyCode = data.familyCode

    // Listen for requests that used the familyCode
    if (familyCode) {
        unsubscribeCode = db
          .collection('familyRequests')
          .where('familyCode', '==', familyCode)
          .where('status', '==', 'pending')
          .onSnapshot(
            (snapshot) => {
              console.log('[TaskQuest] familyCode-based familyRequests update - reloading...')
              loadPendingFamilyRequests()
            },
            (error) => {
              if (error && error.code === 'permission-denied') {
                console.debug('[TaskQuest] familyCode listener permission denied')
              } else {
                console.warn('[TaskQuest] familyCode listener error:', error)
              }
            }
          )
    }

    // Also listen for requests that explicitly set parentId to this parent (legacy/fallback)
    try {
      unsubscribeParentId = db
        .collection('familyRequests')
        .where('parentId', '==', user.uid)
        .where('status', '==', 'pending')
        .onSnapshot(
          (snapshot) => {
            console.log('[TaskQuest] parentId-based familyRequests update - reloading...')
            loadPendingFamilyRequests()
          },
          (error) => {
            if (error && error.code === 'permission-denied') {
              // Rules may forbid parentId reads — suppress noisy logs
              console.debug('[TaskQuest] parentId listener permission denied')
            } else {
              console.warn('[TaskQuest] parentId listener error:', error)
            }
          }
        )
    } catch (e) {
      // Some security rules can throw when trying to construct the listener
      console.debug('[TaskQuest] parentId listener could not be attached (likely rules):', e && e.code ? e.code : e)
    }
  }).catch((err) => {
    console.warn('[TaskQuest] Failed to attach familyRequests listeners:', err)
  })

  return () => {
    try { if (unsubscribeCode) unsubscribeCode() } catch (e) {}
    try { if (unsubscribeParentId) unsubscribeParentId() } catch (e) {}
  }
}

// Real-time listener for children in the parent's family (when children update their user doc)
function setupChildrenListener() {
  if (!auth.currentUser) return () => {}
  const user = auth.currentUser
  let unsubscribe = null

  db.collection('users').doc(user.uid).get().then((doc) => {
    if (!doc.exists) return
    const familyCode = doc.data().familyCode
    if (!familyCode) return

    // Listen for updates to child accounts that match this family code
    unsubscribe = db
      .collection('users')
      .where('familyCode', '==', familyCode)
      .where('role', '==', 'child')
      .onSnapshot(
        (snapshot) => {
          console.log('[TaskQuest] Children collection update - reloading children list...')
          loadChildren()
        },
        (error) => {
          if (error && error.code === 'permission-denied') {
            console.debug('[TaskQuest] Children listener permission denied')
          } else {
            console.warn('[TaskQuest] Children listener error:', error)
          }
        }
      )
  }).catch((err) => {
    console.warn('[TaskQuest] Failed to attach children listener:', err)
  })

  return () => {
    if (unsubscribe) {
      try { unsubscribe() } catch (e) {}
    }
  }
}

// Real-time listener for parents in the family so Family list updates instantly
function setupParentsListener() {
  if (!auth.currentUser) return () => {}
  const user = auth.currentUser
  let unsubscribe = null

  db.collection('users').doc(user.uid).get().then((doc) => {
    if (!doc.exists) return
    const familyCode = doc.data().familyCode
    if (!familyCode) return

    unsubscribe = db
      .collection('users')
      .where('familyCode', '==', familyCode)
      .where('role', '==', 'parent')
      .onSnapshot((snapshot) => {
        try { window.__cache = window.__cache || {} } catch(e) {}
        const count = snapshot.size
        const prev = window.__cache.parentsCount || 0
        window.__cache.parentsCount = count
        // Reload Family list
        loadCoparents()
        // Notify only when the number increases (new parent)
        if (count > prev && prev !== 0) {
          showNotification('A new parent joined your family.', 'success')
        }
      }, (error) => {
        if (error && error.code === 'permission-denied') {
          console.debug('[TaskQuest] Parents listener permission denied')
        } else {
          console.warn('[TaskQuest] Parents listener error:', error)
        }
      })
  }).catch((err) => {
    console.warn('[TaskQuest] Failed to attach parents listener:', err)
  })

  return () => { try { if (unsubscribe) unsubscribe() } catch(e){} }
}

// Load pending family requests for parent
async function loadPendingFamilyRequests() {
  try {
    const user = auth.currentUser
    if (!user) return
    // Get parent's family code first
    const parentDoc = await db.collection("users").doc(user.uid).get()
    if (!parentDoc.exists) return
    const parentFamilyCode = parentDoc.data().familyCode

    // We'll query both by familyCode (if available) and by parentId (fallback), then merge results
    const requestsMap = new Map()

    if (parentFamilyCode) {
      try {
        const snapshotCode = await db
          .collection('familyRequests')
          .where('familyCode', '==', parentFamilyCode)
          .where('status', '==', 'pending')
          .get()
        snapshotCode.forEach((d) => requestsMap.set(d.id, d))
      } catch (e) {
        if (e && e.code === 'permission-denied') console.debug('[TaskQuest] familyCode query permission denied')
        else console.warn('[TaskQuest] familyCode query failed:', e)
      }
    }

    // Always check requests that explicitly set parentId to this user (legacy/fallback)
    try {
      const snapshotParent = await db
        .collection('familyRequests')
        .where('parentId', '==', user.uid)
        .where('status', '==', 'pending')
        .get()
      snapshotParent.forEach((d) => requestsMap.set(d.id, d))
    } catch (e) {
      if (e && e.code === 'permission-denied') console.debug('[TaskQuest] parentId query permission denied')
      else console.warn('[TaskQuest] parentId query failed:', e)
    }

    const container = document.getElementById('pendingFamilyRequests')
    if (!container) return

    if (requestsMap.size === 0) {
      container.innerHTML = '<div class="empty-state"><p>No pending family requests</p></div>'
      return
    }

    container.innerHTML = ''

    for (const [id, doc] of requestsMap.entries()) {
      const req = doc.data()
      const requestId = id

      const isGuardian = req.roleRequested === 'parent'
      let displayName = isGuardian ? (req.requesterName || 'Guardian Request') : (req.childName || 'Child')
      // Append role label in parentheses for clarity
      try { displayName = `${displayName} (${isGuardian ? 'parent' : 'child'})` } catch(e) {}
      const displayEmail = isGuardian ? (req.requesterEmail || '') : (req.childEmail || '')
      const requesterId = isGuardian ? req.requesterId : req.childId

      const card = document.createElement('div')
      card.className = 'family-request-card'
      const createdAt = req.createdAt ? (req.createdAt.toDate ? req.createdAt.toDate() : new Date(req.createdAt)) : null
      const timeAgo = createdAt ? getTimeAgo(createdAt) : 'Just now'
      card.innerHTML = `
        <div class="request-header">
          <h4>${displayName} <span class="request-badge">${isGuardian ? 'Guardian' : 'Child'}</span></h4>
          <small>${displayEmail}</small>
        </div>
        <div class="request-body">
          <p><strong>ID:</strong> ${requesterId}</p>
          <p><strong>Family Code:</strong> ${req.familyCode || '—'}</p>
          <p><strong>Submitted:</strong> ${timeAgo}</p>
        </div>
        <div class="request-actions">
          <button class="btn-approve" onclick="approveFamilyRequest('${requestId}', '${requesterId}', '${req.familyCode}', '${req.roleRequested || 'child'}')">
            ✓ Approve
          </button>
          <button class="btn-decline" onclick="declineFamilyRequest('${requestId}')">
            ✗ Decline
          </button>
        </div>
      `
      container.appendChild(card)
    }
  } catch (error) {
    console.error("[TaskQuest] Load pending requests error:", error)
  }
}

// Approve a family request
async function approveFamilyRequest(requestId, requesterId, familyCode, roleRequested = 'child') {
  try {
    console.log('[TaskQuest] Parent approving request:', { requestId, requesterId, familyCode, roleRequested })
    
    // 1. Mark the request as approved
    await db.collection('familyRequests').doc(requestId).update({
      status: 'approved',
      roleResponded: roleRequested,
      approvedBy: auth.currentUser ? auth.currentUser.uid : null,
      respondedAt: firebase.firestore.FieldValue.serverTimestamp()
    })
    console.log('[TaskQuest] Request marked as approved in Firestore')

    // 2. Get the requester's current name
    let requesterName = 'Child'
    try {
      const requesterDoc = await db.collection('users').doc(requesterId).get()
      if (requesterDoc.exists) {
        requesterName = requesterDoc.data().name || 'Child'
      }
    } catch (e) {
      console.warn('[TaskQuest] Could not fetch requester name:', e)
    }

    // 3. Directly update the requester's user doc to set familyCode and displayName
    // This is allowed by rules because parent can update child profiles in same family
    const roleLabel = (roleRequested === 'parent') ? 'parent' : 'child'
    const displayNameFormatted = `${requesterName} (${roleLabel})`
    
    const childUpdates = { familyCode: familyCode, displayName: displayNameFormatted }
    if (roleRequested === 'parent') {
      childUpdates.role = 'parent'
    }
    
    console.log('[TaskQuest] Parent directly updating requester doc:', childUpdates)
    await db.collection('users').doc(requesterId).update(childUpdates)
    console.log('[TaskQuest] Requester doc updated by parent')

    showNotification('Request approved. Child linked to family!', 'success')
    loadPendingFamilyRequests()
    
    // Refresh children list immediately
    setTimeout(() => {
      console.log('[TaskQuest] Parent calling loadChildren() after approval')
      loadChildren()
    }, 500)
  } catch (error) {
    console.error('[TaskQuest] Approve request error:', error)
    showNotification('Failed to approve request: ' + (error.message || String(error)), 'error')
  }
}

// Decline a family request
async function declineFamilyRequest(requestId) {
  try {
    // Mark request as declined
    await db.collection("familyRequests").doc(requestId).update({
      status: "declined",
      respondedAt: firebase.firestore.FieldValue.serverTimestamp()
    })

    showNotification("Request declined", "success")
    loadPendingFamilyRequests()
    // Refresh children list in case the decline affects the UI
    setTimeout(() => {
      loadChildren()
    }, 500)
  } catch (error) {
    console.error("[TaskQuest] Decline request error:", error)
    showNotification("Failed to decline request: " + error.message, "error")
  }
}

// Debug helper: fetch and log raw pending requests (familyCode + parentId queries)
async function showRawPendingRequests() {
  try {
    const user = auth.currentUser
    if (!user) {
      console.warn('[TaskQuest] showRawPendingRequests: not signed in')
      return
    }

    const parentDoc = await db.collection('users').doc(user.uid).get()
    if (!parentDoc.exists) {
      console.warn('[TaskQuest] showRawPendingRequests: parent doc missing')
      return
    }
    const familyCode = parentDoc.data().familyCode

    const results = { byFamilyCode: [], byParentId: [] }

    if (familyCode) {
      try {
        const snap = await db.collection('familyRequests').where('familyCode', '==', familyCode).where('status', '==', 'pending').get()
        snap.forEach(d => results.byFamilyCode.push({ id: d.id, data: d.data() }))
      } catch (e) {
        if (e && e.code === 'permission-denied') console.debug('[TaskQuest] showRawPendingRequests familyCode permission denied')
        else console.warn('[TaskQuest] showRawPendingRequests familyCode query failed:', e)
      }
    }

    try {
      const snap2 = await db.collection('familyRequests').where('parentId', '==', user.uid).where('status', '==', 'pending').get()
      snap2.forEach(d => results.byParentId.push({ id: d.id, data: d.data() }))
    } catch (e) {
      if (e && e.code === 'permission-denied') console.debug('[TaskQuest] showRawPendingRequests parentId permission denied')
      else console.warn('[TaskQuest] showRawPendingRequests parentId query failed:', e)
    }

    console.log('[TaskQuest] Raw pending requests:', results)

    const container = document.getElementById('pendingFamilyRequests')
    if (!container) return

    const pre = document.createElement('pre')
    pre.style.maxHeight = '240px'
    pre.style.overflow = 'auto'
    pre.textContent = JSON.stringify(results, null, 2)

    // Insert at top for visibility
    container.insertBefore(pre, container.firstChild)
  } catch (error) {
    console.error('[TaskQuest] showRawPendingRequests error:', error)
    showNotification('Failed to fetch raw requests: ' + (error.message || String(error)), 'error')
  }
}

console.log("[TaskQuest] Application initialized - Ready for use")