import { StorageAdapter } from './types';
import { SavedWorkout } from '../../types';

const DB_NAME = 'pulsefit-db';
const DB_VERSION = 1;
const STORE_NAME = 'savedWorkouts';

/**
 * IndexedDB storage implementation for workout data.
 * Provides unlimited storage capacity compared to localStorage.
 */
export class IndexedDBStorage implements StorageAdapter {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize the IndexedDB database
   */
  async init(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) {
        reject(new Error('IndexedDB is not supported in this browser'));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(new Error(`Failed to open database: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const objectStore = db.createObjectStore(STORE_NAME, {
            keyPath: 'id',
          });

          // Create index on createdAt for sorting
          objectStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // Future object stores (commented for now):
        // if (!db.objectStoreNames.contains('workoutLogs')) {
        //   const logStore = db.createObjectStore('workoutLogs', { keyPath: 'id' });
        //   logStore.createIndex('completedAt', 'completedAt', { unique: false });
        //   logStore.createIndex('workoutId', 'workoutId', { unique: false });
        // }
        // if (!db.objectStoreNames.contains('exerciseLogs')) {
        //   const exerciseStore = db.createObjectStore('exerciseLogs', { keyPath: 'id' });
        //   exerciseStore.createIndex('exerciseId', 'exerciseId', { unique: false });
        // }
        // if (!db.objectStoreNames.contains('userGoals')) {
        //   const goalStore = db.createObjectStore('userGoals', { keyPath: 'id' });
        //   goalStore.createIndex('type', 'type', { unique: false });
        // }
        // if (!db.objectStoreNames.contains('userStats')) {
        //   db.createObjectStore('userStats', { keyPath: 'id' });
        // }
      };
    });

    return this.initPromise;
  }

  /**
   * Ensure database is initialized before operations
   */
  private async ensureDatabase(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.init();
    }
    if (!this.db) {
      throw new Error('Database initialization failed');
    }
    return this.db;
  }

  /**
   * Save a new workout routine
   * Uses put() instead of add() to allow overwriting existing workouts
   */
  async saveWorkout(workout: SavedWorkout): Promise<void> {
    const db = await this.ensureDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(workout);

      request.onerror = () => {
        reject(new Error(`Failed to save workout: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        resolve();
      };
    });
  }

  /**
   * Load all saved workout routines
   */
  async loadWorkouts(): Promise<SavedWorkout[]> {
    const db = await this.ensureDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onerror = () => {
        reject(new Error(`Failed to load workouts: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        resolve(request.result || []);
      };
    });
  }

  /**
   * Update an existing workout routine
   */
  async updateWorkout(id: string, updates: Partial<SavedWorkout>): Promise<void> {
    const db = await this.ensureDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const getRequest = store.get(id);

      getRequest.onerror = () => {
        reject(new Error(`Failed to get workout: ${getRequest.error?.message}`));
      };

      getRequest.onsuccess = () => {
        const existing = getRequest.result;
        if (!existing) {
          reject(new Error(`Workout with id ${id} not found`));
          return;
        }

        const updated = { ...existing, ...updates };
        const putRequest = store.put(updated);

        putRequest.onerror = () => {
          reject(new Error(`Failed to update workout: ${putRequest.error?.message}`));
        };

        putRequest.onsuccess = () => {
          resolve();
        };
      };
    });
  }

  /**
   * Delete a workout routine by ID
   */
  async deleteWorkout(id: string): Promise<void> {
    const db = await this.ensureDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onerror = () => {
        reject(new Error(`Failed to delete workout: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        resolve();
      };
    });
  }

  /**
   * Migrate data from localStorage to IndexedDB
   * This is handled by the migration utility, but included for interface compliance
   */
  async migrateFromLocalStorage(): Promise<void> {
    // Migration logic is in migration.ts
    // This method exists for interface compliance
    return Promise.resolve();
  }
}
