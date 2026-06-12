import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

window.onerror = (message, source, lineno, colno, error) => {
  const errStr = `${message} at ${source}:${lineno}:${colno}\nStack: ${error?.stack}`;
  localStorage.setItem("last_crash_error", errStr);
};
window.onunhandledrejection = (event) => {
  const errStr = `Unhandled Rejection: ${event.reason}\nStack: ${event.reason?.stack}`;
  localStorage.setItem("last_crash_error", errStr);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
