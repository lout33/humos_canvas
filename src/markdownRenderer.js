// Canvas markdown renderer - renders parsed markdown to canvas
import { parseMarkdown } from './markdownParser.js';

export function renderMarkdownToCanvas(ctx, text, x, y, maxWidth, nodeHeight, margins = 16) {
    // Handle both old padding format and new margins object
    const marginConfig = typeof margins === 'object' ? margins : {
        top: margins / 2,
        bottom: margins / 2,
        left: margins / 2,
        right: margins / 2
    };

    const parsed = parseMarkdown(text);
    let currentY = y + marginConfig.top;
    const maxY = y + nodeHeight - marginConfig.bottom;
    
    // Save original context state
    ctx.save();
    
    parsed.forEach(item => {
        if (item.type === 'spacing') {
            currentY += item.fontSize;
            return;
        }
        
        // Calculate line height
        let lineHeight = item.fontSize + 4;
        if (item.type === 'header') {
            lineHeight = item.fontSize + 8;
        } else if (item.type === 'list') {
            lineHeight = item.fontSize + 6;
        }
        
        // Check if we have space to render this item
        if (currentY + lineHeight > maxY) {
            return; // Stop rendering if we're out of space
        }
        
        if (Array.isArray(item.content)) {
            // Handle inline formatted content
            currentY = renderInlineFormattedText(ctx, item, x, currentY, maxWidth, marginConfig, lineHeight, maxY);
        } else {
            // Handle simple content
            currentY = renderSimpleText(ctx, item, x, currentY, maxWidth, marginConfig, lineHeight, maxY);
        }
    });
    
    // Restore context state
    ctx.restore();
    
    return currentY - y; // Return total height used
}

function renderSimpleText(ctx, item, x, currentY, maxWidth, margins, lineHeight, maxY) {
    // Set font properties
    const font = `${item.fontWeight} ${item.fontStyle} ${item.fontSize}px Arial`;
    ctx.font = font;
    ctx.fillStyle = '#333';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    // Handle different text types
    if (item.type === 'list') {
        return renderListItem(ctx, item, x, currentY, maxWidth, margins, lineHeight, maxY);
    } else {
        return renderRegularText(ctx, item, x, currentY, maxWidth, margins, lineHeight, maxY);
    }
}

function renderRegularText(ctx, item, x, currentY, maxWidth, margins, lineHeight, maxY) {
    const effectiveMaxWidth = maxWidth - margins.left - margins.right;
    const textX = x + margins.left;

    // Handle both string content and array content (inline formatting)
    if (Array.isArray(item.content)) {
        // For inline formatted content, we need to render each segment with its own formatting
        return renderInlineFormattedText(ctx, item, x, currentY, maxWidth, margins, lineHeight, maxY);
    } else {
        // For simple string content, wrap and render normally
        const lines = wrapTextForRendering(ctx, item.content, effectiveMaxWidth);

        lines.forEach(line => {
            if (currentY + lineHeight > maxY) return;

            ctx.fillText(line, textX, currentY);
            currentY += lineHeight;
        });

        return currentY;
    }
}

function renderListItem(ctx, item, x, currentY, maxWidth, margins, lineHeight, maxY) {
    const bulletX = x + margins.left;
    const textX = bulletX + 20;
    const effectiveMaxWidth = maxWidth - margins.left - margins.right - 20;

    // Draw bullet point
    ctx.fillText(item.bullet, bulletX, currentY);

    // Handle both string content and array content (inline formatting)
    if (Array.isArray(item.content)) {
        // For inline formatted content, render with formatting
        return renderInlineFormattedText(ctx, item, x, currentY, maxWidth, margins, lineHeight, maxY);
    } else {
        // For simple string content, wrap and render normally
        const lines = wrapTextForRendering(ctx, item.content, effectiveMaxWidth);

        lines.forEach((line) => {
            if (currentY + lineHeight > maxY) return;

            ctx.fillText(line, textX, currentY);
            currentY += lineHeight;
        });

        return currentY;
    }
}

function renderInlineFormattedText(ctx, item, x, currentY, maxWidth, margins, lineHeight, maxY) {
    const effectiveMaxWidth = maxWidth - margins.left - margins.right;
    let textX = x + margins.left;

    // Handle list items with inline formatting
    if (item.type === 'list') {
        const bulletX = x + margins.left;
        textX = bulletX + 20;

        // Draw bullet point
        ctx.font = `${item.fontWeight} ${item.fontStyle} ${item.fontSize}px Arial`;
        ctx.fillStyle = '#333';
        ctx.fillText(item.bullet, bulletX, currentY);
    }

    // Simplified approach: render each segment on the same line if possible
    const segments = item.content;
    let currentLineX = textX;
    let maxLineWidth = effectiveMaxWidth - (item.type === 'list' ? 20 : 0);

    // First, try to render all segments on one line
    let totalWidth = 0;
    segments.forEach(segment => {
        setFontForSegment(ctx, segment, item.fontSize);
        totalWidth += ctx.measureText(segment.text).width;
    });

    if (totalWidth <= maxLineWidth) {
        // All segments fit on one line
        segments.forEach(segment => {
            setFontForSegment(ctx, segment, item.fontSize);
            ctx.fillText(segment.text, currentLineX, currentY);
            currentLineX += ctx.measureText(segment.text).width;
        });
        return currentY + lineHeight;
    } else {
        // Need to wrap - fall back to simple text rendering
        const fullText = segments.map(segment => segment.text).join('');
        const lines = wrapTextForRendering(ctx, fullText, maxLineWidth);

        // Set font for the whole text block
        ctx.font = `${item.fontWeight} ${item.fontStyle} ${item.fontSize}px Arial`;
        ctx.fillStyle = '#333';

        lines.forEach(line => {
            if (currentY + lineHeight > maxY) return;

            ctx.fillText(line, textX, currentY);
            currentY += lineHeight;
        });

        return currentY;
    }
}



function setFontForSegment(ctx, segment, baseFontSize) {
    ctx.font = getFontForSegment(segment, baseFontSize);
    
    // Set color based on segment type
    if (segment.type === 'code') {
        ctx.fillStyle = '#d63384'; // Code color
    } else {
        ctx.fillStyle = '#333';
    }
}

function getFontForSegment(segment, baseFontSize) {
    let fontWeight = 'normal';
    let fontStyle = 'normal';
    let fontFamily = 'Arial';
    
    if (segment.type === 'bold') {
        fontWeight = 'bold';
    } else if (segment.type === 'italic') {
        fontStyle = 'italic';
    } else if (segment.type === 'code') {
        fontFamily = 'Monaco, Consolas, monospace';
    }
    
    return `${fontWeight} ${fontStyle} ${baseFontSize}px ${fontFamily}`;
}

function wrapTextForRendering(ctx, text, maxWidth) {
    if (!text) return [''];

    // Handle both string and array content
    let textToWrap = text;
    if (Array.isArray(text)) {
        // If it's an array of segments (inline formatting), join them for wrapping
        textToWrap = text.map(segment => segment.text).join('');
    }

    const words = textToWrap.split(' ');
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

    return lines.length > 0 ? lines : [''];
}
