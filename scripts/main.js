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
    console.log('[TaskQuest] getBasePath() - returning:', basePath)
    return basePath
  }
  
  console.log('[TaskQuest] getBasePath() - no parts, returning empty string')
  return ''
}

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

  const toast = document.createElement('div')
  const bgColor = type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : type === 'warning' ? '#ff9800' : '#2196F3'
  const borderColor = type === 'success' ? '#45a049' : type === 'error' ? '#da190b' : type === 'warning' ? '#e68900' : '#0b7dda'
  
  toast.style.cssText = `
    background-color: ${bgColor};
    color: white;
    padding: 16px 24px;
    border-radius: 4px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    font-size: 14px;
    font-weight: 500;
    min-width: 300px;
    border-left: 4px solid ${borderColor};
    animation: slideIn 0.3s ease-out;
    pointer-events: auto;
    cursor: pointer;
  `
  toast.textContent = message
  
  container.appendChild(toast)
  
  const dismissTimer = setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease-out'
    setTimeout(() => toast.remove(), 300)
  }, duration)
  
  toast.addEventListener('click', () => {
    clearTimeout(dismissTimer)
    toast.style.animation = 'slideOut 0.3s ease-out'
    setTimeout(() => toast.remove(), 300)
  })
}

// Add CSS animations
if (!document.getElementById('toastStyles')) {
  const style = document.createElement('style')
  style.id = 'toastStyles'
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(400px); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(400px); opacity: 0; }
    }
  `
  document.head.appendChild(style)
}

function navigateTo(page) {
  const base = getBasePath()
  window.location.href = base + '/' + page
}

// ==========================================
// SESSION & AUTH STATE MANAGEMENT
// ==========================================

// Set up auth state persistence listener
if (auth) {
  auth.onAuthStateChanged((user) => {
    // Check if this tab was explicitly logged out
    if (sessionStorage.getItem('loggedOut') === 'true') {
      return // Don't restore session for this tab
    }
    
    // If user is logged in and we're on the login page, redirect
    if (user && window.location.pathname.includes('index.html')) {
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
    if (!user && (window.location.pathname.includes('parent-dashboard') || window.location.pathname.includes('child-dashboard'))) {
      console.log('[TaskQuest] User not logged in, redirecting to login...')
      sessionStorage.removeItem('loggedOut')
      navigateTo('index.html')
    }
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
      navigateTo("child-dashboard.html")
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
    const passcode = prompt("Create a 6-digit PASSCODE for additional security (only you should know this):")

    if (!passcode || passcode.length !== 6 || isNaN(passcode)) {
      showNotification("Invalid passcode. Please use exactly 6 digits.", "error")
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
          showNotification('Photos uploaded to Cloudinary (fallback).', 'success')
        } else {
          throw new Error('CloudinaryNotConfigured')
        }
      } catch (cloudinaryErr) {
        console.warn('[TaskQuest] Cloudinary upload failed, using Firestore data-url fallback:', cloudinaryErr)
        // Tier 3: Fallback to data URLs (resized)
        try {
          beforeDataUrl = await fileToDataUrlAndResize(uploadedPhotos.before, 1200, 900, 0.7)
          showNotification('Using local data-URL fallback for before photo.', 'warning')
        } catch (e) {
          console.warn('Failed to convert before photo to dataURL:', e)
        }
        try {
          afterDataUrl = await fileToDataUrlAndResize(uploadedPhotos.after, 1200, 900, 0.7)
          showNotification('Using local data-URL fallback for after photo.', 'warning')
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
      await db.collection("submissions").doc(currentTaskInfo.inProgressSubmissionId).update({
        ...submissionData,
        taskId: currentTaskInfo.id,
        taskTitle: currentTaskInfo.title,
      })
      console.log('[TaskQuest] Updated in-progress submission with photos and confirmed taskId:', currentTaskInfo.id)
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

    // Show success toast and close modal
    showToast("Submitted successfully!", "success", 5000)
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
      loadChildPoints()
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
  if (!confirm("Are you sure you want to reset this child's points to 0?")) return

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

// ==========================================
// MODAL FUNCTIONS
// ==========================================

function showLoginForm(type) {
  currentUserType = type
  currentAuthMode = "login"

  const modal = document.getElementById("loginModal")
  modal.style.display = "block"

  document.getElementById("formTitle").textContent = type === "child" ? "Child Login" : "Parent Login"
  document.getElementById("submitBtn").textContent = "Login"
  document.getElementById("nameGroup").style.display = "none"
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
    const googleProvider = new firebase.auth.GoogleAuthProvider()
    googleProvider.addScope('profile')
    googleProvider.addScope('email')
    
    const result = await auth.signInWithPopup(googleProvider)
    const user = result.user
    const userDoc = await db.collection("users").doc(user.uid).get()
    
    if (userDoc.exists) {
      // User already exists - check role and redirect
      const userData = userDoc.data()
      if (userData.role === "parent") {
        showNotification("Welcome back, Parent!", "success")
        showParentPinVerification()
      } else if (userData.role === "child") {
        showNotification("Welcome back!", "success")
        navigateTo("child-dashboard.html")
      }
    } else {
      // New user - need to determine role and complete profile
      showGoogleRoleSelection(user)
    }
  } catch (error) {
    console.error("[TaskQuest] Google Sign-In error:", error)
    if (error.code === 'auth/popup-closed-by-user') {
      showNotification("Sign-in cancelled", "error")
    } else if (error.code === 'auth/popup-blocked') {
      showNotification("Please allow popups for Google Sign-In", "error")
    } else {
      showNotification("Google Sign-In failed: " + error.message, "error")
    }
  }
}

function showGoogleRoleSelection(googleUser) {
  // Create a modal to select role for new Google users
  const modal = document.getElementById("loginModal")
  const modalContent = modal.querySelector(".modal-content")
  const originalContent = modalContent.innerHTML
  
  modalContent.innerHTML = `
    <span class="close" onclick="closeLoginModal()">&times;</span>
    <h2>Welcome to TaskQuest!</h2>
    <p style="color: var(--text-secondary); margin: 20px 0;">Are you a Parent or a Child?</p>
    <div style="display: flex; gap: 16px; flex-direction: column;">
      <button type="button" class="login-btn parent-login" onclick="completeGoogleSignup('${googleUser.uid}', '${googleUser.displayName || googleUser.email}', 'parent', '${originalContent}')">
        <span class="btn-icon">👨‍👩‍👧‍👦</span>
        <span class="btn-text">I'm a Parent</span>
      </button>
      <button type="button" class="login-btn child-login" onclick="completeGoogleSignup('${googleUser.uid}', '${googleUser.displayName || googleUser.email}', 'child', '${originalContent}')">
        <span class="btn-icon">🎮</span>
        <span class="btn-text">I'm a Child</span>
      </button>
    </div>
  `
}

async function completeGoogleSignup(uid, displayName, role, originalContent) {
  try {
    if (role === "parent") {
      // Parent needs to create a family code
      const passcode = prompt("Create a 6-digit PASSCODE for additional security (only you should know this):")
      
      if (!passcode || passcode.length !== 6 || isNaN(passcode)) {
        showNotification("Invalid passcode. Please use exactly 6 digits.", "error")
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
      showParentPinVerification()
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
      navigateTo("child-dashboard.html")
    }
  } catch (error) {
    console.error("[TaskQuest] Google signup completion error:", error)
    showNotification("Signup failed: " + error.message, "error")
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

document.addEventListener("DOMContentLoaded", () => {
  console.log("[TaskQuest] DOM loaded, initializing page...")

  // No demo seeding — app runs against Firebase only.

  // Check if user is authenticated
  auth.onAuthStateChanged((user) => {
    if (user) {
      const currentPage = window.location.pathname.split("/").pop()

      if (currentPage === "child-dashboard.html") {
        loadChildPoints()
        loadAvailableTasks()
        loadRewards()
        loadChildProfile()
        initializeSectionVisibility()
      } else if (currentPage === "parent-dashboard.html") {
        loadPendingApprovals()
        loadOngoingTasks()
        loadChildren()
        loadParentTasks()
        loadParentRewards()
        initializeSectionVisibility()
        displayFamilyCode()
      }
    } else {
      // User not logged in, redirect to index if not already there
      const currentPage = window.location.pathname.split("/").pop()
      if (currentPage !== "index.html" && currentPage !== "") {
        navigateTo("index.html")
      }
    }
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
      loadChildProfile()
      break
    case "approvals":
      const approvalsSection = document.getElementById("approvals-section")
      if (approvalsSection) approvalsSection.style.display = "block"
      loadPendingApprovals()
      loadOngoingTasks()
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
  const passcode = prompt("Enter your 6-digit parent PASSCODE to access the dashboard:")

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

async function loadChildPoints() {
  try {
    const user = auth.currentUser
    if (!user) return

    const userDoc = await db.collection("users").doc(user.uid).get()
    if (userDoc.exists) {
      const points = userDoc.data().points || 0
      const pointsValue = document.querySelector(".points-value")
      if (pointsValue) {
        pointsValue.textContent = points
      }
    }
  } catch (error) {
    console.error("[TaskQuest] Load points error:", error)
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

    const tasksSnapshot = await db.collection("taskTemplates").where("familyCode", "==", familyCode).get()

    if (tasksSnapshot.empty) {
      tasksGrid.innerHTML = "<p>No tasks available yet. Ask your parent to create tasks!</p>"
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

    const approvedTaskIds = new Set()
    approvedSnapshot.forEach((doc) => {
      approvedTaskIds.add(doc.data().taskId)
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

    tasksGrid.innerHTML = ""

    tasksSnapshot.forEach((doc) => {
      const task = doc.data()
      const taskId = doc.id
      const isInProgress = inProgressTaskIds.has(taskId)
      const isApproved = approvedTaskIds.has(taskId)
      const isDeclined = declinedTaskIds.has(taskId)
      const inProgressByOther = inProgressByOthers[taskId]

      // Skip tasks that this child has already completed and approved
      if (isApproved) return

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

    if (rewardsSnapshot.empty) {
      rewardsGrid.innerHTML = "<p>No rewards available yet. Ask your parent to add rewards!</p>"
      return
    }

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

    if (submissionsSnapshot.empty) {
      grid.innerHTML = "<p>No pending tasks to review. Great job keeping up with approvals! ✅</p>"
      return
    }

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

    if (submissionsSnapshot.empty) {
      grid.innerHTML = "<p>No on-going tasks at the moment. 😴</p>"
      return
    }

    grid.innerHTML = ""

    for (const doc of submissionsSnapshot.docs) {
      const submission = doc.data()

      // Defensive check
      if (!submission.userId) continue
      if (!submission.taskId) continue

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
      taskCard.innerHTML = `
        <div class="task-header">
          <h3>⏳ ${task.title}</h3>
          <span class="points-badge">+${task.points} pts</span>
        </div>
        <div class="child-info">
          <span class="child-name">👤 ${childName}</span>
          <span class="submission-time">Started ${timestamp}</span>
        </div>
        <div class="status-message">
          <p>Your child is currently working on this task. They'll submit photos for review when they're done.</p>
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

