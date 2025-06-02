# Development Plan: Infinite Canvas MVP

This plan outlines the development steps for the Minimum Viable Product (MVP) of the infinite canvas functionality, using vanilla HTML, CSS, JavaScript, and the native Canvas API.

## Phase 1: Basic Canvas Setup & Rendering
*   **Task 1.1: HTML Structure (`index.html`)**
    *   Create the main HTML file.
    *   Include a `<canvas>` element for drawing.
    *   Set up basic div containers for a floating toolbar and canvas navigation controls.
*   **Task 1.2: CSS Styling (`style.css`)**
    *   Basic styles for the page layout.
    *   Style the canvas container (e.g., border, dimensions).
    *   Initial placeholder styles for toolbar and control elements.
*   **Task 1.3: Canvas Initialization (`script.js`)**
    *   Get the 2D rendering context of the canvas.
    *   Set initial canvas dimensions (e.g., full window).
    *   Implement a core `draw()` function that will be responsible for rendering all elements on the canvas. This function will be called whenever the canvas needs to be updated.

## Phase 2: Node Management
*   **Task 2.1: Node Data Structure**
    *   Define a JavaScript class or object constructor for `Node`.
    *   Properties: `id` (unique), `text`, `x`, `y` (canvas coordinates), `width`, `height`, `isSelected`.
    *   Maintain an array (e.g., `nodes = []`) in `script.js` to store all node objects.
*   **Task 2.2: Node Creation & Basic Input**
    *   Implement a function `createNode(text, x, y)` that adds a new node object to the `nodes` array.
    *   Add an "Add Node" button to the floating toolbar.
    *   Clicking "Add Node" will initially create a node with default text at a default position or center of the current view.
*   **Task 2.3: Node Rendering**
    *   Implement `drawNode(node)` function that takes a node object and draws it on the canvas (e.g., a rectangle with text inside).
    *   The main `draw()` function will iterate through the `nodes` array and call `drawNode()` for each.
*   **Task 2.4: Node Selection**
    *   Implement click detection on nodes. When a node is clicked:
        *   Set its `isSelected` property to `true` (and others to `false`).
        *   Visually indicate selection (e.g., change border color or style).
*   **Task 2.5: Node Text Editing (Simple)**
    *   On double-clicking a node, allow the user to edit its text. This could be done by overlaying an HTML `<input>` or `<textarea>` over the node's position on the canvas.
    *   Update the node's `text` property and redraw the canvas.

## Phase 3: Canvas Interaction (Pan & Zoom)
*   **Task 3.1: Panning (Canvas Dragging)**
    *   Store current canvas offset (e.g., `offsetX`, `offsetY`).
    *   On mouse drag (mousedown + mousemove + mouseup) on the canvas background:
        *   Update `offsetX` and `offsetY`.
        *   Adjust node rendering coordinates based on this offset in the `drawNode()` function.
        *   Redraw the canvas.
*   **Task 3.2: Zooming**
    *   Store current zoom level (e.g., `scale`, default 1.0).
    *   Implement zoom using the mouse wheel or dedicated buttons.
    *   In the main `draw()` function, use `context.scale(scale, scale)` before drawing nodes and `context.translate(offsetX, offsetY)`.
    *   Adjust mouse coordinate calculations for selection and interaction to account for zoom and pan.
*   **Task 3.3: Node Dragging**
    *   If a mousedown occurs on a selected node:
        *   On mousemove, update the selected node's `x` and `y` properties.
        *   Ensure coordinates are adjusted for current pan/zoom.
        *   Redraw the canvas.

## Phase 4: UI Elements
*   **Task 4.1: Floating Toolbar**
    *   Create the HTML/CSS for a fixed-position toolbar.
    *   Buttons: "Add Node", "Generate AI".
*   **Task 4.2: Canvas Navigation Controls**
    *   HTML/CSS for zoom in, zoom out, and reset view buttons.
    *   Wire these buttons to the zoom and pan logic.

## Phase 5: AI Integration Placeholder
*   **Task 5.1: "Generate AI" Button**
    *   The "Generate AI" button on the toolbar.
    *   Initially, clicking this button (when a node is selected) could:
        *   Log a message to the console indicating AI generation would occur.
        *   Optionally, create a new, connected placeholder node (e.g., "AI Generated Node") linked to the selected node. The actual AI call and complex node generation logic will be a future task.

## Phase 6: Data Persistence & Export
*   **Task 6.1: Local Storage**
    *   Implement `saveToLocalStorage()`: Serializes the `nodes` array (and canvas pan/zoom state) to JSON and saves it to `localStorage`.
    *   Implement `loadFromLocalStorage()`: On page load, checks `localStorage` for saved data, parses it, and populates the `nodes` array and canvas state.
    *   Call `saveToLocalStorage()` after significant actions (node creation, move, edit, delete).
*   **Task 6.2: Export as JSON**
    *   Add an "Export JSON" button.
    *   Clicking it serializes the current `nodes` array to a JSON string and triggers a file download.

---

## Visualizing Component Interactions:

```mermaid
graph TD
    UserInterface["HTML/CSS (Toolbar, Buttons)"] -- User Clicks --> EventHandlers["JavaScript: Event Handlers (script.js)"]
    UserInterface -- Displays --> CanvasElement["HTML: <canvas>"]

    EventHandlers -- Manipulates --> CanvasState["JavaScript: Canvas State (script.js)<br>(nodes[], offsetX, offsetY, scale)"]
    EventHandlers -- Calls --> DrawingLogic["JavaScript: Drawing Logic (script.js)<br>(draw(), drawNode())"]
    EventHandlers -- Calls --> InteractionLogic["JavaScript: Interaction Logic (script.js)<br>(pan, zoom, dragNode, selectNode)"]
    EventHandlers -- Calls --> PersistenceLogic["JavaScript: Persistence Logic (script.js)<br>(saveToLocalStorage, loadFromLocalStorage, exportJSON)"]
    
    DrawingLogic -- Renders On --> CanvasRenderingContext["Canvas API: 2D Context"]
    InteractionLogic -- Updates --> CanvasState
    PersistenceLogic -- Reads/Writes --> BrowserLocalStorage["Browser: Local Storage"]
    
    CanvasRenderingContext -- Draws On --> CanvasElement

    subgraph "Core Canvas Logic (script.js)"
        CanvasState
        DrawingLogic
        InteractionLogic
        EventHandlers
        PersistenceLogic
    end

    AIButton["'Generate AI' Button"] -- Triggers --> AI_Placeholder["JavaScript: AI Placeholder Logic (script.js)"]
    AI_Placeholder -- Modifies --> CanvasState