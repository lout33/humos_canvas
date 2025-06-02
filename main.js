// Entry point for the Infinite Canvas application
import InfiniteCanvas from './src/InfiniteCanvas.js';
import './style.css';

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.canvasApp = new InfiniteCanvas();
    console.log('Infinite Canvas initialized with modular structure');
});