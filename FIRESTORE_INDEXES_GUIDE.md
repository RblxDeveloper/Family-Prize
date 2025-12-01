# Firestore Indexes Required

The following composite indexes need to be created in Firebase Console for queries to work properly.

## How to Create Indexes

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project: **taskquest-ef595**
3. Navigate to **Firestore Database** → **Indexes** → **Composite Indexes**
4. Click **Create Index** and add each index below

---

## Required Indexes

### 1. Submissions Collection
**Collection:** `submissions`
**Fields:**
- `taskId` (Ascending)
- `status` (Ascending)

This index is used when checking if all children have completed a task (parent dashboard).

---

### 2. Parent Invite Requests Collection
**Collection:** `parentInviteRequests`
**Fields:**
- `targetOwnerId` (Ascending)
- `createdAt` (Descending)

This index is used when viewing pending parent requests.

---

### 3. Parent Invite Requests Collection (Alternative)
**Collection:** `parentInviteRequests`
**Fields:**
- `targetOwnerId` (Ascending)
- `status` (Ascending)

If you want to filter by status, use this index instead.

---

## Auto-Index Creation

Firebase usually shows a link in the browser console when a query requires an index. If you see an error like:

```
The query requires an index. You can create it here: https://console.firebase.google.com/...
```

**Click the link** — it will auto-fill the index creation form with the correct fields. Just click **Create Index** and wait 5-10 minutes for it to build.

---

## Firestore Rules Update

Make sure your Firestore security rules match the version in `FIRESTORE_RULES_FINAL_FIXED.txt`. The rules must allow:
- Parents to read submissions in their family
- Users to read their own submissions
- Parents to update submissions (approve/decline)
