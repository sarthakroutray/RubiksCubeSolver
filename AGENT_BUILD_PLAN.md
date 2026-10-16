# AGENT_BUILD_PLAN.md — 3D 2x2 Pocket Cube Heuristic Search Visualizer (A* / IDA* / Best-FS)

## 0. Meta-Instructions for the Coding Agent (Orchestrator)

You are an autonomous software engineering agent tasked with building a **3D 2x2 Pocket Cube Heuristic Search Visualizer** for an Artificial Intelligence & Soft Computing academic project. 

The application itself is a clean, deterministic client-side web application (Vite + Vanilla TypeScript/JavaScript + Three.js + D3.js/HTML5 Canvas). **Your development workflow must be strictly modular and agentic:** execute the build in the 5 isolated **Agent Workstreams** defined below, verifying each stage via its **Verification Gate** before proceeding to the next.

### Tech Stack & Architecture Constraints
* **Bundler:** Vite (Vanilla JS/TS template, zero backend required).
* **3D Rendering:** `three` + `OrbitControls` (for interactive 3D camera) + custom quaternion/pivot-group slerp animation queue.
* **Algorithm Execution:** Web Worker (`solver.worker.js`) OR async generator yielding search telemetry frames so the UI and 3D canvas never freeze during state-space exploration.
* **Search Tree Visualization:** HTML5 Canvas / SVG split-screen panel rendering the live Search Tree (Open Set vs. Closed Set, node values $f(n) = g(n) + h(n)$).

---

## 1. Shared Data Contracts (`src/types/contracts.js`)

All coding sub-agents MUST adhere to these exact data structures to prevent integration mismatches.

### 1.1 The 24-Sticker State Array & Face Indexing
Represent the $2 \times 2$ cube as a flat `Uint8Array(24)` or `Array(24)` of face colors (`0: U (White)`, `1: R (Red)`, `2: F (Green)`, `3: D (Yellow)`, `4: L (Orange)`, `5: B (Blue)`).
* **Solved State:** `[0,0,0,0, 1,1,1,1, 2,2,2,2, 3,3,3,3, 4,4,4,4, 5,5,5,5]`
* **Action Space (9 Quarter/Half Turns):**
  By fixing the **DBL (Down-Back-Left)** corner in place, you eliminate whole-cube rotational symmetries and reduce the branching factor to strictly 3 faces: **U (Up)**, **R (Right)**, and **F (Front)**.
  * Valid moves: `["U", "U'", "U2", "R", "R'", "R2", "F", "F'", "F2"]`

### 1.2 Search Telemetry Frame (Emitted by Solver to Visualizer)
```json
{
  "step": 42,
  "algorithm": "A*",
  "currentNode": {
    "id": "state_hash_string",
    "parentId": "parent_hash_string",
    "moveFromParent": "R'",
    "path": ["U", "F2", "R'"],
    "state": [0,0,1,1, ...],
    "g": 3,
    "h": 1.25,
    "f": 4.25
  },
  "openSetCount": 118,
  "closedSetCount": 42,
  "openTopNodes": [
    { "id": "...", "move": "U2", "g": 3, "h": 1.5, "f": 4.5 }
  ],
  "isGoal": false
}
```

---

## 2. Agentic Development Workstreams (Execution Plan)

Execute these 5 sub-agent roles sequentially (or in parallel once `contracts.js` is initialized).

---

### Sub-Agent 1: Core Cube State & Permutation Engine
* **Target Files:** `src/core/CubeState.js`, `src/core/constants.js`
* **Objective:** Implement a rock-solid, zero-dependency mathematical model of the $2 \times 2$ Pocket Cube.
* **Implementation Requirements:**
  1. Define the 8 corner cubies by their 3 sticker indices:
     * `0 (UFL): [2, 8, 17]` | `1 (UFR): [3, 9, 4]` | `2 (UBR): [1, 5, 20]` | `3 (UBL): [0, 21, 16]`
     * `4 (DFL): [12, 19, 10]` | `5 (DFR): [13, 11, 6]` | `6 (DBR): [15, 7, 22]` | `7 (DBL - Fixed): [14, 23, 18]`
  2. Implement exact index cycles for the 3 base clockwise moves (`U`, `R`, `F`):
     * **`U` (Top Layer CW):** Face `[0->1->3->2->0]`, Sides `[8,9]->[16,17]->[20,21]->[4,5]->[8,9]`
     * **`R` (Right Layer CW):** Face `[4->5->7->6->4]`, Sides `[1,3]->[20,22(inv)]->[13,15]->[9,11]->[1,3]` *(Wait: ensure 3D Cubie coordinate verification matches array permutation—see Verification Gate 1).*
     * **`F` (Front Layer CW):** Face `[8->9->11->10->8]`, Sides `[2,3]->[4,6]->[13,12]->[19,17]->[2,3]`
  3. Derive inverse moves (`U'`, `R'`, `F'`) by applying the CW cycle 3 times, and double moves (`U2`, `R2`, `F2`) by applying it 2 times.
  4. Implement `scramble(depth = 7)` that picks non-redundant random moves (never picking the same face twice in a row, e.g., no `U` followed by `U'`) and returns `{ state, scrambleMoves }`.
