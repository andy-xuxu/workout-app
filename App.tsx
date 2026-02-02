import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { WORKOUT_LIBRARY, CATEGORIES } from './constants';
import { Workout, Category, SavedWorkout } from './types';

type AppMode = 'landing' | 'view' | 'create' | 'saved' | 'view-saved';

const STORAGE_KEY = 'pulsefit-saved-workouts';

// localStorage helper functions
const loadSavedWorkouts = (): SavedWorkout[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch (error) {
    console.error('Error loading saved workouts:', error);
    return [];
  }
};

const saveWorkoutToStorage = (workout: SavedWorkout): void => {
  try {
    const saved = loadSavedWorkouts();
    saved.push(workout);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  } catch (error) {
    console.error('Error saving workout:', error);
  }
};

const deleteWorkoutFromStorage = (workoutId: string): void => {
  try {
    const saved = loadSavedWorkouts();
    const filtered = saved.filter(w => w.id !== workoutId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Error deleting workout:', error);
  }
};

const updateSavedWorkout = (workoutId: string, updates: Partial<SavedWorkout>): void => {
  try {
    const saved = loadSavedWorkouts();
    const index = saved.findIndex(w => w.id === workoutId);
    if (index !== -1) {
      saved[index] = { ...saved[index], ...updates };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    }
  } catch (error) {
    console.error('Error updating workout:', error);
  }
};

// Helper functions
const getIntensityBadgeClass = (intensity: 'Low' | 'Medium' | 'High'): string => {
  switch (intensity) {
    case 'Low':
      return 'bg-green-600 text-white';
    case 'Medium':
      return 'bg-yellow-600 text-white';
    case 'High':
      return 'bg-red-600 text-white';
  }
};

const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString();
};

// Mobile detection hook
const useIsMobile = (): boolean => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const mediaQuery = window.matchMedia('(max-width: 768px)');
      const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      setIsMobile(mediaQuery.matches && hasTouch);
    };

    checkMobile();
    const mediaQuery = window.matchMedia('(max-width: 768px)');
    const handleChange = () => checkMobile();
    
    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, []);

  return isMobile;
};

// Prominent tile detection hook
const useProminentTile = (
  tileIds: string[],
  isMobile: boolean
): { prominentTileId: string | null; getTileRef: (id: string) => (element: HTMLElement | null) => void } => {
  const [prominentTileId, setProminentTileId] = useState<string | null>(null);
  const tileRefs = useRef<Map<string, HTMLElement>>(new Map());
  const observerRef = useRef<IntersectionObserver | null>(null);
  const visibleAreasRef = useRef<Map<string, number>>(new Map());

  const getTileRef = useCallback((id: string) => {
    return (element: HTMLElement | null) => {
      if (element) {
        element.setAttribute('data-tile-id', id);
        const previousElement = tileRefs.current.get(id);
        if (previousElement !== element) {
          // Unobserve previous element if it exists
          if (previousElement && observerRef.current) {
            observerRef.current.unobserve(previousElement);
          }
          tileRefs.current.set(id, element);
          // Observe new element if observer exists
          if (observerRef.current) {
            observerRef.current.observe(element);
          }
        }
      } else {
        const elementToRemove = tileRefs.current.get(id);
        if (elementToRemove && observerRef.current) {
          observerRef.current.unobserve(elementToRemove);
        }
        tileRefs.current.delete(id);
      }
    };
  }, []);

  useEffect(() => {
    if (!isMobile || tileIds.length === 0) {
      setProminentTileId(null);
      visibleAreasRef.current.clear();
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      return;
    }

    // Cleanup previous observer
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    // Clear visible areas for tiles that are no longer in the list
    const tileIdSet = new Set(tileIds);
    visibleAreasRef.current.forEach((_, id) => {
      if (!tileIdSet.has(id)) {
        visibleAreasRef.current.delete(id);
      }
    });

    // Create intersection observer with multiple thresholds
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const tileId = entry.target.getAttribute('data-tile-id');
          if (!tileId || !tileIdSet.has(tileId)) return;

          // Calculate visible area
          const visibleArea = entry.intersectionRatio * (entry.target as HTMLElement).offsetHeight;
          visibleAreasRef.current.set(tileId, visibleArea);
        });

        // Find tile with largest visible area (only from current tileIds)
        let maxArea = 0;
        let mostProminentId: string | null = null;

        visibleAreasRef.current.forEach((area, id) => {
          if (tileIdSet.has(id) && area > maxArea) {
            maxArea = area;
            mostProminentId = id;
          }
        });

        // Only set prominent tile if it has significant visibility (at least 10% visible)
        if (mostProminentId && maxArea > 0) {
          setProminentTileId(mostProminentId);
        } else {
          setProminentTileId(null);
        }
      },
      {
        threshold: [0, 0.1, 0.25, 0.5, 0.75, 1.0],
        rootMargin: '0px',
      }
    );

    // Observe all existing tiles that are in the current tileIds list
    tileRefs.current.forEach((element, id) => {
      if (tileIdSet.has(id) && observerRef.current) {
        observerRef.current.observe(element);
      }
    });

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, [isMobile, tileIds]);

  return { prominentTileId, getTileRef };
};

