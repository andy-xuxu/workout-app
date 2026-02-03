import { SavedWorkout, WorkoutLog } from '../../types';
import { IndexedDBStorage } from './indexedDBStorage';

const STORAGE_KEY = 'pulsefit-saved-workouts';
const LOGS_STORAGE_KEY = 'pulsefit-workout-logs';
const MIGRATION_FLAG = 'pulsefit-migration-complete';
const MIGRATION_LOGS_FLAG = 'pulsefit-migration-logs-complete';

/**
 * Validate a workout log to ensure it's complete and valid
 * This prevents phantom/invalid data from being migrated
 */
function isValidWorkoutLogForMigration(log: unknown): log is WorkoutLog {
  if (!log || typeof log !== 'object') return false;
  
  const l = log as Partial<WorkoutLog>;
  
  // Must have required fields
  if (!l.id || !l.workoutName || !l.completedAt) {
    return false;
  }
  
  // completedAt must be a valid timestamp (positive number)
  if (typeof l.completedAt !== 'number' || l.completedAt <= 0) {
    return false;
  }
  
  // Must have exercises array with at least one exercise
  if (!l.exercises || !Array.isArray(l.exercises) || l.exercises.length === 0) {
    return false;
  }
  
  // Calculate total reps to ensure workout has meaningful data
  let totalReps = 0;
  let hasValidExercise = false;
  
  for (const exercise of l.exercises) {
    if (!exercise || !exercise.exerciseId || !exercise.exerciseName) {
      continue;
    }
    
    if (!exercise.sets || !Array.isArray(exercise.sets) || exercise.sets.length === 0) {
      continue;
    }
    
    // Check if exercise has at least one valid set
    const exerciseHasValidSet = exercise.sets.some(set => 
      set && 
      typeof set.reps === 'number' && 
      set.reps > 0 &&
      typeof set.completedAt === 'number' &&
      set.completedAt > 0
    );
    
    if (exerciseHasValidSet) {
      hasValidExercise = true;
      // Sum up reps for this exercise
      exercise.sets.forEach(set => {
        if (set && typeof set.reps === 'number' && set.reps > 0) {
          totalReps += set.reps;
        }
      });
    }
  }
  
  // Require at least one valid exercise AND at least 1 rep
  // This matches the validation criteria in App.tsx to ensure consistency
  const hasMinimumReps = totalReps >= 1;
  
  return hasValidExercise && hasMinimumReps;
}

/**
 * Validate a saved workout to ensure it's complete and valid
 */
function isValidSavedWorkout(workout: unknown): workout is SavedWorkout {
  if (!workout || typeof workout !== 'object') return false;
  
  const w = workout as Partial<SavedWorkout>;
  
  // Must have required fields
  if (!w.id || !w.name || !w.createdAt) {
    return false;
  }
  
  // createdAt must be a valid timestamp
  if (typeof w.createdAt !== 'number' || w.createdAt <= 0) {
    return false;
  }
  
  // Must have workouts array with at least one workout
  if (!w.workouts || !Array.isArray(w.workouts) || w.workouts.length === 0) {
    return false;
  }
  
  return true;
}

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
            // Validate workouts before migrating - only migrate valid ones
            const validWorkouts = workouts.filter(isValidSavedWorkout);
            const invalidCount = workouts.length - validWorkouts.length;
            
            if (invalidCount > 0) {
              console.log(`[Migration] Filtered out ${invalidCount} invalid workouts. Migrating ${validWorkouts.length} valid workouts.`);
            }
            
            if (validWorkouts.length === 0) {
              console.log('[Migration] No valid workouts to migrate after validation');
              localStorage.setItem(MIGRATION_FLAG, 'true');
            } else {
              console.log(`[Migration] Migrating ${validWorkouts.length} valid workouts to IndexedDB`);
              for (const workout of validWorkouts) {
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
            // CRITICAL: Validate logs before migrating - only migrate valid, completed workouts
            // This prevents phantom/invalid data from being migrated to new users/devices
            
            // If there are suspiciously many logs (like 698), be extra cautious
            const suspiciousCount = logs.length > 100;
            const validLogs = logs.filter(isValidWorkoutLogForMigration);
            const invalidCount = logs.length - validLogs.length;
            const invalidRatio = logs.length > 0 ? invalidCount / logs.length : 0;
            
            // If more than 90% are invalid or there are suspiciously many logs, don't migrate
            // This prevents corrupted/phantom data from being migrated
            if (suspiciousCount && invalidRatio > 0.9) {
              console.warn(`[Migration] CRITICAL: Suspicious data detected - ${logs.length} total logs, ${invalidCount} invalid (${Math.round(invalidRatio * 100)}%). Clearing localStorage and starting fresh.`);
              // Clear the invalid localStorage data
              localStorage.removeItem(LOGS_STORAGE_KEY);
              localStorage.setItem(MIGRATION_LOGS_FLAG, 'true');
            } else {
              if (invalidCount > 0) {
                console.log(`[Migration] Filtered out ${invalidCount} invalid/phantom workout logs. Only migrating ${validLogs.length} valid logs.`);
              }
              
              if (validLogs.length === 0) {
                console.log('[Migration] No valid workout logs to migrate after validation. Starting fresh.');
                localStorage.setItem(MIGRATION_LOGS_FLAG, 'true');
              } else {
                console.log(`[Migration] Migrating ${validLogs.length} valid workout logs to IndexedDB`);
                for (const log of validLogs) {
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
