import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

console.log('main.tsx script is executing.');

try {
  console.log('Attempting to find root element...');
  const rootElement = document.getElementById('root');
  
  if (!rootElement) {
    console.error('Root element with id "root" was not found in the DOM.');
    document.body.innerHTML = '<div style="color: red; font-family: sans-serif; padding: 20px;"><h1>Fatal Error</h1><p>Application could not start because the root DOM element was not found.</p></div>';
    throw new Error("Could not find root element to mount to");
  }

  console.log('Root element found:', rootElement);
  
  console.log('Creating React root...');
  const root = ReactDOM.createRoot(rootElement);
  
  console.log('Rendering App component...');
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  console.log('App component render initiated successfully.');

} catch (error) {
  console.error('A critical error occurred during application startup:', error);
  const errorElement = document.getElementById('root') || document.body;
  errorElement.innerHTML = `<div style="color: red; font-family: sans-serif; padding: 20px;"><h1>Application Failed to Start</h1><p>A critical error prevented the application from rendering. Please check the browser console for more details.</p><pre>${(error as Error).stack}</pre></div>`;
}
