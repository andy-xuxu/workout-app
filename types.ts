
export type Category = 'All' | 'Chest + Arms' | 'Legs' | 'Back + Shoulders';

export interface Workout {
  id: string;
  name: string;
  category: Category;
  tag: string; 
  gifUrl: string; // Pre-loaded demo URL
  description: string;
  targetMuscles: string[];
}

export interface SavedWorkout {
  id: string; // unique ID for the saved workout
  name: string; // user-provided name
  workouts: Workout[]; // array of workout exercises
  createdAt: number; // timestamp for sorting
}

export interface WorkoutLog {
  id: string;
  workoutId?: string;
  workoutName: string;
  completedAt: number;
  durationSeconds?: number;
  exercises: ExerciseLog[];
  notes?: string;
}

export interface ExerciseLog {
  exerciseId: string;
  exerciseName: string;
  sets: SetLog[];
}

export interface SetLog {
  setNumber: number;
  reps: number;
  weight?: number;
  completedAt: number;
}
