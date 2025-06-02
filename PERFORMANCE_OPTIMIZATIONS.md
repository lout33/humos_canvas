# Canvas Performance Optimizations

## Overview

This document outlines the performance optimizations implemented to make the infinite canvas handle thousands of nodes without lag. The optimizations focus on three main areas: **viewport culling**, **spatial indexing**, and **render throttling**.

## Key Performance Improvements

### 1. Spatial Hash Grid (O(1) Collision Detection)

**Problem**: The original `getNodeAtPoint()` method used linear search (O(n)), checking every node for mouse interactions.

**Solution**: Implemented a spatial hash grid that divides the canvas into cells and only checks nodes in relevant cells.

```javascript
// Spatial grid for fast collision detection
this.spatialGrid = new Map(); // Grid cell -> Set of nodes
this.gridSize = 200; // Grid cell size in canvas units

// Fast O(1) average case lookup
getNodeAtPointOptimized(x, y) {
    const key = this.getGridKey(x, y);
    const candidates = this.spatialGrid.get(key);
    // Only check nodes in the same grid cell
}
```

**Performance Gain**: O(n) → O(1) average case for collision detection

### 2. Viewport Culling (Only Render Visible Nodes)

**Problem**: All nodes were rendered every frame, even if off-screen.

**Solution**: Only render nodes that are visible in the current viewport.

```javascript
// Calculate viewport bounds
getViewportBounds() {
    const left = -this.offsetX / this.scale;
    const top = -this.offsetY / this.scale;
    const right = left + this.canvas.width / this.scale;
    const bottom = top + this.canvas.height / this.scale;
    return { left, top, right, bottom };
}

// Only render visible nodes
this.visibleNodes.forEach(node => drawNode(this.ctx, node));
```

**Performance Gain**: Rendering scales with viewport size, not total node count

### 3. Render Throttling & Dirty Tracking

**Problem**: Canvas was redrawn on every mouse move and interaction.

**Solution**: Implemented dirty tracking and frame-rate limited rendering.

```javascript
// Mark canvas as dirty instead of immediate redraw
markDirty() {
    this.isDirty = true;
    this.requestRender();
}

// Throttled render at 60 FPS
requestRender() {
    if (this.renderThrottleId) return;
    
    this.renderThrottleId = requestAnimationFrame(() => {
        const now = performance.now();
        if (now - this.lastRenderTime >= this.frameTime) {
            this.draw();
            this.lastRenderTime = now;
        }
        this.renderThrottleId = null;
    });
}
```

**Performance Gain**: Eliminates unnecessary redraws, maintains smooth 60 FPS

### 4. Optimized Connection Rendering

**Problem**: All connections were rendered even if nodes were off-screen.

**Solution**: Only render connections where at least one endpoint is visible.

```javascript
// Filter connections to only visible ones
const visibleNodeIds = new Set(Array.from(this.visibleNodes).map(n => n.id));
const visibleConnections = this.connections.filter(connection => 
    visibleNodeIds.has(connection.from) || visibleNodeIds.has(connection.to)
);
```

## Implementation Details

### Spatial Grid Management

- **Grid Size**: 200px cells (configurable)
- **Dynamic Updates**: Nodes are added/removed from grid when moved or deleted
- **Multi-cell Support**: Large nodes can occupy multiple grid cells
- **Automatic Rebuilding**: Grid is rebuilt when loading data or restoring state

### Viewport Culling Strategy

- **Margin Buffer**: Could be extended to include a small margin around viewport for smoother scrolling
- **Connection Optimization**: Connections are culled based on endpoint visibility
- **Selection Handling**: Selected nodes are always considered for rendering

### Performance Monitoring

The `performance-test.html` file provides tools to:
- Create large numbers of nodes (100, 500, 1000+)
- Monitor FPS and render times
- Test collision detection performance
- Measure viewport culling efficiency

## Expected Performance Gains

| Scenario | Before | After | Improvement |
|----------|--------|-------|-------------|
| 1000 nodes - Mouse hover | ~5 FPS | ~60 FPS | 12x faster |
| 5000 nodes - Panning | ~1 FPS | ~60 FPS | 60x faster |
| Collision detection | O(n) | O(1) | n times faster |
| Off-screen nodes | Always rendered | Not rendered | Massive savings |

## Usage Notes

### Automatic Optimization

The optimizations are transparent to existing code:
- `getNodeAtPoint()` automatically uses spatial grid when available
- `draw()` calls are replaced with `markDirty()` for better performance
- Spatial grid is automatically maintained during node operations

### Fallback Behavior

- If spatial grid is empty, falls back to linear search
- Graceful degradation ensures compatibility
- No breaking changes to existing API

### Memory Usage

- Spatial grid uses minimal additional memory
- Grid cells are created on-demand and cleaned up when empty
- Visible nodes cache is lightweight (Set of references)

## Testing Performance

1. Open `performance-test.html` in a browser
2. Click "Add 1000 Nodes" to create a large canvas
3. Test panning, zooming, and mouse interactions
4. Monitor FPS and render times in the stats panel
5. Use "Performance Test" button for detailed benchmarks

## Future Optimizations

Potential additional improvements:
- **Level of Detail (LOD)**: Render simplified nodes when zoomed out
- **Occlusion Culling**: Skip nodes completely hidden behind others
- **Batch Rendering**: Group similar rendering operations
- **Web Workers**: Move heavy calculations off main thread
- **Canvas Layers**: Separate static and dynamic content
