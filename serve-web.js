import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PORT = process.env.PORT || 3000;

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml'
};

async function serveFile(filePath, res) {
  try {
    const fullPath = join(__dirname, filePath);
    await stat(fullPath);
    
    const ext = extname(filePath);
    const contentType = MIME_TYPES[ext] || 'text/plain';
    
    const content = await readFile(fullPath);
    
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache'
    });
    res.end(content);
  } catch (error) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
}

const server = createServer(async (req, res) => {
  // Add CORS headers for development
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Add Content Security Policy for Firebase and Google services
  res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' https://www.gstatic.com https://apis.google.com https://identitytoolkit.googleapis.com; img-src 'self' data: https://*.googleusercontent.com https://*.googleapis.com; connect-src 'self' https://*.googleapis.com https://*.google.com wss://*.firebaseio.com https://*.firebaseio.com;");
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  let url = req.url;
  
  // Route handling
  if (url === '/' || url === '/index.html') {
    await serveFile('web/index.html', res);
  } else if (url.startsWith('/web/')) {
    await serveFile(url.substring(1), res);
  } else {
    // Try to serve from web directory
    await serveFile(`web${url}`, res);
  }
});

server.listen(PORT, () => {
  console.log(`🚀 UpNext Web Server running at:`);
  console.log(`   Local:   http://localhost:${PORT}`);
  console.log(`   Network: http://192.168.1.x:${PORT} (check your IP)`);
  console.log('');
  console.log('📱 To access on your phone:');
  console.log('   1. Connect phone to same WiFi network');
  console.log('   2. Find your computer\'s IP address');
  console.log('   3. Open http://YOUR_IP:3000 on your phone');
  console.log('   4. Add to home screen for app-like experience');
  console.log('');
  console.log('🔧 Make sure to configure Firebase first (see FIREBASE_SETUP.md)');
});
