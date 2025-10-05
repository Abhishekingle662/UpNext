# Testing Guide: Electron vs Tauri

This guide helps you test both versions of UpNext to ensure everything works correctly.

## Quick Test Commands

### Test Tauri Version
```bash
npm run tauri:dev
```

### Test Electron Version
```bash
npm run dev
# or
npm start
```

### Test Web Version
```bash
npm run serve-web
```

## Feature Checklist

Use this checklist to verify both versions work identically:

### ✅ Task Management

- [ ] **Create Task**
  - Type a task and press Enter
  - Verify task appears in list
  - Check task ID is generated
  - Confirm timestamps are set

- [ ] **Complete Task**
  - Click checkbox on a task
  - Verify checkmark appears
  - Check completed styling applied
  - Confirm task count updates

- [ ] **Edit Task**
  - Double-click task title
  - Edit text and press Enter
  - Verify changes saved
  - Check update timestamp changed

- [ ] **Delete Task**
  - Click delete button (🗑️)
  - Verify task removed from list
  - Check task count updates
  - Confirm empty state shows if no tasks

- [ ] **Reorder Tasks**
  - Drag task by handle (⋮⋮)
  - Move to different position
  - Release and verify order saved
  - Reload app to confirm persistence

- [ ] **Clear Completed**
  - Complete some tasks
  - Click "Clear completed"
  - Verify only completed tasks removed
  - Check incomplete tasks remain

### ✅ Window Controls

- [ ] **Pin Window**
  - Click pin button (📌)
  - Verify window stays on top
  - Test with other windows
  - Unpin and verify behavior

- [ ] **Minimize Window**
  - Click minimize button (—)
  - Verify window minimizes
  - Restore and check state preserved

- [ ] **Close Window**
  - Click close button (×)
  - Verify window closes cleanly
  - Reopen and check data persisted

- [ ] **Window Dragging**
  - Drag by title bar
  - Move window to different position
  - Close and reopen
  - Verify position remembered

- [ ] **Window Resizing**
  - Resize from edges
  - Verify min/max size constraints
  - Close and reopen
  - Check size remembered

### ✅ Theme & UI

- [ ] **Toggle Theme**
  - Click theme button (🌗)
  - Verify dark/light mode switches
  - Check all UI elements update
  - Confirm preference saved

- [ ] **Settings Modal**
  - Click settings button (⚙️)
  - Verify modal opens
  - Check settings load correctly
  - Close modal and verify app state

- [ ] **Notification Settings**
  - Open settings
  - Toggle notification options
  - Save settings
  - Verify persistence

- [ ] **Empty State**
  - Clear all tasks
  - Verify empty state shows
  - Check message and icon display
  - Add task and verify state updates

### ✅ Smart Features

- [ ] **Priority Parsing**
  - Create task with "!!!" (P1)
  - Create task with "!!" (P2)
  - Create task with "!" (P3)
  - Verify priority badges show
  - Check sorting by priority

- [ ] **Due Date Parsing**
  - Create task with "tomorrow 3pm"
  - Create task with "2024-12-25"
  - Create task with "next monday"
  - Verify due date badges show
  - Check overdue highlighting

- [ ] **Drag and Drop**
  - Drag task to new position
  - Verify visual feedback
  - Check order persists
  - Test with multiple tasks

### ✅ Data Persistence

- [ ] **Local Storage**
  - Create several tasks
  - Close app completely
  - Reopen app
  - Verify all tasks present

- [ ] **Window State**
  - Resize and move window
  - Close app
  - Reopen app
  - Verify position/size restored

- [ ] **Theme Preference**
  - Toggle theme
  - Close app
  - Reopen app
  - Verify theme remembered

- [ ] **Notification Settings**
  - Change notification settings
  - Close app
  - Reopen app
  - Verify settings persisted

### ✅ Firebase Sync (if configured)

- [ ] **Authentication**
  - Click "Sign In" button
  - Complete Google OAuth flow
  - Verify user info displays
  - Check avatar and name show

- [ ] **Task Sync**
  - Sign in to desktop app
  - Create task
  - Open web app with same account
  - Verify task appears in web app

- [ ] **Cross-Device Sync**
  - Make change on desktop
  - Check web app updates
  - Make change on web app
  - Check desktop app updates

- [ ] **Offline Mode**
  - Disconnect internet
  - Create tasks
  - Reconnect internet
  - Verify tasks sync

## Performance Testing

### Startup Time

**Test:**
1. Close app completely
2. Start timer
3. Launch app
4. Stop timer when window appears

**Expected Results:**
- Electron: 2-3 seconds
- Tauri: <1 second

### Memory Usage

**Test:**
1. Open app
2. Check memory usage in Task Manager/Activity Monitor
3. Create 100 tasks
4. Check memory again

**Expected Results:**
- Electron: ~150 MB initial, ~200 MB with tasks
- Tauri: ~50 MB initial, ~80 MB with tasks

### Bundle Size

**Test:**
```bash
# Electron
npm run dist
du -sh dist/

# Tauri
npm run tauri:build
du -sh src-tauri/target/release/bundle/
```

**Expected Results:**
- Electron: ~150 MB
- Tauri: ~10-15 MB

## Comparison Testing

### Side-by-Side Test

1. **Export data from Electron:**
   ```bash
   # Find app data directory
   # Windows: %APPDATA%\upnext
   # macOS: ~/Library/Application Support/upnext
   # Linux: ~/.config/upnext
   
   # Copy tasks.json
   cp tasks.json tasks-electron.json
   ```

