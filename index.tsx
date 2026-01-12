import React from 'react';
import ReactDOM from 'react-dom/client';
import AppRouter from './Router';

/**
 * OPIE Group Product Configurator Platform
 * 
 * Multi-brand configurator with routing:
 * - / : OPIE Group brand selector
 * - /{brand}/ : Brand landing page
 * - /{brand}/configurator : Product configurator
 * 
 * Embedding:
 * - Add ?embed=1 to any configurator URL to use embed mode
 * - Example: <iframe src="https://configurator.opie.com.au/boscotek/configurator?embed=1" />
 */

const rootElement = document.getElementById('boscotek-configurator-root');
if (!rootElement) {
  throw new Error("Could not find root element 'boscotek-configurator-root' to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <AppRouter />
  </React.StrictMode>
);