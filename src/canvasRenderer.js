// Canvas Renderer Module
// Handles all drawing operations on the HTML5 canvas

export function drawGrid(ctx, offsetX, offsetY, scale, canvasWidth, canvasHeight) {
    const gridSize = 40;
    const startX = Math.floor(-offsetX / scale / gridSize) * gridSize;
    const startY = Math.floor(-offsetY / scale / gridSize) * gridSize;
    const endX = startX + (canvasWidth / scale) + gridSize;
    const endY = startY + (canvasHeight / scale) + gridSize;
    
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.5;
    
    for (let x = startX; x < endX; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, startY);
        ctx.lineTo(x, endY);
        ctx.stroke();
    }
    
    for (let y = startY; y < endY; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(startX, y);
        ctx.lineTo(endX, y);
        ctx.stroke();
    }
    
    ctx.globalAlpha = 1;
}

export function wrapText(ctx, text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';
    
    words.forEach(word => {
        const testLine = currentLine + (currentLine ? ' ' : '') + word;
        const metrics = ctx.measureText(testLine);
        
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

export function drawNode(ctx, node) {
    const { x, y, width, text, isSelected } = node;
    
    // Calculate required height based on text content
    const lines = wrapText(ctx, text, width - 16);
    const lineHeight = 16;
    const padding = 16;
    const minHeight = 40;
    const requiredHeight = Math.max(minHeight, lines.length * lineHeight + padding);
    
    // Only auto-adjust height if node hasn't been manually resized
    if (!node.manuallyResized && node.height !== requiredHeight) {
        node.height = requiredHeight;
    }
    
    const height = node.height;
    
    // Draw node background
    ctx.fillStyle = isSelected ? '#e3f2fd' : '#ffffff';
    ctx.fillRect(x, y, width, height);
    
    // Draw node border
    ctx.strokeStyle = isSelected ? '#2196f3' : '#ddd';
    ctx.lineWidth = isSelected ? 2 : 1;
    ctx.strokeRect(x, y, width, height);
    
    // Draw resize handles if selected
    if (isSelected) {
        drawResizeHandles(ctx, node);
    }
    
    // Draw text with better positioning
    ctx.fillStyle = '#333';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    
    // Start text from top with padding
    const textStartY = y + 8;
    
    lines.forEach((line, index) => {
        const lineY = textStartY + index * lineHeight;
        // Only draw line if it fits within the node height
        if (lineY + lineHeight <= y + height - 8) {
            ctx.fillText(line, x + width / 2, lineY);
        }
    });
}

export function drawResizeHandles(ctx, node) {
    const { x, y, width, height } = node;
    const handleSize = 12;
    
    ctx.fillStyle = '#2196f3';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    
    // Right handle
    const rightX = x + width - handleSize/2;
    const rightY = y + height/2 - handleSize/2;
    ctx.fillRect(rightX, rightY, handleSize, handleSize);
    ctx.strokeRect(rightX, rightY, handleSize, handleSize);
    
    // Bottom handle
    const bottomX = x + width/2 - handleSize/2;
    const bottomY = y + height - handleSize/2;
    ctx.fillRect(bottomX, bottomY, handleSize, handleSize);
    ctx.strokeRect(bottomX, bottomY, handleSize, handleSize);
    
    // Bottom-right corner handle
    const cornerX = x + width - handleSize/2;
    const cornerY = y + height - handleSize/2;
    ctx.fillRect(cornerX, cornerY, handleSize, handleSize);
    ctx.strokeRect(cornerX, cornerY, handleSize, handleSize);
}

export function drawConnection(ctx, connection, nodes) {
    const fromNode = nodes.find(n => n.id === connection.from);
    const toNode = nodes.find(n => n.id === connection.to);
    
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
    ctx.strokeStyle = '#e53e3e';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // Add subtle shadow for depth
    ctx.shadowColor = 'rgba(229, 62, 62, 0.3)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
    
    ctx.beginPath();
    ctx.moveTo(fromEdgeX, fromEdgeY);
    ctx.lineTo(toEdgeX, toEdgeY);
    ctx.stroke();
    
    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    
    // Draw arrowhead
    drawArrowhead(ctx, toEdgeX, toEdgeY, angle);
}

export function drawArrowhead(ctx, x, y, angle) {
    const arrowLength = 12;
    const arrowAngle = Math.PI / 5;
    
    // Add subtle shadow for the arrowhead
    ctx.shadowColor = 'rgba(229, 62, 62, 0.3)';
    ctx.shadowBlur = 3;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
    
    ctx.fillStyle = '#e53e3e';
    ctx.strokeStyle = '#c53030';
    ctx.lineWidth = 1;
    
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(
        x - arrowLength * Math.cos(angle - arrowAngle),
        y - arrowLength * Math.sin(angle - arrowAngle)
    );
    ctx.lineTo(
        x - arrowLength * Math.cos(angle + arrowAngle),
        y - arrowLength * Math.sin(angle + arrowAngle)
    );
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
}

export function drawConnectionPreview(ctx, connectionStart, lastMouseX, lastMouseY, offsetX, offsetY, scale) {
    if (!connectionStart) return;
    
    const canvasX = (lastMouseX - offsetX) / scale;
    const canvasY = (lastMouseY - offsetY) / scale;
    
    const fromX = connectionStart.x + connectionStart.width / 2;
    const fromY = connectionStart.y + connectionStart.height / 2;
    
    // Draw dashed preview line
    ctx.strokeStyle = '#2196f3';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(canvasX, canvasY);
    ctx.stroke();
    ctx.setLineDash([]);
}