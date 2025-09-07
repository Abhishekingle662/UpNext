#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Read package.json to get current version
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const version = packageJson.version;
const productName = packageJson.build.productName || packageJson.name;

console.log(`📦 Creating ZIP distribution for ${productName} v${version}`);

// Paths
const unpackedDir = path.join('dist', 'win-unpacked');
const zipFileName = `${productName}-v${version}-Portable.zip`;
const zipPath = path.join('dist', zipFileName);

// Check if unpacked directory exists
if (!fs.existsSync(unpackedDir)) {
    console.error('❌ Unpacked directory not found. Run "npm run pack" first.');
    process.exit(1);
}

try {
    // Remove old ZIP if exists
    if (fs.existsSync(zipPath)) {
        fs.unlinkSync(zipPath);
        console.log(`🗑️  Removed old ZIP: ${zipFileName}`);
    }

    // Create ZIP using PowerShell (Windows built-in)
    const powershellCommand = `Compress-Archive -Path "${unpackedDir}\\*" -DestinationPath "${zipPath}" -Force`;
    
    console.log('🔄 Creating ZIP archive...');
    execSync(`powershell -Command "${powershellCommand}"`, { stdio: 'inherit' });
    
    // Get file size
    const stats = fs.statSync(zipPath);
    const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
    
    console.log('✅ ZIP distribution created successfully!');
    console.log(`📁 File: ${zipPath}`);
    console.log(`📊 Size: ${fileSizeInMB} MB`);
    console.log(`🎯 Version: ${version}`);
    
    // Create/update release info
    const releaseInfo = {
        version: version,
        productName: productName,
        fileName: zipFileName,
        size: `${fileSizeInMB} MB`,
        createdAt: new Date().toISOString(),
        type: 'portable'
    };
    
    const releaseInfoPath = path.join('dist', 'release-info.json');
    fs.writeFileSync(releaseInfoPath, JSON.stringify(releaseInfo, null, 2));
    
    console.log('📋 Release info saved to dist/release-info.json');
    
} catch (error) {
    console.error('❌ Failed to create ZIP distribution:', error.message);
    process.exit(1);
}
