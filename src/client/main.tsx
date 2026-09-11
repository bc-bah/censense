import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import './layout-fixes.css';
import './chart.css';
import './story.css';
import './catalog.css';
import './network.css';
import './story-motion.css';
import './visualization.css';

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
