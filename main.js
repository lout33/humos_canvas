// Entry point for the HumOS Canvas application
import InfiniteCanvas from './src/InfiniteCanvas.js';
import './style.css';

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.canvasApp = new InfiniteCanvas();
    console.log('HumOS Canvas initialized with modular structure');
});