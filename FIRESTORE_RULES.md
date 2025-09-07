# Firestore Security Rules for Cross-Platform Sync

## Current Rules (for shared user sync)

Go to Firebase Console > Firestore Database > Rules and replace with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow access to the shared user for cross-platform sync
    match /users/shared-user-upnext/tasks/{taskId} {
      allow read, write: if request.auth != null;
    }
    
    // Allow access to the shared user document
    match /users/shared-user-upnext {
      allow read, write: if request.auth != null;
    }
    
    // Legacy: Allow users to read/write their own tasks (for future individual accounts)
    match /users/{userId}/tasks/{taskId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Legacy: Allow users to read/write their user document
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## ⚠️ Important Notes

**This is a temporary solution for development/personal use only!**

### Security Implications:
- All anonymous users can see each other's tasks
- Only suitable for personal use or trusted users
- Not recommended for production with multiple users

### For Production Use:
1. Implement proper email/Google authentication
2. Use individual user accounts
3. Add data validation rules
4. Implement proper access controls

## Future Authentication Upgrade

When you're ready for proper multi-user support:

1. **Enable Email/Password Authentication**:
   - Firebase Console > Authentication > Sign-in method
   - Enable "Email/Password"

2. **Update the apps** to use email sign-in instead of anonymous

3. **Revert to individual user rules**:
   ```javascript
   match /users/{userId}/tasks/{taskId} {
     allow read, write: if request.auth != null && request.auth.uid == userId;
   }
   ```

## Testing the Fix

After updating the rules:

1. **Desktop App**: Restart and create a task
2. **Web App**: Refresh and check if you see the desktop task
3. **Phone**: Refresh and check if you see both tasks
4. **Cross-Platform**: Create tasks on each platform - they should all sync!

The shared user ID `shared-user-upnext` will be used across all platforms for now.
