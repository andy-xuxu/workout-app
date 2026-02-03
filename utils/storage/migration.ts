import { SavedWorkout } from '../../types';
import { IndexedDBStorage } from './indexedDBStorage';

const STORAGE_KEY = 'pulsefit-saved-workouts';
const MIGRATION_FLAG = 'pulsefit-migration-complete';

/**
 * Migrate saved workouts from localStorage to IndexedDB
 * This is a one-time operation that preserves localStorage data as backup
 */
export async function migrateLocalStorageToIndexedDB(
  storage: IndexedDBStorage
): Promise<void> {
  // Check if migration has already been completed
  const migrationComplete = localStorage.getItem(MIGRATION_FLAG);
  if (migrationComplete === 'true') {
    console.log('[Migration] Already migrated, skipping');
    return;
  }

  try {
    // Initialize IndexedDB
    await storage.init();

    // Read data from localStorage
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      console.log('[Migration] No localStorage data to migrate');
      localStorage.setItem(MIGRATION_FLAG, 'true');
      return;
    }

    let workouts: SavedWorkout[];
    try {
      workouts = JSON.parse(stored);
    } catch (error) {
      console.error('[Migration] Failed to parse localStorage data:', error);
      return;
    }

    if (!Array.isArray(workouts) || workouts.length === 0) {
      console.log('[Migration] No workouts to migrate');
      localStorage.setItem(MIGRATION_FLAG, 'true');
      return;
    }

    // Check if workouts already exist in IndexedDB
    const existingWorkouts = await storage.loadWorkouts();
    if (existingWorkouts.length > 0) {
      console.log('[Migration] IndexedDB already has data, skipping migration');
      localStorage.setItem(MIGRATION_FLAG, 'true');
      return;
    }

    // Migrate each workout to IndexedDB
    console.log(`[Migration] Migrating ${workouts.length} workouts to IndexedDB`);
    for (const workout of workouts) {
      try {
        await storage.saveWorkout(workout);
      } catch (error) {
        console.error(`[Migration] Failed to migrate workout ${workout.id}:`, error);
        // Continue with other workouts even if one fails
      }
    }

    // Mark migration as complete
    localStorage.setItem(MIGRATION_FLAG, 'true');
    console.log('[Migration] Migration completed successfully');

    // Note: We intentionally do NOT delete localStorage data
    // It serves as a backup in case IndexedDB fails
  } catch (error) {
    console.error('[Migration] Migration failed:', error);
    // Don't set migration flag on failure - allow retry
    throw error;
  }
}

/**
 * Check if migration has been completed
 */
export function isMigrationComplete(): boolean {
  return localStorage.getItem(MIGRATION_FLAG) === 'true';
}

/**
 * Reset migration flag (for testing/debugging purposes)
 */
export function resetMigrationFlag(): void {
  localStorage.removeItem(MIGRATION_FLAG);
}
