/**
 * Storage Module - Persistent Data Management
 * 
 * This module provides persistent storage for user workout data:
 * - Workout Logs: Complete history of all completed workouts with exercises, sets, reps, weights, and timestamps
 * - Saved Workouts: User-created custom workout routines
 * 
 * Storage Strategy:
 * 1. Primary: IndexedDB (unlimited storage, persists across sessions)
 * 2. Fallback: localStorage (for browsers/devices where IndexedDB is unavailable)
 * 3. Automatic migration from localStorage to IndexedDB on first use
 * 
 * Data Persistence:
 * - All data is automatically saved when created/updated
 * - Data persists across page reloads, browser restarts, and device reboots
 * - Data is stored locally on the user's device (no cloud sync)
 * - Each user's data is isolated to their browser/device
 * 
 * Error Handling:
 * - Graceful fallback if IndexedDB fails
 * - Comprehensive error logging for debugging
 * - Data validation to prevent corruption
 */

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

      // Run migration if needed (with validation)
      try {
        await migrateLocalStorageToIndexedDB(storage);
      } catch (error) {
        console.warn('[Storage] Migration failed, continuing with IndexedDB:', error);
        // Continue even if migration fails
      }

      // Note: Validation and cleanup of workout logs is handled by App.tsx on load.
      // We don't perform cleanup here to avoid validation criteria mismatches.
      // The App is the source of truth for what constitutes a valid workout log.

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

  async saveWorkoutLog(log: import('../../types').WorkoutLog): Promise<void> {
    const adapter = await this.getAdapter();
    return adapter.saveWorkoutLog(log);
  }

  async loadWorkoutLogs(): Promise<import('../../types').WorkoutLog[]> {
    const adapter = await this.getAdapter();
    return adapter.loadWorkoutLogs();
  }

  async deleteWorkoutLog(id: string): Promise<void> {
    const adapter = await this.getAdapter();
    return adapter.deleteWorkoutLog(id);
  }
}

/**
 * Export singleton storage instance
 * Automatically initializes IndexedDB on first use
 */
export const storage: StorageAdapter = new StorageWrapper();
