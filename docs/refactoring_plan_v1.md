# Refactoring Plan: Modularizing `main.js` (Version 1)

**Goal:** Refactor the large `main.js` file into a few key ES6 modules to improve initial code organization, readability, and maintainability.

**Phase 1: Initial Module Split**

We will create a `src` directory to house the new modules. The initial split will result in the following structure:

1.  **`main.js` (Entry Point):**
    *   This file will be significantly reduced in size.
    *   **Responsibilities:**
        *   Import the main `InfiniteCanvas` class from `src/InfiniteCanvas.js`.
        *   Import global styles (e.g., `import './style.css';`).
        *   Initialize the `InfiniteCanvas` application on `DOMContentLoaded`.
    *   **Approximate Size:** Very small (5-10 lines).

2.  **`src/InfiniteCanvas.js` (Core Logic):**
    *   This will remain the primary class for the application.
    *   **Responsibilities:**
        *   Managing core application state (nodes, connections, canvas offset/scale, API key, base URL, selected items, drag states, history, etc.).
        *   Setting up primary event listeners (mouse, keyboard, window resize).
        *   Handling the logic for these events (e.g., `onMouseDown`, `onMouseMove`, `onMouseUp`, `onWheel`, `onDoubleClick`, `onKeyDown`).
        *   Managing node creation, selection, editing, and deletion (`createNode`, `selectNode`, `deleteNode`, `startEditingNode`, `finishEditingNode`).
        *   Managing connection creation (`createConnection`).
        *   Managing UI elements outside the canvas (API modal, notifications, toolbar button states) via methods like `setupAPIKeyUI`, `showApiKeyModal`, `saveApiConfig`, `updateGenerateAIButton`, `showNotification`, `updateUndoRedoButtons`.
        *   Handling history management (`saveState`, `undo`, `redo`, `restoreState`).
        *   Managing data persistence with LocalStorage (`saveToLocalStorage`, `loadFromLocalStorage`).
        *   Handling JSON export (`exportJSON`).
        *   Coordinating calls to `canvasRenderer.js` for drawing and `aiService.js` for AI operations.
    *   **Key Change:** Its `draw()` method will now primarily call functions imported from `canvasRenderer.js`. Its AI-triggering methods will call functions from `aiService.js`.
    *   **Approximate Size:** Still the largest module, but more focused.

3.  **`src/canvasRenderer.js` (Canvas Drawing Logic):**
    *   This module will contain all functions directly responsible for drawing onto the HTML5 canvas.
    *   **Responsibilities (exported functions):**
        *   `drawGrid(ctx, offsetX, offsetY, scale, canvasWidth, canvasHeight)`
        *   `drawNode(ctx, node)`
        *   `drawConnection(ctx, connection, nodesArray)`
        *   `drawArrowhead(ctx, x, y, angle)`
        *   `drawConnectionPreview(ctx, startNode, mouseCanvasX, mouseCanvasY, offsetX, offsetY, scale)`
        *   `drawResizeHandles(ctx, node)`
        *   `wrapText(ctx, text, maxWidth)`
    *   These functions will be pure or near-pure, taking the canvas context (`ctx`) and necessary data as parameters.
    *   **Approximate Size:** Medium, containing all rendering code.

4.  **`src/aiService.js` (AI API Interaction):**
    *   This module will encapsulate all logic related to interacting with AI APIs (OpenAI, OpenRouter, etc.).
    *   **Responsibilities (exported functions):**
        *   `generateAIIdeas(apiKey, baseURL, selectedNodeText)`: Handles constructing the prompt, making the API call, and processing the response to extract ideas. This function will return the generated ideas.
        *   `getProviderName(baseURL)`: Utility to determine the provider name from the base URL.
    *   The `InfiniteCanvas` class will import and use `generateAIIdeas` when the user triggers AI generation. The `InfiniteCanvas` class will then be responsible for creating nodes from the returned ideas.
    *   **Approximate Size:** Small to medium, focused on API communication.

**Refactoring Steps:**

1.  **Create `src` Directory:**
    *   In the project root, create a new directory named `src`.

