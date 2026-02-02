
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

console.log('index.tsx loaded');

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error("Could not find root element to mount to");
  throw new Error("Could not find root element to mount to");
}

try {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  console.log('React app mounted successfully');
} catch (error) {
  console.error('Error mounting React app:', error);
  if (rootElement) {
    rootElement.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; height: 100vh; background: #0a0a0a; color: white; font-family: Inter, sans-serif; padding: 20px; text-align: center;">
        <div>
          <h1 style="color: #ef4444; margin-bottom: 20px;">Failed to Load App</h1>
          <p style="color: #888; margin-bottom: 10px;">Error: ${error instanceof Error ? error.message : 'Unknown error'}</p>
          <pre style="color: #666; font-size: 12px; text-align: left; background: #111; padding: 20px; border-radius: 8px; overflow: auto; max-width: 600px; margin: 0 auto;">
${error instanceof Error ? error.stack : String(error)}
          </pre>
        </div>
      </div>
    `;
  }
}
