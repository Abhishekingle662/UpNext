# Firebase Setup Guide for UpNext Cross-Platform Sync

## Prerequisites

1. A Google account
2. Your existing UpNext desktop app

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project"
3. Name your project (e.g., "upnext-sync")
4. Disable Google Analytics (optional for this use case)
5. Click "Create project"

## Step 2: Set up Firestore Database

1. In your Firebase project, go to "Firestore Database"
2. Click "Create database"
3. Choose "Start in test mode" (we'll secure it later)
4. Select a location close to you
5. Click "Done"

## Step 3: Enable Authentication

1. Go to "Authentication" in the Firebase console
2. Click "Get started"
3. Go to "Sign-in method" tab
4. Enable "Anonymous" authentication (for now)
5. Click "Save"

## Step 4: Get Firebase Configuration

1. Go to "Project settings" (gear icon)
2. Scroll down to "Your apps"
3. Click "Add app" and choose "Web" (</> icon)
4. Name your app (e.g., "UpNext Web")
5. Check "Also set up Firebase Hosting" (optional)
6. Click "Register app"
7. Copy the configuration object

## Step 5: Update Your App Configuration

1. Open `firebase-config.js` in your project
2. Replace the placeholder values with your actual Firebase config:

```javascript
export const firebaseConfig = {
  apiKey: "your-actual-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-actual-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "your-actual-app-id"
};
```

## Step 6: Set up Firestore Security Rules

1. Go to "Firestore Database" > "Rules"
2. Replace the default rules with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow users to read/write their own tasks
    match /users/{userId}/tasks/{taskId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Allow users to read/write their user document
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

3. Click "Publish"

## Step 7: Test Your Desktop App

1. Run `npm install` to install Firebase dependencies
2. Start your app with `npm run dev`
3. Create a test task - it should sync to Firebase
4. Check the Firestore console to see your data

## Step 8: Deploy Web Version (Optional)

If you want to host the web version:

1. Install Firebase CLI: `npm install -g firebase-tools`
2. Login: `firebase login`
3. Initialize hosting: `firebase init hosting`
4. Choose your project
5. Set public directory to `web`
6. Configure as single-page app: Yes
7. Deploy: `firebase deploy`

## Step 9: Access on Mobile

### Option A: Use the Web App
1. Open your deployed web app URL on your phone
2. Add to home screen for app-like experience

### Option B: Use Firebase Hosting URL
1. Your app will be available at: `https://your-project.web.app`
2. Share this URL or bookmark it on your phone

## Security Considerations

For production use, consider:

1. **Enable proper authentication** (Google, email/password)
2. **Implement user accounts** instead of anonymous auth
3. **Add data validation** in Firestore rules
4. **Enable offline persistence** for better mobile experience
5. **Add rate limiting** to prevent abuse

## Troubleshooting

### Common Issues:

1. **"Permission denied" errors**: Check Firestore rules
2. **"Module not found" errors**: Run `npm install`
3. **Tasks not syncing**: Check browser console for errors
4. **Web app not loading**: Check Firebase Hosting configuration

### Debug Steps:

1. Open browser developer tools (F12)
2. Check Console tab for errors
3. Check Network tab for failed requests
4. Verify Firebase config is correct

## Next Steps

Once everything is working:

1. **Migrate existing tasks**: Your local tasks will remain in the app, new ones will sync
2. **Set up proper authentication**: Replace anonymous auth with Google/email
3. **Add user profiles**: Store user preferences in Firestore
4. **Enable push notifications**: For task reminders on mobile
5. **Add sharing features**: Share tasks between users

## Support

If you encounter issues:

1. Check the browser console for error messages
2. Verify your Firebase configuration
3. Ensure Firestore rules allow your operations
4. Test with a simple task creation first

Your UpNext app now syncs across all devices! 🎉
