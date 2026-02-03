import { StorageAdapter } from './types';
import { IndexedDBStorage } from './indexedDBStorage';
import { LocalStorageAdapter } from './localStorageAdapter';
import { migrateLocalStorageToIndexedDB } from './migration';

/**
 * Check if IndexedDB is available in the current browser
 */
function isIndexedDBAvailable(): boolean {
  return 'indexedDB' in window && indexedDB !== null;
}

/**
 * Create and initialize the appropriate storage adapter
 */
async function createStorageAdapter(): Promise<StorageAdapter> {
  if (isIndexedDBAvailable()) {
    try {
      const storage = new IndexedDBStorage();
      await storage.init();

      // Run migration if needed
      try {
        await migrateLocalStorageToIndexedDB(storage);
      } catch (error) {
        console.warn('[Storage] Migration failed, continuing with IndexedDB:', error);
        // Continue even if migration fails
      }

      return storage;
    } catch (error) {
      console.warn('[Storage] IndexedDB initialization failed, falling back to localStorage:', error);
      // Fall through to localStorage adapter
    }
  }

  // Fallback to localStorage if IndexedDB is unavailable or failed
  console.warn('[Storage] Using localStorage adapter (IndexedDB unavailable)');
  return new LocalStorageAdapter();
}

// Create singleton instance
let storageInstance: StorageAdapter | null = null;
let initializationPromise: Promise<StorageAdapter> | null = null;

/**
 * Get the storage adapter instance (singleton)
 * Automatically initializes on first call
 */
export async function getStorage(): Promise<StorageAdapter> {
  if (storageInstance) {
    return storageInstance;
  }

  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = createStorageAdapter();
  storageInstance = await initializationPromise;
  return storageInstance;
}

/**
 * Storage adapter wrapper that handles async initialization
 * Provides a synchronous-like interface that works with React
 */
class StorageWrapper implements StorageAdapter {
  private async getAdapter(): Promise<StorageAdapter> {
    return getStorage();
  }

  async saveWorkout(workout: import('../../types').SavedWorkout): Promise<void> {
    const adapter = await this.getAdapter();
    return adapter.saveWorkout(workout);
  }

  async loadWorkouts(): Promise<import('../../types').SavedWorkout[]> {
    const adapter = await this.getAdapter();
    return adapter.loadWorkouts();
  }

  async updateWorkout(id: string, updates: Partial<import('../../types').SavedWorkout>): Promise<void> {
    const adapter = await this.getAdapter();
    return adapter.updateWorkout(id, updates);
  }

  async deleteWorkout(id: string): Promise<void> {
    const adapter = await this.getAdapter();
    return adapter.deleteWorkout(id);
  }

  async migrateFromLocalStorage(): Promise<void> {
    const adapter = await this.getAdapter();
    return adapter.migrateFromLocalStorage();
  }
}

/**
 * Export singleton storage instance
 * Automatically initializes IndexedDB on first use
 */
export const storage: StorageAdapter = new StorageWrapper();
