
// Canvas MVP - Core functionality with OpenAI integration
import {
    drawGrid,
    drawNode,
    drawConnection,
    drawConnectionPreview,
    drawSelectionRectangle
} from './canvasRenderer.js';

import { calculateMarkdownHeight, parseMarkdown } from './markdownParser.js';

import {
    generateAIIdeasMultipleModels,
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
        this.selectedNodes = []; // Array to store multiple selected nodes
        this.isDragging = false;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.dragTarget = null; // 'canvas' or node object
        this.isConnecting = false; // True when creating a connection
        this.connectionStart = null; // Starting node for connection
        this.isResizing = false; // True when resizing a node
        this.resizeHandle = null; // Which resize handle is being dragged
        this.resizeTarget = null; // Node being resized
        this.isSelecting = false; // True when drawing selection rectangle
        this.selectionStart = { x: 0, y: 0 }; // Start point of selection rectangle
        this.selectionEnd = { x: 0, y: 0 }; // End point of selection rectangle
        this.isPanning = false; // True when panning the canvas
        this.spacePressed = false; // True when space key is held down
        
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
        this.aiModels = localStorage.getItem('ai_models') || 'gpt-3.5-turbo';
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

                    <label for="aiModelsInput">AI Models (comma-separated):</label>
                    <input type="text" id="aiModelsInput" placeholder="gpt-3.5-turbo, deepseek/deepseek-r1-0528, x-ai/grok-3-mini-beta" />
                    <small style="display: block; margin-bottom: 15px; color: #666;">
                        Enter one or more model names separated by commas. When multiple models are specified,
                        the "Generate Ideas" button will create one node for each model.
                    </small>

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
            document.getElementById('aiModelsInput').addEventListener('keydown', (e) => {
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
        const aiModelsInput = document.getElementById('aiModelsInput');
        modal.style.display = 'flex';
        apiKeyInput.value = this.apiKey || '';
        baseUrlInput.value = this.baseURL || 'https://api.openai.com/v1';
        aiModelsInput.value = this.aiModels || 'gpt-3.5-turbo';
        baseUrlInput.focus();
    }
    
    hideApiKeyModal() {
        document.getElementById('apiKeyModal').style.display = 'none';
    }
    
    saveApiConfig() {
        const apiKeyInput = document.getElementById('apiKeyInput');
        const baseUrlInput = document.getElementById('baseUrlInput');
        const aiModelsInput = document.getElementById('aiModelsInput');
        const apiKey = apiKeyInput.value.trim();
        const baseURL = baseUrlInput.value.trim();
        const aiModels = aiModelsInput.value.trim();

        if (!apiKey) {
            this.showNotification('Please enter an API key', 'error');
            return;
        }

        if (!baseURL) {
            this.showNotification('Please enter a base URL', 'error');
            return;
        }

        if (!aiModels) {
            this.showNotification('Please enter at least one AI model', 'error');
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
        this.aiModels = aiModels;
        localStorage.setItem('ai_api_key', apiKey);
        localStorage.setItem('ai_base_url', baseURL);
        localStorage.setItem('ai_models', aiModels);


        this.hideApiKeyModal();
        this.updateApiConfigButton();

        // Show success message with provider info
        const provider = getProviderName(baseURL);
        const modelCount = aiModels.split(',').length;
        this.showNotification(`${provider} configuration saved with ${modelCount} model(s)!`, 'success');
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
        const generateBtn = document.getElementById('generateIdeasBtn');
        const expandBtn = document.getElementById('expandContentBtn');

        // Only show buttons for single node selection
        if (this.selectedNodes.length === 1) {
            const selectedNode = this.selectedNodes[0];
            const rect = this.canvas.getBoundingClientRect();

            // Position tooltip above the selected node
            const nodeScreenX = rect.left + (selectedNode.x * this.scale) + this.offsetX;
            const nodeScreenY = rect.top + (selectedNode.y * this.scale) + this.offsetY;
            const tooltipX = nodeScreenX + (selectedNode.width * this.scale) / 2;
            const tooltipY = nodeScreenY - 60; // 60px above the node to accommodate both buttons

            tooltip.style.left = `${tooltipX}px`;
            tooltip.style.top = `${tooltipY}px`;
            tooltip.style.transform = 'translateX(-50%)'; // Center horizontally

            tooltip.classList.remove('hidden');

            // Update generate button state (only show if API key is configured)
            if (this.apiKey) {
                generateBtn.style.display = 'flex';
                generateBtn.disabled = this.isGeneratingAI;
                generateBtn.textContent = this.isGeneratingAI ? '⏳' : '🤖';
                generateBtn.title = this.isGeneratingAI ? 'Generating...' : 'Generate Ideas';
            } else {
                generateBtn.style.display = 'none';
            }

            // Always show expand button for single selection
            expandBtn.style.display = 'flex';
        } else {
            tooltip.classList.add('hidden');
        }
    }

    updateSelectionStatus() {
        const statusElement = document.getElementById('selectionStatus');
        const countElement = document.getElementById('selectionCount');
        const hintElement = document.getElementById('selectionHint');

        if (this.selectedNodes.length > 0) {
            statusElement.classList.remove('hidden');
            countElement.textContent = this.selectedNodes.length;

            if (this.selectedNodes.length > 1) {
                hintElement.classList.remove('hidden');
                hintElement.textContent = 'Select a single node to generate AI ideas';
            } else {
                hintElement.classList.add('hidden');
            }
        } else {
            statusElement.classList.add('hidden');
        }
    }
    
    showNotification(message, type = 'info', duration = 3000) {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);

        // Remove after specified duration
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, duration);
    }

    showProgressNotification(message, models = []) {
        // Remove existing progress notification if any
        this.hideProgressNotification();

        // Create progress notification element
        const progressNotification = document.createElement('div');
        progressNotification.id = 'aiProgressNotification';
        progressNotification.className = 'progress-notification';

        progressNotification.innerHTML = `
            <div class="progress-header">
                <span class="progress-message">${message}</span>
                <button class="progress-close" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
            <div class="progress-models">
                ${models.map(model => {
                    const modelName = model.split('/').pop() || model;
                    return `<div class="model-status" data-model="${model}">
                        <span class="model-name">${modelName}</span>
                        <span class="model-indicator">⏳</span>
                    </div>`;
                }).join('')}
            </div>
            <div class="progress-summary">
                <span id="progressSummary">Preparing...</span>
            </div>
        `;

        document.body.appendChild(progressNotification);
    }

    updateProgressNotification(completed, total, totalNodes) {
        const progressNotification = document.getElementById('aiProgressNotification');
        if (!progressNotification) return;

        const summaryElement = document.getElementById('progressSummary');
        if (summaryElement) {
            summaryElement.textContent = `${completed}/${total} models completed • ${totalNodes} ideas generated`;
        }
    }

    hideProgressNotification() {
        const progressNotification = document.getElementById('aiProgressNotification');
        if (progressNotification && progressNotification.parentNode) {
            progressNotification.parentNode.removeChild(progressNotification);
        }
    }

    showContentModal() {
        // Check if exactly one node is selected
        if (this.selectedNodes.length !== 1) {
            this.showNotification('Please select exactly one node to expand its content', 'warning');
            return;
        }

        const selectedNode = this.selectedNodes[0];
        const modal = document.getElementById('contentModal');
        const modalTitle = document.getElementById('modalTitle');
        const modalContent = document.getElementById('modalContent');

        // Set modal content
        modalTitle.textContent = 'Node Content';

        // Convert markdown to HTML for better display in modal
        const htmlContent = this.markdownToHtml(selectedNode.text || 'No content');
        modalContent.innerHTML = htmlContent;

        // Show modal
        modal.classList.remove('hidden');

        // Add escape key handler
        this.modalEscapeHandler = (e) => {
            if (e.key === 'Escape') {
                this.hideContentModal();
            }
        };
        document.addEventListener('keydown', this.modalEscapeHandler);
    }

    // Convert markdown to HTML for modal display
    markdownToHtml(text) {
        if (!text || typeof text !== 'string') {
            return '<p>No content</p>';
        }

        const parsed = parseMarkdown(text);
        let html = '';

        parsed.forEach(item => {
            if (item.type === 'spacing') {
                html += '<br>';
                return;
            }

            if (item.type === 'header') {
                const level = item.level || 1;
                html += `<h${level}>${this.escapeHtml(item.content)}</h${level}>`;
            } else if (item.type === 'list') {
                const content = Array.isArray(item.content)
                    ? this.processInlineFormattingToHtml(item.content)
                    : this.escapeHtml(item.content);
                html += `<li>${content}</li>`;
            } else {
                const content = Array.isArray(item.content)
                    ? this.processInlineFormattingToHtml(item.content)
                    : this.escapeHtml(item.content);
                html += `<p>${content}</p>`;
            }
        });

        // Wrap list items in ul tags
        html = html.replace(/(<li>.*?<\/li>)+/g, '<ul>$&</ul>');

        return html || '<p>No content</p>';
    }

    // Process inline formatting to HTML
    processInlineFormattingToHtml(segments) {
        return segments.map(segment => {
            const text = this.escapeHtml(segment.text);
            switch (segment.type) {
                case 'bold':
                    return `<strong>${text}</strong>`;
                case 'italic':
                    return `<em>${text}</em>`;
                case 'code':
                    return `<code>${text}</code>`;
                default:
                    return text;
            }
        }).join('');
    }

    // Escape HTML characters
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    hideContentModal() {
        const modal = document.getElementById('contentModal');
        modal.classList.add('hidden');

        // Remove escape key handler
        if (this.modalEscapeHandler) {
            document.removeEventListener('keydown', this.modalEscapeHandler);
            this.modalEscapeHandler = null;
        }
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
        console.log('Setting up event listeners...');

        // Toolbar buttons
        document.getElementById('addNodeBtn').addEventListener('click', () => this.createNode());

        const exportBtn = document.getElementById('exportBtn');
        console.log('Export button found:', exportBtn); // Debug log
        exportBtn.addEventListener('click', () => {
            console.log('Export button event listener triggered'); // Debug log
            this.exportJSON();
        });

        // Import button
        const importBtn = document.getElementById('importBtn');
        console.log('Import button found:', importBtn); // Debug log
        importBtn.addEventListener('click', () => {
            console.log('Import button event listener triggered'); // Debug log
            this.importJSON();
        });

        // Hidden file input for import
        const importFileInput = document.getElementById('importFileInput');
        console.log('Import file input found:', importFileInput); // Debug log
        importFileInput.addEventListener('change', (e) => {
            console.log('File input change event triggered'); // Debug log
            this.handleFileImport(e);
        });

        // API Configuration button
        document.getElementById('configureApiBtn').addEventListener('click', () => this.showApiKeyModal());

        // Generate Ideas tooltip button
        document.getElementById('generateIdeasBtn').addEventListener('click', () => this.generateAI());

        // Expand Content button
        document.getElementById('expandContentBtn').addEventListener('click', () => this.showContentModal());

        // Modal close handlers
        document.getElementById('closeModalBtn').addEventListener('click', () => this.hideContentModal());
        document.getElementById('contentModal').addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-backdrop')) {
                this.hideContentModal();
            }
        });

        // Canvas controls
        document.getElementById('zoomInBtn').addEventListener('click', () => this.zoom(1.2));
        document.getElementById('zoomOutBtn').addEventListener('click', () => this.zoom(0.8));
        document.getElementById('resetViewBtn').addEventListener('click', () => this.resetView());
        document.getElementById('undoBtn').addEventListener('click', () => this.undo());
        document.getElementById('redoBtn').addEventListener('click', () => this.redo());
        
        // Keyboard events
        document.addEventListener('keydown', (e) => this.onKeyDown(e));
        document.addEventListener('keyup', (e) => this.onKeyUp(e));

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
    createNode(text = 'New Node', x = null, y = null, generatedByModel = null) {
        // Save state for undo before creating node
        this.saveState();

        const node = {
            id: Date.now() + Math.random(),
            text: text,
            x: x !== null ? x : this.canvas.width / 2 - this.offsetX,
            y: y !== null ? y : this.canvas.height / 2 - this.offsetY,
            width: 400,
            height: 60,
            isSelected: false,
            generatedByModel: generatedByModel
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

        // Draw selection rectangle if selecting
        if (this.isSelecting) {
            drawSelectionRectangle(this.ctx, this.selectionStart, this.selectionEnd);
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

        // Handle right mouse button or space+left click for panning
        if (e.button === 2 || (e.button === 0 && this.spacePressed)) {
            this.isPanning = true;
            this.isDragging = true;
            this.dragStartX = mouseX;
            this.dragStartY = mouseY;
            this.dragTarget = 'canvas';
            this.canvas.style.cursor = 'grabbing';
            return;
        }

        // Only handle left mouse button for selection and node interaction
        if (e.button !== 0) return;

        // Check if clicking on a node
        const clickedNode = this.getNodeAtPoint(canvasX, canvasY);

        if (clickedNode) {
            // Check for border-based resize first (works on any node)
            const borderResizeHandle = this.getBorderResizeHandle(clickedNode, canvasX, canvasY);

            if (borderResizeHandle) {
                // Start border-based resizing - only works on single selection
                if (this.selectedNodes.length > 1) {
                    this.selectNode(clickedNode);
                } else if (!clickedNode.isSelected) {
                    this.selectNode(clickedNode);
                }
                this.isResizing = true;
                this.resizeHandle = borderResizeHandle;
                this.resizeTarget = clickedNode;
                this.setCursorForResize(borderResizeHandle);
            } else {
                // Handle multi-selection with Ctrl/Cmd
                if (e.ctrlKey || e.metaKey) {
                    if (clickedNode.isSelected) {
                        this.removeFromSelection(clickedNode);
                    } else {
                        this.addToSelection(clickedNode);
                    }
                } else {
                    // Single selection or select if not already selected
                    if (!clickedNode.isSelected) {
                        this.selectNode(clickedNode);
                    }
                }

                // Check for traditional resize handles on selected nodes (only for single selection)
                if (this.selectedNodes.length === 1 && clickedNode.isSelected) {
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
                        // Regular drag - set drag target to all selected nodes
                        this.dragTarget = this.selectedNodes.length > 1 ? 'selectedNodes' : clickedNode;
                    }
                } else if (!(e.ctrlKey || e.metaKey)) {
                    // Regular drag for multiple selected nodes
                    this.dragTarget = this.selectedNodes.length > 1 ? 'selectedNodes' : clickedNode;
                }
            }
        } else {
            // Clicked on empty space with left mouse button
            if (!(e.ctrlKey || e.metaKey)) {
                this.clearSelection();
            }

            // Start selection rectangle (only for left mouse button, not when space is pressed)
            if (!this.spacePressed) {
                this.isSelecting = true;
                this.selectionStart = { x: canvasX, y: canvasY };
                this.selectionEnd = { x: canvasX, y: canvasY };
            }
        }

        if (!this.isConnecting && !this.isResizing && !this.isSelecting) {
            this.isDragging = true;
            this.dragStartX = mouseX;
            this.dragStartY = mouseY;

            if (this.dragTarget === 'canvas') {
                this.canvas.style.cursor = 'grabbing';
            }
        } else if (this.isSelecting) {
            // Don't set isDragging for selection rectangle
            this.canvas.style.cursor = 'crosshair';
        } else if (!this.isConnecting && !this.isResizing) {
            this.isDragging = true;
            this.dragStartX = mouseX;
            this.dragStartY = mouseY;
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
            if (this.spacePressed) {
                // Space is pressed - show grab cursor for panning
                this.canvas.style.cursor = 'grab';
            } else {
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
                    this.canvas.style.cursor = 'default';
                }
            }
        }
        
        if (this.isSelecting) {
            // Update selection rectangle
            this.selectionEnd = { x: canvasX, y: canvasY };
            this.draw();
            return;
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
        } else if (this.dragTarget === 'selectedNodes') {
            // Drag all selected nodes
            const scaledDeltaX = deltaX / this.scale;
            const scaledDeltaY = deltaY / this.scale;
            this.selectedNodes.forEach(node => {
                node.x += scaledDeltaX;
                node.y += scaledDeltaY;
            });
        } else if (this.dragTarget && typeof this.dragTarget === 'object') {
            // Drag single node
            this.dragTarget.x += deltaX / this.scale;
            this.dragTarget.y += deltaY / this.scale;
        }
        
        this.dragStartX = mouseX;
        this.dragStartY = mouseY;
        
        this.draw();
    }
    
    onMouseUp(e) {
        if (this.isSelecting) {
            // Complete selection rectangle
            this.isSelecting = false;

            // Find nodes within selection rectangle
            const rect = {
                x: Math.min(this.selectionStart.x, this.selectionEnd.x),
                y: Math.min(this.selectionStart.y, this.selectionEnd.y),
                width: Math.abs(this.selectionEnd.x - this.selectionStart.x),
                height: Math.abs(this.selectionEnd.y - this.selectionStart.y)
            };

            const nodesInSelection = this.nodes.filter(node => {
                return node.x < rect.x + rect.width &&
                       node.x + node.width > rect.x &&
                       node.y < rect.y + rect.height &&
                       node.y + node.height > rect.y;
            });

            // Add nodes to selection (or replace if not holding Ctrl/Cmd)
            if (e.ctrlKey || e.metaKey) {
                nodesInSelection.forEach(node => this.addToSelection(node));
            } else {
                this.selectNodes(nodesInSelection);
            }

            this.canvas.style.cursor = 'grab';
            this.draw();
            return;
        }

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
        this.isPanning = false;
        this.dragTarget = null;
        this.canvas.style.cursor = this.spacePressed ? 'grab' : 'default';

        if (this.dragTarget !== 'canvas') {
            this.saveToLocalStorage();
        }
    }
    
    onWheel(e) {
        e.preventDefault();

        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Detect trackpad vs mouse wheel
        // Trackpad typically has smaller deltaY values and often has deltaX
        const isTrackpad = Math.abs(e.deltaY) < 50 || Math.abs(e.deltaX) > 0;

        // Handle trackpad pinch-to-zoom (detected by ctrlKey on Mac)
        if (e.ctrlKey && isTrackpad) {
            // Pinch gesture = zoom
            const zoomFactor = e.deltaY > 0 ? 0.95 : 1.05; // More sensitive for pinch
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
            return;
        }

        // Handle trackpad two-finger scrolling for panning
        if (isTrackpad && !e.ctrlKey && !e.metaKey) {
            // Two-finger scroll = pan the canvas
            const panSensitivity = 1.0;
            this.offsetX -= e.deltaX * panSensitivity;
            this.offsetY -= e.deltaY * panSensitivity;
            this.draw();
            return;
        }

        // Handle zoom (mouse wheel or trackpad with modifier keys)
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
    
    // Selection management methods
    selectNodes(nodes) {
        this.clearSelection();
        if (Array.isArray(nodes)) {
            nodes.forEach(node => {
                if (node) {
                    node.isSelected = true;
                    this.selectedNodes.push(node);
                }
            });
        } else if (nodes) {
            nodes.isSelected = true;
            this.selectedNodes.push(nodes);
        }
        this.draw();
        this.updateGenerateIdeasTooltip();
        this.updateSelectionStatus();
    }

    selectNode(node) {
        this.selectNodes(node);
    }

    addToSelection(node) {
        if (node && !this.selectedNodes.includes(node)) {
            node.isSelected = true;
            this.selectedNodes.push(node);
            this.draw();
            this.updateGenerateIdeasTooltip();
            this.updateSelectionStatus();
        }
    }

    removeFromSelection(node) {
        if (node) {
            node.isSelected = false;
            const index = this.selectedNodes.indexOf(node);
            if (index > -1) {
                this.selectedNodes.splice(index, 1);
            }
            this.draw();
            this.updateGenerateIdeasTooltip();
            this.updateSelectionStatus();
        }
    }

    clearSelection() {
        this.nodes.forEach(n => n.isSelected = false);
        this.selectedNodes = [];
        this.draw();
        this.updateGenerateIdeasTooltip();
        this.updateSelectionStatus();
    }

    getSelectedNodes() {
        return this.selectedNodes;
    }

    // Get bounding box of all selected nodes
    getSelectionBounds() {
        if (this.selectedNodes.length === 0) return null;

        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        this.selectedNodes.forEach(node => {
            minX = Math.min(minX, node.x);
            minY = Math.min(minY, node.y);
            maxX = Math.max(maxX, node.x + node.width);
            maxY = Math.max(maxY, node.y + node.height);
        });

        return {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY
        };
    }

    // Backward compatibility - get first selected node
    get selectedNode() {
        return this.selectedNodes.length > 0 ? this.selectedNodes[0] : null;
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
    
    // Enhanced AI functionality with parallel processing and real-time responses
    async generateAI() {
        // If no API key, show modal to set it
        if (!this.apiKey) {
            this.showApiKeyModal();
            return;
        }

        // Check if exactly one node is selected
        if (this.selectedNodes.length === 0) {
            this.showNotification('Please select a node first to generate connected ideas', 'warning');
            return;
        }

        if (this.selectedNodes.length > 1) {
            this.showNotification('Please select only one node to generate ideas. AI generation works with single nodes.', 'warning');
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

            // Parse models from configuration
            const models = this.aiModels.split(',').map(m => m.trim()).filter(m => m.length > 0);
            console.log('🎯 Using models:', models);

            // Save state for undo before starting generation
            this.saveState();

            // Verify the source node still exists in our nodes array
            const nodeStillExists = this.nodes.find(n => n.id === sourceNode.id);
            if (!nodeStillExists) {
                throw new Error('Source node was deleted during AI generation');
            }

            // Show progress notification
            this.showProgressNotification(`Starting AI generation with ${models.length} model(s)...`, models);

            // Track generation progress
            let completedModels = 0;
            let totalNodes = 0;
            const createdNodes = [];

            // Define callback for when each model completes
            const onModelComplete = async (modelResult) => {
                completedModels++;

                console.log(`📦 Model ${modelResult.model} completed (${completedModels}/${models.length})`);

                // Verify the source node still exists before creating new nodes
                const sourceStillExists = this.nodes.find(n => n.id === sourceNode.id);
                if (!sourceStillExists) {
                    console.warn('⚠️ Source node was deleted during generation, skipping node creation');
                    return;
                }

                // Process ideas from this model immediately
                if (modelResult.success && modelResult.ideas && modelResult.ideas.length > 0) {
                    modelResult.ideas.forEach((idea) => {
                        // Position new nodes in a circular pattern around the source node
                        const angle = (totalNodes / (models.length * 1.5)) * 2 * Math.PI; // Estimate total nodes
                        const radius = 180;
                        const x = sourceNode.x + sourceNode.width/2 + Math.cos(angle) * radius - 200;
                        const y = sourceNode.y + sourceNode.height/2 + Math.sin(angle) * radius - 30;

                        const newNode = this.createNode(idea, x, y, modelResult.model);
                        createdNodes.push(newNode);

                        // Create connection from source to new node
                        this.createConnection(sourceNode, newNode);

                        totalNodes++;
                    });

                    // Update the canvas immediately to show the new node
                    this.draw();
                    this.saveToLocalStorage();

                    // Show immediate feedback for this model
                    const modelName = modelResult.model.split('/').pop() || modelResult.model;
                    this.showNotification(`✅ ${modelName} generated ${modelResult.ideas.length} idea(s)`, 'success', 2000);
                } else if (!modelResult.success) {
                    // Show error for this specific model
                    const modelName = modelResult.model.split('/').pop() || modelResult.model;
                    this.showNotification(`❌ ${modelName} failed: ${modelResult.errorMessage}`, 'error', 3000);
                }

                // Update progress and model status
                this.updateProgressNotification(completedModels, models.length, totalNodes);
                this.updateModelStatus(modelResult.model, modelResult.success ? 'success' : 'error');
            };

            // Call the AI service with parallel processing and real-time callbacks
            const modelResults = await generateAIIdeasMultipleModels(
                this.apiKey,
                this.baseURL,
                sourceNode.text,
                connectedNodes,
                models,
                onModelComplete
            );

            // Final summary notification
            const successfulModels = modelResults.filter(r => r.success).length;
            const failedModels = modelResults.filter(r => !r.success).length;

            let summaryMessage;
            if (totalNodes > 0) {
                summaryMessage = `🎉 Generation complete! Created ${totalNodes} idea(s) from ${successfulModels} model(s)`;
                if (failedModels > 0) {
                    summaryMessage += ` (${failedModels} model(s) failed)`;
                }
            } else {
                summaryMessage = `❌ No ideas generated. All ${models.length} model(s) failed.`;
            }

            this.showNotification(summaryMessage, totalNodes > 0 ? 'success' : 'error', 4000);

        } catch (error) {
            console.error('Error calling AI API:', error);

            const errorMessage = getErrorMessage(error);
            this.showNotification(errorMessage, 'error');
        } finally {
            this.isGeneratingAI = false;

            // Hide progress notification
            this.hideProgressNotification();

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
        console.log('Export JSON button clicked!'); // Debug log

        try {
            const data = {
                nodes: this.nodes,
                connections: this.connections,
                exportDate: new Date().toISOString()
            };

            console.log('Data to export:', data); // Debug log
            console.log('Number of nodes:', this.nodes.length);
            console.log('Number of connections:', this.connections.length);

            // Check if Blob is supported
            if (!window.Blob) {
                throw new Error('Blob API not supported in this browser');
            }

            const jsonString = JSON.stringify(data, null, 2);
            console.log('JSON string length:', jsonString.length);

            const blob = new Blob([jsonString], { type: 'application/json' });
            console.log('Blob created:', blob);

            // Check if URL.createObjectURL is supported
            if (!window.URL || !window.URL.createObjectURL) {
                throw new Error('URL.createObjectURL not supported in this browser');
            }

            const url = URL.createObjectURL(blob);
            console.log('Object URL created:', url);

            const a = document.createElement('a');
            a.href = url;
            a.download = 'canvas-export.json';
            a.style.display = 'none'; // Hide the link

            console.log('Download link created:', a);

            document.body.appendChild(a); // Ensure the element is in the DOM
            console.log('Link added to DOM');

            // Try to trigger the download
            try {
                a.click();
                console.log('Click triggered');
            } catch (clickError) {
                console.error('Error clicking download link:', clickError);
                // Fallback: try dispatching a click event
                const clickEvent = new MouseEvent('click', {
                    view: window,
                    bubbles: true,
                    cancelable: true
                });
                a.dispatchEvent(clickEvent);
                console.log('Click event dispatched');
            }

            // Clean up after a short delay
            setTimeout(() => {
                if (a.parentNode) {
                    document.body.removeChild(a);
                    console.log('Link removed from DOM');
                }
                URL.revokeObjectURL(url);
                console.log('Object URL revoked');
            }, 100);

            // Show success notification
            this.showNotification('Canvas exported successfully!', 'success');
            console.log('Export completed successfully'); // Debug log

        } catch (error) {
            console.error('Error during export:', error);
            this.showNotification('Export failed: ' + error.message, 'error');
        }
    }

    importJSON() {
        console.log('Import JSON method called'); // Debug log

        try {
            // Trigger the hidden file input
            const fileInput = document.getElementById('importFileInput');
            if (!fileInput) {
                throw new Error('File input element not found');
            }

            console.log('Triggering file input click'); // Debug log
            fileInput.click();

        } catch (error) {
            console.error('Error during import trigger:', error);
            this.showNotification('Import failed: ' + error.message, 'error');
        }
    }

    handleFileImport(event) {
        console.log('Handle file import called'); // Debug log

        const file = event.target.files[0];
        if (!file) {
            console.log('No file selected'); // Debug log
            return;
        }

        console.log('File selected:', file.name, file.type, file.size); // Debug log

        // Validate file type
        if (!file.type.includes('json') && !file.name.toLowerCase().endsWith('.json')) {
            this.showNotification('Please select a valid JSON file', 'error');
            return;
        }

        // Validate file size (max 10MB)
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
            this.showNotification('File is too large. Maximum size is 10MB', 'error');
            return;
        }

        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                console.log('File read successfully'); // Debug log
                const jsonData = JSON.parse(e.target.result);
                console.log('JSON parsed successfully:', jsonData); // Debug log

                this.loadCanvasData(jsonData);

            } catch (parseError) {
                console.error('Error parsing JSON:', parseError);
                this.showNotification('Invalid JSON file format', 'error');
            }
        };

        reader.onerror = () => {
            console.error('Error reading file');
            this.showNotification('Error reading file', 'error');
        };

        console.log('Starting file read'); // Debug log
        reader.readAsText(file);

        // Clear the file input so the same file can be selected again
        event.target.value = '';
    }

    loadCanvasData(data) {
        console.log('Loading canvas data:', data);

        try {
            // Validate the data structure
            if (!data || typeof data !== 'object') {
                throw new Error('Invalid data format - not an object');
            }

            // Check for required properties
            if (!Array.isArray(data.nodes)) {
                throw new Error('Invalid or missing nodes data - nodes must be an array');
            }

            if (!Array.isArray(data.connections)) {
                throw new Error('Invalid or missing connections data - connections must be an array');
            }

            // Additional validation for data integrity
            if (data.nodes.length === 0 && data.connections.length > 0) {
                console.warn('Warning: Found connections but no nodes, connections will be removed');
            }

            // Save current state for undo before importing
            this.saveState();

            // Load the data
            this.nodes = data.nodes || [];
            this.connections = data.connections || [];

            // Reset view state if provided
            if (typeof data.offsetX === 'number') this.offsetX = data.offsetX;
            if (typeof data.offsetY === 'number') this.offsetY = data.offsetY;
            if (typeof data.scale === 'number') this.scale = data.scale;

            // Clear selection
            this.selectedNode = null;

            // Validate and fix node data
            this.validateAndFixNodes();

            // Validate and fix connection data
            this.validateAndFixConnections();

            // Save to localStorage and redraw
            this.saveToLocalStorage();
            this.draw();
            this.updateUndoRedoButtons();

            // Show success message
            const nodeCount = this.nodes.length;
            const connectionCount = this.connections.length;
            this.showNotification(
                `Canvas imported successfully! Loaded ${nodeCount} nodes and ${connectionCount} connections.`,
                'success'
            );

            console.log('Canvas data loaded successfully'); // Debug log

        } catch (error) {
            console.error('Error loading canvas data:', error);
            this.showNotification('Failed to load canvas data: ' + error.message, 'error');
        }
    }

    validateAndFixNodes() {
        console.log('Validating nodes...'); // Debug log

        this.nodes = this.nodes.filter(node => {
            // Ensure required properties exist
            if (!node.id || typeof node.text !== 'string') {
                console.warn('Removing invalid node:', node);
                return false;
            }

            // Set default values for missing properties
            node.x = typeof node.x === 'number' ? node.x : 0;
            node.y = typeof node.y === 'number' ? node.y : 0;
            node.width = typeof node.width === 'number' ? node.width : 400;
            node.height = typeof node.height === 'number' ? node.height : 60;
            node.isSelected = false; // Always reset selection state

            return true;
        });

        // Reset selection after validation
        this.selectedNodes = [];

        console.log(`Validated ${this.nodes.length} nodes`); // Debug log
    }

    validateAndFixConnections() {
        console.log('Validating connections...'); // Debug log

        // Get valid node IDs
        const validNodeIds = new Set(this.nodes.map(node => node.id));

        this.connections = this.connections.filter(connection => {
            // Ensure connection has valid from and to node IDs
            if (!connection.from || !connection.to) {
                console.warn('Removing connection with missing from/to:', connection);
                return false;
            }

            if (!validNodeIds.has(connection.from) || !validNodeIds.has(connection.to)) {
                console.warn('Removing connection with invalid node references:', connection);
                return false;
            }

            return true;
        });

        console.log(`Validated ${this.connections.length} connections`); // Debug log
    }

    // Keyboard event handler
    onKeyDown(e) {
        // Handle space key for panning mode
        if (e.key === ' ' && !this.spacePressed) {
            // Don't handle space when editing text
            if (this.editingNode || document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') {
                return;
            }
            e.preventDefault();
            this.spacePressed = true;
            if (!this.isDragging) {
                this.canvas.style.cursor = 'grab';
            }
            return;
        }

        // Don't handle other keyboard events when editing text
        if (this.editingNode || document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') {
            return;
        }

        switch(e.key) {
            case 'Delete':
            case 'Backspace':
                if (this.selectedNodes.length > 0) {
                    this.deleteSelectedNodes();
                }
                break;
            case 'a':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    this.selectAllNodes();
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

    onKeyUp(e) {
        // Handle space key release
        if (e.key === ' ') {
            this.spacePressed = false;
            if (!this.isDragging) {
                this.canvas.style.cursor = 'default';
            }
        }
    }
    
    // Select all nodes
    selectAllNodes() {
        this.selectNodes(this.nodes);
    }

    // Delete multiple selected nodes and their connections
    deleteSelectedNodes() {
        if (this.selectedNodes.length === 0) return;

        // Save state for undo
        this.saveState();

        // Get IDs of nodes to delete
        const nodeIdsToDelete = new Set(this.selectedNodes.map(node => node.id));

        // Remove the nodes
        this.nodes = this.nodes.filter(node => !nodeIdsToDelete.has(node.id));

        // Remove all connections involving these nodes
        this.connections = this.connections.filter(
            conn => !nodeIdsToDelete.has(conn.from) && !nodeIdsToDelete.has(conn.to)
        );

        // Clear selection
        this.clearSelection();

        this.saveToLocalStorage();
        this.draw();
    }

    // Delete single node and its connections (backward compatibility)
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
        this.clearSelection();

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
        this.clearSelection();
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