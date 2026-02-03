import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { storage } from '../../utils/storage';
import { SavedWorkout } from '../../types';

describe('Storage Integration', () => {
  beforeEach(async () => {
    // Clear all data
    try {
      const workouts = await storage.loadWorkouts();
      for (const workout of workouts) {
        await storage.deleteWorkout(workout.id);
      }
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  afterEach(async () => {
    // Clean up after each test
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

  it('should work end-to-end: save, load, update, delete', async () => {
    // Save
    const workout = createMockWorkout('test-1', 'Test Workout');
    await storage.saveWorkout(workout);

    // Load
    let workouts = await storage.loadWorkouts();
    expect(workouts).toHaveLength(1);
    expect(workouts[0].name).toBe('Test Workout');

    // Update
    await storage.updateWorkout('test-1', { name: 'Updated Workout' });
    workouts = await storage.loadWorkouts();
    expect(workouts[0].name).toBe('Updated Workout');

    // Delete
    await storage.deleteWorkout('test-1');
    workouts = await storage.loadWorkouts();
    expect(workouts).toHaveLength(0);
  });

  it('should handle multiple workouts', async () => {
    const workout1 = createMockWorkout('test-1', 'Workout 1');
    const workout2 = createMockWorkout('test-2', 'Workout 2');
    const workout3 = createMockWorkout('test-3', 'Workout 3');

    await storage.saveWorkout(workout1);
    await storage.saveWorkout(workout2);
    await storage.saveWorkout(workout3);

    const workouts = await storage.loadWorkouts();
    expect(workouts).toHaveLength(3);
  });

  it('should handle complex workout data', async () => {
    const workout: SavedWorkout = {
      id: 'complex-1',
      name: 'Complex Workout',
      workouts: [
        {
          id: 'ex-1',
          name: 'Bench Press',
          category: 'Chest + Arms',
          tag: 'Chest',
          gifUrl: 'https://example.com/bench.gif',
          description: 'A compound exercise',
          targetMuscles: ['Chest', 'Triceps', 'Shoulders'],
        },
        {
          id: 'ex-2',
          name: 'Squats',
          category: 'Legs',
          tag: 'Legs',
          gifUrl: 'https://example.com/squat.gif',
          description: 'Leg exercise',
          targetMuscles: ['Quads', 'Glutes'],
        },
      ],
      createdAt: 1234567890,
    };

    await storage.saveWorkout(workout);
    const loaded = await storage.loadWorkouts();

    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe('complex-1');
    expect(loaded[0].workouts).toHaveLength(2);
    expect(loaded[0].workouts[0].name).toBe('Bench Press');
    expect(loaded[0].workouts[1].name).toBe('Squats');
  });

  it('should maintain data integrity across operations', async () => {
    const workout1 = createMockWorkout('test-1', 'Workout 1');
    const workout2 = createMockWorkout('test-2', 'Workout 2');

    await storage.saveWorkout(workout1);
    await storage.saveWorkout(workout2);

    // Update workout1
    await storage.updateWorkout('test-1', { name: 'Updated 1' });

    // Delete workout2
    await storage.deleteWorkout('test-2');

    // Verify final state
    const workouts = await storage.loadWorkouts();
    expect(workouts).toHaveLength(1);
    expect(workouts[0].id).toBe('test-1');
    expect(workouts[0].name).toBe('Updated 1');
  });
});