2. **Run Tauri version:**
   ```bash
   npm run tauri:dev
   ```

3. **Compare data:**
   ```bash
   # Find Tauri app data directory
   # Windows: %APPDATA%\com.abhi.upnext
   # macOS: ~/Library/Application Support/com.abhi.upnext
   # Linux: ~/.config/upnext
   
   # Copy tasks.json
   cp tasks.json tasks-tauri.json
   
   # Compare files
   diff tasks-electron.json tasks-tauri.json
   ```

### API Compatibility Test

**Test script:**
```javascript
// Run in browser console (F12)

// Test all API methods
const tests = [
  { name: 'loadTasks', fn: () => window.api.loadTasks() },
  { name: 'createTask', fn: () => window.api.createTask('Test task') },
  { name: 'togglePin', fn: () => window.api.togglePin() },
  { name: 'getPin', fn: () => window.api.getPin() },
];

for (const test of tests) {
  try {
    await test.fn();
    console.log(`✅ ${test.name} passed`);
  } catch (error) {
    console.error(`❌ ${test.name} failed:`, error);
  }
}
```

## Automated Testing

### Unit Tests (Future)

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

### Integration Tests (Future)

```bash
# Run integration tests
npm run test:integration
```

### E2E Tests (Future)

```bash
# Run end-to-end tests
npm run test:e2e
```

## Platform-Specific Tests

### Windows

- [ ] Test installation from .msi or .exe
- [ ] Check Start Menu shortcut
- [ ] Verify Desktop shortcut
- [ ] Test uninstallation
- [ ] Check WebView2 integration

### macOS

- [ ] Test installation from .dmg
- [ ] Verify app in Applications folder
- [ ] Test Dock icon
- [ ] Check system integration
- [ ] Verify app signing (if configured)

### Linux

- [ ] Test .deb installation (Ubuntu/Debian)
- [ ] Test .AppImage (universal)
- [ ] Verify desktop entry
- [ ] Check system tray integration
- [ ] Test on different distros

## Debugging Tips

### View Logs

**Electron:**
```bash
# Development mode - logs in terminal
npm run dev

# Production - logs in console
# Open DevTools: Ctrl+Shift+I (Windows/Linux) or Cmd+Opt+I (macOS)
```

**Tauri:**
```bash
# Development mode - logs in terminal
npm run tauri:dev

# Production - logs in console
# Open DevTools: F12 or right-click → Inspect
```

### Check App Data

**Find app data directory:**
```bash
# Electron
# Windows: %APPDATA%\upnext
# macOS: ~/Library/Application Support/upnext
# Linux: ~/.config/upnext

# Tauri
# Windows: %APPDATA%\com.abhi.upnext
# macOS: ~/Library/Application Support/com.abhi.upnext
# Linux: ~/.config/upnext
```

**Inspect files:**
```bash
# View tasks
cat tasks.json | jq .

# View window bounds
cat window-bounds.json | jq .

# View UI preferences
cat ui-prefs.json | jq .

# View notification settings
cat notification-settings.json | jq .
```

### Network Inspection

**Firebase requests:**
1. Open DevTools (F12)
2. Go to Network tab
3. Filter by "firebase" or "googleapis"
4. Perform actions (create task, sign in, etc.)
5. Verify requests succeed

## Troubleshooting Common Issues

### Tasks not loading

**Check:**
1. App data directory exists
2. tasks.json is valid JSON
3. File permissions are correct
4. No errors in console

**Fix:**
```bash
# Backup and recreate
cp tasks.json tasks.backup.json
echo "[]" > tasks.json
# Restart app
```

### Window state not saving

**Check:**
1. window-bounds.json exists
2. File is writable
3. App has proper permissions

**Fix:**
```bash
# Remove bounds file
rm window-bounds.json
# Restart app - creates new bounds file
```

### Theme not persisting

**Check:**
1. ui-prefs.json exists
2. Theme value is valid
3. No errors when saving

**Fix:**
```bash
# Reset preferences
rm ui-prefs.json
# Restart app
```

### Firebase sync not working

**Check:**
1. Internet connection active
2. Firebase config is correct
3. User is signed in
4. CORS is properly configured

**Fix:**
1. Sign out and sign in again
2. Check Firebase console for errors
3. Verify Firestore rules
4. Check network requests in DevTools

## Reporting Issues

When reporting bugs, include:

1. **Version:**
   - Electron or Tauri?
   - Version number?

2. **Platform:**
   - OS and version?
   - System specs?

3. **Steps to reproduce:**
   - Exact steps to trigger issue

4. **Expected vs actual:**
   - What should happen?
   - What actually happens?

5. **Logs:**
   - Console output
   - Error messages
   - Screenshots

6. **Data files (if relevant):**
   - tasks.json content
   - Settings files

## Success Criteria

Both versions should:
- ✅ Perform all operations identically
- ✅ Store data in compatible format
- ✅ Maintain same user experience
- ✅ Sync correctly with Firebase
- ✅ Handle errors gracefully
- ✅ Persist state correctly

## Next Steps

After testing:
1. Report any issues found
2. Document differences
3. Update test cases
4. Add automated tests
5. Create regression test suite

---

**Happy testing!** 🧪

For questions or issues, open a GitHub issue with test results.
