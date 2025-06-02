// Canvas markdown renderer - renders parsed markdown to canvas
import { parseMarkdown } from './markdownParser.js';

export function renderMarkdownToCanvas(ctx, text, x, y, maxWidth, nodeHeight, padding = 16) {
    const parsed = parseMarkdown(text);
    let currentY = y + padding / 2;
    const maxY = y + nodeHeight - padding / 2;
    
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
            currentY = renderInlineFormattedText(ctx, item, x, currentY, maxWidth, padding, lineHeight, maxY);
        } else {
            // Handle simple content
            currentY = renderSimpleText(ctx, item, x, currentY, maxWidth, padding, lineHeight, maxY);
        }
    });
    
    // Restore context state
    ctx.restore();
    
    return currentY - y; // Return total height used
}

function renderSimpleText(ctx, item, x, currentY, maxWidth, padding, lineHeight, maxY) {
    // Set font properties
    const font = `${item.fontWeight} ${item.fontStyle} ${item.fontSize}px Arial`;
    ctx.font = font;
    ctx.fillStyle = '#333';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    
    // Handle different text types
    if (item.type === 'list') {
        return renderListItem(ctx, item, x, currentY, maxWidth, padding, lineHeight, maxY);
    } else {
        return renderRegularText(ctx, item, x, currentY, maxWidth, padding, lineHeight, maxY);
    }
}

function renderRegularText(ctx, item, x, currentY, maxWidth, padding, lineHeight, maxY) {
    const effectiveMaxWidth = maxWidth - padding;
    const lines = wrapTextForRendering(ctx, item.content, effectiveMaxWidth);
    
    lines.forEach(line => {
        if (currentY + lineHeight > maxY) return;
        
        const textX = x + padding / 2;
        ctx.fillText(line, textX, currentY);
        currentY += lineHeight;
    });
    
    return currentY;
}

function renderListItem(ctx, item, x, currentY, maxWidth, padding, lineHeight, maxY) {
    const bulletX = x + padding / 2;
    const textX = bulletX + 20;
    const effectiveMaxWidth = maxWidth - padding - 20;
    
    // Draw bullet point
    ctx.fillText(item.bullet, bulletX, currentY);
    
    // Draw list text
    const lines = wrapTextForRendering(ctx, item.content, effectiveMaxWidth);
    
    lines.forEach((line) => {
        if (currentY + lineHeight > maxY) return;
        
        ctx.fillText(line, textX, currentY);
        currentY += lineHeight;
    });
    
    return currentY;
}

function renderInlineFormattedText(ctx, item, x, currentY, maxWidth, padding, lineHeight, maxY) {
    const effectiveMaxWidth = maxWidth - padding;
    let textX = x + padding / 2;
    
    // Handle list items with inline formatting
    if (item.type === 'list') {
        const bulletX = x + padding / 2;
        textX = bulletX + 20;
        
        // Draw bullet point
        ctx.font = `${item.fontWeight} ${item.fontStyle} ${item.fontSize}px Arial`;
        ctx.fillStyle = '#333';
        ctx.fillText(item.bullet, bulletX, currentY);
    }
    
    // Render each formatted segment
    const segments = item.content;
    let lineText = '';
    let segmentIndex = 0;
    
    while (segmentIndex < segments.length && currentY + lineHeight <= maxY) {
        const segment = segments[segmentIndex];
        
        // Set font for this segment
        setFontForSegment(ctx, segment, item.fontSize);
        
        // Try to fit this segment on the current line
        const testText = lineText + segment.text;
        const metrics = ctx.measureText(testText);
        
        if (metrics.width <= effectiveMaxWidth - (item.type === 'list' ? 20 : 0)) {
            // Segment fits, add it to current line
            lineText += segment.text;
            segmentIndex++;
        } else {
            // Segment doesn't fit, render current line and start new one
            if (lineText) {
                renderFormattedLine(ctx, segments.slice(0, segmentIndex), textX, currentY, item.fontSize);
                currentY += lineHeight;
                lineText = '';
                
                // Reset to render remaining segments
                continue;
            } else {
                // Single segment is too long, break it
                const words = segment.text.split(' ');
                let wordIndex = 0;
                
                while (wordIndex < words.length && currentY + lineHeight <= maxY) {
                    let lineWords = [];
                    let testLine = '';
                    
                    while (wordIndex < words.length) {
                        const testWord = testLine + (testLine ? ' ' : '') + words[wordIndex];
                        ctx.font = getFontForSegment(segment, item.fontSize);
                        const metrics = ctx.measureText(testWord);
                        
                        if (metrics.width <= effectiveMaxWidth - (item.type === 'list' ? 20 : 0)) {
                            lineWords.push(words[wordIndex]);
                            testLine = testWord;
                            wordIndex++;
                        } else {
                            break;
                        }
                    }
                    
                    if (lineWords.length > 0) {
                        const lineSegment = { ...segment, text: lineWords.join(' ') };
                        renderFormattedLine(ctx, [lineSegment], textX, currentY, item.fontSize);
                        currentY += lineHeight;
                    } else {
                        // Even single word doesn't fit, force it
                        const lineSegment = { ...segment, text: words[wordIndex] };
                        renderFormattedLine(ctx, [lineSegment], textX, currentY, item.fontSize);
                        currentY += lineHeight;
                        wordIndex++;
                    }
                }
                
                segmentIndex++;
            }
        }
    }
    
    // Render any remaining text on the current line
    if (lineText && currentY + lineHeight <= maxY) {
        renderFormattedLine(ctx, segments.slice(0, segmentIndex), textX, currentY, item.fontSize);
        currentY += lineHeight;
    }
    
    return currentY;
}

function renderFormattedLine(ctx, segments, x, y, baseFontSize) {
    let currentX = x;
    
    segments.forEach(segment => {
        setFontForSegment(ctx, segment, baseFontSize);
        ctx.fillText(segment.text, currentX, y);
        currentX += ctx.measureText(segment.text).width;
    });
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
    
    return lines.length > 0 ? lines : [''];
}
