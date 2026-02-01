
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

export interface AppState {
  localGifs: Record<string, string>; // workoutId -> dataUrl (user's custom uploads)
}
