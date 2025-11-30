# Google Sign-In Setup Guide

Google Sign-In has been integrated into TaskQuest! Follow these steps to enable it in your Firebase project.

## Step 1: Enable Google Sign-In in Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **taskquest-ef595**
3. Navigate to **Build** > **Authentication**
4. Click on the **Sign-in method** tab
5. Click **Google** from the list of providers
6. Toggle the **Enable** switch to ON
7. Configure the **Project support email** (select your email from the dropdown)
8. Click **Save**

## Step 2: Configure OAuth Consent Screen (if needed)

If you see a warning about the OAuth consent screen:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Navigate to **APIs & Services** > **OAuth consent screen**
4. Choose **External** user type
5. Fill in the required fields:
   - **App name**: TaskQuest
   - **User support email**: Your email
   - **Developer contact email**: Your email
6. Click **Save and Continue**
7. On the **Scopes** page, click **Save and Continue** (no extra scopes needed)
8. On the **Test users** page, click **Save and Continue**
9. Review and click **Back to Dashboard**

## Step 3: Configure Authorized Domains

1. In Firebase Console, go to **Build** > **Authentication** > **Sign-in method**
2. Scroll down to **Authorized domains**
3. You should see:
   - `taskquest-ef595.firebaseapp.com` (already added)
   - `localhost` (for local testing)
4. If testing on GitHub Pages, add:
   - `rbldeveloper.github.io` (or your GitHub username)

## Step 4: Test Google Sign-In

1. Open your app and navigate to the login page
2. You'll now see a **"Sign in with Google"** button below the password login
3. Click the button and follow Google's authentication flow
4. You'll be prompted to select whether you're a Parent or Child
5. Complete the setup (parents create a passcode, children enter family code)

## How It Works

### For New Users:
1. Click "Sign in with Google"
2. Authenticate with Google account
3. Select role (Parent or Child)
4. **Parents**: Create a 6-digit passcode (stored in Firestore)
5. **Children**: Enter family code from parent
6. Profile is created automatically using Google's name and email

### For Existing Users:
1. Click "Sign in with Google"
2. App checks Firestore for existing account
3. If found, automatically logged in and redirected to dashboard
4. If not found, prompted to complete signup process

## Security Notes

- Google Sign-In uses OAuth 2.0 - your password is never shared with TaskQuest
- Firebase handles all authentication securely
- Users can have EITHER email/password OR Google sign-in (not required to use both)
- The `authProvider` field in Firestore tracks which login method was used

## Troubleshooting

**"Sign-in cancelled"** - User closed the Google popup
**"Please allow popups"** - Browser blocked the popup; check popup settings
**"Sign-In failed"** - Check Firebase console for errors in Authentication logs

For more help, see [Firebase Google Sign-In Docs](https://firebase.google.com/docs/auth/web/google-signin)
