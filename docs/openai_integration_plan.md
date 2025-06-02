# Plan: OpenAI Integration & Vite Setup for Infinite Canvas

This document outlines the plan to integrate OpenAI API functionality for generating connected node ideas and to restructure the project using Vite for better development workflow and dependency management.

**User Goal:** Integrate OpenAI to generate ideas for connected nodes, prompt user for API key. Introduce `package.json` and Vite.

## Phase 1: Project Setup & Refactoring with Vite

1.  **Initialize `package.json`**:
    *   Purpose: Manage project dependencies (Vite, OpenAI library).
    *   Action: Run `npm init -y` (or similar) in the project root.
2.  **Install Vite**:
    *   Purpose: Modern build setup, fast development server.
    *   Action: Run `npm install --save-dev vite`.
3.  **Restructure Project for Vite**:
    *   Move [`index.html`](index.html) to the project root (if not already there, or Vite's default expected location).
    *   Create a `main.js` file (e.g., in the root or a `src` directory).
    *   Transfer JavaScript code from the current [`script.js`](script.js) into `main.js`.
    *   Update [`index.html`](index.html) to load `main.js` as a module: `<script type="module" src="/main.js"></script>` (adjust path if `main.js` is in a subdirectory like `src`).
    *   Ensure [`style.css`](style.css) is correctly linked in [`index.html`](index.html) (Vite might handle CSS imports differently, e.g., importing CSS in `main.js`).
4.  **Adapt `InfiniteCanvas` Class**:
    *   Ensure the `InfiniteCanvas` class in `main.js` is correctly exported if needed and instantiated (e.g., `new InfiniteCanvas();` at the end of `main.js` or in a dedicated entry point script).
5.  **Add Vite Scripts to `package.json`**:
    *   In `package.json`, add:
        ```json
        "scripts": {
          "dev": "vite",
          "build": "vite build",
          "preview": "vite preview"
        }
        ```
6.  **Test Vite Setup**:
    *   Run `npm run dev` to start the Vite development server.
    *   Verify the application functions as it did before the restructuring.

## Phase 2: OpenAI Integration - Generating Ideas for Connected Nodes

1.  **API Key Management (User Prompt)**:
    *   **UI**: Add an input field and a "Save API Key" button (e.g., in the existing toolbar or a settings modal).
    *   **Storage**: Store the key in a variable within the `InfiniteCanvas` instance (e.g., `this.apiKey = null;`). Consider persisting it to `localStorage` so the user doesn't have to enter it every session.
    *   **Logic**: When the "Generate AI Ideas" feature is triggered, check if `this.apiKey` is set. If not, prompt the user (e.g., by showing the API key input section).
2.  **Install OpenAI Library (Recommended)**:
    *   Purpose: Simplify API interactions.
    *   Action: Run `npm install openai`.
3.  **UI for Triggering AI Idea Generation**:
    *   The existing "Generate AI" button ([`generateAIBtn`](script.js:63)) can be repurposed.
    *   This action should ideally be enabled only when a node is selected.
4.  **Implement AI Idea Generation Logic**:
    *   Modify the [`generateAI()`](script.js:770) method or create a new one like `generateConnectedNodeIdeas()`.
    *   **Input**: This method should take the currently selected node as input.
    *   **Prompt Construction**: Create a prompt for the OpenAI API. Example: "The central idea is: '[text of selected node]'. Generate 3-5 related concepts or sub-topics that could branch off from this central idea. Present each concept on a new line. Be concise."
    *   **API Call**:
        *   Import and initialize the `OpenAI` client from the `openai` library using the user-provided API key.
        *   Make a call to the Chat Completions endpoint (e.g., using `gpt-3.5-turbo` or a newer suitable model).
        *   Example (conceptual):
            ```javascript
            // Inside InfiniteCanvas class
            // async generateConnectedNodeIdeas() {
            //   if (!this.selectedNode) return;
            //   if (!this.apiKey) { /* prompt for key */ return; }
            //
            //   const openai = new OpenAI({ apiKey: this.apiKey, dangerouslyAllowBrowser: true }); // Note: dangerouslyAllowBrowser for client-side
            //   const prompt = `...`; // Construct prompt
            //
            //   try {
            //     const completion = await openai.chat.completions.create({
            //       model: "gpt-3.5-turbo",
            //       messages: [{ role: "user", content: prompt }],
            //     });
            //     const ideasText = completion.choices[0].message.content;
            //     const ideas = ideasText.split('\n').filter(idea => idea.trim() !== '');
            //     // ... create nodes from ideas
            //   } catch (error) {
            //     console.error("Error calling OpenAI:", error);
            //     // Show error to user
            //   }
            // }
            ```
    *   **Response Handling**:
        *   Parse the generated ideas from the API response (e.g., split by newline).
        *   For each idea, call [`createNode()`](script.js:88) to add it to the canvas. Position these new nodes thoughtfully around the source node.
        *   Optionally, automatically use [`createConnection()`](script.js:662) to link the source node to these new idea nodes.
5.  **User Feedback & Error Handling**:
    *   Display a visual loading indicator (e.g., on the "Generate AI Ideas" button or near the selected node) while waiting for the API response.
    *   Provide clear error messages to the user if the API key is missing/invalid, or if the API call fails for other reasons (e.g., network issue, API error).
    *   Ensure the canvas updates smoothly with the new nodes and connections.

## Phase 3: Code Robustness & Refinements (Future Considerations)

1.  **Modularization**:
    *   As `main.js` (formerly [`script.js`](script.js)) grows, consider splitting logic into smaller, more focused ES6 modules (e.g., `openaiService.js` for API interactions, `uiManager.js` for DOM manipulations, `canvasRenderer.js` for drawing logic).
2.  **Clearer Separation of Concerns**:
    *   Continue to ensure that UI logic, canvas rendering logic, state management, and API interactions are as distinct and decoupled as possible.
3.  **State Management**:
    *   For more complex applications, consider a more formal state management pattern or library if `this.nodes`, `this.connections`, etc., become difficult to manage directly.
4.  **Configuration**:
    *   If more configuration options are added, centralize them.

## Workflow Diagram (Mermaid)

```mermaid
graph TD
    A[User selects a node] --> B(User clicks "Generate AI Ideas" button);
    B --> C{API Key available?};
    C -- No --> D[Prompt user for API Key];
    D --> E[User enters API Key & Saves];
    E --> F[Store API Key (e.g., in instance/localStorage)];
    F --> G_CheckNode[Node selected?];
    C -- Yes --> G_CheckNode;
    G_CheckNode -- Yes --> G[Get selected node's text];
    G_CheckNode -- No --> X[End/Show message: Select a node];
    G --> H[Construct prompt for OpenAI];
    H --> I[Show loading indicator];
    I --> J[Call OpenAI API with prompt and key];
    J --> K{API Call Successful?};
    K -- Yes --> L[Parse ideas from response];
    L --> M[For each idea: Create new node near selected node];
    M --> N[Optionally: Create connections to new nodes];
    N --> O[Hide loading indicator, redraw canvas];
    K -- No --> P[Hide loading indicator, show error message to user];
```

This plan provides a structured approach to achieving the desired enhancements.