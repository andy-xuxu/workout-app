
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

try {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} catch (error) {
  console.error('Failed to render app:', error);
  rootElement.innerHTML = `
    <div style="padding: 20px; color: white; background: #0a0a0a; min-height: 100vh; display: flex; align-items: center; justify-content: center; flex-direction: column;">
      <h1 style="color: #ff4444;">Error Loading App</h1>
      <p style="color: #888; margin-top: 10px;">Check the browser console for details.</p>
      <pre style="background: #111; padding: 15px; border-radius: 8px; margin-top: 20px; color: #fff; overflow: auto; max-width: 90%;">${error instanceof Error ? error.message : String(error)}</pre>
    </div>
  `;
}
