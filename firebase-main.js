// Firebase service for Electron main process
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy
} from 'firebase/firestore';
import { 
  getAuth, 
  signInAnonymously,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCredential,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';
import { firebaseConfig } from './firebase-config.js';

class FirebaseMainService {
  constructor() {
    this.app = null;
    this.db = null;
    this.auth = null;
    this.user = null;
    this.isInitialized = false;
  }

  async initialize() {
    try {
      // Initialize Firebase
      this.app = initializeApp(firebaseConfig);
      this.db = getFirestore(this.app);
      this.auth = getAuth(this.app);

      // Set up authentication persistence
      await this.setupAuthPersistence();

      // Check for stored authentication first
      const hasStoredAuth = await this.checkStoredAuth();
      
      if (!hasStoredAuth) {
        // Only authenticate if no stored auth found
        await this.authenticate();
      }
      
      this.isInitialized = true;
      
      return true;
    } catch (error) {
      console.error('Failed to initialize Firebase:', error);
      return false;
    }
  }

  async setupAuthPersistence() {
    try {
      // Set up persistent authentication
      await setPersistence(this.auth, browserLocalPersistence);
      
      // Set up auth state listener
      onAuthStateChanged(this.auth, (user) => {
        if (user && user !== this.user) {
          console.log('Auth state changed - user signed in:', user.email || 'anonymous');
          this.user = user;
          // Notify renderer process about auth change
          this.notifyAuthChange(user);
        } else if (!user && this.user) {
          console.log('Auth state changed - user signed out');
          this.user = null;
          this.notifyAuthChange(null);
        }
      });
    } catch (error) {
      console.error('Failed to setup auth persistence:', error);
    }
  }

  async checkStoredAuth() {
    try {
      console.log('Checking for stored authentication...');
      const { app } = await import('electron');
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const userDataPath = app.getPath('userData');
      const authFilePath = path.join(userDataPath, 'auth.json');
      
      try {
        const authData = await fs.readFile(authFilePath, 'utf8');
        const storedAuth = JSON.parse(authData);
        
        if (storedAuth && storedAuth.user && storedAuth.timestamp) {
          // Check if auth is not too old (24 hours)
          const now = Date.now();
          const authAge = now - storedAuth.timestamp;
          const maxAge = 24 * 60 * 60 * 1000; // 24 hours
          
          if (authAge < maxAge) {
            console.log('Found valid stored authentication for:', storedAuth.user.email);
            
            // We need to re-establish Firebase Auth context for Firestore permissions
            console.log('Re-establishing Firebase Auth for stored user...');
            try {
              // Sign in anonymously to get Firebase Auth context
              const result = await signInAnonymously(this.auth);
              console.log('Anonymous Firebase Auth established:', result.user.uid);
              
              // Now set the user with Firebase context
              this.user = {
                ...storedAuth.user,
                _firebaseUser: result.user // Add Firebase Auth context
              };
              
              console.log('Stored auth restored with Firebase context');
              
              // Delay notification to ensure window is ready
              setTimeout(() => {
                this.notifyAuthChange(this.user);
              }, 1000);
              
              return true;
            } catch (error) {
              console.error('Failed to re-establish Firebase Auth for stored user:', error);
              // Clear invalid stored auth
              await fs.unlink(authFilePath);
              return false;
            }
          } else {
            console.log('Stored authentication expired, removing...');
            await fs.unlink(authFilePath);
          }
        }
      } catch (error) {
        // File doesn't exist or is invalid, that's okay
        console.log('No stored authentication found');
      }
      
      return false;
    } catch (error) {
      console.error('Error checking stored auth:', error);
      return false;
    }
  }

  async storeAuth(user) {
    try {
      const { app } = await import('electron');
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const userDataPath = app.getPath('userData');
      const authFilePath = path.join(userDataPath, 'auth.json');
      
      const authData = {
        user: user,
        timestamp: Date.now()
      };
      
      await fs.writeFile(authFilePath, JSON.stringify(authData, null, 2));
      console.log('Authentication stored successfully');
    } catch (error) {
      console.error('Failed to store authentication:', error);
    }
  }

  async clearStoredAuth() {
    try {
      const { app } = await import('electron');
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const userDataPath = app.getPath('userData');
      const authFilePath = path.join(userDataPath, 'auth.json');
      
      await fs.unlink(authFilePath);
      console.log('Stored authentication cleared');
    } catch (error) {
      // File might not exist, that's okay
    }
  }

  async notifyAuthChange(user) {
    try {
      console.log('notifyAuthChange called with user:', user?.email);
      // Import BrowserWindow to send messages to renderer
      const { BrowserWindow } = await import('electron');
      const windows = BrowserWindow.getAllWindows();
      console.log('Found', windows.length, 'windows');
      
      if (windows.length > 0) {
        const userData = user ? {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          isAnonymous: user.isAnonymous
        } : null;
        
        console.log('Sending auth-state-changed event to renderer:', userData);
        windows[0].webContents.send('auth-state-changed', userData);
        console.log('Auth state change event sent successfully');
      } else {
        console.log('No windows found to send auth state change');
      }
    } catch (error) {
      console.error('Failed to notify auth change:', error);
    }
  }

  async signInWithGoogle() {
    try {
      // Import required modules
      const { shell, BrowserWindow } = await import('electron');
      const http = await import('http');
      const url = await import('url');
      
      return new Promise((resolve, reject) => {
        // Create a local server to handle OAuth callback
        const server = http.createServer();
        const PORT = 3000;
        
        server.listen(PORT, 'localhost', () => {
          console.log(`OAuth callback server listening on http://localhost:${PORT}`);
          
          // Build OAuth URL that redirects to our local server
          const authUrl = `https://upnext-97a2a.web.app?desktop_auth=true&callback_port=${PORT}`;
          
          console.log('Opening browser for Google sign-in...');
          shell.openExternal(authUrl);
          
          // Set timeout for auth process
          const timeout = setTimeout(() => {
            server.close();
            reject(new Error('Authentication timed out. Please try again.'));
          }, 300000); // 5 minutes
          
          // Handle the callback
          server.on('request', async (req, res) => {
            try {
              const parsedUrl = url.parse(req.url, true);
              console.log('Received callback request:', req.url);
              
              if (parsedUrl.pathname === '/auth/callback') {
                const { token, error, idToken, uid, email, displayName, photoURL } = parsedUrl.query;
                
                // Set CORS headers to allow the web app to make the request
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
                res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
                
                if (token === 'success' && idToken) {
                  console.log('Authentication callback received with ID token');
                  
                  // Send success response
                  res.writeHead(200, { 'Content-Type': 'text/plain' });
                  res.end('OK');
                  
                  clearTimeout(timeout);
                  server.close();
                  
                  try {
                    // Sign in to Firebase using the ID token from the web app
                    console.log('Signing in with ID token...');
                    
                    // We can't directly use the ID token in Electron, but we can create
                    // a custom token or use the shared authentication approach
                    
                    // For now, let's use a workaround: sign in anonymously and then
                    // override the user data with the real user info
                    const result = await signInAnonymously(this.auth);
                    
                    // Override the anonymous user with the real user data
                    this.user = {
                      uid: decodeURIComponent(uid),
                      email: decodeURIComponent(email),
                      displayName: decodeURIComponent(displayName) || null,
                      photoURL: decodeURIComponent(photoURL) || null,
                      emailVerified: true,
                      isAnonymous: false,
                      _idToken: decodeURIComponent(idToken),
                      _firebaseUser: result.user // Keep reference to actual Firebase user for auth
                    };
                    
                    console.log('User authenticated successfully:', this.user.email);
                    console.log('Firebase Auth UID:', result.user.uid);
                    console.log('Real User UID:', this.user.uid);
                    
                    // Store authentication for persistence
                    await this.storeAuth(this.user);
                    
                    // Notify the renderer process about the authentication
                    console.log('Notifying renderer of auth change...');
                    this.notifyAuthChange(this.user);
                    console.log('Auth change notification sent');
                    
                    resolve(this.user);
                    
                  } catch (authError) {
                    console.error('Failed to authenticate with ID token:', authError);
                    reject(new Error('Failed to authenticate with provided credentials'));
                  }
                  
                } else if (error) {
                  console.log('Authentication callback received with error:', error);
                  res.writeHead(400, { 'Content-Type': 'text/plain' });
                  res.end('Error: ' + error);
                  
                  clearTimeout(timeout);
                  server.close();
                  reject(new Error(decodeURIComponent(error)));
                } else {
                  // Unknown callback
                  res.writeHead(400, { 'Content-Type': 'text/plain' });
                  res.end('Invalid callback');
                  
                  clearTimeout(timeout);
                  server.close();
                  reject(new Error('Invalid authentication callback'));
                }
              } else {
                // Not the auth callback path
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('Not found');
              }
            } catch (error) {
              console.error('Error handling auth callback:', error);
              res.writeHead(500, { 'Content-Type': 'text/plain' });
              res.end('Server error');
              
              clearTimeout(timeout);
              server.close();
              reject(error);
            }
          });
        });
        
        server.on('error', (error) => {
          if (error.code === 'EADDRINUSE') {
            // Port is in use, try a different approach
            console.log('Port 3000 is in use, falling back to web app method...');
            shell.openExternal('https://upnext-97a2a.web.app');
            reject(new Error('Please sign in via the web browser. The desktop app will automatically detect when you sign in.\n\nTip: Keep the desktop app open while signing in via the web browser.'));
          } else {
            reject(error);
          }
        });
      });
      
    } catch (error) {
      console.error('Google sign-in failed:', error);
      throw error;
    }
  }

  async signInAnonymously() {
    try {
      const result = await signInAnonymously(this.auth);
      this.user = result.user;
      
      console.log('Signed in anonymously:', this.user.uid);
      return this.user;
    } catch (error) {
      console.error('Anonymous sign-in failed:', error);
      throw error;
    }
  }

  // Try Google sign-in first, fallback to anonymous
  async authenticate() {
    try {
      // Check if user is already signed in
      if (this.auth.currentUser) {
        this.user = this.auth.currentUser;
        console.log('Already signed in:', this.user.email || 'anonymous');
        return this.user;
      }

      // For production, use Google sign-in
      // For development/testing, use shared anonymous account
      const useGoogleAuth = process.env.NODE_ENV === 'production' || process.env.FORCE_GOOGLE_AUTH === 'true';
      
      if (useGoogleAuth) {
        return await this.signInWithGoogle();
      } else {
        // Development mode: use shared anonymous account (same as web app)
        const result = await signInAnonymously(this.auth);
        this.user = {
          uid: 'shared-user-upnext',
          email: null,
          displayName: 'Development User',
          photoURL: null,
          emailVerified: false,
          isAnonymous: true,
          _originalUser: result.user
        };
        console.log('Development mode: using shared account');
        return this.user;
      }
    } catch (error) {
      console.log('Primary auth failed, falling back to anonymous:', error.message);
      return await this.signInAnonymously();
    }
  }

  // Get user's tasks collection reference
  getTasksCollection() {
    if (!this.user) throw new Error('User not authenticated');
    
    // IMPORTANT: Both desktop and web apps should use the SAME collection for sync
    // We'll use the real user's collection and update Firestore rules to allow anonymous access
    
    console.log('Getting tasks collection for user:', this.user.uid, this.user.email);
    if (this.user._firebaseUser) {
      console.log('Firebase Auth user:', this.user._firebaseUser.uid, this.user._firebaseUser.isAnonymous ? '(anonymous)' : '(authenticated)');
    }
    
    // Always use the real user's collection for sync
    return collection(this.db, 'users', this.user.uid, 'tasks');
  }

  // Load all tasks
  async loadTasks() {
    try {
      if (!this.isInitialized) return [];
      if (!this.user) await this.signInAnonymously();
      
      const tasksRef = this.getTasksCollection();
      const q = query(tasksRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      
      const tasks = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        tasks.push({
          id: doc.id,
          ...data,
          // Convert Firestore timestamps to JS timestamps
          createdAt: data.createdAt?.toMillis?.() || data.createdAt,
          updatedAt: data.updatedAt?.toMillis?.() || data.updatedAt,
          completedAt: data.completedAt?.toMillis?.() || data.completedAt,
          dueAt: data.dueAt?.toMillis?.() || data.dueAt
        });
      });
      
      return tasks;
    } catch (error) {
      console.error('Failed to load tasks:', error);
      return [];
    }
  }

  // Create a new task
  async createTask(taskData) {
    try {
      if (!this.isInitialized) throw new Error('Firebase not initialized');
      if (!this.user) await this.signInAnonymously();
      
      const tasksRef = this.getTasksCollection();
      const docRef = await addDoc(tasksRef, {
        ...taskData,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      const newTask = {
        id: docRef.id,
        ...taskData,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      
      return newTask;
    } catch (error) {
      console.error('Failed to create task:', error);
      throw error;
    }
  }

  // Update a task
  async updateTask(taskId, updates) {
    try {
      if (!this.isInitialized) throw new Error('Firebase not initialized');
      if (!this.user) await this.signInAnonymously();
      
      const taskRef = doc(this.getTasksCollection(), taskId);
      const updateData = {
        ...updates,
        updatedAt: new Date()
      };
      
      await updateDoc(taskRef, updateData);
      
      return {
        id: taskId,
        ...updates,
        updatedAt: Date.now()
      };
    } catch (error) {
      console.error('Failed to update task:', error);
      throw error;
    }
  }

  // Delete a task
  async deleteTask(taskId) {
    try {
      if (!this.isInitialized) throw new Error('Firebase not initialized');
      if (!this.user) await this.signInAnonymously();
      
      const taskRef = doc(this.getTasksCollection(), taskId);
      await deleteDoc(taskRef);
      
      return true;
    } catch (error) {
      console.error('Failed to delete task:', error);
      throw error;
    }
  }

  // Clear completed tasks
  async clearCompleted() {
    try {
      if (!this.isInitialized) throw new Error('Firebase not initialized');
      
      const tasks = await this.loadTasks();
      const completedTasks = tasks.filter(t => t.completed);
      
      // Delete each completed task
      const deletePromises = completedTasks.map(task => this.deleteTask(task.id));
      await Promise.all(deletePromises);
      
      return completedTasks.length;
    } catch (error) {
      console.error('Failed to clear completed tasks:', error);
      throw error;
    }
  }

  // Sign out user
  async signOut() {
    try {
      await signOut(this.auth);
      
      // Clear stored authentication
      await this.clearStoredAuth();
      
      this.user = null;
      this.notifyAuthChange(null);
      console.log('User signed out');
    } catch (error) {
      console.error('Sign out failed:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const firebaseMainService = new FirebaseMainService();
