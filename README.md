# PulseFit Pro - Workout App

A modern workout technique vault Progressive Web App built with React, TypeScript, and Vite. Browse exercise techniques, view demonstrations, and track your workout library.

## ✨ Features

- **Exercise Library**: Browse workouts organized by category (Chest + Arms, Legs, Back + Shoulders)
- **Technique Demos**: View GIF demonstrations for each exercise
- **Mobile Optimized**: Responsive design that works seamlessly on all devices
- **Progressive Web App**: Installable on mobile devices with offline support
- **Modern UI**: Dark theme with smooth animations and transitions

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

The app will be available at `http://localhost:3000`

## 📱 Deployment to GitHub Pages

### Initial Setup

1. **Create a GitHub repository**:
   - Create a new repository named `workout-app` (or update the `base` path in `vite.config.ts` if using a different name)
   - Push your code to the repository

2. **Enable GitHub Pages**:
   - Go to your repository → **Settings** → **Pages**
   - Under **Source**, select **GitHub Actions**
   - Save the settings

### Automatic Deployment

The app automatically deploys to GitHub Pages when you push to the `main` branch.

Your app will be available at:
```
https://[your-username].github.io/workout-app/
```

### Manual Deployment

Alternatively, deploy manually using:

```bash
npm run deploy
```

## 📱 Mobile Access

1. **Via Browser**:
   - Open your phone's browser
   - Navigate to: `https://[your-username].github.io/workout-app/`
   - The app is mobile-optimized and works as a PWA

2. **Add to Home Screen**:
   - **iOS**: Tap Share → Add to Home Screen
   - **Android**: Tap Menu → Add to Home Screen
   - The app works offline after the first visit (thanks to service worker caching)

## 🛠️ Tech Stack

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling (via CDN)
- **Service Worker** - Offline functionality

## 📝 Project Structure

- `App.tsx` - Main application component
- `constants.ts` - Workout library data
- `types.ts` - TypeScript type definitions
- `vite.config.ts` - Vite configuration
- `sw.js` - Service worker for offline support
- `manifest.json` - PWA manifest

## 🎨 Customization

- Update workout data in `constants.ts`
- Modify styling in `App.tsx` (uses Tailwind CSS classes)
- Adjust PWA settings in `manifest.json`
- Configure build settings in `vite.config.ts`
