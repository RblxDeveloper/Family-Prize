const functions = require('firebase-functions');
const admin = require('firebase-admin');

try { admin.initializeApp(); } catch (e) {}
const db = admin.firestore();

/**
 * Helper: unlink all children that reference the parent's familyCode.
 */
async function unlinkChildrenByFamilyCode(familyCode) {
  if (!familyCode) return;
  const batch = db.batch();
  const childrenSnap = await db.collection('users')
    .where('familyCode', '==', familyCode)
    .where('role', '==', 'child')
    .get();

  childrenSnap.forEach((doc) => {
    batch.update(doc.ref, { familyCode: admin.firestore.FieldValue.delete() });
  });
  await batch.commit();
  return childrenSnap.size;
}

/**
 * Helper: clean orphaned familyRequests where the familyCode belongs to the deleted parent,
 * or parentId equals the deleted parent's UID.
 */
async function cleanupFamilyRequestsForParent(parentUid, familyCode) {
  let count = 0;
  // Requests targeting this parent by parentId
  try {
    const snap1 = await db.collection('familyRequests')
      .where('parentId', '==', parentUid)
      .get();
    const batch1 = db.batch();
    snap1.forEach((d) => { batch1.delete(d.ref); count++; });
    await batch1.commit();
  } catch (e) {}

  // Requests by familyCode (children or guardian requests)
  try {
    if (familyCode) {
      const snap2 = await db.collection('familyRequests')
        .where('familyCode', '==', familyCode)
        .get();
      const batch2 = db.batch();
      snap2.forEach((d) => { batch2.delete(d.ref); count++; });
      await batch2.commit();
    }
  } catch (e) {}
  return count;
}

/**
 * Helper: cleanup parent-owned resources for a familyCode.
 * - Deletes taskTemplates and rewards belonging to this familyCode.
 * - Optionally marks submissions as archived (keeps child history intact).
 */
async function cleanupParentOwnedResources(familyCode) {
  if (!familyCode) return { templatesDeleted: 0, rewardsDeleted: 0, submissionsArchived: 0 };

  let templatesDeleted = 0;
  let rewardsDeleted = 0;
  let submissionsArchived = 0;

  // Delete taskTemplates
  try {
    const ts = await db.collection('taskTemplates').where('familyCode', '==', familyCode).get();
    if (!ts.empty) {
      const batch = db.batch();
      ts.forEach((d) => { batch.delete(d.ref); templatesDeleted++; });
      await batch.commit();
    }
  } catch (e) {
    console.error('cleanupParentOwnedResources taskTemplates error:', e);
  }

  // Delete rewards
  try {
    const rs = await db.collection('rewards').where('familyCode', '==', familyCode).get();
    if (!rs.empty) {
      const batch = db.batch();
      rs.forEach((d) => { batch.delete(d.ref); rewardsDeleted++; });
      await batch.commit();
    }
  } catch (e) {
    console.error('cleanupParentOwnedResources rewards error:', e);
  }

  // Optional: archive submissions (do NOT delete to preserve child history)
  try {
    const ss = await db.collection('submissions').where('familyCode', '==', familyCode).get();
    if (!ss.empty) {
      const batch = db.batch();
      ss.forEach((d) => {
        batch.update(d.ref, {
          archived: true,
          archivedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        submissionsArchived++;
      });
      await batch.commit();
    }
  } catch (e) {
    console.error('cleanupParentOwnedResources submissions archive error:', e);
  }

  return { templatesDeleted, rewardsDeleted, submissionsArchived };
}

/**
 * Firestore trigger: when a parent user document is deleted, automatically unlink children
 * and clean related familyRequests.
 */
exports.onParentUserDeleted = functions.firestore
  .document('users/{userId}')
  .onDelete(async (snap, context) => {
    const deletedData = snap.data() || {};
    const userId = context.params.userId;
    const role = deletedData.role;
    const familyCode = deletedData.familyCode || null;

    // Only handle parents
    if (role !== 'parent') {
      return;
    }

    try {
      // Unlink all children with this familyCode
      const unlinkedCount = await unlinkChildrenByFamilyCode(familyCode);

      // Clean up any pending/legacy requests tied to this parent/familyCode
      const cleanedRequests = await cleanupFamilyRequestsForParent(userId, familyCode);

      // Clean up parent-owned resources (preserve child data)
      const cleanup = await cleanupParentOwnedResources(familyCode);

      // Optionally: log an activity record (if rules allow server-side writes)
      try {
        await db.collection('activityLog').add({
          type: 'parent_deleted',
          parentId: userId,
          parentFamilyCode: familyCode,
          childrenUnlinked: unlinkedCount,
          requestsCleaned: cleanedRequests,
          templatesDeleted: cleanup.templatesDeleted,
          rewardsDeleted: cleanup.rewardsDeleted,
          submissionsArchived: cleanup.submissionsArchived,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch (e) {}

      console.log(`Parent ${userId} deleted. Unlinked ${unlinkedCount} children, cleaned ${cleanedRequests} requests, deleted ${cleanup.templatesDeleted} templates and ${cleanup.rewardsDeleted} rewards, archived ${cleanup.submissionsArchived} submissions.`);
    } catch (error) {
      console.error('onParentUserDeleted error:', error);
    }
  });

/**
 * Auth trigger: when an Auth user is deleted (via Firebase Console), also attempt to
 * unlink any children tied to their users/{uid} doc.
 */
exports.onAuthUserDeleted = functions.auth.user().onDelete(async (user) => {
  try {
    const userDoc = await db.collection('users').doc(user.uid).get();
    if (!userDoc.exists) return;
    const data = userDoc.data() || {};
    if (data.role !== 'parent') return;

    const familyCode = data.familyCode || null;
    const unlinkedCount = await unlinkChildrenByFamilyCode(familyCode);
    const cleanedRequests = await cleanupFamilyRequestsForParent(user.uid, familyCode);
    const cleanup = await cleanupParentOwnedResources(familyCode);

    console.log(`Auth parent ${user.uid} deleted. Unlinked ${unlinkedCount} children, cleaned ${cleanedRequests} requests, deleted ${cleanup.templatesDeleted} templates and ${cleanup.rewardsDeleted} rewards, archived ${cleanup.submissionsArchived} submissions.`);

    // Optionally remove the Firestore doc if still present (defense-in-depth)
    try { await db.collection('users').doc(user.uid).delete(); } catch (e) {}
  } catch (error) {
    console.error('onAuthUserDeleted error:', error);
  }
});
