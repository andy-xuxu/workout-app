import { SavedWorkout } from '../../types';

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

  // Future methods for tracking features (commented for now):
  // saveWorkoutLog(log: WorkoutLog): Promise<void>;
  // loadWorkoutLogs(filters?: LogFilters): Promise<WorkoutLog[]>;
  // saveUserGoal(goal: UserGoal): Promise<void>;
  // loadUserGoals(): Promise<UserGoal[]>;
  // getUserStats(): Promise<UserStats>;
}
