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

      // CRITICAL: After migration, validate and clean any existing invalid data
      // This ensures that even if invalid data was previously migrated, it gets cleaned up
      try {
        const existingLogs = await storage.loadWorkoutLogs();
        if (existingLogs.length > 0) {
          // Import validation function (same as in App.tsx)
          const isValidLog = (log: import('../../types').WorkoutLog): boolean => {
            if (!log || !log.id || !log.workoutName || !log.completedAt) return false;
            if (typeof log.completedAt !== 'number' || log.completedAt <= 0) return false;
            if (!log.exercises || !Array.isArray(log.exercises) || log.exercises.length === 0) return false;
            
            let totalReps = 0;
            let hasValidExercise = false;
            
            for (const exercise of log.exercises) {
              if (!exercise || !exercise.exerciseId || !exercise.exerciseName) continue;
              if (!exercise.sets || !Array.isArray(exercise.sets) || exercise.sets.length === 0) continue;
              
              const exerciseHasValidSet = exercise.sets.some(set => 
                set && typeof set.reps === 'number' && set.reps > 0 &&
                typeof set.completedAt === 'number' && set.completedAt > 0
              );
              
              if (exerciseHasValidSet) {
                hasValidExercise = true;
                exercise.sets.forEach(set => {
                  if (set && typeof set.reps === 'number' && set.reps > 0) {
                    totalReps += set.reps;
                  }
                });
              }
            }
            
            const hasMinimumReps = totalReps >= 10;
            
            return hasValidExercise && hasMinimumReps;
          };
          
          const invalidLogs = existingLogs.filter(log => !isValidLog(log));
          if (invalidLogs.length > 0) {
            console.log(`[Storage] Found ${invalidLogs.length} invalid logs during initialization. Cleaning up...`);
            for (const invalidLog of invalidLogs) {
              try {
                await storage.deleteWorkoutLog(invalidLog.id);
              } catch (error) {
                console.error(`[Storage] Failed to delete invalid log during init:`, error);
              }
            }
            console.log(`[Storage] Cleaned up ${invalidLogs.length} invalid workout logs during initialization.`);
          }
        }
      } catch (error) {
        console.warn('[Storage] Error during initialization cleanup:', error);
        // Don't fail initialization if cleanup fails
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
