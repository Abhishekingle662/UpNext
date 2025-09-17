# UpNext - Cross-Platform Todo App

> An always-accessible, minimalist to-do app that syncs across all your devices in real-time.

![UpNext Demo](https://via.placeholder.com/800x400/1a1a1a/ffffff?text=UpNext+Cross-Platform+Sync)

## ✨ Features

- 🔄 **Real-time Cross-Platform Sync** - Desktop ↔ Web ↔ Mobile
- 📱 **Progressive Web App** - Install on mobile like a native app
- 🔐 **Secure Individual Accounts** - Google Authentication with private task lists
- 🌙 **Dark/Light Themes** - Beautiful UI that adapts to your preference
- 📅 **Smart Date Parsing** - "tomorrow 3pm", "next monday", "in 2 days"
- ⚡ **Priority Levels** - Use !, !!, !!! for task importance
- 📱 **Offline Support** - Works without internet, syncs when reconnected
- 🎯 **Always on Top** - Desktop app stays visible while you work
- 🖱️ **Drag & Drop** - Reorder tasks easily
- 🚀 **Lightning Fast** - Minimalist design focused on speed

## 🚀 Quick Start

### 1. Clone & Install
```bash
git clone https://github.com/yourusername/upnext.git
cd upnext
npm install
```

### 2. Firebase Setup
```bash
# Copy configuration templates
cp firebase-config.template.js firebase-config.js
cp web/firebase-config.template.js web/firebase-config.js

# Follow SETUP_INSTRUCTIONS.md for detailed Firebase configuration
```

### 3. Run the Apps
```bash
# Desktop app
npm run dev

# Web app (in another terminal)
npm run serve-web
```

## 📱 Platform Support

| Platform | Status | How to Access |
|----------|--------|---------------|
| **Windows Desktop** | ✅ Ready | `npm run dev` |
| **macOS Desktop** | ✅ Ready | `npm run dev` |
| **Linux Desktop** | ✅ Ready | `npm run dev` |
| **Web Browser** | ✅ Ready | `npm run serve-web` |
| **Mobile PWA** | ✅ Ready | Install from web browser |
| **iOS Native** | 🔄 Planned | PWA works great meanwhile |
| **Android Native** | 🔄 Planned | PWA works great meanwhile |

## 🛠️ Development vs Production

### 🧪 Development Mode (localhost)
- Shared anonymous account for easy testing
- All developers see the same tasks
- Perfect for development and testing sync

### 🌐 Production Mode (deployed)
- Individual Google accounts
- Private task lists per user
- Secure data isolation
- Professional authentication UI

## 📖 Documentation

- [**Setup Instructions**](SETUP_INSTRUCTIONS.md) - Complete setup guide
- [**Firebase Setup**](FIREBASE_SETUP.md) - Firebase configuration details
- [**Production Deployment**](PRODUCTION_DEPLOYMENT.md) - Deploy to production
- [**Firestore Rules**](FIRESTORE_RULES.md) - Database security configuration

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Desktop App   │    │    Web App      │    │   Mobile PWA    │
│   (Electron)    │    │  (Vanilla JS)   │    │  (Web Browser)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   Firebase      │
                    │   - Firestore   │
                    │   - Auth        │
                    │   - Hosting     │
                    └─────────────────┘
```

## 🔧 Tech Stack

- **Desktop**: Electron + Node.js
- **Web**: Vanilla JavaScript + PWA
- **Backend**: Firebase (Firestore + Authentication)
- **Styling**: Custom CSS with CSS Variables
- **Build**: Native Node.js scripts
- **Deployment**: Firebase Hosting + Electron Builder

## 📝 Smart Task Features

### Date Parsing Examples
```
"Buy groceries tomorrow 3pm"     → Due: Tomorrow at 3:00 PM
"Team meeting next monday 9am"   → Due: Next Monday at 9:00 AM
"Finish project in 3 days"       → Due: 3 days from now
"Call mom friday"                 → Due: This Friday at 9:00 AM
```

### Priority Levels
```
"Fix bug !!!"           → High Priority (P1)
"Review code !!"         → Medium Priority (P2)
"Update docs !"          → Low Priority (P3)
"urgent: Deploy fix"     → High Priority (P1)
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Firebase for the amazing backend infrastructure
- Electron for cross-platform desktop support
- The open-source community for inspiration and tools

---

<div align="center">

**[⬆ Back to Top](#upnext---cross-platform-todo-app)**

Made with ❤️ for productivity enthusiasts


🚀 Distribution Commands:
4. Future Release Workflow
For subsequent releases, follow this pattern:
# 1. Make your code changes, commit, and push
git add .
git commit -m "Add new awesome feature"
git push origin main

# 2. Bump version (choose appropriate level)
npm run version:patch    # Bug fixes (0.2.1 → 0.2.2)
npm run version:minor    # New features (0.2.1 → 0.3.0)  
npm run version:major    # Breaking changes (0.2.1 → 1.0.0)

# 3. Create and push git tag (replace with actual version)
git tag v0.2.2
git push origin v0.2.2

# 4. Build and publish
npm run publish




# other commands
# Quick patch release (0.1.1 → 0.1.2)
npm run release

# 1. Increment version
npm run version:patch    # Bug fixes (0.2.0 → 0.2.1)
npm run version:minor    # New features (0.2.0 → 0.3.0)
npm run version:major    # Breaking changes (0.2.0 → 1.0.0)

# 2. Create git tag and publish to GitHub
git tag v0.3.0
git push origin v0.3.0

# 3. Build and publish release (requires GH_TOKEN env var)
npm run publish
# Create ZIP only (after version change):
npm run zip-dist
</div>