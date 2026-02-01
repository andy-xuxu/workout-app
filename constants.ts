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
    gifUrl: 'https://liftmanual.com/wp-content/uploads/2023/04/cable-seated-chest-press.jpg', 
    description: 'Constant tension chest press using cables. Great for maintaining muscle engagement.',
    targetMuscles: ['Chest', 'Triceps'],
    intensity: 'Medium'
  },
  {
    id: 'ca-3',
    name: 'Cable Overhead Extensions',
    category: 'Chest + Arms',
    tag: 'triceps',
    gifUrl: 'https://www.burnthefatinnercircle.com/members/images/2349.jpg', 
    description: 'Long-head tricep isolation. Keep elbows tucked and focus on the stretch at the bottom.',
    targetMuscles: ['Triceps'],
    intensity: 'Medium'
  },
  {
    id: 'ca-4',
    name: 'DB Seated Curls',
    category: 'Chest + Arms',
    tag: 'Arms',
    gifUrl: 'https://images.squarespace-cdn.com/content/v1/5ffcea9416aee143500ea103/1638178095392-8E8Q4NQ9OD3J2AMLXOSY/Seated%2BIncline%2BDumbbell%2BBiceps%2BCurl.jpeg', 
    description: 'Strict bicep curls performed seated to eliminate body sway and maximize peak tension.',
    targetMuscles: ['Biceps'],
    intensity: 'Medium'
  },
  {
    id: 'ca-5',
    name: 'DB Hammer Curls',
    category: 'Chest + Arms',
    tag: 'Arms',
    gifUrl: 'https://liftmanual.com/wp-content/uploads/2023/04/dumbbell-seated-hammer-curl.jpg', 
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
    gifUrl: 'https://experiencelife.lifetime.life/wp-content/uploads/2021/08/f2-barbell-back-squat-1024x577.jpg', 
    description: 'Compound movement for total lower body power. Maintain a neutral spine throughout.',
    targetMuscles: ['Quads', 'Glutes', 'Hamstrings', 'Core'],
    intensity: 'High'
  },
  {
    id: 'l-2',
    name: 'Bulgarian Split Squats',
    category: 'Legs',
    tag: 'legs',
    gifUrl: 'https://modusx.de/wp-content/uploads/bulgarian-split-squats-ohne-zusatzgewicht.jpg', 
    description: 'Unilateral leg dominant movement. Elevate the rear foot and stay upright to target quads.',
    targetMuscles: ['Quads', 'Glutes'],
    intensity: 'High'
  },
  {
    id: 'l-3',
    name: 'DB RDLs',
    category: 'Legs',
    tag: 'legs',
    gifUrl: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ3DYeHUkoSp38PrFL8-IyjvWNUJCQ_O_1eew&s', 
    description: 'Posterior chain focused movement. Hinge at the hips and feel the stretch in your hamstrings.',
    targetMuscles: ['Hamstrings', 'Glutes', 'Lower Back'],
    intensity: 'High'
  },
  {
    id: 'l-4',
    name: 'Seated Calf Raises',
    category: 'Legs',
    tag: 'legs',
    gifUrl: 'https://liftmanual.com/wp-content/uploads/2023/04/weighted-seated-calf-raise.jpg', 
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
    gifUrl: 'https://liftmanual.com/wp-content/uploads/2023/04/cable-wide-grip-lat-pulldown.jpg', 
    description: 'Width builder for the lats. Pull to the upper chest while keeping shoulders depressed.',
    targetMuscles: ['Lats', 'Middle Back', 'Biceps'],
    intensity: 'High'
  },
  {
    id: 'bs-2',
    name: 'Chest-Supported Rows',
    category: 'Back + Shoulders',
    tag: 'back',
    gifUrl: 'https://cdn.shopify.com/s/files/1/0449/8453/3153/files/chest_supported_row_muscles_worked_600x600.png?v=1716192902', 
    description: 'Mid-back thickness focus. Supporting the chest prevents momentum and lower back fatigue.',
    targetMuscles: ['Upper Back', 'Lats', 'Rear Delts'],
    intensity: 'High'
  },
  {
    id: 'bs-3',
    name: 'Cable Rear-delt Flys',
    category: 'Back + Shoulders',
    tag: 'back',
    gifUrl: 'https://anabolicaliens.com/cdn/shop/articles/5e628d3bea2ff808d2e7abcd_standing-cable-rear-delt-fly-exercise-anabolic-aliens-p-500.png?v=1644926615', 
    description: 'Isolation for the rear deltoids. Maintain a slight bend in the elbows and squeeze at the back.',
    targetMuscles: ['Rear Delts', 'Traps'],
    intensity: 'Medium'
  },
  {
    id: 'bs-4',
    name: 'DB Overhead Press',
    category: 'Back + Shoulders',
    tag: 'shoulders',
    gifUrl: 'https://liftmanual.com/wp-content/uploads/2023/04/dumbbell-seated-shoulder-press.jpg', 
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
    intensity: 'Medium'
  }
];

export const CATEGORIES: string[] = ['All', 'Chest + Arms', 'Legs', 'Back + Shoulders'];
