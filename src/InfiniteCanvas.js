
// Canvas MVP - Core functionality with OpenAI integration
import {
    drawGrid,
    drawNode,
    drawConnection,
    drawConnectionPreview,
    drawResizeHandles,
    wrapText
} from './canvasRenderer.js';

import { calculateMarkdownHeight } from './markdownParser.js';

import {
    generateAIIdeas,
    getProviderName,
    getErrorMessage
} from './aiService.js';

class InfiniteCanvas {
    constructor() {
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Canvas state
        this.offsetX = 0;
        this.offsetY = 0;
        this.scale = 1.0;
        this.nodes = [];
        this.connections = []; // Array to store connections between nodes
        this.selectedNode = null;
        this.isDragging = false;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.dragTarget = null; // 'canvas' or node object
        this.isConnecting = false; // True when creating a connection
        this.connectionStart = null; // Starting node for connection
        this.isResizing = false; // True when resizing a node
        this.resizeHandle = null; // Which resize handle is being dragged
        this.resizeTarget = null; // Node being resized
        
        // Node editing
        this.editingNode = null;
        this.editInput = null;
        
        // Undo/Redo system
        this.history = [];
        this.historyIndex = -1;
        this.maxHistorySize = 50;
        
        // AI API integration (supports OpenRouter, local models, etc.)
        this.apiKey = localStorage.getItem('ai_api_key') || null;
        this.baseURL = localStorage.getItem('ai_base_url') || 'https://api.openai.com/v1';
        this.isGeneratingAI = false;
        
        this.init();
    }
    
    init() {
        this.setupCanvas();
        this.setupEventListeners();
        this.loadFromLocalStorage();
        this.setupAPIKeyUI();
        
        // Initialize history with current state
        this.saveState();
        
        this.draw();
        this.updateUndoRedoButtons();
    }
    
