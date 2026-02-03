import { StorageAdapter } from './types';
import { SavedWorkout } from '../../types';

const STORAGE_KEY = 'pulsefit-saved-workouts';

/**
 * localStorage adapter implementation.
 * Used as a fallback when IndexedDB is unavailable (e.g., Safari private mode).
 * Maintains the same API as IndexedDBStorage for seamless fallback.
 */
export class LocalStorageAdapter implements StorageAdapter {
  /**
   * Save a new workout routine
   */
  async saveWorkout(workout: SavedWorkout): Promise<void> {
    try {
      const saved = await this.loadWorkouts();
      saved.push(workout);
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
}
