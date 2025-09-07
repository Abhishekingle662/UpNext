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
  orderBy, 
  onSnapshot,
  enableNetwork,
  disableNetwork
} from 'firebase/firestore';
import { 
  getAuth, 
  signInAnonymously, 
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged 
} from 'firebase/auth';
import { firebaseConfig } from './firebase-config.js';

class WebTaskApp {
    constructor() {
        this.tasks = [];
        this.isOnline = navigator.onLine;
        this.syncStatus = 'connecting';
        this.unsubscribe = null;
        
        // Firebase instances
        this.app = null;
        this.db = null;
        this.auth = null;
        this.user = null;
        
        // PWA install prompt
        this.deferredPrompt = null;
        this.installButton = null;
        
        // DOM elements
        this.elements = {
            form: document.getElementById('newTaskForm'),
            input: document.getElementById('taskInput'),
            list: document.getElementById('list'),
            empty: document.getElementById('empty'),
            count: document.getElementById('count'),
            clearBtn: document.getElementById('clearCompleted'),
            themeBtn: document.getElementById('themeBtn'),
            syncStatus: document.getElementById('syncStatus'),
            syncIcon: document.querySelector('.sync-icon'),
            syncText: document.querySelector('.sync-text'),
            offlineIndicator: document.getElementById('offlineIndicator'),
            loadingIndicator: document.getElementById('loadingIndicator'),
            template: document.getElementById('taskTemplate'),
            // Auth elements
            userInfo: document.getElementById('userInfo'),
            userPhoto: document.getElementById('userPhoto'),
            userName: document.getElementById('userName'),
            signInBtn: document.getElementById('signInBtn'),
            signOutBtn: document.getElementById('signOutBtn')
        };
        
        this.init();
    }
    
    async init() {
        try {
            console.log('🚀 Initializing web app...');
            console.log('🌍 Current URL:', window.location.href);
            console.log('🏠 Hostname:', window.location.hostname);
            console.log('🔍 Is production?', window.location.hostname !== 'localhost');
            
            // Check if this is a desktop authentication request
            const urlParams = new URLSearchParams(window.location.search);
            const isDesktopAuth = urlParams.has('desktop_auth');
            const callbackPort = urlParams.get('callback_port');
            
            console.log('📱 Desktop auth?', isDesktopAuth);
            
            // Initialize Firebase
            console.log('🔥 Initializing Firebase...');
            await this.initializeFirebase();
            console.log('✅ Firebase initialized successfully');
            
            // Handle desktop authentication callback
            if (isDesktopAuth && callbackPort) {
                console.log('📱 Handling desktop auth callback...');
                await this.handleDesktopAuthCallback(callbackPort);
                return; // Don't continue with normal initialization
            }
            
            this.syncStatus = 'synced';
            this.updateSyncStatus();
            
            // Update UI based on user
            this.updateUserUI();
            
            console.log('👤 Current user after init:', this.user ? `${this.user.email} (${this.user.uid})` : 'None');
            
        } catch (error) {
            console.error('❌ Initialization failed:', error);
            console.error('Error details:', error.code, error.message);
            this.syncStatus = 'error';
            this.updateSyncStatus();
        }
        
        this.setupEventListeners();
        this.setupNetworkListeners();
        this.setupPWAInstall();
        this.loadTheme();
        this.hideLoadingIndicator();
        this.registerServiceWorker();
    }

