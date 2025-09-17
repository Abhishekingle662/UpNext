# 🚀 UpNext Setup Instructions

## 📋 Prerequisites

- Node.js (v16 or later)
- A Google account for Firebase
- Git
- GitHub account (for releases and auto-updates)

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

## 🏷️ GitHub Release Setup (Required for Auto-Updates)

### 1. Create GitHub Personal Access Token

1. Go to GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Give it a name: "UpNext Auto-Update Publisher"
4. Select scopes: **`repo`** (Full control of private repositories)
5. Click "Generate token"
6. **Copy the token immediately** (you won't see it again!)

### 2. Set Environment Variable

#### Windows:
```bash
# Command Prompt (temporary)
set GH_TOKEN=your_token_here

# PowerShell (temporary)
$env:GH_TOKEN="your_token_here"

# Permanent Setup (Recommended):
# 1. Open System Properties → Advanced → Environment Variables
# 2. Click "New" under System variables
# 3. Variable name: GH_TOKEN
# 4. Variable value: your_token_here
# 5. Click OK and restart VS Code/Terminal
```

#### macOS/Linux:
```bash
# Temporary
export GH_TOKEN=your_token_here

# Permanent (add to ~/.bashrc or ~/.zshrc)
echo 'export GH_TOKEN=your_token_here' >> ~/.bashrc
source ~/.bashrc
```

### 3. Verify Token Setup

```bash
# Windows CMD
echo %GH_TOKEN%

# PowerShell/macOS/Linux
echo $GH_TOKEN
```

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

## 🚀 Release Management & Auto-Updates (SIMPLIFIED!)

### 🎯 **Super Simple Release Workflow**

The entire release process is now **just 2 commands**:

#### Step 1: Commit Your Changes
```bash
# Make sure all your work is saved
git add .
git commit -m "Add awesome new feature"
```

#### Step 2: Release with One Command
```bash
# Choose your release type:
npm run release:patch    # Bug fixes (0.2.0 → 0.2.1)
npm run release:minor    # New features (0.2.0 → 0.3.0)
npm run release:major    # Breaking changes (0.2.0 → 1.0.0)
```

**That's it!** ✨ This single command automatically:
- ✅ Bumps the version in package.json
- ✅ Creates a git tag (e.g., v0.2.1)
- ✅ Commits the version change
- ✅ Pushes code and tags to GitHub
- ✅ Builds the app for all platforms
- ✅ Uploads installers to GitHub Releases
- ✅ Enables auto-updates for existing users

### 📋 **Simple Release Checklist**

Before each release:
- [ ] All changes committed: `git status` (should be clean)
- [ ] GH_TOKEN environment variable set: `echo %GH_TOKEN%`
- [ ] App works locally: `npm run dev`

Then just run: `npm run release:patch` (or minor/major)

### 🔍 **Post-Release Verification**

After running the release command:

1. **Check GitHub Releases**: Go to https://github.com/Abhishekingle662/UpNext/releases
2. **Verify Files**: Should see:
   - `UpNext-Setup-X.X.X.exe` - Windows installer
   - `UpNext-X.X.X.dmg` - macOS installer
   - `UpNext-X.X.X.AppImage` - Linux installer
   - `latest.yml` - Windows update metadata
   - `latest-mac.yml` - macOS update metadata
3. **Test Auto-Update**: 
   - Install the previous version
   - Start the app to see update notification

### 🆘 **If Something Goes Wrong**

#### Release Command Fails:
```bash
# Check what went wrong:
git status                # See if version was committed
git tag                   # See if tag was created
echo %GH_TOKEN%          # Verify token is set

# If needed, clean up and try again:
git reset --hard HEAD~1   # Undo version commit (if needed)
git tag -d v0.2.1        # Delete local tag (if created)
git push origin --delete v0.2.1  # Delete remote tag (if pushed)
```

#### Build Fails:
```bash
# Test build locally first:
npm run dist
# If local build works, then try release again
```

## 🔄 Auto-Update Features

### How Auto-Updates Work

1. **🔍 Automatic Checking**: App checks for updates 5 seconds after startup (production only)
2. **📢 Smart Notifications**: Elegant toast notifications appear in top-right corner
3. **📊 Progress Tracking**: Real-time download progress with visual indicators  
4. **🔄 One-Click Install**: Users can restart and install with a single button click
5. **🎯 No Reinstall**: Updates are applied seamlessly over existing installation

### Auto-Update User Experience

- ✅ Non-intrusive update notifications
- ✅ Background download with progress
- ✅ User controls when to install
- ✅ Automatic restart and installation
- ✅ Preserves user data and settings
- ✅ Rollback capability if update fails

### Generated Release Files

Each release creates:
- `UpNext-Setup-X.X.X.exe` - Windows installer
- `UpNext-X.X.X.dmg` - macOS installer  
- `UpNext-X.X.X.AppImage` - Linux installer
- `latest.yml` - Windows update metadata
- `latest-mac.yml` - macOS update metadata
- Source code archives

## 🌐 Deployment Options

### Firebase Hosting (Web App)
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy
```

### Electron Distribution Options
```bash
npm run dist             # Local build only
npm run release:patch    # Complete release workflow (RECOMMENDED)
npm run release:minor    # Feature releases
npm run release:major    # Major version releases
```

### Manual Distribution (Not Recommended)
```bash
# Build locally and distribute manually
npm run dist
# Files created in dist/ folder
# Share .exe, .dmg, .AppImage files manually
# Note: No auto-updates with manual distribution
```

## 🔒 Security & Best Practices

### Firebase Security
- **Never commit** `firebase-config.js` files (they contain API keys)
- **Always use** template files for sharing
- **Update Firestore rules** for production use
- **Enable proper authentication** before going live

### Release Security
- **Protect GH_TOKEN**: Never commit to version control
- **Use environment variables**: Set GH_TOKEN properly
- **Code signing**: Consider signing certificates for production
- **Verify releases**: Always test auto-updates before major releases

### Development vs Production

#### Development Mode (localhost):
- Uses shared anonymous account
- All developers see same tasks
- Perfect for testing sync
- Auto-updates disabled

#### Production Mode (deployed):
- Individual Google accounts
- Private task lists per user
- Secure data isolation
- Auto-updates enabled

## 🆘 Troubleshooting

### Firebase Configuration Issues
```bash
# "Firebase not configured" errors:
# - Ensure firebase-config.js files exist and have valid config
# - Check Firebase project is active
# - Verify API keys are correct

# "Permission denied" errors:
# - Update Firestore security rules
# - Verify authentication is working
# - Check user permissions

# Tasks not syncing:
# - Check internet connection
# - Verify Firebase configuration  
# - Look for errors in browser/electron console
```

### Auto-Update Issues
```bash
# "GH_TOKEN not set" error:
echo %GH_TOKEN%  # Windows - should show your token
echo $GH_TOKEN   # macOS/Linux - should show your token

# Release command fails:
# - Check git status is clean before releasing
# - Verify all changes are committed
# - Ensure GH_TOKEN environment variable is set

# Auto-updates not working:
# - Verify app was installed from GitHub release (not local build)
# - Check app is running in production mode
# - Look for update errors in app console (Ctrl+Shift+I)
```

### Common Development Issues
```bash
# Port already in use:
# - Close other instances of the app
# - Use different port: npm run serve-web -- --port 3001

# Electron won't start:
# - Clear node_modules: rm -rf node_modules && npm install
# - Check for conflicting global packages

# Build errors:
# - Ensure all dependencies installed: npm install
# - Check Node.js version: node --version (should be 16+)
```

## 📚 Project Structure

```
upnext/
├── main.cjs                # Electron main process + auto-updater
├── preload.cjs             # Electron preload script
├── firebase-main.js        # Firebase service for Electron  
├── firebase-config.js      # Firebase config (not in git)
├── package.json            # Dependencies + build config + release scripts
├── renderer/               # Electron UI
│   ├── renderer.js         # Main renderer + update manager
│   └── styles.css          # Styles + update UI
├── web/                    # Web app
│   ├── index.html
│   ├── web-app.js
│   ├── web-styles.css  
│   └── firebase-config.js  # Web Firebase config (not in git)
├── assets/                 # App icons and resources
├── dist/                   # Built installers (auto-generated)
└── docs/                   # Documentation
```

## 🎯 Features Checklist

### Core Features
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

### Auto-Update Features  
- ✅ Automatic update checking on startup
- ✅ User-friendly update notifications
- ✅ Download progress indicators
- ✅ One-click install and restart
- ✅ Seamless upgrades without uninstalling
- ✅ GitHub Releases integration
- ✅ Cross-platform update support (Windows/Mac/Linux)

## 🚀 Quick Reference Commands

### Development
```bash
npm run dev          # Start desktop app in development
npm run serve-web    # Start web server
```

### Building
```bash
npm run dist         # Build installers locally
```

### **🎯 Releases (SIMPLIFIED!)**
```bash
npm run release:patch    # Bug fixes (0.2.0 → 0.2.1) + AUTO-PUBLISH
npm run release:minor    # New features (0.2.0 → 0.3.0) + AUTO-PUBLISH  
npm run release:major    # Breaking changes (0.2.0 → 1.0.0) + AUTO-PUBLISH
```

### **📝 What Each Release Command Does:**
1. **Increments version** in package.json
2. **Creates git commit** with version change
3. **Creates git tag** (e.g., v0.2.1)
4. **Pushes** code and tags to GitHub
5. **Builds** installers for Windows/Mac/Linux
6. **Publishes** to GitHub Releases
7. **Enables** auto-updates for existing users

---

🎉 **Happy task managing with UpNext!**

*With the simplified release workflow, publishing updates is now just one command!*

**Example Release Session:**
```bash
# 1. Finish your work
git add .
git commit -m "Fix task completion bug"

# 2. Release it!
npm run release:patch

# 3. That's it! ✨
# Users will get auto-update notifications within minutes
```
