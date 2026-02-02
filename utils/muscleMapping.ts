export type MuscleGroup =
  | 'chest'
  | 'arms'
  | 'shoulders'
  | 'back'
  | 'core'
  | 'legs';

const MUSCLE_TO_GROUP: Record<string, MuscleGroup> = {
  chest: 'chest', 'upper chest': 'chest',
  biceps: 'arms', triceps: 'arms', brachialis: 'arms', forearms: 'arms',
  shoulders: 'shoulders', 'front delts': 'shoulders', 'side delts': 'shoulders', 'rear delts': 'shoulders',
  lats: 'back', 'middle back': 'back', 'upper back': 'back', 'lower back': 'back', traps: 'back',
  core: 'core',
  quads: 'legs', hamstrings: 'legs', glutes: 'legs', calves: 'legs',
};

export function getMuscleGroups(muscles: string[]): MuscleGroup[] {
  const set = new Set<MuscleGroup>();
  muscles.forEach(m => {
    const g = MUSCLE_TO_GROUP[m.toLowerCase().trim()];
    if (g) set.add(g);
  });
  return Array.from(set);
}

export function getMuscleGroupsFromWorkouts(workouts: { targetMuscles: string[] }[]): MuscleGroup[] {
  return getMuscleGroups(workouts.flatMap(w => w.targetMuscles));
}
