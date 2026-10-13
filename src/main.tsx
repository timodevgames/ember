import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { startSync } from './state/sync';
import { startPwa } from './state/pwa';

// Ask Safari not to evict our IndexedDB (home-screen apps are exempt anyway).
navigator.storage?.persist?.().catch(() => {});
startSync();
startPwa();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
