import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import './layout-fixes.css';
import './chart.css';
import './story.css';

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
