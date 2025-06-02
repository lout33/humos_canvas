# Plan to Implement Contextual "Generate Ideas" Button

This document outlines the plan to implement a contextual "Generate Ideas" button that appears on a selected node in the Infinite Canvas application.

## 1. Modify `index.html`

*   **Action:** Remove the existing "Generate AI" button from the floating toolbar.
    *   **File:** [`index.html`](index.html:1)
    *   **Details:** Delete line 17: `<button id="generateAIBtn" class="toolbar-btn">Generate AI</button>`

## 2. Modify `src/canvasRenderer.js`

*   **Action:** Update the `drawNode` function to render the contextual button.
    *   **File:** [`src/canvasRenderer.js`](src/canvasRenderer.js:1)
    *   **Function:** [`drawNode`](src/canvasRenderer.js:56)
    *   **Details:**
        *   After drawing the node, check if `node.isSelected` is true.
        *   If true:
            *   Calculate button position: Centered horizontally, above the node's top edge (e.g., `node.y - buttonHeight - 5`).
            *   Define button dimensions (e.g., width: 100, height: 20).
            *   Draw the button background (e.g., a rounded rectangle with appropriate styling).
            *   Draw button text (e.g., "✨ Generate Ideas" or similar).
            *   Optional: Add a small pointer/triangle at the bottom of the button, pointing towards the node.

## 3. Modify `src/InfiniteCanvas.js`

*   **Action:** Remove the event listener for the old toolbar button and add logic for the new contextual button.
    *   **File:** [`src/InfiniteCanvas.js`](src/InfiniteCanvas.js:1)
    *   **Details:**
        *   **Remove Old Event Listener:**
            *   In the [`setupEventListeners`](src/InfiniteCanvas.js:213) method, remove the line that adds an event listener to `generateAIBtn` (previously `document.getElementById('generateAIBtn').addEventListener('click', () => this.generateAI());`).
        *   **Button Click Detection:**
            *   In the [`onMouseDown`](src/InfiniteCanvas.js:288) event handler:
                *   If `this.selectedNode` exists, check if the mouse click coordinates fall within the bounds of the newly drawn "Generate Ideas" button (relative to the `selectedNode`'s position).
        *   **Trigger AI Generation:**
            *   If the click is on the contextual "Generate Ideas" button:
                *   Call `this.generateAI(this.selectedNode)`.
                *   Ensure the existing API key check within [`generateAI`](src/InfiniteCanvas.js:687) (which shows the API key modal if not configured) remains functional.
                *   Prevent other default actions like node dragging.

## 4. Refinements & Considerations

*   **Visuals:** Ensure the button's appearance (colors, fonts, shape) is consistent with the application's overall UI design.
*   **Hover State (Optional Enhancement):** Consider implementing a hover state for the button in [`onMouseMove`](src/InfiniteCanvas.js:357) (e.g., change cursor to 'pointer', slightly alter button appearance). This would require redrawing on mouse move when a node is selected and the cursor is over the button area.
*   **Performance:** Be mindful of any performance implications, especially if implementing hover effects that require frequent canvas redraws.
*   **Accessibility:** As this is a canvas-drawn element, standard HTML accessibility features do not directly apply. Consider if alternative feedback mechanisms are necessary.

## Mermaid Diagram of Changes

```mermaid
graph TD
    subgraph HTML Changes
        A[index.html] --> B{Remove generateAIBtn};
    end

    subgraph Canvas Rendering
        C[User selects a Node] --> D{Node.isSelected = true};
        D -- In src/canvasRenderer.js --> E[drawNode function];
        E -- If selected --> F[Draw "Generate Ideas" button above Node];
    end

    subgraph Event Handling & Logic
        G[User clicks on Canvas] --> H[onMouseDown in src/InfiniteCanvas.js];
        H -- If selectedNode exists --> I{Click on contextual "Generate Ideas" button?};
        I -- Yes --> J[Call this.generateAI(selectedNode)];
        J -- If API key missing --> K[Show API Key Modal];
        I -- No --> L[Handle normal canvas/node interaction];
        M[src/InfiniteCanvas.js] --> N{Remove event listener for old generateAIBtn};
    end