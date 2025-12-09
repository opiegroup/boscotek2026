import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Embedding Instructions:
// 1. Ensure a div with id="boscotek-configurator-root" exists on the page.
// 2. Load the bundled JS.
// 3. The app will mount into the div automatically.

const rootElement = document.getElementById('boscotek-configurator-root');
if (!rootElement) {
  throw new Error("Could not find root element 'boscotek-configurator-root' to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);