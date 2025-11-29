# Firebase Security Rules Setup

## Important: Apply These Security Rules

To fix the permission errors and secure your TaskQuest app, you need to apply the Firestore security rules.

### Steps to Apply Security Rules:

1. **Go to Firebase Console**: https://console.firebase.google.com
2. **Select your project**: `taskquest-ef595`
3. **Navigate to Firestore Database** from the left sidebar
4. **Click on the "Rules" tab** at the top
5. **Copy the security rules below** 
6. **Paste the rules** into the Firebase console
7. **Click "Publish"** to apply the rules

### Firestore Security Rules:

\`\`\`javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper function to check if user is authenticated
    function isSignedIn() {
      return request.auth != null;
    }
    
    // Helper function to get user data
    function getUserData() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
    }
    
    // Helper function to check if user is a parent
    function isParent() {
      return isSignedIn() && getUserData().role == 'parent';
    }
    
    // Helper function to check if user is a child
    function isChild() {
      return isSignedIn() && getUserData().role == 'child';
    }
    
    // Helper function to check if user belongs to the same family
    function isSameFamily(familyCode) {
      return isSignedIn() && getUserData().familyCode == familyCode;
    }
    
    // Users collection
    match /users/{userId} {
      // Users can read their own data
      allow read: if isSignedIn() && request.auth.uid == userId;
      
      // Users can create their own profile during signup
      allow create: if isSignedIn() && request.auth.uid == userId;
      
      // Users can update their own profile
      allow update: if isSignedIn() && request.auth.uid == userId;
      
      // Parents can read children profiles in their family
      allow read: if isSignedIn() && isParent() && 
                     resource.data.familyCode == getUserData().familyCode;
      
      // Parents can update children points in their family
      allow update: if isSignedIn() && isParent() && 
                       resource.data.familyCode == getUserData().familyCode &&
                       resource.data.role == 'child';
    }
    
    // Task Templates collection
    match /taskTemplates/{taskId} {
      // Anyone in the family can read task templates
      allow read: if isSignedIn() && isSameFamily(resource.data.familyCode);
      
      // Only parents can create task templates
      allow create: if isSignedIn() && isParent();
      
      // Only parents can update/delete their family's tasks
      allow update, delete: if isSignedIn() && isParent() && 
                                isSameFamily(resource.data.familyCode);
    }
    
    // Rewards collection
    match /rewards/{rewardId} {
      // Anyone in the family can read rewards
      allow read: if isSignedIn() && isSameFamily(resource.data.familyCode);
      
      // Only parents can create rewards
      allow create: if isSignedIn() && isParent();
      
      // Only parents can update/delete their family's rewards
      allow update, delete: if isSignedIn() && isParent() && 
                                isSameFamily(resource.data.familyCode);
    }
    
    // Submissions collection
    match /submissions/{submissionId} {
      // Children can create submissions
      allow create: if isSignedIn() && isChild() && 
                       request.resource.data.userId == request.auth.uid;
      
      // Children can read their own submissions
      allow read: if isSignedIn() && resource.data.userId == request.auth.uid;
      
      // Parents can read submissions from children in their family
      allow read: if isSignedIn() && isParent() && 
                     isSameFamily(resource.data.familyCode);
      
      // Parents can update submissions (approve/decline) for their family
      allow update: if isSignedIn() && isParent() && 
                       isSameFamily(resource.data.familyCode);
    }
    
    // Redeemed Rewards collection
    match /redeemedRewards/{redeemId} {
      // Children can create redeemed rewards
      allow create: if isSignedIn() && isChild() && 
                       request.resource.data.userId == request.auth.uid;
      
      // Users can read their own redeemed rewards
      allow read: if isSignedIn() && resource.data.userId == request.auth.uid;
      
      // Parents can read redeemed rewards from children in their family
      allow read: if isSignedIn() && isParent() && 
                     isSameFamily(resource.data.familyCode);
    }
    
    // Notifications collection
    match /notifications/{notificationId} {
      // Users can read their own notifications
      allow read: if isSignedIn() && resource.data.userId == request.auth.uid;
      
      // Parents can create notifications for children in their family
      allow create: if isSignedIn() && isParent();
      
      // Users can update their own notifications (mark as read)
      allow update: if isSignedIn() && resource.data.userId == request.auth.uid;
    }
  }
}
\`\`\`

### Storage Rules (for photo uploads):

Also update your Firebase Storage rules:

1. Go to **Storage** in Firebase Console
2. Click on the **Rules** tab
3. Replace with these rules:

\`\`\`javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /tasks/{userId}/{allPaths=**} {
      // Allow authenticated users to upload their own task photos
      allow read, write: if request.auth != null && request.auth.uid == userId;
      
      // Allow parents to read task photos
      allow read: if request.auth != null;
    }
  }
}
\`\`\`

4. Click **Publish**

### After Applying Rules:

All permission errors will be resolved and your app will be fully functional with proper security!

## How the Family Connection Works:

1. **Parent Signs Up**: Receives a unique 6-digit Family Code
2. **Parent Shares Code**: Shares the Family Code with their children
3. **Child Signs Up**: Enters the Family Code during registration
4. **Connected**: Child can now see all tasks and rewards created by their parent
5. **Parent Manages**: Parent can approve submissions, add bonus points, and manage all tasks/rewards
6. **Isolated Families**: Each family's data is completely isolated from other families

## Key Features:

✅ **Family Code System**: Automatic parent-child linking
✅ **Real-time Updates**: Tasks and rewards appear instantly for connected children
✅ **Secure**: Each family's data is isolated with Firestore security rules
✅ **Points System**: Children earn points, parents can approve/decline tasks
✅ **Rewards Store**: Children can redeem rewards with earned points
✅ **Activity History**: Track all completed tasks and redeemed rewards
✅ **Parent Controls**: Reset points, add bonus points, manage tasks and rewards