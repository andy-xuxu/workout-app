import React, { useState } from 'react';
import { WORKOUT_LIBRARY, CATEGORIES } from './constants';
import { Workout, Category } from './types';

const App: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<Category>('All');
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null);

  const filteredWorkouts = selectedCategory === 'All' 
    ? WORKOUT_LIBRARY 
    : WORKOUT_LIBRARY.filter(w => w.category === selectedCategory);

  const getCategoryStyles = (category: Category) => {
    switch (category) {
      case 'Chest + Arms': 
        return { 
          gradient: 'from-blue-500 to-cyan-400',
          border: 'border-blue-500/20', 
          text: 'text-blue-400', 
          bg: 'bg-blue-500/10' 
        };
      case 'Legs': 
        return { 
          gradient: 'from-emerald-500 to-green-400',
          border: 'border-emerald-500/20', 
          text: 'text-emerald-400', 
          bg: 'bg-emerald-500/10' 
        };
      case 'Back + Shoulders': 
        return { 
          gradient: 'from-purple-600 to-pink-500',
          border: 'border-purple-500/20', 
          text: 'text-purple-400', 
          bg: 'bg-purple-500/10' 
        };
      default: 
        return { 
          gradient: 'from-gray-600 to-gray-400',
          border: 'border-gray-800', 
          text: 'text-gray-400', 
          bg: 'bg-gray-800/10' 
        };
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-4 md:p-12 selection:bg-blue-500/30">
      <header className="max-w-7xl mx-auto mb-8 md:mb-12 flex justify-between items-start">
        <div>
          <h1 className={`text-3xl md:text-5xl font-bold bg-gradient-to-r ${getCategoryStyles(selectedCategory).gradient} bg-clip-text text-transparent inline-block transition-all duration-500`}>
            PulseFit Pro
          </h1>
          <p className="text-gray-400 mt-1 text-base md:text-lg">Personal Technique Vault.</p>
        </div>
      </header>

      <nav className="max-w-7xl mx-auto mb-10 overflow-x-auto scrollbar-hide -mx-4 px-4">
        <div className="flex gap-3 pb-2">
          {CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat as Category)}
                className={`px-6 py-2.5 rounded-2xl whitespace-nowrap transition-all border text-sm font-bold active:scale-95 ${
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

      <main className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredWorkouts.map((workout) => {
          const styles = getCategoryStyles(workout.category);

          return (
            <div 
              key={workout.id}
              className={`group relative bg-[#111111] border ${styles.border} rounded-[2rem] overflow-hidden transition-all flex flex-col active:scale-[0.98] shadow-sm hover:shadow-2xl hover:shadow-black/60`}
            >
              <div className="h-48 bg-black/40 overflow-hidden relative transition-all duration-500">
                {workout.gifUrl ? (
                  <img 
                    src={workout.gifUrl} 
                    alt={workout.name}
                    className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-gray-800 gap-2">
                    <svg className="w-8 h-8 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-[9px] font-black uppercase tracking-widest text-center px-4">Technique Coming Soon</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#111111] via-transparent to-transparent"></div>
                <div className="absolute top-4 left-4 flex gap-2">
                   <span className={`px-3 py-1.5 ${styles.bg} ${styles.text} text-[10px] font-black rounded-xl uppercase tracking-widest border ${styles.border} backdrop-blur-md`}>
                    {workout.tag}
                  </span>
                </div>
              </div>

              <div className="p-6 flex-1 flex flex-col">
                <h3 className="text-xl font-bold mb-1.5 group-hover:text-white transition-colors">{workout.name}</h3>
                <p className="text-gray-500 text-xs line-clamp-2 mb-6 h-8 leading-relaxed font-medium">{workout.description}</p>
                
                <div className="mt-auto">
                  <button 
                    onClick={() => setSelectedWorkout(workout)}
                    className={`w-full py-4 bg-gradient-to-br ${styles.gradient} text-black text-[10px] font-black rounded-2xl transition-all shadow-lg active:brightness-90 uppercase tracking-widest`}
                  >
                    View
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </main>

      {selectedWorkout && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/95 backdrop-blur-3xl transition-all animate-in fade-in duration-300 p-0 md:p-6">
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
                      <p className="text-gray-500 font-black text-sm uppercase tracking-widest">Technique Clip Awaiting</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="lg:w-2/5 p-8 md:p-16 flex flex-col bg-[#111111] border-t lg:border-t-0 lg:border-l border-gray-800/50">
                <div className="mb-12">
                  <div className="flex items-center gap-4 mb-6">
                     <span className={`w-3 h-3 rounded-full bg-gradient-to-br ${getCategoryStyles(selectedWorkout.category).gradient} shadow-[0_0_15px_rgba(0,0,0,0.5)]`} />
                     <span className={`text-xs font-black ${getCategoryStyles(selectedWorkout.category).text} uppercase tracking-[0.3em]`}>
                       {selectedWorkout.category} / {selectedWorkout.tag}
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
