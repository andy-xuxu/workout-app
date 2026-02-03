import { SavedWorkout, WorkoutLog } from '../../types';

/**
 * Storage adapter interface for workout data persistence.
 * Provides a clean abstraction that can be implemented by different storage backends
 * (IndexedDB, localStorage, cloud sync, etc.)
 */
export interface StorageAdapter {
  /**
   * Save a new workout routine
   */
  saveWorkout(workout: SavedWorkout): Promise<void>;

  /**
   * Load all saved workout routines
   */
  loadWorkouts(): Promise<SavedWorkout[]>;

  /**
   * Update an existing workout routine
   */
  updateWorkout(id: string, updates: Partial<SavedWorkout>): Promise<void>;

  /**
   * Delete a workout routine by ID
   */
  deleteWorkout(id: string): Promise<void>;

  /**
   * Migrate data from localStorage to IndexedDB (one-time operation)
   */
  migrateFromLocalStorage(): Promise<void>;

  /**
   * Save a workout log entry
   */
  saveWorkoutLog(log: WorkoutLog): Promise<void>;

  /**
   * Load workout logs, sorted by completion date (newest first)
   */
  loadWorkoutLogs(): Promise<WorkoutLog[]>;

  /**
   * Delete a workout log entry by ID
   */
  deleteWorkoutLog(id: string): Promise<void>;
}
