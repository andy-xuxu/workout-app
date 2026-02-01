# PulseFit Pro - Workout App

A modern workout tracking Progressive Web App built with React, TypeScript, and Vite.

## 🚀 Deployment to GitHub Pages

This app is configured to deploy automatically to GitHub Pages. Follow these steps:

### Initial Setup

1. **Create a GitHub repository** (if you haven't already):
   - Go to [GitHub](https://github.com) and create a new repository
   - Name it `workout-app` (or update the `base` path in `vite.config.ts` if you use a different name)
   - Push your code to the repository

2. **Enable GitHub Pages**:
   - Go to your repository on GitHub
   - Click **Settings** → **Pages**
   - Under **Source**, select **GitHub Actions**
   - Save the settings

3. **Set up Environment Variables** (if your app uses API keys):
   - Go to **Settings** → **Secrets and variables** → **Actions**
   - Click **New repository secret**
   - Add `GEMINI_API_KEY` (or any other API keys your app needs)

### Automatic Deployment

Once set up, the app will automatically deploy to GitHub Pages whenever you push to the `main` branch.

Your app will be available at:
```
https://[your-username].github.io/workout-app/
```

### Manual Deployment (Alternative)

If you prefer manual deployment, you can use:

```bash
npm run deploy
```

This will build the app and deploy it using `gh-pages`.

## 📱 Viewing on Your Phone

1. **Via Browser**:
   - Open your phone's browser
   - Navigate to: `https://[your-username].github.io/workout-app/`
   - The app is mobile-optimized and works as a PWA

2. **Add to Home Screen** (iOS/Android):
   - On iOS: Tap the Share button → Add to Home Screen
   - On Android: Tap the menu → Add to Home Screen
   - The app will work offline after the first visit (thanks to the service worker)

## 🛠️ Local Development

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

## 📝 Notes

- The app is configured with base path `/workout-app/` for GitHub Pages
- Service worker is automatically registered for offline functionality
- The app is optimized for mobile devices with touch-friendly UI
