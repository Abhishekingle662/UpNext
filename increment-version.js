#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Read package.json
const packageJsonPath = 'package.json';
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// Parse current version
const currentVersion = packageJson.version;
const versionParts = currentVersion.split('.').map(Number);

// Get increment type from command line argument
const incrementType = process.argv[2] || 'patch';

let newVersion;
switch (incrementType) {
    case 'major':
        newVersion = `${versionParts[0] + 1}.0.0`;
        break;
    case 'minor':
        newVersion = `${versionParts[0]}.${versionParts[1] + 1}.0`;
        break;
    case 'patch':
    default:
        newVersion = `${versionParts[0]}.${versionParts[1]}.${versionParts[2] + 1}`;
        break;
}

// Update package.json
packageJson.version = newVersion;
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

console.log(`🔼 Version incremented: ${currentVersion} → ${newVersion}`);
console.log(`📝 Updated ${packageJsonPath}`);

// Update any version info files if they exist
const versionFiles = [
    'src/version.js',
    'renderer/version.js',
    'version.txt'
];

versionFiles.forEach(file => {
    if (fs.existsSync(file)) {
        let content = fs.readFileSync(file, 'utf8');
        content = content.replace(/version.*?['"`][\d.]+['"`]/gi, `version: '${newVersion}'`);
        fs.writeFileSync(file, content);
        console.log(`📝 Updated ${file}`);
    }
});

console.log('✅ Version increment complete!');
