// Lightweight markdown parser optimized for canvas rendering
// Supports: headers, bold, italic, lists, code, and paragraphs

export function parseMarkdown(text) {
    if (!text || typeof text !== 'string') {
        return [{ type: 'text', content: '', fontSize: 14, fontWeight: 'normal', fontStyle: 'normal' }];
    }

    const lines = text.split('\n');
    const parsed = [];
    
    lines.forEach((line, index) => {
        const trimmedLine = line.trim();
        
        // Skip empty lines but preserve spacing
        if (trimmedLine === '') {
            if (index < lines.length - 1) { // Don't add spacing for last empty line
                parsed.push({ type: 'spacing', content: '', fontSize: 8, fontWeight: 'normal', fontStyle: 'normal' });
            }
            return;
        }
        
        // Headers
        if (trimmedLine.startsWith('### ')) {
            parsed.push({ 
                type: 'header', 
                content: trimmedLine.slice(4), 
                fontSize: 16, 
                fontWeight: 'bold', 
                fontStyle: 'normal',
                level: 3
            });
        } else if (trimmedLine.startsWith('## ')) {
            parsed.push({ 
                type: 'header', 
                content: trimmedLine.slice(3), 
                fontSize: 18, 
                fontWeight: 'bold', 
                fontStyle: 'normal',
                level: 2
            });
        } else if (trimmedLine.startsWith('# ')) {
            parsed.push({ 
                type: 'header', 
                content: trimmedLine.slice(2), 
                fontSize: 20, 
                fontWeight: 'bold', 
                fontStyle: 'normal',
                level: 1
            });
        }
        // Lists
        else if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
            const content = trimmedLine.slice(2);
            const processedContent = processInlineFormatting(content);
            parsed.push({ 
                type: 'list', 
                content: processedContent, 
                fontSize: 14, 
                fontWeight: 'normal', 
                fontStyle: 'normal',
                bullet: '•'
            });
        }
        // Regular text with inline formatting
        else {
            const processedContent = processInlineFormatting(trimmedLine);
            parsed.push({ 
                type: 'text', 
                content: processedContent, 
                fontSize: 14, 
                fontWeight: 'normal', 
                fontStyle: 'normal'
            });
        }
    });
    
    return parsed.length > 0 ? parsed : [{ type: 'text', content: '', fontSize: 14, fontWeight: 'normal', fontStyle: 'normal' }];
}

// Process inline formatting like **bold**, *italic*, and `code`
function processInlineFormatting(text) {
    const segments = [];
    let currentIndex = 0;
    
    // Regex patterns for inline formatting
    const patterns = [
        { regex: /\*\*(.*?)\*\*/g, type: 'bold' },
        { regex: /\*(.*?)\*/g, type: 'italic' },
        { regex: /`(.*?)`/g, type: 'code' }
    ];
    
    // Find all matches and their positions
    const matches = [];
    patterns.forEach(pattern => {
        let match;
        const regex = new RegExp(pattern.regex.source, 'g');
        while ((match = regex.exec(text)) !== null) {
            matches.push({
                start: match.index,
                end: match.index + match[0].length,
                content: match[1],
                type: pattern.type,
                fullMatch: match[0]
            });
        }
    });
    
    // Sort matches by position
    matches.sort((a, b) => a.start - b.start);
    
    // Process text with formatting
    matches.forEach(match => {
        // Add text before the match
        if (currentIndex < match.start) {
            const beforeText = text.slice(currentIndex, match.start);
            if (beforeText) {
                segments.push({ text: beforeText, type: 'normal' });
            }
        }
        
        // Add the formatted text
        segments.push({ text: match.content, type: match.type });
        currentIndex = match.end;
    });
    
    // Add remaining text
    if (currentIndex < text.length) {
        const remainingText = text.slice(currentIndex);
        if (remainingText) {
            segments.push({ text: remainingText, type: 'normal' });
        }
    }
    
    // If no formatting found, return the original text
    if (segments.length === 0) {
        segments.push({ text: text, type: 'normal' });
    }
    
    return segments;
}

// Calculate the total height needed for rendered markdown content
export function calculateMarkdownHeight(ctx, text, maxWidth, margins = 16) {
    // Handle both old padding format and new margins object
    const marginConfig = typeof margins === 'object' ? margins : {
        top: margins / 2,
        bottom: margins / 2,
        left: margins / 2,
        right: margins / 2
    };

    const parsed = parseMarkdown(text);
    let totalHeight = marginConfig.top; // Top margin
    
    parsed.forEach(item => {
        if (item.type === 'spacing') {
            totalHeight += item.fontSize;
            return;
        }
        
        // Set font for measurement
        const font = `${item.fontWeight} ${item.fontStyle} ${item.fontSize}px Arial`;
        ctx.font = font;
        
        let lineHeight = item.fontSize + 4; // Base line height with spacing
        
        // Adjust line height for different types
        if (item.type === 'header') {
            lineHeight = item.fontSize + 8; // More spacing for headers
        } else if (item.type === 'list') {
            lineHeight = item.fontSize + 6; // Slightly more spacing for lists
        }
        
        if (Array.isArray(item.content)) {
            // Handle inline formatted content
            const fullText = item.content.map(segment => segment.text).join('');
            const wrappedLines = wrapTextForMarkdown(ctx, fullText, maxWidth - marginConfig.left - marginConfig.right, item);
            totalHeight += wrappedLines.length * lineHeight;
        } else {
            // Handle simple content
            const wrappedLines = wrapTextForMarkdown(ctx, item.content, maxWidth - marginConfig.left - marginConfig.right, item);
            totalHeight += wrappedLines.length * lineHeight;
        }
    });

    return Math.max(40, totalHeight + marginConfig.bottom); // Minimum height with bottom margin
}

// Enhanced text wrapping that considers formatting
function wrapTextForMarkdown(ctx, text, maxWidth, item) {
    if (!text) return [''];

    // Set the correct font for measurement
    const font = `${item.fontWeight} ${item.fontStyle} ${item.fontSize}px Arial`;
    ctx.font = font;

    const words = text.split(' ');
    const lines = [];
    let currentLine = '';

    // Account for list bullets
    const effectiveMaxWidth = item.type === 'list' ? maxWidth - 20 : maxWidth;

    words.forEach(word => {
        const testLine = currentLine + (currentLine ? ' ' : '') + word;
        const metrics = ctx.measureText(testLine);

        if (metrics.width > effectiveMaxWidth && currentLine) {
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
