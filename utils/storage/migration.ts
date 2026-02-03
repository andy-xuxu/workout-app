import { SavedWorkout } from '../../types';
import { IndexedDBStorage } from './indexedDBStorage';

const STORAGE_KEY = 'pulsefit-saved-workouts';
const LOGS_STORAGE_KEY = 'pulsefit-workout-logs';
const MIGRATION_FLAG = 'pulsefit-migration-complete';
const MIGRATION_LOGS_FLAG = 'pulsefit-migration-logs-complete';

/**
 * Migrate saved workouts from localStorage to IndexedDB
 * This is a one-time operation that preserves localStorage data as backup
 */
export async function migrateLocalStorageToIndexedDB(
  storage: IndexedDBStorage
): Promise<void> {
  // Check if migration has already been completed
  const migrationComplete = localStorage.getItem(MIGRATION_FLAG);
  const migrationLogsComplete = localStorage.getItem(MIGRATION_LOGS_FLAG);
  if (migrationComplete === 'true' && migrationLogsComplete === 'true') {
    console.log('[Migration] Already migrated, skipping');
    return;
  }

  try {
    // Initialize IndexedDB
    await storage.init();

    if (migrationComplete !== 'true') {
      // Read workout data from localStorage
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        console.log('[Migration] No localStorage workouts to migrate');
        localStorage.setItem(MIGRATION_FLAG, 'true');
      } else {
        let workouts: SavedWorkout[];
        try {
          workouts = JSON.parse(stored);
        } catch (error) {
          console.error('[Migration] Failed to parse localStorage workouts:', error);
          workouts = [];
        }

        if (!Array.isArray(workouts) || workouts.length === 0) {
          console.log('[Migration] No workouts to migrate');
          localStorage.setItem(MIGRATION_FLAG, 'true');
        } else {
          const existingWorkouts = await storage.loadWorkouts();
          if (existingWorkouts.length > 0) {
            console.log('[Migration] IndexedDB already has workouts, skipping workout migration');
            localStorage.setItem(MIGRATION_FLAG, 'true');
          } else {
            console.log(`[Migration] Migrating ${workouts.length} workouts to IndexedDB`);
            for (const workout of workouts) {
              try {
                await storage.saveWorkout(workout);
              } catch (error) {
                console.error(`[Migration] Failed to migrate workout ${workout.id}:`, error);
              }
            }
            localStorage.setItem(MIGRATION_FLAG, 'true');
          }
        }
      }
    }

    if (migrationLogsComplete !== 'true') {
      const storedLogs = localStorage.getItem(LOGS_STORAGE_KEY);
      if (!storedLogs) {
        console.log('[Migration] No localStorage workout logs to migrate');
        localStorage.setItem(MIGRATION_LOGS_FLAG, 'true');
      } else {
        let logs: unknown;
        try {
          logs = JSON.parse(storedLogs);
        } catch (error) {
          console.error('[Migration] Failed to parse localStorage logs:', error);
          logs = [];
        }

        if (!Array.isArray(logs) || logs.length === 0) {
          console.log('[Migration] No workout logs to migrate');
          localStorage.setItem(MIGRATION_LOGS_FLAG, 'true');
        } else {
          const existingLogs = await storage.loadWorkoutLogs();
          if (existingLogs.length > 0) {
            console.log('[Migration] IndexedDB already has logs, skipping log migration');
            localStorage.setItem(MIGRATION_LOGS_FLAG, 'true');
          } else {
            console.log(`[Migration] Migrating ${logs.length} workout logs to IndexedDB`);
            for (const log of logs) {
              try {
                await storage.saveWorkoutLog(log);
              } catch (error) {
                console.error('[Migration] Failed to migrate workout log:', error);
              }
            }
            localStorage.setItem(MIGRATION_LOGS_FLAG, 'true');
          }
        }
      }
    }

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
  return (
    localStorage.getItem(MIGRATION_FLAG) === 'true' &&
    localStorage.getItem(MIGRATION_LOGS_FLAG) === 'true'
  );
}

/**
 * Reset migration flag (for testing/debugging purposes)
 */
export function resetMigrationFlag(): void {
  localStorage.removeItem(MIGRATION_FLAG);
  localStorage.removeItem(MIGRATION_LOGS_FLAG);
}
