# 🚀 UpNext Setup Instructions

## 📋 Prerequisites

- Node.js (v16 or later)
- A Google account for Firebase
- Git

## 🔧 Initial Setup

### 1. Clone and Install Dependencies

```bash
git clone <your-repo-url>
cd upnext
npm install
```

### 2. Firebase Configuration (Required)

#### Create Firebase Project:
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project
3. Enable Firestore Database
4. Enable Authentication (Anonymous + Google)

#### Configure Your App:
1. **Copy template files**:
   ```bash
   cp firebase-config.template.js firebase-config.js
   cp web/firebase-config.template.js web/firebase-config.js
   ```

2. **Get Firebase config**:
   - Firebase Console → Project Settings → General → Your apps
   - Click "Web app" and copy the configuration

3. **Update both config files** with your Firebase credentials:
   ```javascript
   export const firebaseConfig = {
     apiKey: "your-actual-api-key",
     authDomain: "your-project.firebaseapp.com",
     projectId: "your-project-id",
     // ... other config values
   };
   ```

### 3. Firestore Security Rules

Copy the rules from `firestore-production-rules.txt` to your Firebase Console:
- Firebase Console → Firestore Database → Rules
- Paste the rules and publish

### 4. Authentication Setup

1. **Enable Anonymous Authentication**:
   - Firebase Console → Authentication → Sign-in method
   - Enable "Anonymous"

2. **Enable Google Authentication** (for production):
   - Enable "Google" provider
   - Add your domain to authorized domains

## 🏃‍♂️ Running the App

### Desktop App (Electron)
```bash
npm run dev          # Development mode
npm run start        # Production mode
npm run dist         # Build installer
```

### Web App
```bash
npm run serve-web    # Start local web server
```
Then open `http://localhost:3000`

### Mobile Access
1. Run web server: `npm run serve-web`
2. Find your computer's IP address
3. Open `http://YOUR_IP:3000` on your phone
4. Add to home screen for app-like experience

## 🌐 Deployment

### Firebase Hosting (Web App)
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy
```

### Electron App Distribution
```bash
npm run dist  # Creates installer in dist/ folder
```

## 🔒 Security Notes

- **Never commit** `firebase-config.js` files (they contain API keys)
- **Always use** the template files for sharing
- **Update Firestore rules** for production use
- **Enable proper authentication** before going live

## 🧪 Development vs Production

### Development Mode (localhost):
- Uses shared anonymous account
- All developers see same tasks
- Perfect for testing sync

### Production Mode (deployed):
- Individual Google accounts
- Private task lists per user
- Secure data isolation

## 🆘 Troubleshooting

### "Firebase not configured" errors:
- Ensure `firebase-config.js` files exist and have valid config
- Check Firebase project is active

### "Permission denied" errors:
- Update Firestore security rules
- Verify authentication is working

### Tasks not syncing:
- Check internet connection
- Verify Firebase configuration
- Look for errors in browser/electron console

## 📚 Project Structure

```
upnext/
├── main.js                 # Electron main process
├── firebase-main.js        # Firebase service for Electron
├── firebase-config.js      # Firebase config (not in git)
├── renderer/               # Electron UI
├── web/                    # Web app
│   ├── index.html
│   ├── web-app.js
│   ├── web-styles.css
│   └── firebase-config.js  # Web Firebase config (not in git)
├── assets/                 # App icons and resources
└── docs/                   # Documentation
```

## 🎯 Features

- ✅ Cross-platform sync (Desktop ↔ Web ↔ Mobile)
- ✅ Real-time collaboration
- ✅ Offline support
- ✅ Smart date parsing ("tomorrow 3pm", "next monday")
- ✅ Priority levels (!, !!, !!!)
- ✅ Drag & drop reordering
- ✅ Dark/light themes
- ✅ PWA support for mobile
- ✅ Google Authentication
- ✅ Individual user accounts

---

🎉 **Happy task managing with UpNext!**