    async handleDesktopAuthCallback(callbackPort) {
        try {
            console.log('Handling desktop authentication callback...');
            
            // Show desktop auth UI
            document.body.innerHTML = `
                <div style="font-family: Arial, sans-serif; text-align: center; padding: 50px; max-width: 500px; margin: 0 auto;">
                    <h1>🖥️ Desktop App Authentication</h1>
                    <p>Please sign in with Google to connect your desktop app.</p>
                    <button id="desktopSignIn" style="
                        background: #4285f4; 
                        color: white; 
                        border: none; 
                        padding: 12px 24px; 
                        border-radius: 6px; 
                        font-size: 16px; 
                        cursor: pointer;
                        margin: 20px;
                    ">Sign In with Google</button>
                    <p><small>This will authenticate your UpNext desktop app with your Google account.</small></p>
                </div>
            `;
            
            // Set up sign-in handler
            document.getElementById('desktopSignIn').addEventListener('click', async () => {
                try {
                    console.log('🔐 Desktop sign-in button clicked');
                    await this.signInWithGoogle();
                    
                    if (this.user && !this.user.isAnonymous) {
                        console.log('✅ User signed in successfully, preparing callback...');
                        
                        // Show success message
                        document.body.innerHTML = `
                            <div style="font-family: Arial, sans-serif; text-align: center; padding: 50px; max-width: 500px; margin: 0 auto;">
                                <h2>✅ Authentication Successful!</h2>
                                <p>You are now signed in as <strong>${this.user.email}</strong></p>
                                <p>Connecting to your desktop app...</p>
                                <div style="margin: 20px 0;">
                                    <div style="display: inline-block; width: 20px; height: 20px; border: 2px solid #4285f4; border-radius: 50%; border-top-color: transparent; animation: spin 1s linear infinite;"></div>
                                </div>
                                <style>
                                    @keyframes spin { to { transform: rotate(360deg); } }
                                </style>
                            </div>
                        `;
                        
                        // Get the ID token for the desktop app
                        console.log('🎫 Getting ID token...');
                        const idToken = await this.user.getIdToken();
                        console.log('✅ ID token obtained');
                        
                        // Send success callback to desktop app with auth token
                        const callbackUrl = `http://localhost:${callbackPort}/auth/callback?token=success&idToken=${encodeURIComponent(idToken)}&uid=${encodeURIComponent(this.user.uid)}&email=${encodeURIComponent(this.user.email)}&displayName=${encodeURIComponent(this.user.displayName || '')}&photoURL=${encodeURIComponent(this.user.photoURL || '')}`;
                        
                        console.log('📡 Sending callback to desktop app:', callbackUrl);
                        
                        // Use fetch to send callback instead of redirect
                        try {
                            const response = await fetch(callbackUrl, { 
                                method: 'GET',
                                mode: 'no-cors'
                            });
                            console.log('✅ Callback sent successfully');
                            
                            // Show completion message
                            setTimeout(() => {
                                document.body.innerHTML = `
                                    <div style="font-family: Arial, sans-serif; text-align: center; padding: 50px; max-width: 500px; margin: 0 auto;">
                                        <h2>🎉 All Set!</h2>
                                        <p>Your desktop app has been authenticated successfully.</p>
                                        <p>You can now close this window and return to your desktop app.</p>
                                        <button onclick="window.close()" style="
                                            background: #4285f4; 
                                            color: white; 
                                            border: none; 
                                            padding: 12px 24px; 
                                            border-radius: 6px; 
                                            font-size: 16px; 
                                            cursor: pointer;
                                            margin: 20px;
                                        ">Close Window</button>
                                    </div>
                                `;
                            }, 2000);
                        } catch (error) {
                            console.log('📡 Callback sent (CORS expected):', error);
                            // CORS error is expected, but the request should still reach the desktop app
                            document.body.innerHTML = `
                                <div style="font-family: Arial, sans-serif; text-align: center; padding: 50px; max-width: 500px; margin: 0 auto;">
                                    <h2>🎉 Authentication Complete!</h2>
                                    <p>Please return to your desktop app.</p>
                                    <p><small>You can close this window now.</small></p>
                                </div>
                            `;
                        }
                    } else {
                        throw new Error('Authentication failed');
                    }
                } catch (error) {
                    console.error('❌ Desktop auth failed:', error);
                    // Send error callback
                    const callbackUrl = `http://localhost:${callbackPort}/auth/callback?error=${encodeURIComponent(error.message)}`;
                    console.log('📡 Sending error callback:', callbackUrl);
                    window.location.href = callbackUrl;
                }
            });
            
        } catch (error) {
            console.error('Desktop auth callback failed:', error);
        }
    }
    
    async initializeFirebase() {
        try {
            console.log('🔥 Initializing Firebase...');
            
            // Initialize Firebase
            this.app = initializeApp(firebaseConfig);
            this.db = getFirestore(this.app);
            this.auth = getAuth(this.app);

            console.log('🔥 Firebase initialized, setting up auth persistence...');
            
            // Firebase Auth automatically handles persistence in web browsers
            console.log('✅ Firebase Auth persistence is automatic in browsers');

            console.log('🔥 Waiting for auth state...');
            // Wait for authentication state to be restored
            await this.waitForAuthState();
            
            return true;
        } catch (error) {
            console.error('Failed to initialize Firebase:', error);
            throw error;
        }
    }

