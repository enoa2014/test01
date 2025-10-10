import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { CloudbaseProvider } from './providers/CloudbaseProvider';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <CloudbaseProvider>
        <App />
      </CloudbaseProvider>
    </BrowserRouter>
  </React.StrictMode>
);