// Empty GIF placeholder component
const EmptyGifPlaceholder: React.FC<{ size?: 'small' | 'large' }> = ({ size = 'small' }) => {
  const iconSize = size === 'large' ? 'w-12 h-12' : 'w-8 h-8';
  const textSize = size === 'large' ? 'text-sm' : 'text-[9px]';
  
  return (
    <div className={`w-full h-full flex flex-col items-center justify-center text-gray-800 gap-2`}>
      <svg className={`${iconSize} opacity-20`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
      <span className={`${textSize} font-black uppercase tracking-widest text-center px-4`}>
        {size === 'large' ? 'Technique Clip Awaiting' : 'Technique Coming Soon'}
      </span>
    </div>
  );
};

// Sortable Workout Card Component
interface SortableWorkoutCardProps {
  workout: Workout;
  onRemove: (workoutId: string) => void;
  onClick: (workout: Workout) => void;
  getCategoryStyles: (category: Category) => { gradient: string; border: string; text: string; bg: string };
  getIntensityBadgeClass: (intensity: 'Low' | 'Medium' | 'High') => string;
}

const SortableWorkoutCard: React.FC<SortableWorkoutCardProps> = ({
  workout,
  onRemove,
  onClick,
  getCategoryStyles,
  getIntensityBadgeClass,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: workout.id });

  const styles = getCategoryStyles(workout.category);
  
  // Build transform string properly
  let transformString: string | undefined = undefined;
  if (transform) {
    transformString = CSS.Transform.toString(transform);
    if (isDragging) {
      transformString += ' scale(1.08)'; // Larger scale for better "pop up" effect
    }
  } else if (isDragging) {
    transformString = 'scale(1.08)';
  }
  
  const style: React.CSSProperties = {
    transition: isDragging ? 'none' : (transition || 'transform 250ms cubic-bezier(0.2, 0, 0, 1)'),
    opacity: isDragging ? 0.9 : 1,
    zIndex: isDragging ? 9999 : 1,
    touchAction: 'none', // Prevent scrolling and text selection on mobile
    userSelect: 'none', // Prevent iOS text selection/magnifying glass
    WebkitUserSelect: 'none', // Safari prefix
    WebkitTouchCallout: 'none', // Prevent iOS callout menu
  };
  
  // Only set transform when we have a value from @dnd-kit
  // This ensures transforms are properly cleared when drag ends
  if (transformString) {
    style.transform = transformString;
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group bg-[#111111] border border-gray-800 rounded-2xl overflow-hidden flex flex-col gap-4 p-4 relative select-none ${
        isDragging 
          ? 'shadow-2xl shadow-blue-500/30 cursor-grabbing' 
          : 'cursor-grab hover:border-gray-700 hover:-translate-y-2 hover:scale-[1.02] hover:shadow-2xl hover:shadow-black/60'
      }`}
      {...attributes}
      {...listeners}
    >
      {/* Drag Handle Indicator */}
      <div
        className="absolute top-4 left-4 z-10 p-2 text-gray-500 pointer-events-none"
        aria-hidden="true"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
        </svg>
      </div>

      {/* Remove Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove(workout.id);
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
        }}
        onTouchStart={(e) => {
          e.stopPropagation();
        }}
        className="absolute top-4 right-4 z-20 p-2 bg-red-600/80 hover:bg-red-600 rounded-lg text-white transition-colors touch-none"
        aria-label={`Remove ${workout.name}`}
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <div className="flex-1 flex flex-col justify-center">
        <div className="flex items-center gap-3 mb-2">
          <span className={`px-3 py-1 ${styles.bg} ${styles.text} text-[10px] font-black rounded-lg uppercase tracking-widest transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 select-none`}>
            {workout.tag}
          </span>
          <span className={`px-3 py-1 ${getIntensityBadgeClass(workout.intensity)} text-[10px] font-black rounded-lg uppercase tracking-widest select-none`}>
            {workout.intensity}
          </span>
        </div>
        <h3 className="text-xl font-bold mb-1 transition-colors duration-300 group-hover:text-white select-none">{workout.name}</h3>
        <p className="text-gray-400 text-sm mb-3 select-none">{workout.description}</p>
        <div className="flex flex-wrap gap-2">
          {workout.targetMuscles.map(m => (
            <span key={m} className="px-3 py-1 bg-black/40 text-gray-400 text-[10px] font-black rounded-lg border border-gray-800 uppercase select-none">
              {m}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [appMode, setAppMode] = useState<AppMode>('landing');
  const [selectedCategory, setSelectedCategory] = useState<Category>('All');
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null);
  const [customWorkouts, setCustomWorkouts] = useState<Workout[]>([]);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [savedWorkouts, setSavedWorkouts] = useState<SavedWorkout[]>([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [workoutNameInput, setWorkoutNameInput] = useState('');
  const [editingWorkoutId, setEditingWorkoutId] = useState<string | null>(null);
  const [viewingWorkoutId, setViewingWorkoutId] = useState<string | null>(null);
  const [originalWorkout, setOriginalWorkout] = useState<{ workouts: Workout[]; name: string } | null>(null);

  const isCreateMode = appMode === 'create';
  const isMobile = useIsMobile();

  // Configure drag-and-drop sensors
  const sensors = useSensors(
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150, // Shorter delay for more responsive dragging
        tolerance: 8, // Increased tolerance to prevent accidental scroll
      },
    }),
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px of movement before activating drag
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Get unique tags from workout library
  const availableTags = useMemo(() => {
    const tags = Array.from(new Set(WORKOUT_LIBRARY.map(w => w.tag)));
    // Sort tags with "Legs" last
    return tags.sort((a, b) => {
      if (a === 'Legs') return 1;
      if (b === 'Legs') return -1;
      return a.localeCompare(b);
    });
  }, []);

  const filteredWorkouts = useMemo(() => {
    if (isCreateMode) {
      return selectedTag
        ? WORKOUT_LIBRARY.filter(w => w.tag.toLowerCase() === selectedTag.toLowerCase())
        : WORKOUT_LIBRARY;
    }
    return selectedCategory === 'All'
      ? WORKOUT_LIBRARY
      : WORKOUT_LIBRARY.filter(w => w.category === selectedCategory);
  }, [isCreateMode, selectedTag, selectedCategory]);

  // Get tile IDs for prominent tile detection
  const tileIds = useMemo(() => {
    if (appMode === 'view-saved' && viewingWorkoutId) {
      const viewedWorkout = savedWorkouts.find(w => w.id === viewingWorkoutId);
      return viewedWorkout ? viewedWorkout.workouts.map(w => w.id) : [];
    }
    return filteredWorkouts.map(w => w.id);
  }, [appMode, viewingWorkoutId, savedWorkouts, filteredWorkouts]);

  // Prominent tile detection for mobile
  const { prominentTileId, getTileRef } = useProminentTile(tileIds, isMobile);

  const getCategoryStyles = (category: Category) => {
    switch (category) {
      case 'Chest + Arms': 
        return { 
          gradient: 'from-blue-500 to-cyan-400',
          border: 'border-2 border-blue-500/20', 
          text: 'text-white', 
          bg: 'bg-blue-600' 
        };
      case 'Legs': 
        return { 
          gradient: 'from-emerald-500 to-green-400',
          border: 'border-2 border-emerald-500/20', 
          text: 'text-white', 
          bg: 'bg-emerald-600' 
        };
      case 'Back + Shoulders': 
        return { 
          gradient: 'from-purple-600 to-pink-500',
          border: 'border-2 border-purple-500/20', 
          text: 'text-white', 
          bg: 'bg-purple-600' 
        };
      case 'All':
      default:
        return { 
          gradient: 'from-gray-600 to-gray-400',
          border: 'border-2 border-gray-800', 
          text: 'text-white', 
          bg: 'bg-gray-700' 
        };
    }
  };

  const handleWorkoutToggle = (workout: Workout) => {
    setCustomWorkouts(prev =>
      prev.some(w => w.id === workout.id)
        ? prev.filter(w => w.id !== workout.id)
        : [workout, ...prev]
    );
  };

  const handleViewWorkouts = () => {
    setAppMode('view');
    setSelectedCategory('Chest + Arms');
  };

  const handleCreateNewWorkout = () => {
    setAppMode('create');
    setCustomWorkouts([]);
    setSelectedTag(null);
    setEditingWorkoutId(null);
    setOriginalWorkout(null);
  };

  const handleBackToLanding = () => {
    setAppMode('landing');
    setSelectedWorkout(null);
    setCustomWorkouts([]);
    setEditingWorkoutId(null);
    setViewingWorkoutId(null);
    setOriginalWorkout(null);
  };

  const handleClearCustomWorkout = () => {
    setCustomWorkouts([]);
    // Don't clear editingWorkoutId - user might want to clear workouts and add new ones to the same saved workout
    // Keep editingWorkoutId set so they can still save to the same workout
    // Keep originalWorkout as is - we need it to detect changes from the original state
  };

  const handleRemoveWorkout = (workoutId: string) => {
    setCustomWorkouts(prev => prev.filter(w => w.id !== workoutId));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setCustomWorkouts(items => {
        const oldIndex = items.findIndex(item => item.id === active.id);
        const newIndex = items.findIndex(item => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const closeSaveModal = () => {
    setShowSaveModal(false);
    setWorkoutNameInput('');
    // Don't clear editingWorkoutId here - keep it set so subsequent saves continue to update the same workout
    // It will be cleared when creating a new workout or going back to landing
    // setEditingWorkoutId(null);
    // Don't clear originalWorkout either - we need it to detect changes
    // setOriginalWorkout(null);
  };

  const handleSaveWorkout = () => {
    if (customWorkouts.length === 0) return;
    setShowSaveModal(true);
    // If editing an existing workout, pre-fill the name
    if (editingWorkoutId) {
      const workout = savedWorkouts.find(w => w.id === editingWorkoutId);
      setWorkoutNameInput(workout?.name || '');
      // Store original state if not already stored
      if (!originalWorkout && workout) {
        setOriginalWorkout({ workouts: [...workout.workouts], name: workout.name });
      }
    } else {
      setWorkoutNameInput('');
    }
  };

  // Check if changes were made when editing (for Save button - doesn't check name since modal isn't open yet)
  const hasWorkoutChanges = useMemo(() => {
    if (!editingWorkoutId || !originalWorkout) return true; // New workout always has "changes"
    
    // Compare workouts by IDs and order - reordering counts as a change
    const originalIds = originalWorkout.workouts.map(w => w.id);
    const currentIds = customWorkouts.map(w => w.id);
    
    // Check if length changed
    if (originalIds.length !== currentIds.length) {
      return true;
    }
    
    // Check if order or content changed
    const workoutsChanged = originalIds.some((id, index) => id !== currentIds[index]);
    
    return workoutsChanged;
  }, [editingWorkoutId, originalWorkout, customWorkouts]);

  // Check if changes were made when editing (for modal - includes name check)
  const hasChanges = useMemo(() => {
    if (!editingWorkoutId || !originalWorkout) return true; // New workout always has "changes"
    
    const currentName = workoutNameInput.trim();
    const nameChanged = currentName !== originalWorkout.name;
    
    // Compare workouts by IDs and order - reordering counts as a change
    const originalIds = originalWorkout.workouts.map(w => w.id);
    const currentIds = customWorkouts.map(w => w.id);
    
    // Check if length changed
    if (originalIds.length !== currentIds.length) {
      return true;
    }
    
    // Check if order or content changed
    const workoutsChanged = originalIds.some((id, index) => id !== currentIds[index]);
    
    return nameChanged || workoutsChanged;
  }, [editingWorkoutId, originalWorkout, workoutNameInput, customWorkouts]);

  const handleSaveWorkoutConfirm = () => {
    const name = workoutNameInput.trim();
    if (!name || name.length === 0 || name.length > 50) return;
    // Don't save if no changes were made
    if (editingWorkoutId && !hasChanges) return;

    if (editingWorkoutId) {
      // Update existing workout
      updateSavedWorkout(editingWorkoutId, {
        name,
        workouts: [...customWorkouts]
      });
      // Update originalWorkout to the newly saved state so we can detect future changes
      setOriginalWorkout({ workouts: [...customWorkouts], name });
      // Keep editingWorkoutId set so subsequent saves continue to update the same workout
    } else {
      // Create new workout
      const newWorkout: SavedWorkout = {
        id: Date.now().toString(),
        name,
        workouts: [...customWorkouts],
        createdAt: Date.now()
      };
      saveWorkoutToStorage(newWorkout);
    }
    setSavedWorkouts(loadSavedWorkouts());
    closeSaveModal();
  };

  const handleLoadSavedWorkout = (workoutId: string) => {
    const workout = savedWorkouts.find(w => w.id === workoutId);
    if (workout) {
      setCustomWorkouts(workout.workouts);
      setEditingWorkoutId(workoutId);
      setOriginalWorkout({ workouts: [...workout.workouts], name: workout.name });
      setAppMode('create');
      setSelectedTag(null);
    }
  };

  const handleViewSavedWorkout = (workoutId: string) => {
    setViewingWorkoutId(workoutId);
    setAppMode('view-saved');
  };

  const handleEditSavedWorkout = (workoutId: string) => {
    handleLoadSavedWorkout(workoutId);
  };

  const handleDeleteSavedWorkout = (workoutId: string) => {
    if (window.confirm('Delete this saved workout?')) {
      deleteWorkoutFromStorage(workoutId);
      setSavedWorkouts(loadSavedWorkouts());
    }
  };

  const handleViewSavedWorkouts = () => {
    setAppMode('saved');
  };

  const isWorkoutSelected = (workoutId: string) => {
    return customWorkouts.some(w => w.id === workoutId);
  };

  // Load saved workouts on mount
  useEffect(() => {
    setSavedWorkouts(loadSavedWorkouts());
  }, []);

  if (appMode === 'landing') {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-4 selection:bg-blue-500/30">
        <div className="max-w-4xl w-full text-center">
          <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 bg-clip-text text-transparent mb-12">
            PulseFit Pro
          </h1>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <button
              onClick={handleViewWorkouts}
              className="group relative bg-[#111111] border border-gray-800 rounded-3xl p-8 md:px-10 md:py-8 hover:border-blue-500/50 transition-all duration-300 hover:shadow-2xl hover:shadow-blue-500/20 hover:-translate-y-2 hover:scale-[1.02] active:scale-[0.98] min-w-0 w-full flex flex-col items-center justify-center"
            >
              <div className="w-full flex flex-col items-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-2xl flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 group-hover:shadow-lg group-hover:shadow-blue-500/50">
                  <svg className="w-8 h-8 text-white transition-transform duration-300 group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </div>
                <h2 className="text-xl md:text-2xl font-bold mb-2 text-center transition-colors duration-300 group-hover:text-blue-400">Choose Workout</h2>
                <p className="text-gray-500 text-sm text-center transition-colors duration-300 group-hover:text-gray-400">Browse exercises by category</p>
              </div>
            </button>
            
            <button
              onClick={handleCreateNewWorkout}
              className="group relative bg-[#111111] border border-gray-800 rounded-3xl p-8 md:px-10 md:py-8 hover:border-orange-500/50 transition-all duration-300 hover:shadow-2xl hover:shadow-orange-500/20 hover:-translate-y-2 hover:scale-[1.02] active:scale-[0.98] min-w-0 w-full flex flex-col items-center justify-center"
            >
              <div className="w-full flex flex-col items-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 group-hover:shadow-lg group-hover:shadow-orange-500/50">
                  <svg className="w-8 h-8 text-white transition-transform duration-300 group-hover:scale-125" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <h2 className="text-xl md:text-2xl font-bold mb-2 text-center transition-colors duration-300 group-hover:text-orange-400">Create Workout</h2>
                <p className="text-gray-500 text-sm text-center transition-colors duration-300 group-hover:text-gray-400">Build your custom routine</p>
              </div>
            </button>

            <button
              onClick={handleViewSavedWorkouts}
              className="group relative bg-[#111111] border border-gray-800 rounded-3xl p-8 md:px-10 md:py-8 hover:border-purple-500/50 transition-all duration-300 hover:shadow-2xl hover:shadow-purple-500/20 hover:-translate-y-2 hover:scale-[1.02] active:scale-[0.98] min-w-0 w-full flex flex-col items-center justify-center"
            >
              <div className="w-full flex flex-col items-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 group-hover:shadow-lg group-hover:shadow-purple-500/50">
                  <svg className="w-8 h-8 text-white transition-transform duration-300 group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                </div>
                <h2 className="text-xl md:text-2xl font-bold mb-2 text-center transition-colors duration-300 group-hover:text-purple-400">Saved Workouts</h2>
                <p className="text-gray-500 text-sm text-center transition-colors duration-300 group-hover:text-gray-400">Access your routines</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (appMode === 'saved') {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white p-4 md:p-12 selection:bg-blue-500/30">
        <header className="max-w-7xl mx-auto mb-8 md:mb-12 flex justify-between items-start">
          <div>
            <h1 className="text-3xl md:text-5xl font-bold bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 bg-clip-text text-transparent inline-block transition-all duration-500">
              PulseFit Pro
            </h1>
          </div>
          <button
            onClick={handleBackToLanding}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors text-sm font-medium"
          >
            ← Back
          </button>
        </header>

        <main className="max-w-7xl mx-auto">
          {savedWorkouts.length === 0 ? (
            <div className="text-center py-16 bg-[#111111] border border-gray-800 rounded-2xl">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
              <p className="text-gray-400 text-lg mb-2">No saved workouts yet</p>
              <p className="text-gray-500 text-sm">Create one in the workout builder!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {savedWorkouts.map((savedWorkout) => (
                <div
                  key={savedWorkout.id}
                  className="group bg-[#111111] border border-gray-800 rounded-2xl overflow-hidden transition-all duration-300 flex flex-col md:flex-row gap-4 p-4 hover:border-gray-700 hover:shadow-2xl hover:shadow-black/60"
                >
                  <div className="flex-1 flex flex-col justify-center">
                    <h3 className="text-xl font-bold mb-2 transition-colors duration-300 group-hover:text-white">{savedWorkout.name}</h3>
                    <p className="text-gray-500 text-sm mb-1">
                      {savedWorkout.workouts.length} {savedWorkout.workouts.length === 1 ? 'exercise' : 'exercises'}
                    </p>
                    <p className="text-gray-600 text-xs">Created {formatDate(savedWorkout.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-2 md:pr-4">
                    <button
                      onClick={() => handleViewSavedWorkout(savedWorkout.id)}
                      className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-bold transition-all active:scale-95 whitespace-nowrap"
                    >
                      View
                    </button>
                    <button
                      onClick={() => handleEditSavedWorkout(savedWorkout.id)}
                      className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl text-sm font-bold transition-all active:scale-95 whitespace-nowrap"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteSavedWorkout(savedWorkout.id)}
                      className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold transition-all active:scale-95 whitespace-nowrap"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    );
  }

  if (appMode === 'view-saved' && viewingWorkoutId) {
    const viewedWorkout = savedWorkouts.find(w => w.id === viewingWorkoutId);
    if (!viewedWorkout) {
      setAppMode('saved');
      return null;
    }

    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white p-4 md:p-12 selection:bg-blue-500/30">
        <header className="max-w-7xl mx-auto mb-8 md:mb-12 flex justify-between items-start">
          <div>
            <h1 className="text-3xl md:text-5xl font-bold bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 bg-clip-text text-transparent inline-block transition-all duration-500">
              PulseFit Pro
            </h1>
            <p className="text-gray-500 text-sm mt-2">{viewedWorkout.name} • {viewedWorkout.workouts.length} {viewedWorkout.workouts.length === 1 ? 'exercise' : 'exercises'}</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => handleEditSavedWorkout(viewingWorkoutId)}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-xl text-sm font-bold transition-all active:scale-95"
            >
              Edit
            </button>
            <button
              onClick={() => setAppMode('saved')}
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors text-sm font-medium"
            >
              ← Back
            </button>
          </div>
        </header>

        <main className="max-w-7xl mx-auto">
          <div className="space-y-4">
            {viewedWorkout.workouts.map((workout) => {
              const styles = getCategoryStyles(workout.category);
              const isProminent = isMobile && prominentTileId === workout.id;
              return (
                <div 
                  key={workout.id}
                  ref={getTileRef(workout.id)}
                  className={`group bg-[#111111] border border-gray-800 rounded-2xl overflow-hidden transition-all duration-300 flex flex-col md:flex-row gap-4 p-4 hover:border-gray-700 hover:shadow-2xl hover:shadow-black/60 cursor-pointer active:scale-[0.98] ${
                    isProminent ? 'scale-105' : ''
                  }`}
                  style={isProminent ? { filter: 'brightness(1.15)' } : undefined}
                  onClick={() => setSelectedWorkout(workout)}
                >
                  <div className="w-full md:w-48 h-48 bg-black/40 overflow-hidden rounded-xl flex-shrink-0">
                    {workout.gifUrl ? (
                      <img 
                        src={workout.gifUrl} 
                        alt={workout.name}
                        className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity"
                        loading="lazy"
                      />
                    ) : (
                      <EmptyGifPlaceholder />
                    )}
                  </div>
                  <div className="flex-1 flex flex-col justify-center">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-3 py-1 ${styles.bg} ${styles.text} text-[10px] font-black rounded-lg uppercase tracking-widest transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 select-none`}>
                        {workout.tag}
                      </span>
                      <span className={`px-3 py-1 ${getIntensityBadgeClass(workout.intensity)} text-[10px] font-black rounded-lg uppercase tracking-widest select-none`}>
                        {workout.intensity}
                      </span>
                    </div>
                    <h3 className="text-xl font-bold mb-1 transition-colors duration-300 group-hover:text-white select-none">{workout.name}</h3>
                    <p className="text-gray-400 text-sm mb-3 select-none">{workout.description}</p>
                    <div className="flex flex-wrap gap-2">
                      {workout.targetMuscles.map(m => (
                        <span key={m} className="px-3 py-1 bg-black/40 text-gray-400 text-[10px] font-black rounded-lg border border-gray-800 uppercase select-none">
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center md:pr-4">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedWorkout(workout);
                      }}
                      className={`px-6 py-3 bg-gradient-to-br ${styles.gradient} text-black text-[10px] font-black rounded-xl transition-all shadow-lg active:brightness-90 uppercase tracking-widest whitespace-nowrap`}
                    >
                      View
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </main>

        {selectedWorkout && (
          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/95 backdrop-blur-3xl transition-all p-0 md:p-6">
            <div className={`bg-[#0d0d0d] border-t md:border border-gray-800 w-full max-w-6xl md:rounded-[3rem] overflow-hidden shadow-2xl relative max-h-screen md:max-h-[90vh] flex flex-col`}>
              <button 
                onClick={() => setSelectedWorkout(null)} 
                className="absolute top-6 right-6 z-20 p-4 bg-black/60 hover:bg-gray-800 rounded-full transition-colors text-white border border-gray-800 shadow-xl"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <div className="flex flex-col lg:flex-row overflow-y-auto">
                <div className="lg:w-3/5 bg-black flex flex-col items-center justify-center relative p-4 md:p-12 min-h-[400px] lg:min-h-[600px]">
                  <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${getCategoryStyles(selectedWorkout.category).gradient}`}></div>
                  
                  <div className="relative w-full h-full flex items-center justify-center">
                    {selectedWorkout.gifUrl ? (
                      <img 
                        src={selectedWorkout.gifUrl} 
                        alt={selectedWorkout.name}
                        className="max-w-full max-h-[500px] lg:max-h-[700px] object-contain rounded-[2.5rem] shadow-[0_20px_100px_rgba(0,0,0,0.9)] border border-gray-800/50"
                      />
                    ) : (
                      <div className="text-center p-12 bg-gray-900/20 rounded-[3rem] border-2 border-dashed border-gray-800/40 w-full max-w-md">
                        <EmptyGifPlaceholder size="large" />
                      </div>
                    )}
                  </div>
                </div>

                <div className="lg:w-2/5 p-8 md:p-16 flex flex-col bg-[#111111] border-t lg:border-t-0 lg:border-l border-gray-800/50">
                  <div className="mb-12">
                    <div className="flex items-center gap-4 mb-6">
                       <span className={`w-3 h-3 rounded-full bg-gradient-to-br ${getCategoryStyles(selectedWorkout.category).gradient} shadow-[0_0_15px_rgba(0,0,0,0.5)]`} />
                       <span className={`text-xs font-black ${getCategoryStyles(selectedWorkout.category).text} uppercase tracking-[0.3em]`}>
                         {selectedWorkout.tag}
                       </span>
                    </div>
                    <h2 className="text-5xl font-black mb-6 leading-none tracking-tighter">{selectedWorkout.name}</h2>
                    <p className="text-gray-400 text-base leading-relaxed font-medium">{selectedWorkout.description}</p>
                  </div>

                  <div className="mb-12">
                    <h4 className={`text-xs font-black ${getCategoryStyles(selectedWorkout.category).text} uppercase tracking-[0.3em] mb-6 border-b border-gray-800/50 pb-4`}>
                      TARGET MUSCLES
                    </h4>
                    <div className="flex flex-wrap gap-3">
                      {selectedWorkout.targetMuscles.map(m => (
                        <span key={m} className="px-5 py-2.5 bg-black/40 text-gray-400 text-[10px] font-black rounded-xl border border-gray-800 uppercase tracking-tight">
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mt-auto pt-8 border-t border-gray-800/50">
                    <div className="text-[10px] font-black text-gray-500 tracking-widest uppercase">INTENSITY: {selectedWorkout.intensity}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-4 md:p-12 selection:bg-blue-500/30">
      <header className="max-w-7xl mx-auto mb-8 md:mb-12 flex justify-between items-start">
        <div>
          <h1 className="text-3xl md:text-5xl font-bold bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 bg-clip-text text-transparent inline-block transition-all duration-500">
            PulseFit Pro
          </h1>
        </div>
        <button
          onClick={handleBackToLanding}
          className="px-4 py-2 text-gray-400 hover:text-white transition-colors text-sm font-medium"
        >
          ← Back
        </button>
      </header>

      {!isCreateMode && (
        <nav className="max-w-7xl mx-auto mb-10">
          <div className="flex gap-3 pb-2 overflow-x-auto scrollbar-hide">
            {CATEGORIES.filter(cat => appMode === 'view' ? cat !== 'All' : true).map((cat) => {
              const isActive = selectedCategory === cat && !isCreateMode;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat as Category)}
                  className={`px-6 py-2.5 rounded-2xl whitespace-nowrap transition-all border text-sm font-bold active:scale-95 flex-shrink-0 ${
                    isActive 
                      ? `bg-white text-black border-white shadow-[0_0_20px_rgba(255,255,255,0.1)]` 
                      : `bg-transparent text-gray-500 border-gray-800 hover:border-gray-600`
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </nav>
      )}

      <main className="max-w-7xl mx-auto">
        {isCreateMode && (
          <>
            <div 
              className={`mb-8 transition-all duration-300 ease-in-out ${
                customWorkouts.length > 0 
                  ? 'opacity-100 max-h-[2000px] pointer-events-auto' 
                  : 'opacity-0 max-h-0 pointer-events-none overflow-hidden'
              }`}
            >
              <div className="flex justify-end items-center gap-3 mb-6">
                <button
                  onClick={handleSaveWorkout}
                  disabled={editingWorkoutId && !hasWorkoutChanges}
                  className={`px-6 py-2.5 rounded-2xl text-sm font-bold transition-all active:scale-95 ${
                    editingWorkoutId && !hasWorkoutChanges
                      ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                      : 'bg-green-600 hover:bg-green-700 text-white'
                  }`}
                >
                  Save
                  </button>
                  <button
                    onClick={handleClearCustomWorkout}
                    className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-2xl text-sm font-bold transition-all active:scale-95"
                  >
                    Clear
                  </button>
                </div>
                <div className="mb-4 p-3 bg-[#111111] border border-gray-800 rounded-xl">
                  <p className="text-gray-400 text-sm text-center flex items-center justify-center gap-1">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                    </svg>
                    <span>Hold to drag and drop to reorder your workout routine</span>
                  </p>
                </div>
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={customWorkouts.map(w => w.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-4 mb-8" style={{ touchAction: 'pan-y' }}>
                      {customWorkouts.map((workout) => (
                        <SortableWorkoutCard
                          key={workout.id}
                          workout={workout}
                          onRemove={handleRemoveWorkout}
                          onClick={setSelectedWorkout}
                          getCategoryStyles={getCategoryStyles}
                          getIntensityBadgeClass={getIntensityBadgeClass}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </div>

            <nav className="max-w-7xl mx-auto mb-10">
              <div className="flex gap-3 pb-2 overflow-x-auto scrollbar-hide">
                <button
                  onClick={() => setSelectedTag(null)}
                  className={`px-6 py-2.5 rounded-2xl whitespace-nowrap transition-all border text-sm font-bold active:scale-95 flex-shrink-0 ${
                    selectedTag === null
                      ? `bg-white text-black border-white shadow-[0_0_20px_rgba(255,255,255,0.1)]`
                      : `bg-transparent text-gray-500 border-gray-800 hover:border-gray-600`
                  }`}
                >
                  All
                </button>
                {availableTags.map((tag) => {
                  const isActive = selectedTag?.toLowerCase() === tag.toLowerCase();
                  return (
                    <button
                      key={tag}
                      onClick={() => setSelectedTag(isActive ? null : tag)}
                      className={`px-6 py-2.5 rounded-2xl whitespace-nowrap transition-all border text-sm font-bold active:scale-95 flex-shrink-0 capitalize ${
                        isActive
                          ? `bg-white text-black border-white shadow-[0_0_20px_rgba(255,255,255,0.1)]`
                          : `bg-transparent text-gray-500 border-gray-800 hover:border-gray-600`
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </nav>
          </>
        )}

        {isCreateMode && (
          <div className="mb-8 p-4 bg-[#111111] border border-gray-800 rounded-2xl">
            <p className="text-gray-400 text-sm text-center">
              {customWorkouts.length === 0 
                ? 'Tap workouts below to add them to your custom routine'
                : 'Continue selecting workouts below to add more to your custom routine'}
            </p>
          </div>
        )}

        {appMode === 'view' ? (
          <div className="space-y-4">
            {filteredWorkouts.map((workout) => {
              const styles = getCategoryStyles(workout.category);
              const isProminent = isMobile && prominentTileId === workout.id;

              return (
                <div 
                  key={workout.id}
                  ref={getTileRef(workout.id)}
                  className={`group bg-[#111111] border border-gray-800 rounded-2xl overflow-hidden transition-all duration-300 flex flex-col md:flex-row gap-4 p-4 hover:border-gray-700 hover:shadow-2xl hover:shadow-black/60 cursor-pointer active:scale-[0.98] ${
                    isProminent ? 'scale-105' : ''
                  }`}
                  style={isProminent ? { filter: 'brightness(1.15)' } : undefined}
                  onClick={() => setSelectedWorkout(workout)}
                >
                  <div className="w-full md:w-48 h-48 bg-black/40 overflow-hidden rounded-xl flex-shrink-0">
                    {workout.gifUrl ? (
                      <img 
                        src={workout.gifUrl} 
                        alt={workout.name}
                        className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity"
                        loading="lazy"
                      />
                    ) : (
                      <EmptyGifPlaceholder />
                    )}
                  </div>
                  <div className="flex-1 flex flex-col justify-center">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-3 py-1 ${styles.bg} ${styles.text} text-[10px] font-black rounded-lg uppercase tracking-widest transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 select-none`}>
                        {workout.tag}
                      </span>
                      <span className={`px-3 py-1 ${getIntensityBadgeClass(workout.intensity)} text-[10px] font-black rounded-lg uppercase tracking-widest select-none`}>
                        {workout.intensity}
                      </span>
                    </div>
                    <h3 className="text-xl font-bold mb-1 transition-colors duration-300 group-hover:text-white select-none">{workout.name}</h3>
                    <p className="text-gray-400 text-sm mb-3 select-none">{workout.description}</p>
                    <div className="flex flex-wrap gap-2">
                      {workout.targetMuscles.map(m => (
                        <span key={m} className="px-3 py-1 bg-black/40 text-gray-400 text-[10px] font-black rounded-lg border border-gray-800 uppercase select-none">
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center md:pr-4">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedWorkout(workout);
                      }}
                      className={`px-6 py-3 bg-gradient-to-br ${styles.gradient} text-black text-[10px] font-black rounded-xl transition-all shadow-lg active:brightness-90 uppercase tracking-widest whitespace-nowrap`}
                    >
                      View
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredWorkouts.map((workout) => {
              const styles = getCategoryStyles(workout.category);
              const isSelected = isWorkoutSelected(workout.id);
              const isProminent = isMobile && prominentTileId === workout.id;

              return (
                <div 
                  key={workout.id}
                  ref={getTileRef(workout.id)}
                  onClick={isCreateMode ? () => handleWorkoutToggle(workout) : () => setSelectedWorkout(workout)}
                  className={`group relative bg-[#111111] ${isSelected ? 'border-2 border-orange-500' : styles.border} rounded-[2rem] overflow-hidden transition-all duration-300 flex flex-col ${isCreateMode || appMode === 'view' ? 'cursor-pointer active:scale-[0.98]' : 'active:scale-[0.98]'} shadow-sm hover:shadow-2xl hover:shadow-black/60 hover:-translate-y-2 hover:scale-[1.02] ${
                    isProminent ? 'scale-105' : ''
                  }`}
                  style={isProminent ? { filter: 'brightness(1.15)' } : undefined}
                >
                  {isSelected && (
                    <div className="absolute top-4 right-4 z-10 bg-orange-500 rounded-full p-2 shadow-lg">
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                  <div className="h-48 bg-black/40 overflow-hidden relative transition-all duration-500">
                    {workout.gifUrl ? (
                      <img 
                        src={workout.gifUrl} 
                        alt={workout.name}
                        className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity"
                        loading="lazy"
                      />
                      ) : (
                        <EmptyGifPlaceholder />
                      )}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#111111] via-transparent to-transparent"></div>
                    <div className="absolute top-4 left-4 flex gap-2">
                       <span className={`px-3 py-1.5 ${styles.bg} ${styles.text} text-[10px] font-black rounded-xl uppercase tracking-widest shadow-lg transition-all duration-300 group-hover:scale-110 group-hover:rotate-3`}>
                        {workout.tag}
                      </span>
                      <span className={`px-3 py-1.5 ${getIntensityBadgeClass(workout.intensity)} text-[10px] font-black rounded-xl uppercase tracking-widest shadow-lg transition-all duration-300 group-hover:scale-110`}>
                        {workout.intensity}
                      </span>
                    </div>
                  </div>

                  <div className="p-6 flex-1 flex flex-col">
                    <h3 className="text-xl font-bold mb-1.5 group-hover:text-white transition-colors duration-300 text-center">{workout.name}</h3>
                    
                    <div className="mt-auto">
                      {isCreateMode ? (
                        <div className={`w-full py-4 ${isSelected ? 'bg-orange-600' : 'bg-gray-700'} text-white text-[10px] font-black rounded-2xl transition-all shadow-lg uppercase tracking-widest text-center`}>
                          {isSelected ? 'Selected' : 'Tap to Add'}
                        </div>
                      ) : (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedWorkout(workout);
                          }}
                          className={`w-full py-4 bg-gradient-to-br ${styles.gradient} text-black text-[10px] font-black rounded-2xl transition-all shadow-lg active:brightness-90 uppercase tracking-widest text-center`}
                        >
                          View
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-3xl transition-all p-4">
          <div className="bg-[#0d0d0d] border border-gray-800 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl relative">
            <button 
              onClick={closeSaveModal}
              className="absolute top-6 right-6 z-20 p-2 bg-black/60 hover:bg-gray-800 rounded-full transition-colors text-white border border-gray-800"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="p-8">
              <h2 className="text-2xl font-bold mb-6">
                {editingWorkoutId ? 'Update Workout' : 'Save Workout'}
              </h2>
              <input
                type="text"
                value={workoutNameInput}
                onChange={(e) => setWorkoutNameInput(e.target.value)}
                placeholder="Enter workout name..."
                maxLength={50}
                className="w-full px-4 py-3 bg-[#111111] border border-gray-800 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:border-gray-600 mb-4"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveWorkoutConfirm();
                  }
                }}
              />
              <div className="flex gap-3">
                <button
                  onClick={handleSaveWorkoutConfirm}
                  disabled={!workoutNameInput.trim() || (editingWorkoutId && !hasChanges)}
                  className={`flex-1 px-6 py-3 rounded-2xl text-sm font-bold transition-all active:scale-95 ${
                    editingWorkoutId && !hasChanges
                      ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                      : 'bg-green-600 hover:bg-green-700 text-white disabled:bg-gray-700 disabled:cursor-not-allowed'
                  }`}
                >
                  {editingWorkoutId ? 'Update' : 'Save'}
                </button>
                <button
                  onClick={closeSaveModal}
                  className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-2xl text-sm font-bold transition-all active:scale-95"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedWorkout && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/95 backdrop-blur-3xl transition-all p-0 md:p-6">
          <div className={`bg-[#0d0d0d] border-t md:border border-gray-800 w-full max-w-6xl md:rounded-[3rem] overflow-hidden shadow-2xl relative max-h-screen md:max-h-[90vh] flex flex-col`}>
            <button 
              onClick={() => setSelectedWorkout(null)} 
              className="absolute top-6 right-6 z-20 p-4 bg-black/60 hover:bg-gray-800 rounded-full transition-colors text-white border border-gray-800 shadow-xl"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="flex flex-col lg:flex-row overflow-y-auto">
              <div className="lg:w-3/5 bg-black flex flex-col items-center justify-center relative p-4 md:p-12 min-h-[400px] lg:min-h-[600px]">
                <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${getCategoryStyles(selectedWorkout.category).gradient}`}></div>
                
                <div className="relative w-full h-full flex items-center justify-center">
                  {selectedWorkout.gifUrl ? (
                    <img 
                      src={selectedWorkout.gifUrl} 
                      alt={selectedWorkout.name}
                      className="max-w-full max-h-[500px] lg:max-h-[700px] object-contain rounded-[2.5rem] shadow-[0_20px_100px_rgba(0,0,0,0.9)] border border-gray-800/50"
                    />
                  ) : (
                    <div className="text-center p-12 bg-gray-900/20 rounded-[3rem] border-2 border-dashed border-gray-800/40 w-full max-w-md">
                      <EmptyGifPlaceholder size="large" />
                    </div>
                  )}
                </div>
              </div>

              <div className="lg:w-2/5 p-8 md:p-16 flex flex-col bg-[#111111] border-t lg:border-t-0 lg:border-l border-gray-800/50">
                <div className="mb-12">
                  <div className="flex items-center gap-4 mb-6">
                     <span className={`w-3 h-3 rounded-full bg-gradient-to-br ${getCategoryStyles(selectedWorkout.category).gradient} shadow-[0_0_15px_rgba(0,0,0,0.5)]`} />
                     <span className={`text-xs font-black ${getCategoryStyles(selectedWorkout.category).text} uppercase tracking-[0.3em]`}>
                       {selectedWorkout.tag}
                     </span>
                  </div>
                  <h2 className="text-5xl font-black mb-6 leading-none tracking-tighter">{selectedWorkout.name}</h2>
                  <p className="text-gray-400 text-base leading-relaxed font-medium">{selectedWorkout.description}</p>
                </div>

                <div className="mb-12">
                  <h4 className={`text-xs font-black ${getCategoryStyles(selectedWorkout.category).text} uppercase tracking-[0.3em] mb-6 border-b border-gray-800/50 pb-4`}>
                    TARGET MUSCLES
                  </h4>
                  <div className="flex flex-wrap gap-3">
                    {selectedWorkout.targetMuscles.map(m => (
                      <span key={m} className="px-5 py-2.5 bg-black/40 text-gray-400 text-[10px] font-black rounded-xl border border-gray-800 uppercase tracking-tight">
                        {m}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-auto pt-8 border-t border-gray-800/50">
                  <div className="text-[10px] font-black text-gray-500 tracking-widest uppercase">INTENSITY: {selectedWorkout.intensity}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default App;
