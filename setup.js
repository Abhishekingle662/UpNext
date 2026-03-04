// Initial project setup — copies the Firebase config template.
// Run once after cloning: node setup.js
import fs   from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function setup() {
  console.log('Setting up UpNext...\n');

  const src  = path.join(__dirname, 'web', 'firebase-config.template.js');
  const dest = path.join(__dirname, 'web', 'firebase-config.js');

  const exists = await fs.access(dest).then(() => true).catch(() => false);
  if (exists) {
    console.log('web/firebase-config.js already exists — skipping.');
  } else {
    await fs.copyFile(src, dest);
    console.log('Created web/firebase-config.js from template.');
    console.log('→ Fill in your Firebase project credentials before running the web app.');
  }

  console.log('\nNext steps:');
  console.log('  npm run tauri:dev    — launch Tauri desktop app');
  console.log('  npm run serve-web    — launch web app at http://localhost:3000');
  console.log('\nSee SETUP_INSTRUCTIONS.md for Firebase and release setup.');
}

setup().catch((e) => { console.error('Setup failed:', e.message); process.exit(1); });
