#!/usr/bin/env node
// Bumps version in package.json, src-tauri/tauri.conf.json, and src-tauri/Cargo.toml.
// Usage: node increment-version.cjs [patch|minor|major]
'use strict';
const fs = require('fs');

const type = process.argv[2] || 'patch';

// ── package.json ──────────────────────────────────────────────────────────
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const [major, minor, patch] = pkg.version.split('.').map(Number);
const next =
  type === 'major' ? `${major + 1}.0.0` :
  type === 'minor' ? `${major}.${minor + 1}.0` :
                     `${major}.${minor}.${patch + 1}`;

pkg.version = next;
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
console.log(`package.json          → ${next}`);

// ── src-tauri/tauri.conf.json ─────────────────────────────────────────────
const confPath = 'src-tauri/tauri.conf.json';
if (fs.existsSync(confPath)) {
  const conf = JSON.parse(fs.readFileSync(confPath, 'utf8'));
  conf.package = conf.package || {};
  conf.package.version = next;
  fs.writeFileSync(confPath, JSON.stringify(conf, null, 2) + '\n');
  console.log(`tauri.conf.json       → ${next}`);
}

// ── src-tauri/Cargo.toml ──────────────────────────────────────────────────
const cargoPath = 'src-tauri/Cargo.toml';
if (fs.existsSync(cargoPath)) {
  const cargo = fs.readFileSync(cargoPath, 'utf8')
    .replace(/^version = "[\d.]+"$/m, `version = "${next}"`);
  fs.writeFileSync(cargoPath, cargo);
  console.log(`Cargo.toml            → ${next}`);
}

console.log(`\nVersion bumped: ${pkg.version.replace(next, '')}${next}`);