async function loadChildren() {
  try {
    const childrenGrid = document.getElementById("childrenGrid")
    if (!childrenGrid) return

    const user = auth.currentUser
    const familyCode = await getFamilyCodeForUser(user)
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

    if (childrenSnapshot.empty) {
      childrenGrid.innerHTML = `
        <div class="empty-state">
          <p>No children in your family yet.</p>
          <p class="family-code-hint">Share your Family Code: <strong>${familyCode}</strong> with your children to get started!</p>
        </div>
      `
      return
    }

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
        <h3>${child.name}</h3>
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
  const points = prompt("How many bonus points would you like to add?")

  if (!points || isNaN(points) || Number(points) <= 0) {
    showNotification("Invalid points amount", "error")
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

  const currentPasscode = prompt("Enter your current 6-digit passcode:")
  if (!currentPasscode) return

  try {
    const userDoc = await db.collection("users").doc(user.uid).get()
    const storedPasscode = userDoc.data().passcode

    if (currentPasscode !== storedPasscode) {
      showNotification("Incorrect current passcode", "error")
      return
    }

    const newPasscode = prompt("Enter your new 6-digit passcode:")
    if (!newPasscode || newPasscode.length !== 6 || isNaN(newPasscode)) {
      showNotification("Invalid passcode. Please use exactly 6 digits.", "error")
      return
    }

    const confirmPasscode = prompt("Confirm your new 6-digit passcode:")
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

    if (tasksSnapshot.empty) {
      tasksGrid.innerHTML = "<p>No tasks created yet. Click 'Create New Task' to add one.</p>"
      return
    }

    tasksGrid.innerHTML = ""

    tasksSnapshot.forEach((doc) => {
      const task = doc.data()
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
    })
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
          // Child is linked — show parent info if available
          codeInput.style.display = "none"
          linkedInfo.textContent = `Linked to family: ${userData.familyCode}`

          // Try to get parent name (with fallback if permissions deny)
          try {
            const parentSnap = await db.collection("users").where("familyCode", "==", userData.familyCode).where("role", "==", "parent").limit(1).get()
            if (!parentSnap.empty) {
              const p = parentSnap.docs[0].data()
              linkedInfo.textContent = `Linked to ${p.name} (Family ${userData.familyCode})`
            }
          } catch (err) {
            // If permission error, just show family code (app will still work)
            if (err.message && err.message.includes("Missing or insufficient permissions")) {
              console.warn("[TaskQuest] Note: Firestore rules not yet published. Parent name not available.")
              linkedInfo.textContent = `Linked to family: ${userData.familyCode}`
            } else {
              console.warn("Could not fetch parent info:", err)
            }
          }
        } else {
          // Not linked — prompt for code
          codeInput.style.display = "inline-block"
          linkedInfo.textContent = "Not linked to a family yet."
        }
      }
    } catch (uiErr) {
      console.warn("Child profile family UI update failed:", uiErr)
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

    // Process submissions
    for (const doc of submissionsSnapshot.docs) {
      const submission = doc.data()
      // Defensive: some submissions may not have taskId (older/partial docs)
      let taskName = submission.taskTitle || "Unknown Task"
      let points = 0
      if (submission.taskId) {
        try {
          const taskDoc = await db.collection("taskTemplates").doc(submission.taskId).get()
          if (taskDoc.exists) {
            taskName = taskDoc.data().title || taskName
            points = taskDoc.data().points || 0
          }
        } catch (e) {
          console.warn('[TaskQuest] Failed to load task template for activity history:', e)
          // don't throw — show the submission using fallback data
        }
      } else {
        console.warn('[TaskQuest] Submission missing taskId, using fallback title:', doc.id)
      }

      activities.push({
        type: submission.status,
        title: taskName,
        time: submission.submittedAt?.toDate() || new Date(),
        points: points,
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

    activityList.innerHTML = ""

    activities.forEach((activity) => {
      const activityItem = document.createElement("div")
      const timeAgo = getTimeAgo(activity.time)

      if (activity.type === "approved") {
        activityItem.className = "activity-item completed"
        activityItem.innerHTML = `
          <div class="activity-icon">✅</div>
          <div class="activity-details">
            <h4>${activity.title}</h4>
            <span class="activity-time">${timeAgo}</span>
          </div>
          <span class="activity-points">+${activity.points} pts</span>
        `
      } else if (activity.type === "pending") {
        activityItem.className = "activity-item pending"
        activityItem.innerHTML = `
          <div class="activity-icon">⏳</div>
          <div class="activity-details">
            <h4>${activity.title}</h4>
            <span class="activity-time">${timeAgo}</span>
          </div>
          <span class="activity-status">Pending</span>
        `
      } else if (activity.type === "declined") {
        activityItem.className = "activity-item declined"
        activityItem.innerHTML = `
          <div class="activity-icon">❌</div>
          <div class="activity-details">
            <h4>${activity.title}</h4>
            <span class="activity-time">${timeAgo}</span>
          </div>
          <span class="activity-status">Try again</span>
        `
      } else if (activity.type === "redeemed") {
        activityItem.className = "activity-item reward"
        activityItem.innerHTML = `
          <div class="activity-icon">🎁</div>
          <div class="activity-details">
            <h4>${activity.title}</h4>
            <span class="activity-time">${timeAgo}</span>
          </div>
          <span class="activity-cost">-${activity.cost} pts</span>
        `
      }

      activityList.appendChild(activityItem)
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

    // Directly set the familyCode on the child's user doc.
    // We avoid querying other users (that can trigger permission errors).
    await db.collection("users").doc(user.uid).update({ familyCode: code })
    showNotification("Successfully linked to parent! Tasks will appear shortly.", "success")

    // Refresh child-specific views
    setTimeout(() => {
      loadChildProfile()
      loadAvailableTasks()
      loadRewards()
    }, 800)
  } catch (error) {
    console.error("[TaskQuest] setFamilyCodeForChild error:", error)
    await handleFirestoreError(error, document.getElementById("childFamilyLinkCard"))
  }
}

console.log("[TaskQuest] Application initialized - Ready for use")