    setupAPIKeyUI() {
        // Create API configuration modal if it doesn't exist
        if (!document.getElementById('apiKeyModal')) {
            const modal = document.createElement('div');
            modal.id = 'apiKeyModal';
            modal.className = 'api-key-modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <h3>AI API Configuration</h3>
                    <p>Configure your AI API settings. Supports OpenAI, OpenRouter, and other compatible APIs:</p>
                    
                    <label for="baseUrlInput">Base URL:</label>
                    <input type="text" id="baseUrlInput" placeholder="https://api.openai.com/v1" />
                    
                    <label for="apiKeyInput">API Key:</label>
                    <input type="password" id="apiKeyInput" placeholder="sk-... or or-..." />
                    
                    <div class="modal-buttons">
                        <button id="saveApiKeyBtn">Save Configuration</button>
                        <button id="cancelApiKeyBtn">Cancel</button>
                    </div>
                    <small>
                        <strong>Popular providers:</strong><br>
                        • OpenAI: https://api.openai.com/v1<br>
                        • OpenRouter: https://openrouter.ai/api/v1<br>
                        • Local models: http://localhost:1234/v1<br>
                        Your settings are stored locally and never shared.
                    </small>
                </div>
            `;
            document.body.appendChild(modal);
            
            // Add event listeners
            document.getElementById('saveApiKeyBtn').addEventListener('click', () => this.saveApiConfig());
            document.getElementById('cancelApiKeyBtn').addEventListener('click', () => this.hideApiKeyModal());
            document.getElementById('apiKeyInput').addEventListener('keydown', (e) => {
                if (e.key === 'Enter') this.saveApiConfig();
                if (e.key === 'Escape') this.hideApiKeyModal();
            });
            document.getElementById('baseUrlInput').addEventListener('keydown', (e) => {
                if (e.key === 'Enter') this.saveApiConfig();
                if (e.key === 'Escape') this.hideApiKeyModal();
            });
        }
        
        // Update API configuration button text based on API key availability
        this.updateApiConfigButton();
    }
    
    showApiKeyModal() {
        const modal = document.getElementById('apiKeyModal');
        const apiKeyInput = document.getElementById('apiKeyInput');
        const baseUrlInput = document.getElementById('baseUrlInput');
        modal.style.display = 'flex';
        apiKeyInput.value = this.apiKey || '';
        baseUrlInput.value = this.baseURL || 'https://api.openai.com/v1';
        baseUrlInput.focus();
    }
    
    hideApiKeyModal() {
        document.getElementById('apiKeyModal').style.display = 'none';
    }
    
    saveApiConfig() {
        const apiKeyInput = document.getElementById('apiKeyInput');
        const baseUrlInput = document.getElementById('baseUrlInput');
        const apiKey = apiKeyInput.value.trim();
        const baseURL = baseUrlInput.value.trim();
        
        if (!apiKey) {
            this.showNotification('Please enter an API key', 'error');
            return;
        }
        
        if (!baseURL) {
            this.showNotification('Please enter a base URL', 'error');
            return;
        }
        
        // Validate URL format
        try {
            new URL(baseURL);
        } catch (e) {
            this.showNotification('Please enter a valid URL', 'error');
            return;
        }
        
        this.apiKey = apiKey;
        this.baseURL = baseURL;
        localStorage.setItem('ai_api_key', apiKey);
        localStorage.setItem('ai_base_url', baseURL);
        

        this.hideApiKeyModal();
        this.updateApiConfigButton();

        // Show success message with provider info
        const provider = getProviderName(baseURL);
        this.showNotification(`${provider} configuration saved successfully!`, 'success');
    }
    
    updateApiConfigButton() {
        const btn = document.getElementById('configureApiBtn');
        if (this.apiKey) {
            const provider = getProviderName(this.baseURL);
            btn.textContent = `🔑 ${provider} Configured`;
            btn.title = `API configured for ${provider}. Click to change settings.`;
            btn.style.background = '#28a745'; // Green when configured
        } else {
            btn.textContent = '🔑 Configure API Keys';
            btn.title = 'Configure AI API settings to enable AI features';
            btn.style.background = '#dc3545'; // Red when not configured
        }
    }

    updateGenerateIdeasTooltip() {
        const tooltip = document.getElementById('generateIdeasTooltip');
        const btn = document.getElementById('generateIdeasBtn');

        if (this.selectedNode && this.apiKey) {
            // Position tooltip above the selected node
            const rect = this.canvas.getBoundingClientRect();
            const nodeScreenX = rect.left + (this.selectedNode.x * this.scale) + this.offsetX;
            const nodeScreenY = rect.top + (this.selectedNode.y * this.scale) + this.offsetY;

            // Position tooltip above the node with some padding
            const tooltipX = nodeScreenX + (this.selectedNode.width * this.scale) / 2;
            const tooltipY = nodeScreenY - 50; // 50px above the node

            tooltip.style.left = `${tooltipX}px`;
            tooltip.style.top = `${tooltipY}px`;
            tooltip.style.transform = 'translateX(-50%)'; // Center horizontally

            tooltip.classList.remove('hidden');

            // Update button state
            btn.disabled = this.isGeneratingAI;
            btn.textContent = this.isGeneratingAI ? '⏳ Generating...' : '🤖 Generate Ideas';
        } else {
            tooltip.classList.add('hidden');
        }
    }
    
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        // Remove after 3 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }
    
    setupCanvas() {
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }
    
    resizeCanvas() {
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        this.draw();
    }
    
    setupEventListeners() {
        // Toolbar buttons
        document.getElementById('addNodeBtn').addEventListener('click', () => this.createNode());
        document.getElementById('exportBtn').addEventListener('click', () => this.exportJSON());

        // API Configuration button
        document.getElementById('configureApiBtn').addEventListener('click', () => this.showApiKeyModal());

        // Generate Ideas tooltip button
        document.getElementById('generateIdeasBtn').addEventListener('click', () => this.generateAI());

        // Canvas controls
        document.getElementById('zoomInBtn').addEventListener('click', () => this.zoom(1.2));
        document.getElementById('zoomOutBtn').addEventListener('click', () => this.zoom(0.8));
        document.getElementById('resetViewBtn').addEventListener('click', () => this.resetView());
        document.getElementById('undoBtn').addEventListener('click', () => this.undo());
        document.getElementById('redoBtn').addEventListener('click', () => this.redo());
        
        // Keyboard events
        document.addEventListener('keydown', (e) => this.onKeyDown(e));
        
        // Canvas mouse events
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('wheel', (e) => this.onWheel(e));
        this.canvas.addEventListener('dblclick', (e) => this.onDoubleClick(e));
        
        // Prevent context menu
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    
    // Node creation and management
    createNode(text = 'New Node', x = null, y = null) {
        // Save state for undo before creating node
        this.saveState();
        
        const node = {
            id: Date.now() + Math.random(),
            text: text,
            x: x !== null ? x : this.canvas.width / 2 - this.offsetX,
            y: y !== null ? y : this.canvas.height / 2 - this.offsetY,
            width: 400,
            height: 60,
            isSelected: false
        };
        
        this.nodes.push(node);
        this.saveToLocalStorage();
        this.draw();
        return node;
    }
    
    // Drawing functions
    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.save();
        this.ctx.translate(this.offsetX, this.offsetY);
        this.ctx.scale(this.scale, this.scale);
        
        // Draw grid using imported function
        drawGrid(this.ctx, this.offsetX, this.offsetY, this.scale, this.canvas.width, this.canvas.height);
        
        // Draw connections first (behind nodes) using imported function
        this.connections.forEach(connection => drawConnection(this.ctx, connection, this.nodes));
        
        // Draw all nodes using imported function
        this.nodes.forEach(node => drawNode(this.ctx, node));
        
        // Draw connection preview if connecting using imported function
        if (this.isConnecting && this.connectionStart) {
            drawConnectionPreview(this.ctx, this.connectionStart, this.lastMouseX || 0, this.lastMouseY || 0, this.offsetX, this.offsetY, this.scale);
        }

        this.ctx.restore();

        // Update tooltip position after drawing
        this.updateGenerateIdeasTooltip();
    }
    
    
    // Mouse event handlers
    onMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // Store mouse position for connection preview
        this.lastMouseX = mouseX;
        this.lastMouseY = mouseY;
        
        // Convert to canvas coordinates
        const canvasX = (mouseX - this.offsetX) / this.scale;
        const canvasY = (mouseY - this.offsetY) / this.scale;
        
        // Check if clicking on a node
        const clickedNode = this.getNodeAtPoint(canvasX, canvasY);
        
        if (clickedNode) {
            // Check for border-based resize first (works on any node)
            const borderResizeHandle = this.getBorderResizeHandle(clickedNode, canvasX, canvasY);

            if (borderResizeHandle) {
                // Start border-based resizing
                this.selectNode(clickedNode); // Select the node when starting to resize
                this.isResizing = true;
                this.resizeHandle = borderResizeHandle;
                this.resizeTarget = clickedNode;
                this.setCursorForResize(borderResizeHandle);
            } else {
                this.selectNode(clickedNode);

                // Check for traditional resize handles on selected nodes
                const resizeHandle = this.getResizeHandle(clickedNode, canvasX, canvasY);

                if (resizeHandle) {
                    // Start traditional resizing
                    this.isResizing = true;
                    this.resizeHandle = resizeHandle;
                    this.resizeTarget = clickedNode;
                    this.setCursorForResize(resizeHandle);
                } else if (e.ctrlKey || e.metaKey) {
                    // Connection mode
                    this.isConnecting = true;
                    this.connectionStart = clickedNode;
                    this.canvas.style.cursor = 'crosshair';
                } else {
                    // Regular drag
                    this.dragTarget = clickedNode;
                }
            }
        } else {
            this.selectNode(null);
            this.dragTarget = 'canvas';
        }
        
        if (!this.isConnecting && !this.isResizing) {
            this.isDragging = true;
            this.dragStartX = mouseX;
            this.dragStartY = mouseY;
            
            if (this.dragTarget === 'canvas') {
                this.canvas.style.cursor = 'grabbing';
            }
        }
    }
    
    setCursorForResize(handle) {
        switch(handle) {
            case 'top':
            case 'bottom':
                this.canvas.style.cursor = 'ns-resize';
                break;
            case 'left':
            case 'right':
                this.canvas.style.cursor = 'ew-resize';
                break;
            case 'top-left':
            case 'bottom-right':
                this.canvas.style.cursor = 'nw-resize';
                break;
            case 'top-right':
            case 'bottom-left':
                this.canvas.style.cursor = 'ne-resize';
                break;
            default:
                this.canvas.style.cursor = 'default';
        }
    }
    
    onMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // Update mouse position for connection preview
        this.lastMouseX = mouseX;
        this.lastMouseY = mouseY;
        
        // Convert to canvas coordinates for cursor updates
        const canvasX = (mouseX - this.offsetX) / this.scale;
        const canvasY = (mouseY - this.offsetY) / this.scale;
        
        // Update cursor based on hover state
        if (!this.isDragging && !this.isConnecting && !this.isResizing) {
            const hoveredNode = this.getNodeAtPoint(canvasX, canvasY);
            if (hoveredNode) {
                // Check for border-based resize first (works on any node)
                const borderResizeHandle = this.getBorderResizeHandle(hoveredNode, canvasX, canvasY);
                if (borderResizeHandle) {
                    this.setCursorForResize(borderResizeHandle);
                } else if (hoveredNode.isSelected) {
                    // Check for traditional resize handles on selected nodes
                    const resizeHandle = this.getResizeHandle(hoveredNode, canvasX, canvasY);
                    if (resizeHandle) {
                        this.setCursorForResize(resizeHandle);
                    } else {
                        this.canvas.style.cursor = 'grab';
                    }
                } else {
                    this.canvas.style.cursor = 'grab';
                }
            } else {
                this.canvas.style.cursor = 'grab';
            }
        }
        
        if (this.isConnecting) {
            // Redraw to show connection preview
            this.draw();
            return;
        }
        
        if (this.isResizing) {
            // Handle resizing
            const deltaX = mouseX - this.dragStartX;
            const deltaY = mouseY - this.dragStartY;

            // Mark node as manually resized
            this.resizeTarget.manuallyResized = true;

            const minWidth = 60;
            const minHeight = 40;
            const scaledDeltaX = deltaX / this.scale;
            const scaledDeltaY = deltaY / this.scale;

            switch(this.resizeHandle) {
                case 'top':
                    const newHeightTop = this.resizeTarget.height - scaledDeltaY;
                    if (newHeightTop >= minHeight) {
                        this.resizeTarget.y += scaledDeltaY;
                        this.resizeTarget.height = newHeightTop;
                    }
                    break;
                case 'bottom':
                    this.resizeTarget.height = Math.max(minHeight, this.resizeTarget.height + scaledDeltaY);
                    break;
                case 'left':
                    const newWidthLeft = this.resizeTarget.width - scaledDeltaX;
                    if (newWidthLeft >= minWidth) {
                        this.resizeTarget.x += scaledDeltaX;
                        this.resizeTarget.width = newWidthLeft;
                    }
                    break;
                case 'right':
                    this.resizeTarget.width = Math.max(minWidth, this.resizeTarget.width + scaledDeltaX);
                    break;
                case 'top-left':
                    const newWidthTL = this.resizeTarget.width - scaledDeltaX;
                    const newHeightTL = this.resizeTarget.height - scaledDeltaY;
                    if (newWidthTL >= minWidth && newHeightTL >= minHeight) {
                        this.resizeTarget.x += scaledDeltaX;
                        this.resizeTarget.y += scaledDeltaY;
                        this.resizeTarget.width = newWidthTL;
                        this.resizeTarget.height = newHeightTL;
                    }
                    break;
                case 'top-right':
                    const newHeightTR = this.resizeTarget.height - scaledDeltaY;
                    if (newHeightTR >= minHeight) {
                        this.resizeTarget.y += scaledDeltaY;
                        this.resizeTarget.height = newHeightTR;
                    }
                    this.resizeTarget.width = Math.max(minWidth, this.resizeTarget.width + scaledDeltaX);
                    break;
                case 'bottom-left':
                    const newWidthBL = this.resizeTarget.width - scaledDeltaX;
                    if (newWidthBL >= minWidth) {
                        this.resizeTarget.x += scaledDeltaX;
                        this.resizeTarget.width = newWidthBL;
                    }
                    this.resizeTarget.height = Math.max(minHeight, this.resizeTarget.height + scaledDeltaY);
                    break;
                case 'bottom-right':
                    this.resizeTarget.width = Math.max(minWidth, this.resizeTarget.width + scaledDeltaX);
                    this.resizeTarget.height = Math.max(minHeight, this.resizeTarget.height + scaledDeltaY);
                    break;
            }

            this.dragStartX = mouseX;
            this.dragStartY = mouseY;
            this.draw();
            return;
        }
        
        if (!this.isDragging) return;
        
        const deltaX = mouseX - this.dragStartX;
        const deltaY = mouseY - this.dragStartY;
        
        if (this.dragTarget === 'canvas') {
            // Pan canvas
            this.offsetX += deltaX;
            this.offsetY += deltaY;
        } else if (this.dragTarget && typeof this.dragTarget === 'object') {
            // Drag node
            this.dragTarget.x += deltaX / this.scale;
            this.dragTarget.y += deltaY / this.scale;
        }
        
        this.dragStartX = mouseX;
        this.dragStartY = mouseY;
        
        this.draw();
    }
    
    onMouseUp(e) {
        if (this.isConnecting) {
            // Complete connection if dropped on a different node
            const rect = this.canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            const canvasX = (mouseX - this.offsetX) / this.scale;
            const canvasY = (mouseY - this.offsetY) / this.scale;
            
            const targetNode = this.getNodeAtPoint(canvasX, canvasY);
            
            if (targetNode && targetNode !== this.connectionStart) {
                this.createConnection(this.connectionStart, targetNode);
            }
            
            // Reset connection state
            this.isConnecting = false;
            this.connectionStart = null;
            this.canvas.style.cursor = 'grab';
            this.draw();
            return;
        }
        
        if (this.isResizing) {
            // Complete resizing
            this.isResizing = false;
            this.resizeHandle = null;
            this.resizeTarget = null;
            this.canvas.style.cursor = 'grab';
            this.saveToLocalStorage();
            return;
        }
        
        this.isDragging = false;
        this.dragTarget = null;
        this.canvas.style.cursor = 'grab';
        
        if (this.dragTarget !== 'canvas') {
            this.saveToLocalStorage();
        }
    }
    
    onWheel(e) {
        e.preventDefault();
        
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = Math.max(0.1, Math.min(3.0, this.scale * zoomFactor));
        
        // Zoom towards mouse position
        const beforeZoomX = (mouseX - this.offsetX) / this.scale;
        const beforeZoomY = (mouseY - this.offsetY) / this.scale;
        
        this.scale = newScale;
        
        const afterZoomX = (mouseX - this.offsetX) / this.scale;
        const afterZoomY = (mouseY - this.offsetY) / this.scale;
        
        this.offsetX += (afterZoomX - beforeZoomX) * this.scale;
        this.offsetY += (afterZoomY - beforeZoomY) * this.scale;
        
        this.draw();
    }
    
    onDoubleClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const canvasX = (mouseX - this.offsetX) / this.scale;
        const canvasY = (mouseY - this.offsetY) / this.scale;
        
        const clickedNode = this.getNodeAtPoint(canvasX, canvasY);
        
        if (clickedNode) {
            // Double-click on a node - start editing text
            this.startEditingNode(clickedNode);
        } else {
            // Double-click on empty space - create new node at that position
            const newNode = this.createNode('New Node', canvasX - 100, canvasY - 30);
            // Immediately start editing the new node
            setTimeout(() => {
                this.startEditingNode(newNode);
            }, 50);
        }
    }
    
    // Node interaction
    getNodeAtPoint(x, y) {
        for (let i = this.nodes.length - 1; i >= 0; i--) {
            const node = this.nodes[i];
            if (x >= node.x && x <= node.x + node.width &&
                y >= node.y && y <= node.y + node.height) {
                return node;
            }
        }
        return null;
    }
    
    getResizeHandle(node, x, y) {
        const handleSize = 12;
        const tolerance = 8;

        // Right handle
        if (Math.abs(x - (node.x + node.width)) < tolerance &&
            Math.abs(y - (node.y + node.height/2)) < handleSize/2 + tolerance) {
            return 'right';
        }

        // Bottom handle
        if (Math.abs(x - (node.x + node.width/2)) < handleSize/2 + tolerance &&
            Math.abs(y - (node.y + node.height)) < tolerance) {
            return 'bottom';
        }

        // Bottom-right corner handle (check this first as it's most specific)
        if (Math.abs(x - (node.x + node.width)) < tolerance &&
            Math.abs(y - (node.y + node.height)) < tolerance) {
            return 'bottom-right';
        }

        return null;
    }

    // Enhanced border-based resize detection for any node
    getBorderResizeHandle(node, x, y) {
        const borderTolerance = 8; // Distance from border to trigger resize
        const cornerSize = 20; // Size of corner resize areas

        const nodeLeft = node.x;
        const nodeRight = node.x + node.width;
        const nodeTop = node.y;
        const nodeBottom = node.y + node.height;

        // Check if mouse is within the border tolerance zone
        const nearLeft = Math.abs(x - nodeLeft) <= borderTolerance;
        const nearRight = Math.abs(x - nodeRight) <= borderTolerance;
        const nearTop = Math.abs(y - nodeTop) <= borderTolerance;
        const nearBottom = Math.abs(y - nodeBottom) <= borderTolerance;

        // Check if mouse is within the node bounds (including tolerance)
        const withinHorizontalBounds = x >= nodeLeft - borderTolerance && x <= nodeRight + borderTolerance;
        const withinVerticalBounds = y >= nodeTop - borderTolerance && y <= nodeBottom + borderTolerance;

        // Corner resize handles (check corners first as they're more specific)
        if (nearTop && nearLeft &&
            x >= nodeLeft - borderTolerance && x <= nodeLeft + cornerSize &&
            y >= nodeTop - borderTolerance && y <= nodeTop + cornerSize) {
            return 'top-left';
        }

        if (nearTop && nearRight &&
            x >= nodeRight - cornerSize && x <= nodeRight + borderTolerance &&
            y >= nodeTop - borderTolerance && y <= nodeTop + cornerSize) {
            return 'top-right';
        }

        if (nearBottom && nearLeft &&
            x >= nodeLeft - borderTolerance && x <= nodeLeft + cornerSize &&
            y >= nodeBottom - cornerSize && y <= nodeBottom + borderTolerance) {
            return 'bottom-left';
        }

        if (nearBottom && nearRight &&
            x >= nodeRight - cornerSize && x <= nodeRight + borderTolerance &&
            y >= nodeBottom - cornerSize && y <= nodeBottom + borderTolerance) {
            return 'bottom-right';
        }

        // Edge resize handles
        if (nearTop && withinHorizontalBounds &&
            x > nodeLeft + cornerSize && x < nodeRight - cornerSize) {
            return 'top';
        }

        if (nearBottom && withinHorizontalBounds &&
            x > nodeLeft + cornerSize && x < nodeRight - cornerSize) {
            return 'bottom';
        }

        if (nearLeft && withinVerticalBounds &&
            y > nodeTop + cornerSize && y < nodeBottom - cornerSize) {
            return 'left';
        }

        if (nearRight && withinVerticalBounds &&
            y > nodeTop + cornerSize && y < nodeBottom - cornerSize) {
            return 'right';
        }

        return null;
    }
    
    selectNode(node) {
        this.nodes.forEach(n => n.isSelected = false);
        if (node) {
            node.isSelected = true;
            this.selectedNode = node;
        } else {
            this.selectedNode = null;
        }
        this.draw();
        this.updateGenerateIdeasTooltip();
    }
    
    createConnection(fromNode, toNode) {
        // Check if connection already exists
        const existingConnection = this.connections.find(
            conn => (conn.from === fromNode.id && conn.to === toNode.id) ||
                   (conn.from === toNode.id && conn.to === fromNode.id)
        );

        if (!existingConnection) {
            // Save state for undo before creating connection
            this.saveState();

            const connection = {
                id: Date.now() + Math.random(),
                from: fromNode.id,
                to: toNode.id
            };
            this.connections.push(connection);
            this.saveToLocalStorage();
            console.log('Created connection from', fromNode.text, 'to', toNode.text);
        }
    }

    // Get all nodes connected to the given node
    getConnectedNodes(node) {
        if (!node) return [];

        const connectedNodes = [];

        // Find all connections involving this node
        this.connections.forEach(connection => {
            let connectedNodeId = null;

            if (connection.from === node.id) {
                connectedNodeId = connection.to;
            } else if (connection.to === node.id) {
                connectedNodeId = connection.from;
            }

            if (connectedNodeId) {
                const connectedNode = this.nodes.find(n => n.id === connectedNodeId);
                if (connectedNode) {
                    connectedNodes.push(connectedNode);
                }
            }
        });

        return connectedNodes;
    }
    
    startEditingNode(node) {
        this.editingNode = node;
        
        // Create input element
        this.editInput = document.createElement('textarea');
        this.editInput.value = node.text;
        this.editInput.className = 'node-input';
        
        // Position input over node
        const rect = this.canvas.getBoundingClientRect();
        const x = rect.left + (node.x * this.scale) + this.offsetX;
        const y = rect.top + (node.y * this.scale) + this.offsetY;
        
        this.editInput.style.left = x + 'px';
        this.editInput.style.top = y + 'px';
        this.editInput.style.width = (node.width * this.scale) + 'px';
        this.editInput.style.height = (node.height * this.scale) + 'px';
        
        document.body.appendChild(this.editInput);
        this.editInput.focus();
        this.editInput.select();
        
        // Handle input events
        this.editInput.addEventListener('blur', () => this.finishEditingNode());
        this.editInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.finishEditingNode();
            }
        });
    }
    
    finishEditingNode() {
        if (this.editingNode && this.editInput) {
            // Save state for undo before changing text
            this.saveState();
            
            this.editingNode.text = this.editInput.value;
            
            // Only reset manual resize flag if the node wasn't manually resized
            if (!this.editingNode.manuallyResized) {
                // Auto-size for nodes that haven't been manually resized using markdown-aware calculation
                const margins = {
                    top: 20,    // Increased top margin for better visual balance
                    bottom: 12, // Bottom margin
                    left: 12,   // Left margin
                    right: 12   // Right margin
                };
                const minHeight = 40;
                const requiredHeight = Math.max(minHeight, calculateMarkdownHeight(this.ctx, this.editingNode.text, this.editingNode.width, margins));
                this.editingNode.height = requiredHeight;
            }
            
            document.body.removeChild(this.editInput);
            this.editInput = null;
            this.editingNode = null;
            this.saveToLocalStorage();
            this.draw();
        }
    }
    
    // Canvas controls
    zoom(factor) {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        
        const beforeZoomX = (centerX - this.offsetX) / this.scale;
        const beforeZoomY = (centerY - this.offsetY) / this.scale;
        
        this.scale = Math.max(0.1, Math.min(3.0, this.scale * factor));
        
        const afterZoomX = (centerX - this.offsetX) / this.scale;
        const afterZoomY = (centerY - this.offsetY) / this.scale;
        
        this.offsetX += (afterZoomX - beforeZoomX) * this.scale;
        this.offsetY += (afterZoomY - beforeZoomY) * this.scale;
        
        this.draw();
    }
    
    resetView() {
        this.offsetX = 0;
        this.offsetY = 0;
        this.scale = 1.0;
        this.draw();
    }
    
    // Enhanced AI functionality
    async generateAI() {
        // If no API key, show modal to set it
        if (!this.apiKey) {
            this.showApiKeyModal();
            return;
        }

        // Check if a node is selected
        if (!this.selectedNode) {
            this.showNotification('Please select a node first to generate connected ideas', 'warning');
            return;
        }

        // Prevent multiple simultaneous requests
        if (this.isGeneratingAI) {
            this.showNotification('AI generation already in progress...', 'info');
            return;
        }

        // Capture the selected node at the start to preserve it during async operation
        const sourceNode = this.selectedNode;

        try {
            this.isGeneratingAI = true;

            // Update tooltip button to show loading state
            this.updateGenerateIdeasTooltip();

            console.log('🎯 Generating ideas for:', sourceNode.text);

            // Get connected nodes for conversation history
            const connectedNodes = this.getConnectedNodes(sourceNode);
            console.log('📎 Connected nodes as conversation history:', connectedNodes.map(n => n.text));

            // Call the AI service to generate ideas with context
            const ideas = await generateAIIdeas(this.apiKey, this.baseURL, sourceNode.text, connectedNodes);

            // Save state for undo
            this.saveState();

            // Verify the source node still exists in our nodes array (in case it was deleted during generation)
            const nodeStillExists = this.nodes.find(n => n.id === sourceNode.id);
            if (!nodeStillExists) {
                throw new Error('Source node was deleted during AI generation');
            }

            const createdNodes = [];

            ideas.forEach((idea, index) => {
                // Position new nodes in a circular pattern around the source node
                const angle = (index / ideas.length) * 2 * Math.PI;
                const radius = 180;
                const x = sourceNode.x + sourceNode.width/2 + Math.cos(angle) * radius - 100;
                const y = sourceNode.y + sourceNode.height/2 + Math.sin(angle) * radius - 30;

                const newNode = this.createNode(idea, x, y);
                createdNodes.push(newNode);

                // Create connection from source to new node
                this.createConnection(sourceNode, newNode);
            });
            
            const message = ideas.length === 1
                ? `Generated 1 AI idea and connected it!`
                : `Generated ${ideas.length} AI ideas and connected them!`;
            this.showNotification(message, 'success');
            
        } catch (error) {
            console.error('Error calling AI API:', error);
            
            const errorMessage = getErrorMessage(error);
            this.showNotification(errorMessage, 'error');
        } finally {
            this.isGeneratingAI = false;

            // Restore tooltip button state
            this.updateGenerateIdeasTooltip();
        }
    }
    
    // Data persistence
    saveToLocalStorage() {
        const data = {
            nodes: this.nodes,
            connections: this.connections,
            offsetX: this.offsetX,
            offsetY: this.offsetY,
            scale: this.scale
        };
        localStorage.setItem('infiniteCanvasMVP', JSON.stringify(data));
    }
    
    loadFromLocalStorage() {
        const saved = localStorage.getItem('infiniteCanvasMVP');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                this.nodes = data.nodes || [];
                this.connections = data.connections || [];
                this.offsetX = data.offsetX || 0;
                this.offsetY = data.offsetY || 0;
                this.scale = data.scale || 1.0;
            } catch (e) {
                console.error('Error loading from localStorage:', e);
            }
        }
    }
    
    exportJSON() {
        const data = {
            nodes: this.nodes,
            connections: this.connections,
            exportDate: new Date().toISOString()
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'canvas-export.json';
        a.click();
        
        URL.revokeObjectURL(url);
    }
    
    // Keyboard event handler
    onKeyDown(e) {
        // Don't handle keyboard events when editing text
        if (this.editingNode || document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') {
            return;
        }
        
        switch(e.key) {
            case 'Delete':
            case 'Backspace':
                if (this.selectedNode) {
                    this.deleteNode(this.selectedNode);
                }
                break;
            case 'z':
                if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
                    e.preventDefault();
                    this.redo();
                } else if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    this.undo();
                }
                break;
            case 'y':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    this.redo();
                }
                break;
        }
    }
    
    // Delete node and its connections
    deleteNode(node) {
        const nodeIndex = this.nodes.findIndex(n => n.id === node.id);
        if (nodeIndex === -1) return;
        
        // Save state for undo
        this.saveState();
        
        // Remove the node
        this.nodes.splice(nodeIndex, 1);
        
        // Remove all connections involving this node
        this.connections = this.connections.filter(
            conn => conn.from !== node.id && conn.to !== node.id
        );
        
        // Clear selection
        this.selectedNode = null;
        
        this.saveToLocalStorage();
        this.draw();
    }
    
    // History management
    saveState() {
        const state = {
            nodes: JSON.parse(JSON.stringify(this.nodes)),
            connections: JSON.parse(JSON.stringify(this.connections))
        };
        
        // Remove any future history if we're not at the end
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }
        
        // Add new state
        this.history.push(state);
        
        // Limit history size
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
        } else {
            this.historyIndex++;
        }
        
        this.updateUndoRedoButtons();
    }
    
    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.restoreState(this.history[this.historyIndex]);
        }
    }
    
    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.restoreState(this.history[this.historyIndex]);
        }
    }
    
    restoreState(state) {
        this.nodes = JSON.parse(JSON.stringify(state.nodes));
        this.connections = JSON.parse(JSON.stringify(state.connections));
        this.selectedNode = null;
        this.saveToLocalStorage();
        this.draw();
        this.updateUndoRedoButtons();
    }
    
    updateUndoRedoButtons() {
        const undoBtn = document.getElementById('undoBtn');
        const redoBtn = document.getElementById('redoBtn');
        
        undoBtn.disabled = this.historyIndex <= 0;
        redoBtn.disabled = this.historyIndex >= this.history.length - 1;
    }
}

export default InfiniteCanvas;