* **Verification Gate 1 (Self-Test Script):**
  * Run a unit test before moving to Agent 2:
    * Applying `U` 4 times on a solved state MUST equal the solved state.
    * Applying the sexy move `(R U R' U')` 6 times MUST return the cube to the exact solved state.
    * Applying a 10-move sequence followed by its exact inverse sequence MUST return `isSolved() === true`.

---

### Sub-Agent 2: Heuristic Search & Soft Computing Engine
* **Target Files:** `src/solver/heuristics.js`, `src/solver/SearchEngine.js`
* **Objective:** Implement **A\* Search**, **Iterative Deepening A\* (IDA\*)**, and **Greedy Best-First Search** with selectable heuristics and step-by-step telemetry yielding.
* **Implementation Requirements:**
  1. **Admissible Heuristic 1 — Sticker / Cubie Misplacement ($h_1$):**
     * Count how many stickers (out of 24) do not match their solved face color, divided by `12` (since 1 move shifts 12 stickers):
       $$h_1(n) = \frac{\text{Misplaced Stickers}}{12}$$
     * Or count how many of the 7 movable corner cubies are not in their home position/orientation, divided by `4`:
       $$h_{\text{cubie}}(n) = \frac{\text{Misplaced or Twisted Corners}}{4}$$
  2. **Admissible Heuristic 2 — 3D Manhattan Corner Distance ($h_2$):**
     * For each of the 7 movable corners, compute the minimum number of quarter-turns ($0, 1,$ or $2$) needed to place it into its home $(x, y, z)$ slot, sum across all 7 corners, and divide by $4$:
       $$h_2(n) = \frac{1}{4} \sum_{i=0}^{6} \text{dist}(\text{corner}_i, \text{goal}_i)$$
  3. **Search Algorithms (Generator Functions `function* solve(...)`):**
     * Use JavaScript Generator Functions (`yield telemetryFrame`) so the main UI can either step through the algorithm frame-by-frame at custom speeds (e.g., 10 nodes/sec) or run at full speed to completion.
     * **A\* Search:** Priority Queue ordered by $f(n) = g(n) + h(n)$. Maintain a `closedSet` (`Set` of state strings) and `gScore` map.
     * **Greedy Best-First Search:** Priority Queue ordered strictly by $f(n) = h(n)$ (demonstrates faster greedy exploration vs. sub-optimal path lengths for academic comparison).
     * **IDA\* Search:** Depth-first iterative threshold search where threshold starts at $h(\text{start})$ and increases to the minimum $f(n)$ that exceeded the previous threshold.
* **Verification Gate 2:**
  * Run a headless benchmark test on a 6-move scramble:
    * A\* with $h_2$ must find a solution of length $\le 6$ in under 500ms.
    * Verify that every move in the returned solution array, when applied to the scrambled state, results in `isSolved() === true`.

---

