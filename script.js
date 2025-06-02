// Canvas MVP - Core functionality
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
        
        this.init();
    }
    
    init() {
        this.setupCanvas();
        this.setupEventListeners();
        this.loadFromLocalStorage();
        
        // Initialize history with current state
        this.saveState();
        
        this.draw();
        this.updateUndoRedoButtons();
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
        document.getElementById('generateAIBtn').addEventListener('click', () => this.generateAI());
        document.getElementById('exportBtn').addEventListener('click', () => this.exportJSON());
        
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
            width: 120,
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
        
        // Draw grid
        this.drawGrid();
        
        // Draw connections first (behind nodes)
        this.connections.forEach(connection => this.drawConnection(connection));
        
        // Draw all nodes
        this.nodes.forEach(node => this.drawNode(node));
        
        // Draw connection preview if connecting
        if (this.isConnecting && this.connectionStart) {
            this.drawConnectionPreview();
        }
        
        this.ctx.restore();
    }
    
    drawGrid() {
        const gridSize = 40;
        const startX = Math.floor(-this.offsetX / this.scale / gridSize) * gridSize;
        const startY = Math.floor(-this.offsetY / this.scale / gridSize) * gridSize;
        const endX = startX + (this.canvas.width / this.scale) + gridSize;
        const endY = startY + (this.canvas.height / this.scale) + gridSize;
        
        this.ctx.strokeStyle = '#e0e0e0';
        this.ctx.lineWidth = 1;
        this.ctx.globalAlpha = 0.5;
        
        for (let x = startX; x < endX; x += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, startY);
            this.ctx.lineTo(x, endY);
            this.ctx.stroke();
        }
        
        for (let y = startY; y < endY; y += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(startX, y);
            this.ctx.lineTo(endX, y);
            this.ctx.stroke();
        }
        
        this.ctx.globalAlpha = 1;
    }
    
    drawNode(node) {
        const { x, y, width, text, isSelected } = node;
        
        // Calculate required height based on text content
        const lines = this.wrapText(text, width - 16);
        const lineHeight = 16;
        const padding = 16;
        const minHeight = 40;
        const requiredHeight = Math.max(minHeight, lines.length * lineHeight + padding);
        
        // Only auto-adjust height if node hasn't been manually resized
        // We'll add a flag to track manual resizing
        if (!node.manuallyResized && node.height !== requiredHeight) {
            node.height = requiredHeight;
        }
        
        const height = node.height;
        
        // Draw node background
        this.ctx.fillStyle = isSelected ? '#e3f2fd' : '#ffffff';
        this.ctx.fillRect(x, y, width, height);
        
        // Draw node border
        this.ctx.strokeStyle = isSelected ? '#2196f3' : '#ddd';
        this.ctx.lineWidth = isSelected ? 2 : 1;
        this.ctx.strokeRect(x, y, width, height);
        
        // Draw resize handles if selected
        if (isSelected) {
            this.drawResizeHandles(node);
        }
        
        // Draw text with better positioning
        this.ctx.fillStyle = '#333';
        this.ctx.font = '14px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'top';
        
        // Start text from top with padding
        const textStartY = y + 8;
        
        lines.forEach((line, index) => {
            const lineY = textStartY + index * lineHeight;
            // Only draw line if it fits within the node height
            if (lineY + lineHeight <= y + height - 8) {
                this.ctx.fillText(line, x + width / 2, lineY);
            }
        });
    }
    
    drawResizeHandles(node) {
        const { x, y, width, height } = node;
        const handleSize = 12; // Increased from 8 to 12
        
        this.ctx.fillStyle = '#2196f3';
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 2;
        
        // Right handle
        const rightX = x + width - handleSize/2;
        const rightY = y + height/2 - handleSize/2;
        this.ctx.fillRect(rightX, rightY, handleSize, handleSize);
        this.ctx.strokeRect(rightX, rightY, handleSize, handleSize);
        
        // Bottom handle
        const bottomX = x + width/2 - handleSize/2;
        const bottomY = y + height - handleSize/2;
        this.ctx.fillRect(bottomX, bottomY, handleSize, handleSize);
        this.ctx.strokeRect(bottomX, bottomY, handleSize, handleSize);
        
        // Bottom-right corner handle
        const cornerX = x + width - handleSize/2;
        const cornerY = y + height - handleSize/2;
        this.ctx.fillRect(cornerX, cornerY, handleSize, handleSize);
        this.ctx.strokeRect(cornerX, cornerY, handleSize, handleSize);
    }
    
    wrapText(text, maxWidth) {
        const words = text.split(' ');
        const lines = [];
        let currentLine = '';
        
        words.forEach(word => {
            const testLine = currentLine + (currentLine ? ' ' : '') + word;
            const metrics = this.ctx.measureText(testLine);
            
            if (metrics.width > maxWidth && currentLine) {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        });
        
        if (currentLine) {
            lines.push(currentLine);
        }
        
        return lines;
    }
    
    drawConnection(connection) {
        const fromNode = this.nodes.find(n => n.id === connection.from);
        const toNode = this.nodes.find(n => n.id === connection.to);
        
        if (!fromNode || !toNode) return;
        
        // Calculate connection points (center of nodes)
        const fromX = fromNode.x + fromNode.width / 2;
        const fromY = fromNode.y + fromNode.height / 2;
        const toX = toNode.x + toNode.width / 2;
        const toY = toNode.y + toNode.height / 2;
        
        // Calculate edge points of nodes to avoid drawing line inside nodes
        const angle = Math.atan2(toY - fromY, toX - fromX);
        
        const fromEdgeX = fromNode.x + fromNode.width / 2 + Math.cos(angle) * (fromNode.width / 2);
        const fromEdgeY = fromNode.y + fromNode.height / 2 + Math.sin(angle) * (fromNode.height / 2);
        
        const toEdgeX = toNode.x + toNode.width / 2 - Math.cos(angle) * (toNode.width / 2);
        const toEdgeY = toNode.y + toNode.height / 2 - Math.sin(angle) * (toNode.height / 2);
        
        // Draw line with enhanced styling
        this.ctx.strokeStyle = '#e53e3e';
        this.ctx.lineWidth = 3;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        
        // Add subtle shadow for depth
        this.ctx.shadowColor = 'rgba(229, 62, 62, 0.3)';
        this.ctx.shadowBlur = 4;
        this.ctx.shadowOffsetX = 1;
        this.ctx.shadowOffsetY = 1;
        
        this.ctx.beginPath();
        this.ctx.moveTo(fromEdgeX, fromEdgeY);
        this.ctx.lineTo(toEdgeX, toEdgeY);
        this.ctx.stroke();
        
        // Reset shadow
        this.ctx.shadowColor = 'transparent';
        this.ctx.shadowBlur = 0;
        this.ctx.shadowOffsetX = 0;
        this.ctx.shadowOffsetY = 0;
        
        // Draw arrowhead
        this.drawArrowhead(toEdgeX, toEdgeY, angle);
    }
    
    drawArrowhead(x, y, angle) {
        const arrowLength = 12; // Increased size for better visibility
        const arrowAngle = Math.PI / 5; // Slightly wider angle (36 degrees)
        
        // Add subtle shadow for the arrowhead
        this.ctx.shadowColor = 'rgba(229, 62, 62, 0.3)';
        this.ctx.shadowBlur = 3;
        this.ctx.shadowOffsetX = 1;
        this.ctx.shadowOffsetY = 1;
        
        this.ctx.fillStyle = '#e53e3e';
        this.ctx.strokeStyle = '#c53030'; // Slightly darker border
        this.ctx.lineWidth = 1;
        
        this.ctx.beginPath();
        this.ctx.moveTo(x, y);
        this.ctx.lineTo(
            x - arrowLength * Math.cos(angle - arrowAngle),
            y - arrowLength * Math.sin(angle - arrowAngle)
        );
        this.ctx.lineTo(
            x - arrowLength * Math.cos(angle + arrowAngle),
            y - arrowLength * Math.sin(angle + arrowAngle)
        );
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();
        
        // Reset shadow
        this.ctx.shadowColor = 'transparent';
        this.ctx.shadowBlur = 0;
        this.ctx.shadowOffsetX = 0;
        this.ctx.shadowOffsetY = 0;
    }
    
    drawConnectionPreview() {
        if (!this.connectionStart) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = this.lastMouseX || 0;
        const mouseY = this.lastMouseY || 0;
        
        const canvasX = (mouseX - this.offsetX) / this.scale;
        const canvasY = (mouseY - this.offsetY) / this.scale;
        
        const fromX = this.connectionStart.x + this.connectionStart.width / 2;
        const fromY = this.connectionStart.y + this.connectionStart.height / 2;
        
        // Draw dashed preview line
        this.ctx.strokeStyle = '#2196f3';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);
        this.ctx.beginPath();
        this.ctx.moveTo(fromX, fromY);
        this.ctx.lineTo(canvasX, canvasY);
        this.ctx.stroke();
        this.ctx.setLineDash([]); // Reset line dash
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
            this.selectNode(clickedNode);
            
            // Check for resize handle first
            const resizeHandle = this.getResizeHandle(clickedNode, canvasX, canvasY);
            
            if (resizeHandle) {
                // Start resizing
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
            case 'right':
                this.canvas.style.cursor = 'ew-resize';
                break;
            case 'bottom':
                this.canvas.style.cursor = 'ns-resize';
                break;
            case 'bottom-right':
                this.canvas.style.cursor = 'nw-resize';
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
            if (hoveredNode && hoveredNode.isSelected) {
                const resizeHandle = this.getResizeHandle(hoveredNode, canvasX, canvasY);
                if (resizeHandle) {
                    this.setCursorForResize(resizeHandle);
                } else {
                    this.canvas.style.cursor = 'grab';
                }
            } else if (hoveredNode) {
                this.canvas.style.cursor = 'grab';
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
            
            switch(this.resizeHandle) {
                case 'right':
                    this.resizeTarget.width = Math.max(60, this.resizeTarget.width + deltaX / this.scale);
                    break;
                case 'bottom':
                    this.resizeTarget.height = Math.max(40, this.resizeTarget.height + deltaY / this.scale);
                    break;
                case 'bottom-right':
                    this.resizeTarget.width = Math.max(60, this.resizeTarget.width + deltaX / this.scale);
                    this.resizeTarget.height = Math.max(40, this.resizeTarget.height + deltaY / this.scale);
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
            const newNode = this.createNode('New Node', canvasX - 60, canvasY - 30);
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
        const handleSize = 12; // Match the visual size
        const tolerance = 8; // Increased tolerance for easier interaction
        
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
    
    selectNode(node) {
        this.nodes.forEach(n => n.isSelected = false);
        if (node) {
            node.isSelected = true;
            this.selectedNode = node;
        } else {
            this.selectedNode = null;
        }
        this.draw();
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
            // This preserves manually set dimensions while allowing auto-sizing for new nodes
            if (!this.editingNode.manuallyResized) {
                // Auto-size for nodes that haven't been manually resized
                const lines = this.wrapText(this.editingNode.text, this.editingNode.width - 16);
                const lineHeight = 16;
                const padding = 16;
                const minHeight = 40;
                const requiredHeight = Math.max(minHeight, lines.length * lineHeight + padding);
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
    
    // AI placeholder
    generateAI() {
        if (!this.selectedNode) {
            alert('Please select a node first');
            return;
        }
        
        console.log('AI generation would occur for node:', this.selectedNode.text);
        
        // Create a placeholder AI-generated node
        const newNode = this.createNode(
            'AI Generated: ' + this.selectedNode.text,
            this.selectedNode.x + 150,
            this.selectedNode.y
        );
        
        // Create connection between selected node and new node
        this.createConnection(this.selectedNode, newNode);
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

// Initialize the canvas when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.canvas = new InfiniteCanvas();
});