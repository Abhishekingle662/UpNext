const CACHE_NAME = 'upnext-v0.2.0';
const STATIC_CACHE_URLS = [
  '/',
  '/index.html',
  '/web-styles.css',
  '/web-app.js',
  '/firebase-config.js',
  '/manifest.json',
  '/favicon.ico',
  '/favicon.png',
  '/icon-72.png',
  '/icon-96.png',
  '/icon-128.png',
  '/icon-144.png',
  '/icon-152.png',
  '/icon-192.png',
  '/icon-384.png',
  '/icon-512.png'
];

// Install event - cache static resources
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching static files');
        return cache.addAll(STATIC_CACHE_URLS);
      })
      .then(() => {
        console.log('Service Worker: Skip waiting');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Service Worker: Cache failed', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => cacheName !== CACHE_NAME)
            .map((cacheName) => {
              console.log('Service Worker: Deleting old cache', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => {
        console.log('Service Worker: Claiming clients');
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }
  
  // Skip Firebase API calls
  if (event.request.url.includes('firebaseapp.com') || 
      event.request.url.includes('googleapis.com') ||
      event.request.url.includes('firebase')) {
    return;
  }
  
  // Force fresh fetch for manifest and icons to ensure updates
  if (event.request.url.includes('manifest.json') || 
      event.request.url.includes('icon-') ||
      event.request.url.includes('favicon')) {
    event.respondWith(
      fetch(event.request, { cache: 'no-cache' })
        .then((response) => {
          if (response && response.status === 200) {
            // Add cache-busting headers
            const modifiedResponse = new Response(response.body, {
              status: response.status,
              statusText: response.statusText,
              headers: {
                ...Object.fromEntries(response.headers.entries()),
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
              }
            });
            return modifiedResponse;
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          console.log('Service Worker: Serving from cache', event.request.url);
          return cachedResponse;
        }
        
        console.log('Service Worker: Fetching from network', event.request.url);
        return fetch(event.request)
          .then((response) => {
            // Don't cache non-successful responses
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Clone the response before caching
            const responseToCache = response.clone();
            
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });
            
            return response;
          })
          .catch((error) => {
            console.error('Service Worker: Fetch failed', error);
            
            // Return a fallback response for navigation requests
            if (event.request.mode === 'navigate') {
              return caches.match('/index.html');
            }
            
            throw error;
          });
      })
  );
});

// Background sync for offline task creation
self.addEventListener('sync', (event) => {
  console.log('Service Worker: Background sync triggered', event.tag);
  
  if (event.tag === 'background-sync-tasks') {
    event.waitUntil(syncTasks());
  }
});

async function syncTasks() {
  try {
    // This would sync any offline-created tasks
    console.log('Service Worker: Syncing tasks...');
    
    // Notify all clients that sync is happening
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_STARTED'
      });
    });

    // Check if we have offline tasks or queue to sync
    // The main app will handle the actual sync logic
    clients.forEach(client => {
      client.postMessage({
        type: 'PROCESS_OFFLINE_QUEUE'
      });
    });
    
    // Notify completion
    setTimeout(() => {
      clients.forEach(client => {
        client.postMessage({
          type: 'SYNC_COMPLETED'
        });
      });
    }, 1000);
    
  } catch (error) {
    console.error('Service Worker: Sync failed', error);
    
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_FAILED',
        error: error.message
      });
    });
  }
}

// Push notifications (for future enhancement)
self.addEventListener('push', (event) => {
  console.log('Service Worker: Push received', event);
  
  if (!event.data) return;
  
  const data = event.data.json();
  const options = {
    body: data.body || 'You have a task due soon!',
    icon: '/icon-192.png',
    badge: '/icon-72.png',
    tag: 'task-reminder',
    requireInteraction: true,
    actions: [
      {
        action: 'view',
        title: 'View Task',
        icon: '/icon-96.png'
      },
      {
        action: 'dismiss',
        title: 'Dismiss',
        icon: '/icon-96.png'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'UpNext Reminder', options)
  );
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: Notification clicked', event);
  
  event.notification.close();
  
  if (event.action === 'view') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Message handling from main app
self.addEventListener('message', (event) => {
  console.log('Service Worker: Message received', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    // Handle notification requests from main app
    const { title, body, icon, tag, requireInteraction, actions, data, badge } = event.data.data;
    
    self.registration.showNotification(title, {
      body: body,
      icon: icon || '/icon-192.png',
      badge: badge || '/icon-72.png',
      tag: tag,
      requireInteraction: requireInteraction || false,
      actions: actions || [],
      data: data || {},
      vibrate: [200, 100, 200],
      timestamp: Date.now()
    });
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: Notification clicked', event);
  
  const notification = event.notification;
  const action = event.action;
  const data = notification.data;
  
  notification.close();
  
  // Handle different actions
  if (action === 'complete') {
    // Send message to main app to complete task
    event.waitUntil(
      self.clients.matchAll().then(clients => {
        if (clients.length > 0) {
          clients[0].postMessage({
            type: 'NOTIFICATION_ACTION',
            action: 'complete',
            taskId: data.taskId
          });
        }
      })
    );
  } else if (action === 'snooze') {
    // Send message to main app to snooze task
    event.waitUntil(
      self.clients.matchAll().then(clients => {
        if (clients.length > 0) {
          clients[0].postMessage({
            type: 'NOTIFICATION_ACTION',
            action: 'snooze',
            taskId: data.taskId
          });
        }
      })
    );
  } else if (action === 'view' || !action) {
    // Open or focus the app
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then(clients => {
        // Check if app is already open
        for (const client of clients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        // If no window is open, open a new one
        if (self.clients.openWindow) {
          return self.clients.openWindow('/');
        }
      })
    );
  }
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  console.log('Service Worker: Notification closed', event);
});
