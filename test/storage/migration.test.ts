import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { migrateLocalStorageToIndexedDB, isMigrationComplete, resetMigrationFlag } from '../../utils/storage/migration';
import { IndexedDBStorage } from '../../utils/storage/indexedDBStorage';
import { SavedWorkout } from '../../types';

describe('Migration', () => {
  let storage: IndexedDBStorage;
  const STORAGE_KEY = 'pulsefit-saved-workouts';

  beforeEach(async () => {
    // Clear any existing database
    if ('indexedDB' in window) {
      try {
        await new Promise<void>((resolve) => {
          const deleteReq = indexedDB.deleteDatabase('pulsefit-db');
          deleteReq.onsuccess = () => resolve();
          deleteReq.onerror = () => resolve();
          deleteReq.onblocked = () => resolve();
          setTimeout(() => resolve(), 500); // Timeout fallback
        });
      } catch (e) {
        // Ignore
      }
    }
    
    localStorage.clear();
    resetMigrationFlag();
    
    storage = new IndexedDBStorage();
    await storage.init();
  });

  afterEach(async () => {
    // Clean up: delete all workouts
    try {
      const workouts = await storage.loadWorkouts();
      for (const workout of workouts) {
        await storage.deleteWorkout(workout.id);
      }
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  const createMockWorkout = (id: string, name: string): SavedWorkout => ({
    id,
    name,
    workouts: [],
    createdAt: Date.now(),
  });

  it('should migrate workouts from localStorage to IndexedDB', async () => {
    // Setup: Add workouts to localStorage
    const workout1 = createMockWorkout('test-1', 'Workout 1');
    const workout2 = createMockWorkout('test-2', 'Workout 2');
    localStorage.setItem(STORAGE_KEY, JSON.stringify([workout1, workout2]));

    // Migrate
    await migrateLocalStorageToIndexedDB(storage);

    // Verify migration
    const workouts = await storage.loadWorkouts();
    expect(workouts).toHaveLength(2);
    expect(workouts.find(w => w.id === 'test-1')).toBeDefined();
    expect(workouts.find(w => w.id === 'test-2')).toBeDefined();
    expect(isMigrationComplete()).toBe(true);
  });

  it('should not migrate if migration flag is already set', async () => {
    const workout = createMockWorkout('test-1', 'Workout 1');
    localStorage.setItem(STORAGE_KEY, JSON.stringify([workout]));
    localStorage.setItem('pulsefit-migration-complete', 'true');

    // Add a workout directly to IndexedDB
    await storage.saveWorkout(createMockWorkout('existing-1', 'Existing'));

    await migrateLocalStorageToIndexedDB(storage);

    // Should not have migrated the localStorage workout
    const workouts = await storage.loadWorkouts();
    expect(workouts).toHaveLength(1);
    expect(workouts[0].id).toBe('existing-1');
  });

  it('should not migrate if IndexedDB already has data', async () => {
    const workout1 = createMockWorkout('test-1', 'Workout 1');
    localStorage.setItem(STORAGE_KEY, JSON.stringify([workout1]));

    // Add a workout directly to IndexedDB first
    await storage.saveWorkout(createMockWorkout('existing-1', 'Existing'));

    await migrateLocalStorageToIndexedDB(storage);

    // Should not have migrated
    const workouts = await storage.loadWorkouts();
    expect(workouts).toHaveLength(1);
    expect(workouts[0].id).toBe('existing-1');
  });

  it('should handle empty localStorage', async () => {
    await migrateLocalStorageToIndexedDB(storage);
    expect(isMigrationComplete()).toBe(true);
    
    const workouts = await storage.loadWorkouts();
    expect(workouts).toHaveLength(0);
  });

  it('should preserve localStorage data after migration', async () => {
    const workout = createMockWorkout('test-1', 'Workout 1');
    localStorage.setItem(STORAGE_KEY, JSON.stringify([workout]));

    await migrateLocalStorageToIndexedDB(storage);

    // localStorage should still have the data
    const stored = localStorage.getItem(STORAGE_KEY);
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed).toHaveLength(1);
  });

  it('should handle invalid JSON in localStorage', async () => {
    localStorage.setItem(STORAGE_KEY, 'invalid json');
    
    // Should not throw, but migration should fail gracefully
    await expect(migrateLocalStorageToIndexedDB(storage)).resolves.not.toThrow();
    expect(isMigrationComplete()).toBe(false); // Flag not set on failure
  });
});
