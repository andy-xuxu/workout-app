
export type Category = 'All' | 'Chest + Arms' | 'Legs' | 'Back + Shoulders';

export interface Workout {
  id: string;
  name: string;
  category: Category;
  tag: string; 
  gifUrl: string; // Pre-loaded demo URL
  description: string;
  targetMuscles: string[];
  intensity: 'Low' | 'Medium' | 'High';
}

export interface SavedWorkout {
  id: string; // unique ID for the saved workout
  name: string; // user-provided name
  workouts: Workout[]; // array of workout exercises
  createdAt: number; // timestamp for sorting
}
