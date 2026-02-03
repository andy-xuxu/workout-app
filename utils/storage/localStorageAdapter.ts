import { StorageAdapter } from './types';
import { SavedWorkout, WorkoutLog } from '../../types';

const STORAGE_KEY = 'pulsefit-saved-workouts';
const LOGS_STORAGE_KEY = 'pulsefit-workout-logs';

/**
 * localStorage adapter implementation.
 * Used as a fallback when IndexedDB is unavailable (e.g., Safari private mode).
 * Maintains the same API as IndexedDBStorage for seamless fallback.
 */
export class LocalStorageAdapter implements StorageAdapter {
  /**
   * Save a new workout routine
   * Uses put() semantics - updates if exists, adds if new
   */
  async saveWorkout(workout: SavedWorkout): Promise<void> {
    try {
      const saved = await this.loadWorkouts();
      const existingIndex = saved.findIndex(w => w.id === workout.id);
      if (existingIndex >= 0) {
        // Update existing workout
        saved[existingIndex] = workout;
      } else {
        // Add new workout
        saved.push(workout);
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    } catch (error) {
      console.error('Error saving workout to localStorage:', error);
      throw error;
    }
  }

  /**
   * Load all saved workout routines
   */
  async loadWorkouts(): Promise<SavedWorkout[]> {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return [];
      return JSON.parse(stored);
    } catch (error) {
      console.error('Error loading workouts from localStorage:', error);
      return [];
    }
  }

  /**
   * Update an existing workout routine
   */
  async updateWorkout(id: string, updates: Partial<SavedWorkout>): Promise<void> {
    try {
      const saved = await this.loadWorkouts();
      const index = saved.findIndex(w => w.id === id);
      if (index === -1) {
        throw new Error(`Workout with id ${id} not found`);
      }
      saved[index] = { ...saved[index], ...updates };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    } catch (error) {
      console.error('Error updating workout in localStorage:', error);
      throw error;
    }
  }

  /**
   * Delete a workout routine by ID
   */
  async deleteWorkout(id: string): Promise<void> {
    try {
      const saved = await this.loadWorkouts();
      const filtered = saved.filter(w => w.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    } catch (error) {
      console.error('Error deleting workout from localStorage:', error);
      throw error;
    }
  }

  /**
   * Migration is not needed for localStorage adapter
   */
  async migrateFromLocalStorage(): Promise<void> {
    // No-op for localStorage adapter
    return Promise.resolve();
  }

  /**
   * Save a workout log entry
   * Uses put() semantics - updates if exists, adds if new
   */
  async saveWorkoutLog(log: WorkoutLog): Promise<void> {
    try {
      const logs = await this.loadWorkoutLogs();
      const existingIndex = logs.findIndex(l => l.id === log.id);
      if (existingIndex >= 0) {
        // Update existing log
        logs[existingIndex] = log;
      } else {
        // Add new log
        logs.push(log);
      }
      localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(logs));
    } catch (error) {
      console.error('Error saving workout log to localStorage:', error);
      throw error;
    }
  }

  /**
   * Load workout logs sorted by completedAt (newest first)
   */
  async loadWorkoutLogs(): Promise<WorkoutLog[]> {
    try {
      const stored = localStorage.getItem(LOGS_STORAGE_KEY);
      if (!stored) return [];
      const logs = JSON.parse(stored) as WorkoutLog[];
      return logs.sort((a, b) => b.completedAt - a.completedAt);
    } catch (error) {
      console.error('Error loading workout logs from localStorage:', error);
      return [];
    }
  }

  /**
   * Delete a workout log entry by ID
   */
  async deleteWorkoutLog(id: string): Promise<void> {
    try {
      const logs = await this.loadWorkoutLogs();
      const filtered = logs.filter(log => log.id !== id);
      localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(filtered));
    } catch (error) {
      console.error('Error deleting workout log from localStorage:', error);
      throw error;
    }
  }
}
