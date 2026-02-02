# GitHub Pages Black Screen Fix

## Changes Made

1. **Fixed manifest.json path** - Changed from relative `./manifest.json` to absolute `/workout-app/manifest.json`
2. **Added 404.html** - Required for GitHub Pages SPA routing
3. **Added .nojekyll** - Ensures GitHub Pages serves all files correctly
4. **Updated service worker** - Now uses correct base path `/workout-app/`
5. **Added error handling** - Better debugging and error messages
6. **Added loading state** - Shows loading spinner while app initializes

## Next Steps

1. **Rebuild the project:**
   ```bash
   npm run build
   ```

2. **Commit and push the changes:**
   ```bash
   git add .
   git commit -m "Fix GitHub Pages black screen issue"
   git push origin main
   ```

3. **Wait for GitHub Actions to deploy** (check Actions tab in GitHub)

4. **Clear browser cache** or use incognito mode to test

5. **Check browser console** for any errors:
   - Open DevTools (F12)
   - Check Console tab for errors
   - Check Network tab to see if assets are loading

## Common Issues

### Still seeing black screen?

1. **Check browser console** - Look for:
   - 404 errors (assets not found)
   - CORS errors
   - JavaScript errors

2. **Verify GitHub Pages settings:**
   - Go to repository Settings → Pages
   - Source should be "GitHub Actions"
   - Check if deployment succeeded

3. **Check the built files:**
   - After build, check `dist/index.html`
   - Verify script tags have `/workout-app/` prefix
   - Verify all asset paths are correct

4. **Hard refresh:**
   - Ctrl+Shift+R (Windows/Linux)
   - Cmd+Shift+R (Mac)

### Assets not loading?

- Verify `base: '/workout-app/'` in `vite.config.ts`
- Check that repository name matches the base path
- Ensure `.nojekyll` file is in dist folder

### Service Worker issues?

- Check browser console for SW registration errors
- Clear service worker cache:
  - Chrome: DevTools → Application → Service Workers → Unregister
  - Or use incognito mode

## Testing Locally

Test the production build locally:
```bash
npm run build
npm run preview
```

Then visit `http://localhost:4173/workout-app/` to verify it works.