    // Wait for Firebase to restore authentication state
    waitForAuthState() {
        return new Promise((resolve) => {
            let resolved = false;
            
            console.log('Setting up Firebase auth state listener...');
            
            // Set up persistent auth state listener (don't unsubscribe)
            this.authStateUnsubscribe = onAuthStateChanged(this.auth, async (user) => {
                console.log('🔥 Auth state changed:', user ? `${user.email || 'anonymous'} (${user.uid})` : 'signed out');
                console.log('🔥 User object:', user);
                
                if (user && !user.isAnonymous) {
                    // Real user is signed in - Firebase restored the session
                    this.user = user;
                    console.log('✅ Real user restored from auth state:', this.user.email);
                    
                    // Set up subscriptions and load tasks if not already done
                    if (!this.unsubscribe) {
                        console.log('Setting up subscriptions and loading tasks...');
                        this.subscribeToTasks();
                        await this.loadTasks();
                    }
                    
                    this.syncStatus = 'synced';
                    this.updateSyncStatus();
                    
                } else if (user && user.isAnonymous) {
                    // Anonymous user detected
                    console.log('📝 Anonymous user detected');
                    const isProduction = window.location.hostname !== 'localhost';
                    
                    if (!isProduction) {
                        // Development mode: use shared account
                        this.user = {
                            uid: 'shared-user-upnext',
                            email: null,
                            displayName: 'Development User',
                            photoURL: null,
                            emailVerified: false,
                            isAnonymous: true,
                            _originalUser: user
                        };
                        console.log('Development mode: using shared account');
                        
                        if (!this.unsubscribe) {
                            this.subscribeToTasks();
                            await this.loadTasks();
                        }
                    } else {
                        // Production with anonymous user - wait a bit to see if real user comes
                        console.log('Production with anonymous user - waiting for potential real user...');
                        
                        // Don't immediately clear - Firebase might be restoring a real user session
                        // We'll wait for the auth state to stabilize
                        setTimeout(() => {
                            // Check again after a short delay
                            const currentUser = this.auth.currentUser;
                            if (currentUser && currentUser.isAnonymous) {
                                console.log('Still anonymous after delay - clearing user state...');
                                this.user = null;
                                this.tasks = [];
                                if (this.unsubscribe) {
                                    this.unsubscribe();
                                    this.unsubscribe = null;
                                }
                                this.render();
                            }
                        }, 1000); // Wait 1 second for auth to stabilize
                    }
                } else {
                    // No user at all
                    console.log('❌ No user found');
                    const isProduction = window.location.hostname !== 'localhost';
                    const forceAuth = new URLSearchParams(window.location.search).has('auth');
                    const isDesktopAuth = new URLSearchParams(window.location.search).has('desktop_auth');
                    
                    if (!isProduction && !forceAuth && !isDesktopAuth) {
                        // Development mode: create shared account
                        console.log('Development mode: creating shared account...');
                        try {
                            const result = await signInAnonymously(this.auth);
                            // Don't set this.user here - let the auth state change handler do it
                            console.log('Anonymous sign-in initiated, waiting for auth state change...');
                            return; // Let the auth state change handler process this
                        } catch (error) {
                            console.error('Failed to sign in anonymously:', error);
                            this.user = null;
                        }
                    } else {
                        // Production or special auth modes: no user, show sign-in UI
                        console.log('Production/special mode: no user, showing sign-in UI');
                        this.user = null;
                        this.tasks = [];
                        if (this.unsubscribe) {
                            this.unsubscribe();
                            this.unsubscribe = null;
                        }
                        this.render();
                    }
                }
                
                this.updateUserUI();
                
                // Resolve only once on initial load
                if (!resolved) {
                    resolved = true;
                    console.log('✅ Initial auth state resolved');
                    resolve();
                }
            });
        });
    }
    
