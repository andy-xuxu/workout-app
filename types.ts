
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

// Future types for tracking features (commented for reference):
// export interface WorkoutLog {
//   id: string;
//   workoutId: string;
//   workoutName: string;
//   completedAt: number;
//   duration: number; // seconds
//   exercises: ExerciseLog[];
//   notes?: string;
// }
//
// export interface ExerciseLog {
//   exerciseId: string;
//   exerciseName: string;
//   sets: SetLog[];
// }
//
// export interface SetLog {
//   setNumber: number;
//   reps: number;
//   weight?: number; // optional
//   restTime?: number; // seconds
//   completedAt: number;
// }
//
// export interface UserGoal {
//   id: string;
//   type: 'strength' | 'volume' | 'frequency' | 'endurance';
//   target: number;
//   current: number;
//   deadline?: number;
//   createdAt: number;
// }
//
// export interface UserStats {
//   totalWorkouts: number;
//   totalVolume: number; // total weight lifted
//   longestStreak: number;
//   currentStreak: number;
//   favoriteExercises: string[];
// }
