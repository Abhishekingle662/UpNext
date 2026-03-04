#!/usr/bin/env node

import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function setup() {
    console.log('Setting up UpNext...\n');

    try {
        const webConfigExists = await fs.access(path.join(__dirname, 'web', 'firebase-config.js')).then(() => true).catch(() => false);

        if (!webConfigExists) {
            console.log('Copying web/firebase-config.template.js to web/firebase-config.js...');
            await fs.copyFile(
                path.join(__dirname, 'web', 'firebase-config.template.js'),
                path.join(__dirname, 'web', 'firebase-config.js')
            );
            console.log('Created web/firebase-config.js');
        } else {
            console.log('web/firebase-config.js already exists');
        }

        console.log('\nNext steps:');
        console.log('1. Set up Firebase project (see SETUP_INSTRUCTIONS.md)');
        console.log('2. Update web/firebase-config.js with your Firebase credentials');
        console.log('3. Run "npm run tauri:dev" for the desktop app');
        console.log('4. Run "npm run serve-web" for the web app');

        console.log('\nDocumentation:');
        console.log('- SETUP_INSTRUCTIONS.md - Complete setup guide');
        console.log('- FIREBASE_SETUP.md - Firebase configuration');
        console.log('- PRODUCTION_DEPLOYMENT.md - Deploy to production');

        console.log('\nSetup complete!');

    } catch (error) {
        console.error('Setup failed:', error.message);
        process.exit(1);
    }
}

setup();
