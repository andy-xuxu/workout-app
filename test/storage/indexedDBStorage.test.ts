import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IndexedDBStorage } from '../../utils/storage/indexedDBStorage';
import { SavedWorkout } from '../../types';

describe('IndexedDBStorage', () => {
  let storage: IndexedDBStorage;

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

  it('should initialize the database', async () => {
    expect(storage).toBeDefined();
    await expect(storage.init()).resolves.not.toThrow();
  });

  it('should save a workout', async () => {
    const workout = createMockWorkout('test-1', 'Test Workout');
    await expect(storage.saveWorkout(workout)).resolves.not.toThrow();
  });

  it('should load saved workouts', async () => {
    const workout1 = createMockWorkout('test-1', 'Workout 1');
    const workout2 = createMockWorkout('test-2', 'Workout 2');

    await storage.saveWorkout(workout1);
    await storage.saveWorkout(workout2);

    const workouts = await storage.loadWorkouts();
    expect(workouts).toHaveLength(2);
    expect(workouts.find(w => w.id === 'test-1')).toBeDefined();
    expect(workouts.find(w => w.id === 'test-2')).toBeDefined();
  });

  it('should update an existing workout', async () => {
    const workout = createMockWorkout('test-1', 'Original Name');
    await storage.saveWorkout(workout);

    await storage.updateWorkout('test-1', { name: 'Updated Name' });

    const workouts = await storage.loadWorkouts();
    const updated = workouts.find(w => w.id === 'test-1');
    expect(updated?.name).toBe('Updated Name');
  });

  it('should delete a workout', async () => {
    const workout = createMockWorkout('test-1', 'Test Workout');
    await storage.saveWorkout(workout);

    await storage.deleteWorkout('test-1');

    const workouts = await storage.loadWorkouts();
    expect(workouts).toHaveLength(0);
  });

  it('should handle updating non-existent workout', async () => {
    await expect(
      storage.updateWorkout('non-existent', { name: 'New Name' })
    ).rejects.toThrow();
  });

  it('should handle multiple operations', async () => {
    const workout1 = createMockWorkout('test-1', 'Workout 1');
    const workout2 = createMockWorkout('test-2', 'Workout 2');
    const workout3 = createMockWorkout('test-3', 'Workout 3');

    await storage.saveWorkout(workout1);
    await storage.saveWorkout(workout2);
    await storage.saveWorkout(workout3);

    await storage.updateWorkout('test-2', { name: 'Updated Workout 2' });
    await storage.deleteWorkout('test-1');

    const workouts = await storage.loadWorkouts();
    expect(workouts).toHaveLength(2);
    expect(workouts.find(w => w.id === 'test-2')?.name).toBe('Updated Workout 2');
    expect(workouts.find(w => w.id === 'test-1')).toBeUndefined();
  });

  it('should preserve workout data structure', async () => {
    const workout: SavedWorkout = {
      id: 'test-1',
      name: 'Complex Workout',
      workouts: [
        {
          id: 'ex-1',
          name: 'Exercise 1',
          category: 'Chest + Arms',
          tag: 'Chest',
          gifUrl: 'https://example.com/gif.gif',
          description: 'Test exercise',
          targetMuscles: ['Chest', 'Triceps'],
        },
      ],
      createdAt: 1234567890,
    };

    await storage.saveWorkout(workout);
    const loaded = await storage.loadWorkouts();

    expect(loaded[0]).toEqual(workout);
    expect(loaded[0].workouts).toHaveLength(1);
    expect(loaded[0].workouts[0].name).toBe('Exercise 1');
  });
});
