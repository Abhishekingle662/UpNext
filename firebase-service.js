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
  disableNetwork,
  connectFirestoreEmulator
} from 'firebase/firestore';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged 
} from 'firebase/auth';
import { firebaseConfig } from './firebase-config.js';

class FirebaseService {
  constructor() {
    this.app = null;
    this.db = null;
    this.auth = null;
    this.user = null;
    this.isOnline = true; // Assume online in main process
    this.listeners = new Set();
    this.localCache = new Map();
    this.isMainProcess = typeof window === 'undefined';
    
    // Only add browser event listeners if we're in renderer process
    if (!this.isMainProcess && typeof navigator !== 'undefined') {
      this.isOnline = navigator.onLine;
      
      // Listen for online/offline events
      window.addEventListener('online', () => {
        this.isOnline = true;
        this.enableSync();
      });
      
      window.addEventListener('offline', () => {
        this.isOnline = false;
        this.disableSync();
      });
    }
  }

  async initialize() {
    try {
      // Initialize Firebase
      this.app = initializeApp(firebaseConfig);
      this.db = getFirestore(this.app);
      this.auth = getAuth(this.app);

      // Enable offline persistence
      // Note: This needs to be called before any Firestore operations
      
      // Sign in anonymously for now
      await this.signInAnonymously();
      
      return true;
    } catch (error) {
      console.error('Failed to initialize Firebase:', error);
      return false;
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

  // Get user's tasks collection reference
  getTasksCollection() {
    if (!this.user) throw new Error('User not authenticated');
    return collection(this.db, 'users', this.user.uid, 'tasks');
  }

  // Load all tasks
  async loadTasks() {
    try {
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
      
      // Cache locally
      this.localCache.set('tasks', tasks);
      return tasks;
    } catch (error) {
      console.error('Failed to load tasks:', error);
      // Return cached data if available
      return this.localCache.get('tasks') || [];
    }
  }

  // Create a new task
  async createTask(taskData) {
    try {
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
      
      // Update local cache
      const cachedTasks = this.localCache.get('tasks') || [];
      cachedTasks.unshift(newTask);
      this.localCache.set('tasks', cachedTasks);
      
      return newTask;
    } catch (error) {
      console.error('Failed to create task:', error);
      throw error;
    }
  }

  // Update a task
  async updateTask(taskId, updates) {
    try {
      if (!this.user) await this.signInAnonymously();
      
      const taskRef = doc(this.getTasksCollection(), taskId);
      const updateData = {
        ...updates,
        updatedAt: new Date()
      };
      
      await updateDoc(taskRef, updateData);
      
      // Update local cache
      const cachedTasks = this.localCache.get('tasks') || [];
      const taskIndex = cachedTasks.findIndex(t => t.id === taskId);
      if (taskIndex !== -1) {
        cachedTasks[taskIndex] = {
          ...cachedTasks[taskIndex],
          ...updates,
          updatedAt: Date.now()
        };
        this.localCache.set('tasks', cachedTasks);
      }
      
      return cachedTasks[taskIndex];
    } catch (error) {
      console.error('Failed to update task:', error);
      throw error;
    }
  }

  // Delete a task
  async deleteTask(taskId) {
    try {
      if (!this.user) await this.signInAnonymously();
      
      const taskRef = doc(this.getTasksCollection(), taskId);
      await deleteDoc(taskRef);
      
      // Update local cache
      const cachedTasks = this.localCache.get('tasks') || [];
      const filteredTasks = cachedTasks.filter(t => t.id !== taskId);
      this.localCache.set('tasks', filteredTasks);
      
      return true;
    } catch (error) {
      console.error('Failed to delete task:', error);
      throw error;
    }
  }

  // Clear completed tasks
  async clearCompleted() {
    try {
      const tasks = this.localCache.get('tasks') || [];
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

  // Listen for real-time updates
  subscribeToTasks(callback) {
    if (!this.user) {
      console.warn('Cannot subscribe: user not authenticated');
      return () => {};
    }

    try {
      const tasksRef = this.getTasksCollection();
      const q = query(tasksRef, orderBy('createdAt', 'desc'));
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const tasks = [];
        snapshot.forEach((doc) => {
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
        
        // Update local cache
        this.localCache.set('tasks', tasks);
        callback(tasks);
      }, (error) => {
        console.error('Task subscription error:', error);
        // Fallback to cached data
        callback(this.localCache.get('tasks') || []);
      });
      
      this.listeners.add(unsubscribe);
      return unsubscribe;
    } catch (error) {
      console.error('Failed to subscribe to tasks:', error);
      return () => {};
    }
  }

  // Enable network sync
  async enableSync() {
    try {
      if (this.db) {
        await enableNetwork(this.db);
        console.log('Firebase sync enabled');
      }
    } catch (error) {
      console.error('Failed to enable sync:', error);
    }
  }

  // Disable network sync
  async disableSync() {
    try {
      if (this.db) {
        await disableNetwork(this.db);
        console.log('Firebase sync disabled');
      }
    } catch (error) {
      console.error('Failed to disable sync:', error);
    }
  }

  // Clean up listeners
  cleanup() {
    this.listeners.forEach(unsubscribe => unsubscribe());
    this.listeners.clear();
  }
}

// Export singleton instance - only create in browser environment
export const firebaseService = typeof window !== 'undefined' ? new FirebaseService() : null;
