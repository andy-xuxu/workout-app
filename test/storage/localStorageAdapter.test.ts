import { describe, it, expect, beforeEach } from 'vitest';
import { LocalStorageAdapter } from '../../utils/storage/localStorageAdapter';
import { SavedWorkout } from '../../types';

describe('LocalStorageAdapter', () => {
  let storage: LocalStorageAdapter;

  beforeEach(() => {
    storage = new LocalStorageAdapter();
    localStorage.clear();
  });

  const createMockWorkout = (id: string, name: string): SavedWorkout => ({
    id,
    name,
    workouts: [],
    createdAt: Date.now(),
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

  it('should return empty array when no workouts exist', async () => {
    const workouts = await storage.loadWorkouts();
    expect(workouts).toEqual([]);
  });
});
