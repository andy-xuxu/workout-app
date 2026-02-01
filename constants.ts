import { Workout } from './types';

export const WORKOUT_LIBRARY: Workout[] = [
  // --- Chest + Arms Split ---
  {
    id: 'ca-1',
    name: 'DB Incline Press',
    category: 'Chest + Arms',
    tag: 'Chest',
    gifUrl: '', 
    description: 'Upper-chest focused press. Focus on a controlled descent and strong contraction at the top.',
    targetMuscles: ['Upper Chest', 'Triceps', 'Front Delts'],
    intensity: 'High'
  },
  {
    id: 'ca-2',
    name: 'Cable Flat Press',
    category: 'Chest + Arms',
    tag: 'Chest',
    gifUrl: '', 
    description: 'Constant tension chest press using cables. Great for maintaining muscle engagement.',
    targetMuscles: ['Chest', 'Triceps'],
    intensity: 'Medium'
  },
  {
    id: 'ca-3',
    name: 'Cable Overhead Extensions',
    category: 'Chest + Arms',
    tag: 'triceps',
    gifUrl: '', 
    description: 'Long-head tricep isolation. Keep elbows tucked and focus on the stretch at the bottom.',
    targetMuscles: ['Triceps'],
    intensity: 'Medium'
  },
  {
    id: 'ca-4',
    name: 'BB Seated Curls',
    category: 'Chest + Arms',
    tag: 'Arms',
    gifUrl: '', 
    description: 'Strict bicep curls performed seated to eliminate body sway and maximize peak tension.',
    targetMuscles: ['Biceps'],
    intensity: 'Medium'
  },
  {
    id: 'ca-5',
    name: 'DB Hammer Curls',
    category: 'Chest + Arms',
    tag: 'Arms',
    gifUrl: '', 
    description: 'Neutral grip curls targeting the brachialis and forearms for overall arm thickness.',
    targetMuscles: ['Biceps', 'Brachialis', 'Forearms'],
    intensity: 'Medium'
  },

  // --- Legs Split ---
  {
    id: 'l-1',
    name: 'BB Back Squats',
    category: 'Legs',
    tag: 'legs',
    gifUrl: '', 
    description: 'Compound movement for total lower body power. Maintain a neutral spine throughout.',
    targetMuscles: ['Quads', 'Glutes', 'Hamstrings', 'Core'],
    intensity: 'High'
  },
  {
    id: 'l-2',
    name: 'Bulgarian Split Squats',
    category: 'Legs',
    tag: 'legs',
    gifUrl: '', 
    description: 'Unilateral leg dominant movement. Elevate the rear foot and stay upright to target quads.',
    targetMuscles: ['Quads', 'Glutes'],
    intensity: 'High'
  },
  {
    id: 'l-3',
    name: 'DB RDLs',
    category: 'Legs',
    tag: 'legs',
    gifUrl: '', 
    description: 'Posterior chain focused movement. Hinge at the hips and feel the stretch in your hamstrings.',
    targetMuscles: ['Hamstrings', 'Glutes', 'Lower Back'],
    intensity: 'High'
  },
  {
    id: 'l-4',
    name: 'Seated Calf Raises',
    category: 'Legs',
    tag: 'legs',
    gifUrl: '', 
    description: 'Soleus isolation. Perform with a slow tempo and a full pause at the bottom stretch.',
    targetMuscles: ['Calves'],
    intensity: 'Medium'
  },

  // --- Back + Shoulders Split ---
  {
    id: 'bs-1',
    name: 'Cable Lateral Pulldowns',
    category: 'Back + Shoulders',
    tag: 'back',
    gifUrl: '', 
    description: 'Width builder for the lats. Pull to the upper chest while keeping shoulders depressed.',
    targetMuscles: ['Lats', 'Middle Back', 'Biceps'],
    intensity: 'High'
  },
  {
    id: 'bs-2',
    name: 'Chest-Supported Rows',
    category: 'Back + Shoulders',
    tag: 'back',
    gifUrl: '', 
    description: 'Mid-back thickness focus. Supporting the chest prevents momentum and lower back fatigue.',
    targetMuscles: ['Upper Back', 'Lats', 'Rear Delts'],
    intensity: 'High'
  },
  {
    id: 'bs-3',
    name: 'Cable Rear-delt Flys',
    category: 'Back + Shoulders',
    tag: 'back',
    gifUrl: '', 
    description: 'Isolation for the rear deltoids. Maintain a slight bend in the elbows and squeeze at the back.',
    targetMuscles: ['Rear Delts', 'Traps'],
    intensity: 'Medium'
  },
  {
    id: 'bs-4',
    name: 'DB Overhead Press',
    category: 'Back + Shoulders',
    tag: 'shoulders',
    gifUrl: '', 
    description: 'Vertical push for shoulder strength. Control the weights and avoid excessive arching.',
    targetMuscles: ['Shoulders', 'Triceps'],
    intensity: 'High'
  },
  {
    id: 'bs-5',
    name: 'Cable Lateral Raises',
    category: 'Back + Shoulders',
    tag: 'shoulders',
    gifUrl: '', 
    description: 'Medial delt isolation. The cable provides constant tension which is superior for growth.',
    targetMuscles: ['Side Delts'],
    intensity: 'Medium'
  }
];

export const CATEGORIES: string[] = ['All', 'Chest + Arms', 'Legs', 'Back + Shoulders'];
