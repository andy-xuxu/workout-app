import React, { useState } from 'react';
import { MuscleGroup } from '../utils/muscleMapping';

interface AnatomicalFigureProps {
  activeMuscleGroups: MuscleGroup[];
}

const AnatomicalFigure: React.FC<AnatomicalFigureProps> = ({ activeMuscleGroups }) => {
  const [view, setView] = useState<'front' | 'back'>('front');
  const isActive = (g: MuscleGroup) => activeMuscleGroups.includes(g);
  const cx = 120;
  const viewBox = '0 0 240 520';

  const muscleStyle = (g: MuscleGroup) => ({
    fill: isActive(g) ? 'url(#muscleHighlight)' : 'url(#muscleInactive)',
    stroke: isActive(g) ? 'rgba(96, 165, 250, 0.9)' : 'rgba(55, 65, 81, 0.6)',
    strokeWidth: isActive(g) ? 1.5 : 0.8,
    opacity: isActive(g) ? 1 : 0.35,
    filter: isActive(g) ? 'url(#softGlow)' : undefined,
  });

  return (
    <div className="w-full h-full flex flex-col items-center">
      <div className="mb-4 flex gap-2">
        <button onClick={() => setView('front')} className={`px-4 py-2 rounded-lg text-xs font-bold ${view === 'front' ? 'bg-white text-black' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>Front</button>
        <button onClick={() => setView('back')} className={`px-4 py-2 rounded-lg text-xs font-bold ${view === 'back' ? 'bg-white text-black' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>Back</button>
      </div>
      <div className="flex-1 w-full max-w-[280px] min-h-[340px]">
        <svg viewBox={viewBox} className="w-full h-full select-none" preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id="skinBase" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#2d2a28" /><stop offset="50%" stopColor="#252220" /><stop offset="100%" stopColor="#1e1c1a" />
            </linearGradient>
            <linearGradient id="muscleInactive" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3a3836" /><stop offset="100%" stopColor="#2a2826" />
            </linearGradient>
            <linearGradient id="muscleHighlight" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.85" /><stop offset="50%" stopColor="#a78bfa" stopOpacity="0.9" /><stop offset="100%" stopColor="#f472b6" stopOpacity="0.85" />
            </linearGradient>
            <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          {view === 'front' ? (
            <g>
              <path d={`M ${cx - 20} 92 Q ${cx - 28} 180 ${cx - 22} 250 Q ${cx - 20} 320 ${cx - 18} 345 L ${cx + 18} 345 Q ${cx + 20} 320 ${cx + 22} 250 Q ${cx + 28} 180 ${cx + 20} 92 Q ${cx} 85 ${cx - 20} 92 Z`} fill="url(#skinBase)" stroke="rgba(75,85,99,0.4)" strokeWidth="1" />
              <ellipse cx={cx} cy={42} rx={26} ry={32} fill="url(#skinBase)" stroke="rgba(75,85,99,0.5)" strokeWidth="1" />
              <path d={`M ${cx - 11} 72 L ${cx - 9} 88 Q ${cx} 92 ${cx + 9} 88 L ${cx + 11} 72 Q ${cx} 68 ${cx - 11} 72 Z`} fill="url(#skinBase)" stroke="rgba(75,85,99,0.5)" strokeWidth="1" />
              <path d={`M ${cx - 18} 345 L ${cx - 24} 400 Q ${cx - 22} 470 ${cx - 16} 512 L ${cx - 8} 515 L ${cx + 8} 515 L ${cx + 16} 512 Q ${cx + 22} 470 ${cx + 24} 400 L ${cx + 18} 345 Z`} fill="url(#skinBase)" stroke="rgba(75,85,99,0.4)" strokeWidth="1" />
              <path d={`M ${cx - 2} 95 Q ${cx - 28} 98 ${cx - 38} 115 Q ${cx - 42} 135 ${cx - 38} 158 Q ${cx - 32} 178 ${cx - 18} 192 L ${cx - 2} 198 L ${cx + 2} 198 L ${cx + 18} 192 Q ${cx + 32} 178 ${cx + 38} 158 Q ${cx + 42} 135 ${cx + 38} 115 Q ${cx + 28} 98 ${cx + 2} 95 Z`} {...muscleStyle('chest')} />
              <path d={`M ${cx - 38} 108 Q ${cx - 52} 112 ${cx - 55} 128 Q ${cx - 52} 148 ${cx - 42} 158 Q ${cx - 32} 162 ${cx - 22} 158 L ${cx - 28} 98 Q ${cx - 35} 102 ${cx - 38} 108 Z`} {...muscleStyle('shoulders')} />
              <path d={`M ${cx + 38} 108 Q ${cx + 52} 112 ${cx + 55} 128 Q ${cx + 52} 148 ${cx + 42} 158 Q ${cx + 32} 162 ${cx + 22} 158 L ${cx + 28} 98 Q ${cx + 35} 102 ${cx + 38} 108 Z`} {...muscleStyle('shoulders')} />
              <path d={`M ${cx - 42} 158 L ${cx - 48} 195 Q ${cx - 50} 235 ${cx - 46} 275 Q ${cx - 42} 310 ${cx - 36} 340 L ${cx - 30} 355 L ${cx - 22} 350 Q ${cx - 28} 310 ${cx - 32} 275 Q ${cx - 34} 235 ${cx - 32} 195 Z`} {...muscleStyle('arms')} />
              <path d={`M ${cx + 42} 158 L ${cx + 48} 195 Q ${cx + 50} 235 ${cx + 46} 275 Q ${cx + 42} 310 ${cx + 36} 340 L ${cx + 30} 355 L ${cx + 22} 350 Q ${cx + 28} 310 ${cx + 32} 275 Q ${cx + 34} 235 ${cx + 32} 195 Z`} {...muscleStyle('arms')} />
              <path d={`M ${cx - 18} 198 L ${cx - 22} 248 Q ${cx - 24} 278 ${cx - 22} 308 L ${cx - 18} 338 L ${cx} 342 L ${cx + 18} 338 L ${cx + 22} 308 Q ${cx + 24} 278 ${cx + 22} 248 L ${cx + 18} 198 L ${cx} 195 Z`} {...muscleStyle('core')} />
              <path d={`M ${cx - 28} 342 L ${cx - 32} 380 Q ${cx - 34} 420 ${cx - 32} 460 Q ${cx - 28} 495 ${cx - 24} 515 L ${cx - 14} 518 L ${cx - 10} 495 Q ${cx - 12} 460 ${cx - 14} 420 L ${cx - 16} 380 Z`} {...muscleStyle('legs')} />
              <path d={`M ${cx + 28} 342 L ${cx + 32} 380 Q ${cx + 34} 420 ${cx + 32} 460 Q ${cx + 28} 495 ${cx + 24} 515 L ${cx + 14} 518 L ${cx + 10} 495 Q ${cx + 12} 460 ${cx + 14} 420 L ${cx + 16} 380 Z`} {...muscleStyle('legs')} />
            </g>
          ) : (
            <g>
              <path d={`M ${cx - 22} 92 Q ${cx - 30} 180 ${cx - 24} 250 Q ${cx - 22} 320 ${cx - 20} 348 L ${cx + 20} 348 Q ${cx + 22} 320 ${cx + 24} 250 Q ${cx + 30} 180 ${cx + 22} 92 Q ${cx} 85 ${cx - 22} 92 Z`} fill="url(#skinBase)" stroke="rgba(75,85,99,0.4)" strokeWidth="1" />
              <ellipse cx={cx} cy={42} rx={26} ry={32} fill="url(#skinBase)" stroke="rgba(75,85,99,0.5)" strokeWidth="1" />
              <path d={`M ${cx - 11} 72 L ${cx - 9} 88 Q ${cx} 92 ${cx + 9} 88 L ${cx + 11} 72 Q ${cx} 68 ${cx - 11} 72 Z`} fill="url(#skinBase)" stroke="rgba(75,85,99,0.5)" strokeWidth="1" />
              <path d={`M ${cx - 20} 348 L ${cx - 26} 405 Q ${cx - 24} 472 ${cx - 18} 514 L ${cx - 8} 517 L ${cx + 8} 517 L ${cx + 18} 514 Q ${cx + 24} 472 ${cx + 26} 405 L ${cx + 20} 348 Z`} fill="url(#skinBase)" stroke="rgba(75,85,99,0.4)" strokeWidth="1" />
              <path d={`M ${cx - 2} 95 L ${cx - 22} 100 Q ${cx - 40} 120 ${cx - 42} 145 Q ${cx - 40} 175 ${cx - 35} 205 L ${cx - 32} 248 Q ${cx - 30} 290 ${cx - 28} 330 L ${cx} 335 L ${cx + 28} 330 Q ${cx + 30} 290 ${cx + 32} 248 L ${cx + 35} 205 Q ${cx + 40} 175 ${cx + 42} 145 Q ${cx + 40} 120 ${cx + 22} 100 L ${cx + 2} 95 Z`} {...muscleStyle('back')} />
              <path d={`M ${cx - 40} 112 Q ${cx - 54} 118 ${cx - 55} 135 Q ${cx - 52} 152 ${cx - 42} 162 L ${cx - 28} 158 L ${cx - 32} 118 Z`} {...muscleStyle('shoulders')} />
              <path d={`M ${cx + 40} 112 Q ${cx + 54} 118 ${cx + 55} 135 Q ${cx + 52} 152 ${cx + 42} 162 L ${cx + 28} 158 L ${cx + 32} 118 Z`} {...muscleStyle('shoulders')} />
              <path d={`M ${cx - 42} 162 L ${cx - 48} 200 Q ${cx - 50} 245 ${cx - 46} 285 Q ${cx - 42} 318 ${cx - 36} 345 L ${cx - 28} 352 L ${cx - 22} 342 Q ${cx - 28} 308 ${cx - 32} 268 L ${cx - 34} 218 Z`} {...muscleStyle('arms')} />
              <path d={`M ${cx + 42} 162 L ${cx + 48} 200 Q ${cx + 50} 245 ${cx + 46} 285 Q ${cx + 42} 318 ${cx + 36} 345 L ${cx + 28} 352 L ${cx + 22} 342 Q ${cx + 28} 308 ${cx + 32} 268 L ${cx + 34} 218 Z`} {...muscleStyle('arms')} />
              <path d={`M ${cx - 28} 248 L ${cx - 26} 295 Q ${cx - 24} 328 ${cx - 20} 358 L ${cx} 365 L ${cx + 20} 358 Q ${cx + 24} 328 ${cx + 26} 295 L ${cx + 28} 248 L ${cx} 245 Z`} {...muscleStyle('core')} />
              <path d={`M ${cx - 28} 358 L ${cx - 32} 398 Q ${cx - 34} 438 ${cx - 32} 478 Q ${cx - 28} 508 ${cx - 24} 518 L ${cx - 12} 518 L ${cx - 10} 488 Q ${cx - 14} 448 ${cx - 16} 398 Z`} {...muscleStyle('legs')} />
              <path d={`M ${cx + 28} 358 L ${cx + 32} 398 Q ${cx + 34} 438 ${cx + 32} 478 Q ${cx + 28} 508 ${cx + 24} 518 L ${cx + 12} 518 L ${cx + 10} 488 Q ${cx + 14} 448 ${cx + 16} 398 Z`} {...muscleStyle('legs')} />
            </g>
          )}
        </svg>
      </div>
      {activeMuscleGroups.length > 0 && (
        <div className="mt-4 w-full">
          <p className="text-xs text-gray-400 mb-2 text-center">Active muscle groups</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {activeMuscleGroups.map(g => (
              <span key={g} className="px-2 py-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 text-white text-[10px] font-bold rounded uppercase">{g}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AnatomicalFigure;
