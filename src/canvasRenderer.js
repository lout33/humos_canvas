// Canvas Renderer Module
// Handles all drawing operations on the HTML5 canvas

import { calculateMarkdownHeight } from './markdownParser.js';
import { renderMarkdownToCanvas } from './markdownRenderer.js';

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

    // Enhanced margin configuration for better text spacing
    const margins = {
        top: 20,    // Increased top margin for better visual balance
        bottom: 12, // Bottom margin
        left: 12,   // Left margin
        right: 12   // Right margin
    };

    const minHeight = 40;

    // Calculate required height based on markdown content with new margins
    const requiredHeight = Math.max(minHeight, calculateMarkdownHeight(ctx, text, width, margins));

    // Only auto-adjust height if node hasn't been manually resized
    if (!node.manuallyResized && node.height !== requiredHeight) {
        node.height = requiredHeight;
    }

    const height = node.height;

    // Draw node background
    ctx.fillStyle = isSelected ? '#2d3748' : '#1a202c';
    ctx.fillRect(x, y, width, height);

    // Draw node border
    ctx.strokeStyle = isSelected ? '#4299e1' : '#4a5568';
    ctx.lineWidth = isSelected ? 2 : 1;
    ctx.strokeRect(x, y, width, height);

    // Draw resize handles if selected
    if (isSelected) {
        drawResizeHandles(ctx, node);
    }

    // Render markdown content with enhanced margins
    renderMarkdownToCanvas(ctx, text, x, y, width, height, margins);
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

// Helper function to calculate intersection of line with rectangle
function getLineRectangleIntersection(centerX, centerY, targetX, targetY, rectX, rectY, rectWidth, rectHeight) {
    // Calculate direction vector
    const dx = targetX - centerX;
    const dy = targetY - centerY;

    // If no direction, return center
    if (dx === 0 && dy === 0) {
        return { x: centerX, y: centerY };
    }

    // Calculate intersections with all four edges
    const intersections = [];

    // Left edge (x = rectX)
    if (dx !== 0) {
        const t = (rectX - centerX) / dx;
        const y = centerY + t * dy;
        if (t > 0 && y >= rectY && y <= rectY + rectHeight) {
            intersections.push({ x: rectX, y: y, distance: t });
        }
    }

    // Right edge (x = rectX + rectWidth)
    if (dx !== 0) {
        const t = (rectX + rectWidth - centerX) / dx;
        const y = centerY + t * dy;
        if (t > 0 && y >= rectY && y <= rectY + rectHeight) {
            intersections.push({ x: rectX + rectWidth, y: y, distance: t });
        }
    }

    // Top edge (y = rectY)
    if (dy !== 0) {
        const t = (rectY - centerY) / dy;
        const x = centerX + t * dx;
        if (t > 0 && x >= rectX && x <= rectX + rectWidth) {
            intersections.push({ x: x, y: rectY, distance: t });
        }
    }

    // Bottom edge (y = rectY + rectHeight)
    if (dy !== 0) {
        const t = (rectY + rectHeight - centerY) / dy;
        const x = centerX + t * dx;
        if (t > 0 && x >= rectX && x <= rectX + rectWidth) {
            intersections.push({ x: x, y: rectY + rectHeight, distance: t });
        }
    }

    // Return the closest intersection
    if (intersections.length > 0) {
        const closest = intersections.reduce((min, curr) =>
            curr.distance < min.distance ? curr : min
        );
        return { x: closest.x, y: closest.y };
    }

    // Fallback to center if no intersection found
    return { x: centerX, y: centerY };
}

export function drawConnection(ctx, connection, nodes) {
    const fromNode = nodes.find(n => n.id === connection.from);
    const toNode = nodes.find(n => n.id === connection.to);

    if (!fromNode || !toNode) return;

    // Calculate connection points (center of nodes)
    const fromCenterX = fromNode.x + fromNode.width / 2;
    const fromCenterY = fromNode.y + fromNode.height / 2;
    const toCenterX = toNode.x + toNode.width / 2;
    const toCenterY = toNode.y + toNode.height / 2;

    // Calculate proper edge intersection points for rectangular nodes
    const fromEdge = getLineRectangleIntersection(
        fromCenterX, fromCenterY, toCenterX, toCenterY,
        fromNode.x, fromNode.y, fromNode.width, fromNode.height
    );

    const toEdge = getLineRectangleIntersection(
        toCenterX, toCenterY, fromCenterX, fromCenterY,
        toNode.x, toNode.y, toNode.width, toNode.height
    );

    // Calculate angle for arrow head
    const angle = Math.atan2(toCenterY - fromCenterY, toCenterX - fromCenterX);

    // Add offset to ensure arrow head is visible outside the node
    const arrowOffset = 18; // Increased offset for better visibility
    const arrowX = toEdge.x - Math.cos(angle) * arrowOffset;
    const arrowY = toEdge.y - Math.sin(angle) * arrowOffset;

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
    ctx.moveTo(fromEdge.x, fromEdge.y);
    ctx.lineTo(arrowX, arrowY);
    ctx.stroke();

    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Draw arrowhead at the offset position
    drawArrowhead(ctx, arrowX, arrowY, angle);
}

export function drawArrowhead(ctx, x, y, angle) {
    const arrowLength = 16; // Increased from 12 for better visibility
    const arrowAngle = Math.PI / 4; // Wider angle (45 degrees) for more prominent arrow

    // Add enhanced shadow for the arrowhead
    ctx.shadowColor = 'rgba(229, 62, 62, 0.4)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    // Enhanced colors for better contrast
    ctx.fillStyle = '#d63031'; // Slightly darker red for better visibility
    ctx.strokeStyle = '#a71e1e'; // Darker border for definition
    ctx.lineWidth = 2; // Thicker border

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