2.  **Refactor `canvasRenderer.js`:**
    *   Create `src/canvasRenderer.js`.
    *   Identify and move all canvas drawing functions (`drawGrid`, `drawNode`, `drawConnection`, etc., including `wrapText`) from the current `InfiniteCanvas` class (in `main.js`) into `src/canvasRenderer.js`.
    *   Modify these functions to:
        *   Be `export`ed.
        *   Accept `ctx` (the 2D rendering context) as the first parameter.
        *   Accept other necessary data (e.g., `node` object, `scale`, `offsetX`, `offsetY`, `nodes` array) as parameters.
    *   In the `InfiniteCanvas` class (still in `main.js` for now):
        *   Import the drawing functions from `src/canvasRenderer.js`.
        *   Update the main `draw()` method and any other methods that perform drawing (e.g., `drawConnectionPreview` in `onMouseMove`) to call these imported functions, passing `this.ctx` and other required state.

3.  **Refactor `aiService.js`:**
    *   Create `src/aiService.js`.
    *   Move the core logic of the `generateAI()` method (API call, prompt construction, response parsing) and the `getProviderName()` method into `src/aiService.js`.
    *   Export a primary function, e.g., `async function generateAIIdeas(apiKey, baseURL, selectedNodeText)`. This function should return the array of generated idea strings.
    *   In the `InfiniteCanvas` class:
        *   Import `generateAIIdeas` and `getProviderName` from `src/aiService.js`.
        *   The existing `generateAI()` method in `InfiniteCanvas` will now:
            *   Handle UI aspects (button states, notifications for starting/errors).
            *   Call the imported `generateAIIdeas` function, passing `this.apiKey`, `this.baseURL`, and `this.selectedNode.text`.
            *   Receive the ideas and then proceed to create nodes and connections based on these ideas (this part remains in `InfiniteCanvas.js`).
        *   Update `saveApiConfig` and `updateGenerateAIButton` to use the imported `getProviderName`.

4.  **Create `src/InfiniteCanvas.js` and update `main.js` (entry point):**
    *   Rename the current `main.js` to `src/InfiniteCanvas.js`.
    *   Ensure the `InfiniteCanvas` class is `export default InfiniteCanvas;`.
    *   Create a new, minimal `main.js` in the project root:
        ```javascript
        // main.js
        import InfiniteCanvas from './src/InfiniteCanvas.js';
        import './style.css'; // For Vite to process CSS

        document.addEventListener('DOMContentLoaded', () => {
            window.canvasApp = new InfiniteCanvas();
            // console.log('Infinite Canvas Initialized with new structure');
        });
        ```
    *   Adjust paths in `index.html` to point to the new `main.js` (if not already done: `<script type="module" src="/main.js"></script>`).
    *   Adjust paths in `package.json`'s `main` field if necessary (though for Vite, `index.html` is the typical entry).

5.  **Testing and Verification:**
    *   After each major step (e.g., after creating `canvasRenderer.js` and updating `InfiniteCanvas.js` to use it), thoroughly test all related functionalities in the browser.
    *   Check for console errors.
    *   Verify drawing, node manipulation, AI generation, UI updates, history, and local storage.

**Mermaid Diagram of Planned Structure:**

```mermaid
graph TD
    RootMain[main.js (entry point)] -->|imports & instantiates| IC[src/InfiniteCanvas.js]

    IC -->|delegates drawing to| CR[src/canvasRenderer.js]
    IC -->|delegates AI calls to| AS[src/aiService.js]

    subgraph CoreAppLogic [src/InfiniteCanvas.js]
        direction LR
        StateManagement[State Management]
        EventHandling[Event Handling]
        NodeConnectionLogic[Node/Connection Logic]
        UILogic[UI Logic (Modals, Buttons)]
        HistoryPersistence[History & Persistence]
    end

    subgraph CanvasRenderingModule [src/canvasRenderer.js]
        direction TB
        DrawGrid[drawGrid()]
        DrawNode[drawNode()]
        DrawConnection[drawConnection()]
        WrapText[wrapText()]
        MoreDrawFuncs[...]
    end

    subgraph AIServiceModule [src/aiService.js]
        direction TB
        GenerateIdeas[generateAIIdeas()]
        GetProvider[getProviderName()]
    end
```

This plan provides a clear path to a more organized codebase as a first iteration.