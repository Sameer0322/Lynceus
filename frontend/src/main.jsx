import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './style.css';

// Apply saved theme before first render
const saved = localStorage.getItem('pd_theme');
if (saved) document.documentElement.dataset.theme = saved;

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
