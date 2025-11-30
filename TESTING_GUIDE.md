# TaskQuest - Testing Guide for Bug Fixes & UI Improvements

## Quick Test Scenarios

### 🔴 Test 1: Declined Task Button Reset
**What to test**: When a parent declines a task, the child's "Finish Task" button resets to "Start Task"

**Steps**:
1. Login as child, start a task (button changes to "⏳ Finish Task")
2. Open parent dashboard in another window
3. Parent approves or declines the task
4. Child refreshes the page or navigates away and back to tasks
5. **Expected**: If declined, the button should now show "Start Task" instead of "Finish Task"

---

### 🟠 Test 2: In-Progress Tasks on Parent Dashboard
**What to test**: Parent sees in-progress tasks in the Approvals section

**Steps**:
1. Login as parent
2. Login as child in another window/tab
3. Child clicks "Start Task" on any task
4. Parent clicks on "Approvals" tab (should be active by default)
5. **Expected**: Parent sees both:
   - "Pending Verification 📸" section with tasks waiting approval
   - "In Progress 🏃" section showing child's in-progress task with child's name and "Started X minutes ago"

---

### 🟡 Test 3: Activity History Doesn't Crash
**What to test**: Activity history loads without "empty path" errors

**Steps**:
1. Login as child
2. Click on "Profile" tab
3. Scroll down to "Activity History"
4. **Expected**: Displays past approved/declined/pending tasks and redeemed rewards without errors
5. **Check DevTools Console**: No errors about "Function CollectionReference.doc() cannot be called with an empty path"

---

### 🟢 Test 4: Parent Dashboard Navigation
**What to test**: New simplified 3-tab navigation works smoothly

**Steps**:
1. Login as parent
2. Click "Approvals" tab → should show pending & in-progress tasks
3. Click "Manage" tab → should show Tasks, Rewards, and Children Profiles as subsections
4. Click "Settings" tab → should show 2 cards: "Change Passcode" and "Family Code"
5. **Expected**: All sections load without flickering or content disappearing

---

### 🔵 Test 5: UI Stability (Cards Don't Disappear)
**What to test**: Cards remain visible and don't flicker on scroll/navigation

**Steps**:
1. Login as parent
2. Navigate through Approvals → Manage → Settings tabs quickly
3. Scroll through long lists (e.g., many tasks, many children)
4. **Expected**: No flickering, no disappearing elements, smooth transitions

---

### 💜 Test 6: Responsive Design
**What to test**: UI looks good on mobile/tablet/desktop

**Steps**:
1. On desktop: Open DevTools (F12) and toggle device toolbar
2. Test on iPhone 12 (375px), iPad (768px), Desktop (1200px+)
3. Navigate through all sections
4. **Expected**: 
   - Cards stack properly on mobile
   - Text is readable
   - Buttons are clickable (no overlap)
   - Settings cards display side-by-side on desktop, stacked on mobile

---

## Firestore Rule Publication (Required for Production)

**Current Status**: Firestore rules are prepared in `FIRESTORE_RULES_FINAL.txt` but need to be published.

**To Enable**:
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your "taskquest-ef595" project
3. Click "Firestore Database" → "Rules" tab
4. Paste content from `FIRESTORE_RULES_FINAL.txt`
5. Click "Publish"
6. **After publishing**: Permission errors in console should disappear

---

## Common Issues & Solutions

### Issue: "Missing or insufficient permissions" error
- **Cause**: Firestore rules not published
- **Fix**: Publish rules from `FIRESTORE_RULES_FINAL.txt` (see above)

### Issue: "requires an index" error
- **Cause**: Firestore composite index not created for complex queries
- **Fix**: Error message includes a link. Click it or check `FIRESTORE_INDEXES.md`

### Issue: CORS error on image uploads
- **Cause**: Firebase Storage CORS not configured
- **Status**: Already handled - app falls back to Cloudinary or client-side data-URL
- **Fix**: No action needed if photos are uploading (check DevTools Network tab)

### Issue: Parent doesn't see in-progress tasks
- **Cause**: `loadOngoingTasks()` not being called on navigation
- **Fix**: Should auto-load when you click "Approvals" tab
- **Debug**: Check DevTools Console for errors

---

## Success Indicators ✅

- [ ] Declined tasks reset to "Start Task"
- [ ] Parent sees in-progress tasks with child names
- [ ] Activity history loads without crashes
- [ ] Navigation between tabs is smooth
- [ ] Settings section displays properly
- [ ] Cards don't disappear or flicker
- [ ] No console errors about paths or permissions

---

## Rollback Instructions (If Needed)

All changes are in:
- `scripts/main.js` (bug fixes + navigation updates)
- `parent-dashboard.html` (simplified navigation)
- `styles/main.css` (subsection + settings styling)

To revert: Use your git history or replace these files with backup versions.

---

**Questions?** Check the `CHANGES_SUMMARY.md` file for detailed technical changes.