### Sub-Agent 3: Three.js 3D Interactive Pocket Cube & Pivot Animator
* **Target Files:** `src/three/CubeScene.js`, `src/three/CubieMesh.js`, `src/three/MoveAnimator.js`
* **Objective:** Build a sleek, glossy 3D $2 \times 2$ Pocket Cube using Three.js with smooth easing animations for face rotations and ghost-preview overlays during algorithm search.
* **Implementation Requirements:**
  1. **Scene Setup:**
     * Dark studio environment (`#0f172a` background), `PerspectiveCamera`, `OrbitControls` with damping enabled, ambient + directional studio lighting.
  2. **Cubie Construction:**
     * Create 8 separate `THREE.Group` or `THREE.Mesh` cubies positioned at $(x, y, z) \in \{-0.52, +0.52\}^3$.
     * Each cubie has a rounded dark-plastic core box and 3 colored sticker planes slightly offset (`0.01`) on its outer faces.
  3. **The Pivot Group Rotation Trick (Critical for Bug-Free Three.js Rubik's Cubes):**
     * Never hardcode Euler angle additions directly on individual cubies (causes gimbal lock).
     * To animate a move (e.g., `U` rotates all cubies with $y > 0$ around the Y-axis by $-90^\circ$):
       1. Create a temporary `pivot = new THREE.Group()` at `(0,0,0)`.
       2. Find the 4 cubies belonging to the target face (e.g., `cubie.position.y > 0.1`).
       3. Attach those 4 cubies to `pivot` using `pivot.attach(cubie)`.
       4. Animate `pivot.rotation[axis]` from `0` to `targetAngle` over `durationMs` using cubic ease-in-out.
       5. On animation complete, re-attach the 4 cubies back to `scene` via `scene.attach(cubie)` and round `cubie.position` to 2 decimal places to prevent floating-point drift.
  4. **Search Preview Mode ("Ghost State" Sync):**
     * Add a method `syncToStateArray(state24)` that instantly snaps the 3D sticker colors to match whatever node the A\* algorithm is currently inspecting during slow-motion visualization.
* **Verification Gate 3:**
  * Ensure that syncing the 3D scene and executing `U`, `R`, `F` via the 3D `MoveAnimator` matches the colors of `CubeState.js` 100% of the time without visual tearing or misaligned cubies.

---

### Sub-Agent 4: Real-Time Algorithm Telemetry & Search Tree Visualizer
* **Target Files:** `src/visualizer/SearchTreeCanvas.js`, `src/visualizer/MetricsDashboard.js`
* **Objective:** Make the AI & Soft Computing internals visibly clear while the algorithm is thinking.
* **Implementation Requirements:**
  1. **Live Search Tree Graph (Right Panel):**
     * Render an interactive 2D hierarchical tree on an HTML5 Canvas or SVG.
     * **Root Node:** Scrambled state ($g=0$).
     * **Color Coding:**
       * **Closed Set (Expanded Nodes):** Indigo (`#6366f1`)
       * **Current Node Being Evaluated:** Pulsing Cyan (`#06b6d4`)
       * **Open Set Frontier (Top Candidates):** Amber (`#f59e0b`)
       * **Final Optimal Solution Path:** Emerald Green (`#10b981`) with thickened connecting edges.
     * Each node badge displays the move name (`U`, `R'`, `F2`) and its cost breakdown `f = g + h`.
  2. **Live Heuristic & Cost Telemetry Cards:**
     * Real-time counters for:
       * `Nodes Expanded (Closed List Size)`
       * `Frontier Size (Open List Size)`
       * `Current Depth g(n)`, `Heuristic Estimate h(n)`, `Total Priority f(n)`
       * `Effective Branching Factor`
  3. **Interactive Node Inspector:**
     * Clicking any node in the 2D Search Tree immediately previews that exact cube configuration on the 3D Three.js cube.

---

### Sub-Agent 5: Master Controller & Academic Comparison UI
* **Target Files:** `src/main.js`, `index.html`, `src/styles/main.css`
* **Objective:** Wire the 3D Scene, the Search Generator, and the Telemetry Tree into a responsive dashboard with playback controls.
* **Implementation Requirements:**
  1. **Layout:**
     * **Left 55% Viewport:** Interactive 3D Three.js Pocket Cube + Manual Move Buttons (`U`, `U'`, `U2`, `R`, `R'`, `R2`, `F`, `F'`, `F2`) + Move Tape Ribbon at the bottom showing the solution sequence step-by-step as it executes.
     * **Right 45% Viewport:** Algorithm Control Bar + Telemetry Metrics Cards + Live Search Tree Canvas.
  2. **Playback & Speed Controls:**
     * **Scramble Controls:** `Scramble (5 Moves)`, `Scramble (7 Moves)`, `Custom Move Input`.
     * **Algorithm Selector:** `A* Search`, `IDA* Search`, `Greedy Best-First Search`.
     * **Heuristic Selector:** `3D Manhattan Corner Distance (h2)`, `Misplaced Stickers / 12 (h1)`, `Zero Heuristic / BFS (h=0)`.
     * **Execution Mode:**
       * `Watch Live Search (Step-by-Step)`: Animates the search tree expanding in real time and updates the 3D cube to show each candidate state being tested, then plays back the winning solution smoothly.
       * `Instant Solve + 3D Playback`: Solves in $<50\text{ms}$, highlights the winning branch in the tree, and smoothly animates the 3D rotations one by one.
       * `Speed Slider`: `0.25x` to `10x` search & rotation speed.

---

## 3. Step-by-Step Execution Checklist for the Coding Agent

When you start executing this file, follow this strict order:
- [ ] **Step 1:** Initialize project (`npm create vite@latest . -- --template vanilla` and `npm install three`).
- [ ] **Step 2:** Create `src/core/CubeState.js` and run a Node test script (`node test-cube.js`) to verify that move permutations and corner coordinates are 100% consistent. **Do not write UI code until this test passes.**
- [ ] **Step 3:** Create `src/solver/heuristics.js` and `src/solver/SearchEngine.js`. Run a Node test script (`node test-solver.js`) verifying that A\*, IDA\*, and Greedy Best-FS solve a 6-move scramble accurately and emit valid telemetry frames.
- [ ] **Step 4:** Build the Three.js scene (`src/three/CubeScene.js` & `MoveAnimator.js`) with `OrbitControls` and pivot-based quaternion/axis animation.
- [ ] **Step 5:** Build the 2D Search Tree Canvas (`src/visualizer/SearchTreeCanvas.js`) and connect the generator playback loop in `src/main.js`.
- [ ] **Step 6:** Start the dev server, verify zero console errors, and test a full scramble-to-solve cycle across all 3 algorithms.