    async signInWithGoogle() {
        try {
            console.log('🔐 Starting Google sign-in...');
            const provider = new GoogleAuthProvider();
            
            // Add scopes to ensure we get the user's profile information
            provider.addScope('profile');
            provider.addScope('email');
            
            const result = await signInWithPopup(this.auth, provider);
            this.user = result.user;
            
            console.log('✅ Signed in with Google successfully!');
            console.log('User:', this.user.email, this.user.uid);
            console.log('User object:', this.user);
            
            // Verify the user is persisted
            setTimeout(() => {
                console.log('🔍 Checking current user after sign-in:', this.auth.currentUser?.email);
            }, 1000);
            
            return this.user;
        } catch (error) {
            console.error('❌ Google sign-in failed:', error);
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

    // Manual Google sign-in (called by sign-in button)
    async authenticateWithGoogle() {
        try {
            return await this.signInWithGoogle();
        } catch (error) {
            console.error('Google authentication failed:', error);
            throw error;
        }
    }

    async signOutUser() {
        try {
            await signOut(this.auth);
            this.user = null;
            this.tasks = [];
            this.render();
            this.updateUserUI();
            console.log('User signed out');
        } catch (error) {
            console.error('Sign out failed:', error);
        }
    }
    
    async handleSignIn() {
        try {
            await this.authenticateWithGoogle();
            this.updateUserUI();
            
            // Set up subscriptions and load tasks after successful sign-in
            this.subscribeToTasks();
            await this.loadTasks();
            
            // Update sync status
            this.syncStatus = 'synced';
            this.updateSyncStatus();
        } catch (error) {
            console.error('Sign in failed:', error);
            this.showError('Sign in failed. Please try again.');
        }
    }
    
    updateUserUI() {
        console.log('🎨 Updating UI for user:', this.user ? `${this.user.email || 'anonymous'} (${this.user.uid})` : 'None');
        
        if (this.user && !this.user.isAnonymous) {
            // Show user info for real authenticated users
            console.log('✅ Showing user info for authenticated user');
            this.elements.userInfo.hidden = false;
            this.elements.signInBtn.hidden = true;
            
            this.elements.userName.textContent = this.user.displayName || this.user.email;
            if (this.user.photoURL) {
                this.elements.userPhoto.src = this.user.photoURL;
                this.elements.userPhoto.hidden = false;
            } else {
                this.elements.userPhoto.hidden = true;
            }
        } else {
            // Show sign in button based on environment
            const isProduction = window.location.hostname !== 'localhost';
            const isDesktopAuth = new URLSearchParams(window.location.search).has('desktop_auth');
            
            console.log('🔐 Showing sign-in UI - Production:', isProduction, 'Desktop auth:', isDesktopAuth);
            
            this.elements.userInfo.hidden = true;
            // Show sign-in button in production or desktop auth mode
            this.elements.signInBtn.hidden = !(isProduction || isDesktopAuth);
            
            if (!this.elements.signInBtn.hidden) {
                console.log('👆 Sign-in button is visible');
            } else {
                console.log('🙈 Sign-in button is hidden (development mode)');
            }
        }
    }
    
    // Get user's tasks collection reference
    getTasksCollection() {
        if (!this.user) throw new Error('User not authenticated');
        console.log('Getting tasks collection for user:', this.user.uid);
        console.log('Collection path:', `users/${this.user.uid}/tasks`);
        return collection(this.db, 'users', this.user.uid, 'tasks');
    }
    
    // Subscribe to real-time updates
    subscribeToTasks() {
        if (!this.user) return;

        try {
            const tasksRef = this.getTasksCollection();
            const q = query(tasksRef, orderBy('createdAt', 'desc'));
            
            this.unsubscribe = onSnapshot(q, (snapshot) => {
                console.log('Snapshot received, document count:', snapshot.size);
                const tasks = [];
                snapshot.forEach((doc) => {
                    console.log('Document data:', doc.id, doc.data());
                    const data = doc.data();
                    tasks.push({
                        id: doc.id,
                        ...data,
                        createdAt: data.createdAt?.toMillis?.() || data.createdAt,
                        updatedAt: data.updatedAt?.toMillis?.() || data.updatedAt,
                        completedAt: data.completedAt?.toMillis?.() || data.completedAt,
                        dueAt: data.dueAt?.toMillis?.() || data.dueAt
                    });
                });
                
                console.log('Processed tasks:', tasks);
                this.tasks = this.enrichTasks(tasks);
                this.sortTasks();
                this.render();
            }, (error) => {
                console.error('Task subscription error:', error);
                console.error('Error details:', error.code, error.message);
            });
        } catch (error) {
            console.error('Failed to subscribe to tasks:', error);
        }
    }
    
    setupEventListeners() {
        // Form submission
        this.elements.form.addEventListener('submit', (e) => this.handleSubmit(e));
        
        // Clear completed
        this.elements.clearBtn.addEventListener('click', () => this.clearCompleted());
        
        // Theme toggle
        this.elements.themeBtn.addEventListener('click', () => this.toggleTheme());
        
        // Sync status click (manual refresh)
        this.elements.syncStatus.addEventListener('click', () => this.manualSync());
        
        // Auth buttons
        this.elements.signInBtn.addEventListener('click', () => this.handleSignIn());
        this.elements.signOutBtn.addEventListener('click', () => this.signOutUser());
    }
    
    setupNetworkListeners() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.hideOfflineIndicator();
            if (this.syncStatus === 'offline') {
                this.syncStatus = 'connecting';
                this.updateSyncStatus();
                this.manualSync();
            }
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.syncStatus = 'offline';
            this.updateSyncStatus();
            this.showOfflineIndicator();
        });
    }
    
    async loadTasks() {
        try {
            if (!this.user) {
                console.log('No user available for loading tasks');
                return;
            }
            
            console.log('Loading tasks for user:', this.user.uid);
            const tasksRef = this.getTasksCollection();
            const q = query(tasksRef, orderBy('createdAt', 'desc'));
            console.log('Executing query...');
            const snapshot = await getDocs(q);
            console.log('Query completed, document count:', snapshot.size);
            
            const tasks = [];
            snapshot.forEach((doc) => {
                console.log('Loading document:', doc.id, doc.data());
                const data = doc.data();
                tasks.push({
                    id: doc.id,
                    ...data,
                    createdAt: data.createdAt?.toMillis?.() || data.createdAt,
                    updatedAt: data.updatedAt?.toMillis?.() || data.updatedAt,
                    completedAt: data.completedAt?.toMillis?.() || data.completedAt,
                    dueAt: data.dueAt?.toMillis?.() || data.dueAt
                });
            });
            
            console.log('Loaded tasks:', tasks);
            this.tasks = this.enrichTasks(tasks);
            this.sortTasks();
            this.render();
        } catch (error) {
            console.error('Failed to load tasks:', error);
            console.error('Error details:', error.code, error.message);
            this.syncStatus = 'error';
            this.updateSyncStatus();
        }
    }
    
    async handleSubmit(e) {
        e.preventDefault();
        const title = this.elements.input.value.trim();
        if (!title) return;
        
        try {
            const taskData = {
                title,
                completed: false,
                createdAt: new Date(),
                updatedAt: new Date(),
                order: 0
            };
            
            const tasksRef = this.getTasksCollection();
            await addDoc(tasksRef, taskData);
            this.elements.input.value = '';
            
            // Tasks will be updated via real-time subscription
        } catch (error) {
            console.error('Failed to create task:', error);
            this.showError('Failed to create task');
        }
    }
    
    async updateTask(id, updates) {
        try {
            const taskRef = doc(this.getTasksCollection(), id);
            const updateData = {
                ...updates,
                updatedAt: new Date()
            };
            
            await updateDoc(taskRef, updateData);
            // Tasks will be updated via real-time subscription
        } catch (error) {
            console.error('Failed to update task:', error);
            this.showError('Failed to update task');
        }
    }
    
    async deleteTask(id) {
        try {
            const taskRef = doc(this.getTasksCollection(), id);
            await deleteDoc(taskRef);
            // Tasks will be updated via real-time subscription
        } catch (error) {
            console.error('Failed to delete task:', error);
            this.showError('Failed to delete task');
        }
    }
    
    async clearCompleted() {
        try {
            const completedTasks = this.tasks.filter(t => t.completed);
            
            // Delete each completed task
            const deletePromises = completedTasks.map(task => {
                const taskRef = doc(this.getTasksCollection(), task.id);
                return deleteDoc(taskRef);
            });
            
            await Promise.all(deletePromises);
            // Tasks will be updated via real-time subscription
        } catch (error) {
            console.error('Failed to clear completed tasks:', error);
            this.showError('Failed to clear completed tasks');
        }
    }
    
    async manualSync() {
        if (!this.isOnline) return;
        
        this.syncStatus = 'connecting';
        this.updateSyncStatus();
        
        try {
            await this.loadTasks();
            this.syncStatus = 'synced';
            this.updateSyncStatus();
        } catch (error) {
            this.syncStatus = 'error';
            this.updateSyncStatus();
        }
    }
    
    enrichTasks(tasks) {
        return tasks.map(task => ({
            ...task,
            dueAt: this.parseDueFromTitle(task.title),
            priority: this.parsePriorityFromTitle(task.title)
        }));
    }
    
    sortTasks() {
        this.tasks.sort((a, b) => {
            // Completed tasks go to bottom
            const byCompleted = Number(a.completed) - Number(b.completed);
            if (byCompleted) return byCompleted;
            
            // For incomplete tasks, use manual order
            const aOrder = Number(a.order ?? 999999);
            const bOrder = Number(b.order ?? 999999);
            if (aOrder !== bOrder) return aOrder - bOrder;
            
            // Fallback to creation time
            return (b.createdAt || 0) - (a.createdAt || 0);
        });
    }
    
    render() {
        this.elements.list.innerHTML = '';
        const fragment = document.createDocumentFragment();
        
        for (const task of this.tasks) {
            fragment.appendChild(this.createTaskElement(task));
        }
        
        this.elements.list.appendChild(fragment);
        this.updateCount();
        this.updateEmptyState();
    }
    
    createTaskElement(task) {
        const clone = this.elements.template.content.cloneNode(true);
        const item = clone.querySelector('.task-item');
        const checkbox = clone.querySelector('input[type="checkbox"]');
        const title = clone.querySelector('[data-role="title"]');
        const edit = clone.querySelector('[data-role="edit"]');
        const deleteBtn = clone.querySelector('[data-role="delete"]');
        const dueEl = clone.querySelector('[data-role="due"]');
        const priorityEl = clone.querySelector('[data-role="priority"]');
        const dragBtn = clone.querySelector('[data-role="drag"]');
        
        // Set task data
        item.dataset.taskId = task.id;
        checkbox.checked = !!task.completed;
        title.textContent = task.title;
        title.classList.toggle('completed', task.completed);
        edit.value = task.title;
        
        // Due date badge
        if (task.dueAt) {
            const dueText = this.formatDue(task.dueAt);
            dueEl.textContent = dueText;
            dueEl.hidden = false;
            
            const isOverdue = Date.now() > task.dueAt;
            dueEl.classList.toggle('overdue', isOverdue);
            dueEl.classList.toggle('soon', !isOverdue);
        } else {
            dueEl.hidden = true;
        }
        
        // Priority badge
        if (task.priority > 0) {
            const priorityText = task.priority === 3 ? 'P1' : task.priority === 2 ? 'P2' : 'P3';
            priorityEl.textContent = priorityText;
            priorityEl.hidden = false;
            priorityEl.className = `badge priority-badge p${task.priority === 3 ? '3' : task.priority === 2 ? '2' : '1'}`;
        } else {
            priorityEl.hidden = true;
        }
        
        // Event listeners
        checkbox.addEventListener('change', () => {
            this.updateTask(task.id, { completed: checkbox.checked });
        });
        
        title.addEventListener('dblclick', () => {
            item.classList.add('editing');
            edit.focus();
            edit.setSelectionRange(edit.value.length, edit.value.length);
        });
        
        edit.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                item.classList.remove('editing');
                edit.value = task.title;
            }
            if (e.key === 'Enter') {
                edit.blur();
            }
        });
        
        edit.addEventListener('blur', () => {
            const newTitle = edit.value.trim();
            item.classList.remove('editing');
            if (newTitle && newTitle !== task.title) {
                this.updateTask(task.id, { title: newTitle });
            } else {
                edit.value = task.title;
            }
        });
        
        deleteBtn.addEventListener('click', () => {
            this.deleteTask(task.id);
        });
        
        // Drag and drop (simplified for touch devices)
        this.setupDragAndDrop(item, task);
        
        return clone;
    }
    
    setupDragAndDrop(item, task) {
        let startY = 0;
        let currentY = 0;
        let isDragging = false;
        
        const startDrag = (e) => {
            isDragging = true;
            item.classList.add('dragging');
            startY = e.type === 'mousedown' ? e.clientY : e.touches[0].clientY;
            currentY = startY;
            
            document.addEventListener('mousemove', drag);
            document.addEventListener('mouseup', endDrag);
            document.addEventListener('touchmove', drag, { passive: false });
            document.addEventListener('touchend', endDrag);
        };
        
        const drag = (e) => {
            if (!isDragging) return;
            e.preventDefault();
            
            currentY = e.type === 'mousemove' ? e.clientY : e.touches[0].clientY;
            const deltaY = currentY - startY;
            item.style.transform = `translateY(${deltaY}px)`;
        };
        
        const endDrag = () => {
            if (!isDragging) return;
            isDragging = false;
            
            item.classList.remove('dragging');
            item.style.transform = '';
            
            document.removeEventListener('mousemove', drag);
            document.removeEventListener('mouseup', endDrag);
            document.removeEventListener('touchmove', drag);
            document.removeEventListener('touchend', endDrag);
            
            // Simple reordering logic (move to top if dragged up significantly)
            const deltaY = currentY - startY;
            if (Math.abs(deltaY) > 50) {
                const newOrder = deltaY < 0 ? 0 : 999999;
                this.updateTask(task.id, { order: newOrder });
            }
        };
        
        const dragBtn = item.querySelector('[data-role="drag"]');
        dragBtn.addEventListener('mousedown', startDrag);
        dragBtn.addEventListener('touchstart', startDrag, { passive: true });
    }
    
    updateCount() {
        const remaining = this.tasks.filter(t => !t.completed).length;
        this.elements.count.textContent = remaining === 0 ? 'All done 🎉' : `${remaining} to do`;
    }
    
    updateEmptyState() {
        this.elements.empty.hidden = this.tasks.length > 0;
    }
    
    updateSyncStatus() {
        const { syncIcon, syncText, syncStatus } = this.elements;
        
        syncStatus.className = `status-btn ${this.syncStatus}`;
        
        switch (this.syncStatus) {
            case 'connecting':
                syncIcon.textContent = '🔄';
                syncText.textContent = 'Syncing...';
                break;
            case 'synced':
                syncIcon.textContent = '✅';
                syncText.textContent = 'Synced';
                break;
            case 'offline':
                syncIcon.textContent = '📱';
                syncText.textContent = 'Offline';
                break;
            case 'error':
                syncIcon.textContent = '⚠️';
                syncText.textContent = 'Error';
                break;
        }
    }
    
    showOfflineIndicator() {
        this.elements.offlineIndicator.hidden = false;
    }
    
    hideOfflineIndicator() {
        this.elements.offlineIndicator.hidden = true;
    }
    
    hideLoadingIndicator() {
        this.elements.loadingIndicator.style.display = 'none';
    }
    
    showError(message) {
        // Simple error display - could be enhanced with a toast system
        console.error(message);
        // You could add a toast notification here
    }
    
    toggleTheme() {
        const isLight = document.documentElement.classList.contains('light');
        const newTheme = isLight ? 'dark' : 'light';
        
        document.documentElement.classList.toggle('light', newTheme === 'light');
        localStorage.setItem('theme', newTheme);
    }
    
    loadTheme() {
        const savedTheme = localStorage.getItem('theme') || 'dark';
        document.documentElement.classList.toggle('light', savedTheme === 'light');
    }
    
    // Utility methods (copied from main.js)
    parsePriorityFromTitle(title) {
        if (!title) return 0;
        const t = String(title);
        
        // Exclamation-based: !!! > !! > !
        if (/!!!/.test(t)) return 3;
        if (/!!/.test(t)) return 2;
        if (/(^|\s)!($|\s)/.test(` ${t} `)) return 1;
        
        // Words: urgent/high/medium/low
        if (/\b(urgent|asap|critical|high)\b/i.test(t)) return 3;
        if (/\b(medium|normal)\b/i.test(t)) return 2;
        if (/\b(low|minor)\b/i.test(t)) return 1;
        
        // P-levels: p1/p2/p3 (p1 highest)
        const p = t.match(/\bp([123])\b/i);
        if (p) {
            const n = Number(p[1]);
            return n === 1 ? 3 : n === 2 ? 2 : 1;
        }
        
        return 0;
    }
    
    parseDueFromTitle(title, nowTs = Date.now()) {
        if (!title) return null;
        const t = String(title);
        const now = new Date(nowTs);
        
        // Simplified parsing - you can expand this with the full logic from main.js
        // For now, just handle common cases
        
        // Today/tomorrow
        if (/\btoday\b/i.test(t)) {
            return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0).getTime();
        }
        if (/\btomorrow\b/i.test(t)) {
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(9, 0, 0, 0);
            return tomorrow.getTime();
        }
        
        // Time patterns like "3pm", "15:30"
        const timeMatch = t.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
        if (timeMatch) {
            let hours = Number(timeMatch[1]);
            const minutes = timeMatch[2] ? Number(timeMatch[2]) : 0;
            const ampm = timeMatch[3].toLowerCase();
            
            if (ampm === 'pm' && hours < 12) hours += 12;
            if (ampm === 'am' && hours === 12) hours = 0;
            
            const date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);
            return date.getTime() > nowTs ? date.getTime() : date.getTime() + 24 * 60 * 60 * 1000;
        }
        
        return null;
    }
    
    formatDue(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const sameDay = date.toDateString() === now.toDateString();
        const tomorrow = new Date(now);
        tomorrow.setDate(now.getDate() + 1);
        const isTomorrow = date.toDateString() === tomorrow.toDateString();
        
        const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        if (sameDay) return `today ${time}`;
        if (isTomorrow) return `tomorrow ${time}`;
        
        const diffDays = Math.round((date.setHours(0,0,0,0) - now.setHours(0,0,0,0)) / (24*60*60*1000));
        if (diffDays > 0 && diffDays <= 7) {
            return date.toLocaleDateString(undefined, { weekday: 'long' }) + ' ' + time;
        }
        
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' + time;
    }
    
    setupPWAInstall() {
        // Create install button
        this.createInstallButton();
        
        // Listen for beforeinstallprompt event
        window.addEventListener('beforeinstallprompt', (e) => {
            console.log('PWA install prompt available');
            // Prevent the mini-infobar from appearing on mobile
            e.preventDefault();
            // Store the event so it can be triggered later
            this.deferredPrompt = e;
            // Show the install button
            this.showInstallButton();
        });
        
        // Listen for app installed event
        window.addEventListener('appinstalled', () => {
            console.log('PWA was installed');
            this.hideInstallButton();
            this.deferredPrompt = null;
            // Show a confirmation message
            this.showInstallConfirmation();
        });
        
        // Check if app is already installed
        if (window.matchMedia('(display-mode: standalone)').matches || 
            window.navigator.standalone === true) {
            console.log('PWA is running in standalone mode');
            this.hideInstallButton();
        }
    }
    
    createInstallButton() {
        // Create install button and add it to the header
        this.installButton = document.createElement('button');
        this.installButton.innerHTML = '📱 Install App';
        this.installButton.className = 'install-btn';
        this.installButton.title = 'Install UpNext as an app';
        this.installButton.style.cssText = `
            background: #007acc;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            font-size: 14px;
            cursor: pointer;
            margin-left: 8px;
            display: none;
            transition: background-color 0.2s;
        `;
        
        this.installButton.addEventListener('mouseover', () => {
            this.installButton.style.backgroundColor = '#005a9e';
        });
        
        this.installButton.addEventListener('mouseout', () => {
            this.installButton.style.backgroundColor = '#007acc';
        });
        
        this.installButton.addEventListener('click', () => {
            this.handleInstallClick();
        });
        
        // Add to header actions
        const headerActions = document.querySelector('.header-actions');
        if (headerActions) {
            headerActions.insertBefore(this.installButton, headerActions.firstChild);
        }
    }
    
    showInstallButton() {
        if (this.installButton) {
            this.installButton.style.display = 'inline-block';
        }
    }
    
    hideInstallButton() {
        if (this.installButton) {
            this.installButton.style.display = 'none';
        }
    }
    
    async handleInstallClick() {
        if (!this.deferredPrompt) {
            console.log('No deferred prompt available');
            return;
        }
        
        // Hide the install button
        this.hideInstallButton();
        
        // Show the install prompt
        this.deferredPrompt.prompt();
        
        // Wait for the user to respond to the prompt
        const { outcome } = await this.deferredPrompt.userChoice;
        console.log(`User response to the install prompt: ${outcome}`);
        
        if (outcome === 'accepted') {
            console.log('User accepted the install prompt');
        } else {
            console.log('User dismissed the install prompt');
            // Show the button again if user dismissed
            setTimeout(() => {
                this.showInstallButton();
            }, 30000); // Show again after 30 seconds
        }
        
        // Clear the deferred prompt
        this.deferredPrompt = null;
    }
    
    showInstallConfirmation() {
        // Create a temporary notification
        const notification = document.createElement('div');
        notification.innerHTML = '✅ UpNext installed successfully!';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4caf50;
            color: white;
            padding: 16px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 1000;
            font-weight: 500;
            transform: translateX(100%);
            transition: transform 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);
        
        // Remove after 4 seconds
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 4000);
    }
    
    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('./sw.js');
                console.log('Service Worker registered:', registration);
                
                // Listen for updates
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            // New version available
                            this.showUpdateAvailable();
                        }
                    });
                });
                
                // Listen for messages from service worker
                navigator.serviceWorker.addEventListener('message', (event) => {
                    if (event.data.type === 'SYNC_STARTED') {
                        this.syncStatus = 'connecting';
                        this.updateSyncStatus();
                    } else if (event.data.type === 'SYNC_COMPLETED') {
                        this.syncStatus = 'synced';
                        this.updateSyncStatus();
                    } else if (event.data.type === 'SYNC_FAILED') {
                        this.syncStatus = 'error';
                        this.updateSyncStatus();
                    }
                });
                
            } catch (error) {
                console.error('Service Worker registration failed:', error);
            }
        }
    }
    
    showUpdateAvailable() {
        // Simple update notification - could be enhanced with a better UI
        if (confirm('A new version is available. Reload to update?')) {
            window.location.reload();
        }
    }
    
    cleanup() {
        if (this.unsubscribe) {
            this.unsubscribe();
        }
        if (this.authStateUnsubscribe) {
            this.authStateUnsubscribe();
        }
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.taskApp = new WebTaskApp();
    
    // Debug helper function
    window.debugFirebase = () => {
        console.log('=== Firebase Debug Info ===');
        console.log('App user ID:', window.taskApp.user?.uid);
        console.log('Auth user ID:', window.taskApp.auth?.currentUser?.uid);
        console.log('Collection path:', `users/${window.taskApp.user?.uid}/tasks`);
        console.log('User object:', window.taskApp.user);
        console.log('========================');
    };
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window.taskApp) {
        window.taskApp.cleanup();
    }
});
