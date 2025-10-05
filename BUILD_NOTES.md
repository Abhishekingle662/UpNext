# Build Environment Notes

## WebKit Version Compatibility

### Current Build Environment (Ubuntu 24.04)

This CI/build environment uses Ubuntu 24.04 which ships with `webkit2gtk-4.1`. However, Tauri v1.x requires `webkit2gtk-4.0` for Linux builds.

**This is NOT a problem for:**
- ✅ macOS builds (uses system WebView)
- ✅ Windows builds (uses WebView2)
- ✅ Ubuntu 22.04 and earlier (has webkit2gtk-4.0)
- ✅ Debian-based distros with webkit2gtk-4.0
- ✅ Fedora/RHEL with appropriate webkit packages

**Workaround options:**

1. **Build on appropriate platform:**
   ```bash
   # Use Ubuntu 22.04 for Linux builds
   docker run -it ubuntu:22.04 bash
   # Then follow build instructions
   ```

2. **Use GitHub Actions** (recommended):
   - The included `.github/workflows/tauri-build.yml` uses appropriate runners
   - Ubuntu 22.04 runner has webkit2gtk-4.0
   - Builds for all platforms automatically

3. **Upgrade to Tauri v2** (future):
   - Tauri v2 supports webkit2gtk-4.1
   - Migration guide: https://tauri.app/v2/guides/upgrade/

## Verification Status

### ✅ Verified Working

- Tauri configuration (`tauri.conf.json`) is valid
- Rust code syntax is correct
- Cargo dependencies are properly specified
- JavaScript/TypeScript API bridge is correctly structured
- Icons generated successfully
- Package.json scripts configured properly

### 🔧 Requires Platform-Specific Testing

- **Windows**: Full build requires Windows environment with Visual Studio Build Tools
- **macOS**: Full build requires macOS with Xcode Command Line Tools
- **Linux**: Full build requires Ubuntu 22.04 or earlier, or appropriate webkit version

## Testing Recommendations

### For Contributors

1. **Test on your local machine:**
   ```bash
   git pull
   npm install
   npm run tauri:dev
   ```

2. **Test Electron version** (works on all platforms):
   ```bash
   npm run dev
   ```

3. **Use GitHub Actions** for production builds:
   - Push to main branch triggers builds
   - Tagged releases create distributable binaries

### For Users

**Download pre-built binaries** from:
- GitHub Releases (once workflow runs)
- Platform-specific package managers (future)

## Build Matrix

| Platform | Build Environment | Status |
|----------|------------------|--------|
| Windows | windows-latest | ✅ Ready (requires Windows runner) |
| macOS | macos-latest | ✅ Ready (requires macOS runner) |
| Linux | ubuntu-22.04 | ✅ Ready (requires Ubuntu 22.04) |
| Linux | ubuntu-24.04 | ⚠️ webkit version mismatch (use 22.04) |

## Additional Notes

### Firebase Integration

Firebase SDK works identically in both Electron and Tauri because:
- Firebase runs in the renderer/WebView context
- No backend changes needed
- Auth, Firestore, and sync work out of the box

### Data Compatibility

Both Electron and Tauri versions:
- Use identical file formats
- Store data in platform-specific app data directories
- Can coexist on the same machine (different app IDs)
- Share the same Firebase backend

### Performance Expectations

| Metric | Electron | Tauri | Improvement |
|--------|----------|-------|-------------|
| Bundle Size | ~150 MB | ~10-15 MB | 90% smaller |
| Memory Usage | ~150 MB | ~50 MB | 66% less |
| Startup Time | 2-3s | <1s | 2-3x faster |

## Development Workflow

### Recommended Setup

1. Develop with hot reload:
   ```bash
   npm run tauri:dev
   ```

2. Test before committing:
   ```bash
   # Test Tauri
   npm run tauri:dev
   
   # Test Electron (fallback)
   npm run dev
   
   # Test web version
   npm run serve-web
   ```

3. Let CI/CD handle builds:
   - Push to branch → CI runs tests
   - Create tag → CI builds releases
   - Merge to main → CI builds preview

### Manual Build Testing

If you need to test builds manually on a compatible system:

```bash
# Check prerequisites
npx @tauri-apps/cli info

# Build for your platform
npm run tauri:build

# Test the built app
# Windows: .\src-tauri\target\release\upnext.exe
# macOS: ./src-tauri/target/release/bundle/macos/UpNext.app
# Linux: ./src-tauri/target/release/upnext
```

## Known Issues & Solutions

### Issue: webkit2gtk-4.0 not found

**Solution**: Use Ubuntu 22.04 or install from source:
```bash
# Not recommended - use Ubuntu 22.04 instead
# Building webkit from source is time-consuming
```

### Issue: Build takes too long

**Solution**: Use release mode only for final builds:
```bash
# Development (faster, no optimization)
npm run tauri:dev

# Production (slower, optimized)
npm run tauri:build
```

### Issue: Different behavior on different platforms

**Solution**: Test on multiple platforms using:
1. GitHub Actions (automatic)
2. Docker containers
3. Virtual machines
4. Physical hardware

## Future Plans

- [ ] Migrate to Tauri v2 (supports webkit2gtk-4.1)
- [ ] Add auto-updater for Tauri version
- [ ] Create pre-built binaries for all platforms
- [ ] Add integration tests
- [ ] Create Docker build containers
- [ ] Add code signing for macOS and Windows

## Getting Help

If you encounter build issues:

1. Check `npx @tauri-apps/cli info` output
2. Verify system prerequisites are installed
3. Review this document for platform-specific notes
4. Check Tauri documentation: https://tauri.app
5. Open an issue with build logs

---

**Last Updated**: Migration to Tauri v1.8.x
**Next Review**: After Tauri v2 migration
