# Firestore Composite Indexes Required

Your app needs these composite indexes created in Firebase Console. When you see "The query requires an index" errors, the console will provide a direct link—click it and create the index. Here's what each query needs:

## Index 1: Activity History (Redeemed Rewards)
**Collection:** `redeemedRewards`  
**Fields:**
- `userId` (Ascending)
- `redeemedAt` (Descending)

**Used by:** `loadActivityHistory()` function in child profile

**Create it directly:** https://console.firebase.google.com/v1/r/project/taskquest-ef595/firestore/indexes?create_composite=Cldwcm9qZWN0cy90YXNrcXVlc3QtZWY1OTUvZGF0YWJhc2VzLyhkZWZhdWx0KS9jb2xsZWN0aW9uR3JvdXBzL3JlZGVlbWVkUmV3YXJkcy9pbmRleGVzL18QARoKCgZ1c2VySWQQARoOCgpyZWRlZW1lZEF0EAIaDAoIX19uYW1lX18QAg

Or manually:
1. Go to Firebase Console → Firestore Database → Indexes
2. Click "Create Index"
3. Collection: `redeemedRewards`
4. Add field `userId` (Ascending)
5. Add field `redeemedAt` (Descending)
6. Click Create

---

## Index 2: Activity History (Submissions)
**Collection:** `submissions`  
**Fields:**
- `userId` (Ascending)
- `submittedAt` (Descending)

**Used by:** `loadActivityHistory()` function in child profile

---

## Index 3: Parent Tasks with Order (if needed)
**Collection:** `taskTemplates`  
**Fields:**
- `familyCode` (Ascending)
- `createdAt` (Descending)

**Used by:** `loadParentTasks()` if you add `.orderBy("createdAt", "desc")`

---

## Index 4: Parent Rewards with Order (if needed)
**Collection:** `rewards`  
**Fields:**
- `familyCode` (Ascending)
- `createdAt` (Descending)

**Used by:** `loadParentRewards()` if you add `.orderBy("createdAt", "desc")`

---

## Index 5: On-Going Tasks
**Collection:** `submissions`  
**Fields:**
- `familyCode` (Ascending)
- `status` (Ascending)
- `submittedAt` (Descending)

**Used by:** `loadPendingApprovals()` for pending tasks

---

## Index 6: User Submissions Timeline
**Collection:** `submissions`  
**Fields:**
- `userId` (Ascending)
- `submittedAt` (Descending)

**Used by:** Child activity history and submissions tracking

---

## Quick Test After Indexes Are Created:

1. **Parent Flow:**
   - Sign up as parent → get family code
   - Go to Tasks section → "Create New Task" → add a task
   - Check parent dashboard — task should appear in list

2. **Child Flow:**
   - Sign up as child (any family code for now)
   - Go to Profile → paste parent's family code → click "Link"
   - Go to Tasks section — should see parent's task

3. **Approval Flow:**
   - Child clicks "Start Task" → uploads before/after photos
   - Parent sees it in "Pending Verifications" → click Approve
   - Child sees +points in profile

If errors persist after creating indexes:
- Check browser console for the full error message
- Verify Firestore rules were published (should show green checkmark)
- Try the simpler permissive rules for testing (see FIREBASE_SETUP.md)

