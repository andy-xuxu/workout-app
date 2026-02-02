import { Workout } from './types';

export const WORKOUT_LIBRARY: Workout[] = [
  // --- Chest + Arms Split ---
  {
    id: 'ca-1',
    name: 'DB Incline Press',
    category: 'Chest + Arms',
    tag: 'Chest',
    gifUrl: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Incline-Dumbbell-Press.gif', 
    description: 'Upper-chest focused press. Focus on a controlled descent and strong contraction at the top.',
    targetMuscles: ['Upper Chest', 'Triceps', 'Front Delts'],
    intensity: 'High'
  },
  {
    id: 'ca-2',
    name: 'Cable Flat Press',
    category: 'Chest + Arms',
    tag: 'Chest',
    gifUrl: 'https://fitnessprogramer.com/wp-content/uploads/2022/02/Seated-Cable-Chest-Press.gif', 
    description: 'Constant tension chest press using cables. Great for maintaining muscle engagement.',
    targetMuscles: ['Chest', 'Triceps'],
    intensity: 'Medium'
  },
  {
    id: 'ca-3',
    name: 'Cable Overhead Extensions',
    category: 'Chest + Arms',
    tag: 'triceps',
    gifUrl: 'https://fitnessprogramer.com/wp-content/uploads/2021/04/Cable-Rope-Overhead-Triceps-Extension.gif', 
    description: 'Long-head tricep isolation. Keep elbows tucked and focus on the stretch at the bottom.',
    targetMuscles: ['Triceps'],
    intensity: 'Medium'
  },
  {
    id: 'ca-4',
    name: 'DB Seated Incline Curls',
    category: 'Chest + Arms',
    tag: 'Arms',
    gifUrl: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Seated-Incline-Dumbbell-Curl.gif', 
    description: 'Strict bicep curls performed seated to eliminate body sway and maximize peak tension.',
    targetMuscles: ['Biceps'],
    intensity: 'Medium'
  },
  {
    id: 'ca-5',
    name: 'DB Hammer Curls',
    category: 'Chest + Arms',
    tag: 'Arms',
    gifUrl: 'https://fitnessprogramer.com/wp-content/uploads/2021/04/Seated-Hammer-Curl.gif', 
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
    gifUrl: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/BARBELL-SQUAT.gif', 
    description: 'Compound movement for total lower body power. Maintain a neutral spine throughout.',
    targetMuscles: ['Quads', 'Glutes', 'Hamstrings', 'Core'],
    intensity: 'High'
  },
  {
    id: 'l-2',
    name: 'Bulgarian Split Squats',
    category: 'Legs',
    tag: 'legs',
    gifUrl: 'https://fitnessprogramer.com/wp-content/uploads/2021/05/Dumbbell-Bulgarian-Split-Squat.gif', 
    description: 'Unilateral leg dominant movement. Elevate the rear foot and stay upright to target quads.',
    targetMuscles: ['Quads', 'Glutes'],
    intensity: 'High'
  },
  {
    id: 'l-3',
    name: 'DB RDLs',
    category: 'Legs',
    tag: 'legs',
    gifUrl: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Dumbbell-Romanian-Deadlift.gif', 
    description: 'Posterior chain focused movement. Hinge at the hips and feel the stretch in your hamstrings.',
    targetMuscles: ['Hamstrings', 'Glutes', 'Lower Back'],
    intensity: 'Medium'
  },
  {
    id: 'l-4',
    name: 'Seated Calf Raises',
    category: 'Legs',
    tag: 'legs',
    gifUrl: 'https://www.inspireusafoundation.org/file/2023/08/smith-machine-calf-raise.gif', 
    description: 'Soleus isolation. Perform with a slow tempo and a full pause at the bottom stretch.',
    targetMuscles: ['Calves'],
    intensity: 'Low'
  },

  // --- Back + Shoulders Split ---
  {
    id: 'bs-1',
    name: 'Cable Lateral Pulldowns',
    category: 'Back + Shoulders',
    tag: 'back',
    gifUrl: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Lat-Pulldown.gif', 
    description: 'Width builder for the lats. Pull to the upper chest while keeping shoulders depressed.',
    targetMuscles: ['Lats', 'Middle Back', 'Biceps'],
    intensity: 'High'
  },
  {
    id: 'bs-2',
    name: 'Chest-Supported Rows',
    category: 'Back + Shoulders',
    tag: 'back',
    gifUrl: 'https://media.tenor.com/dRQP9z6o7VMAAAAM/remada-inclinada-a-45-graus.gif', 
    description: 'Mid-back thickness focus. Supporting the chest prevents momentum and lower back fatigue.',
    targetMuscles: ['Upper Back', 'Lats', 'Rear Delts'],
    intensity: 'High'
  },
  {
    id: 'bs-3',
    name: 'Cable Rear-delt Flys',
    category: 'Back + Shoulders',
    tag: 'back',
    gifUrl: 'https://www.inspireusafoundation.org/file/2022/10/cable-rear-delt-fly.gif', 
    description: 'Isolation for the rear deltoids. Maintain a slight bend in the elbows and squeeze at the back.',
    targetMuscles: ['Rear Delts', 'Traps'],
    intensity: 'Low'
  },
  {
    id: 'bs-4',
    name: 'DB Overhead Press',
    category: 'Back + Shoulders',
    tag: 'shoulders',
    gifUrl: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Dumbbell-Shoulder-Press.gif', 
    description: 'Vertical push for shoulder strength. Control the weights and avoid excessive arching.',
    targetMuscles: ['Shoulders', 'Triceps'],
    intensity: 'High'
  },
  {
    id: 'bs-5',
    name: 'Cable Lateral Raises',
    category: 'Back + Shoulders',
    tag: 'shoulders',
    gifUrl: 'https://fitnessprogramer.com/wp-content/uploads/2021/09/Leaning-Cable-Lateral-Raise.gif', 
    description: 'Medial delt isolation. The cable provides constant tension which is superior for growth.',
    targetMuscles: ['Side Delts'],
    intensity: 'Low'
  }
];

export const CATEGORIES: string[] = ['All', 'Chest + Arms', 'Legs', 'Back + Shoulders'];
