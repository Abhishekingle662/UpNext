#!/usr/bin/env node

const fs = require('fs');

// Read package.json
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const currentVersion = packageJson.version;
const versionParts = currentVersion.split('.').map(Number);

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
fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2) + '\n');
console.log(`Updated package.json: ${currentVersion} → ${newVersion}`);

// Update src-tauri/tauri.conf.json
const tauriConfPath = 'src-tauri/tauri.conf.json';
if (fs.existsSync(tauriConfPath)) {
    const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));
    tauriConf.package = tauriConf.package || {};
    tauriConf.package.version = newVersion;
    fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n');
    console.log(`Updated ${tauriConfPath}`);
}

// Update src-tauri/Cargo.toml
const cargoPath = 'src-tauri/Cargo.toml';
if (fs.existsSync(cargoPath)) {
    let cargo = fs.readFileSync(cargoPath, 'utf8');
    cargo = cargo.replace(/^version = "[\d.]+"$/m, `version = "${newVersion}"`);
    fs.writeFileSync(cargoPath, cargo);
    console.log(`Updated ${cargoPath}`);
}

console.log(`Version bumped to ${newVersion}`);
