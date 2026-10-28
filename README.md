# 🧊 3D Pocket Cube (2×2) Heuristic Search Visualizer

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16.4.2-black?style=for-the-badge&logo=next.js&logoColor=white" alt="Next.js" />
  <img src="https://img.shields.io/badge/React-19.3.1-61dafb?style=for-the-badge&logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/Three.js-0.180.0-049ef4?style=for-the-badge&logo=threedotjs&logoColor=white" alt="Three.js" />
  <img src="https://img.shields.io/badge/Tests-Passing_4_Gates-emerald?style=for-the-badge&logo=checkmarx&logoColor=white" alt="Tests" />
  <img src="https://img.shields.io/badge/Node.js-%3E=18.17.0-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node" />
  <img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" alt="License" />
</p>

<p align="center">
  <b>An interactive 3D WebGL laboratory and academic benchmarking suite for informed heuristic search on the 2×2 Pocket Cube.</b><br/>
  Explores state-space search algorithms (<b>A*</b>, <b>IDA*</b>, <b>Greedy Best-First</b>, and <b>BFS</b>) in real time, synchronizing physical 3D cube rotations with an interactive 2D search tree canvas, and features an interactive <b>"Solve My Cube"</b> physical cube scanner and step-by-step 3D solver.
</p>

<p align="center">
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-solve-my-cube-feature">Solve My Cube</a> •
  <a href="#-mathematical-formulation">Mathematical Formulation</a> •
  <a href="#-heuristic-search-algorithms">Search Algorithms</a> •
  <a href="#-heuristics--admissibility-proofs">Heuristic Proofs</a> •
  <a href="#-software-architecture">Architecture</a> •
  <a href="#-extensibility-how-to-add-a-new-solver">Add New Solver</a> •
  <a href="#-verification-test-gates">Test Gates</a> •
  <a href="#-keyboard-shortcuts">Controls</a>
</p>

---

## ⚡ Highlights

* 🎮 **Interactive 3D WebGL Studio** — Photorealistic 2×2 Pocket Cube built with Three.js, complete with studio lighting, micro-beveled cubies, glossy decals, and drift-free pivot-group rotation mechanics.
* 🧩 **"Solve My Cube" Custom Solver** — Paint your physical scrambled cube in 3D or on a 2D unfolded cross net (with optional webcam/photo assist), validate physical feasibility, normalize orientation, and follow animated graphical step cards.
* 🧠 **Real-Time Heuristic Search** — Watch **A\***, **IDA\***, and **Greedy Best-First Search** traverse millions of permutations using admissible heuristics ($h_2$ Manhattan distance, $h_1$ misplaced stickers, and $h_0$ BFS).
* 🌳 **Interactive 2D Search Tree** — Real-time high-DPI HTML5 Canvas rendering of the expansion graph. Click any node badge in the graph to preview that exact configuration on the 3D cube!
* ⏱ **Non-Blocking Telemetry Web Worker** — Asynchronous Web Worker and ES6 generator architecture emits node-by-node search metrics without freezing the browser thread.
* 📐 **Group Theory & Symmetry Reduction** — Pins the Down-Back-Left (DBL) corner piece to eliminate whole-cube rotational symmetries, pruning branching factor and guaranteeing canonical representations.
* 🛡 **Automated 4-Gate Test Suite** — Headless Node.js unit tests verifying permutation group theory, heuristic admissibility bounds, solver optimality, 3D mesh synchronization, and Solve My Cube validation.

---

## 🚀 Quick Start

### Prerequisites
* **Node.js** `v18.17.0` or higher (`v20+` recommended)
* **npm** `v9.0.0` or higher

```bash
# 1. Clone the repository
git clone https://github.com/your-username/RubiksCubeSolver.git
cd RubiksCubeSolver

# 2. Install dependencies
npm install

# 3. Launch local development server
npm run dev
```

Open your browser and navigate to **`http://localhost:3000`**.

### Production Build

```bash
# Compile optimized Next.js bundle
npm run build

# Start production server
npm run start
```

---

## 🧩 "Solve My Cube" Feature

The "Solve My Cube" mode allows users to input their physical 2×2 cube's colors, validate feasibility, and follow step-by-step 3D solution cards.

### 1. Dual Color Input
* **Interactive 3D Painter:** Click any color from the 6-color palette (White, Yellow, Red, Orange, Green, Blue) and click directly on the 3D cube stickers to paint. Supports full 3D orbital camera rotation.
* **Synchronized 2D Net View:** An unfolded cross net (U on top, L F R B in the middle row, D below) with click-and-drag painting and undo/redo stacks.
* **Photo / Camera Assist:** Capture faces using a webcam or upload images; automatic HSV color classification auto-populates the 4 quadrants per face with interactive review before applying.
* **Color-Blind Accessibility:** Toggle letter overlays (`W`, `Y`, `R`, `O`, `G`, `B`) directly on stickers.

### 2. Graphical Step-By-Step Solution Viewer
* **Graphical Step Cards:** Each step displays the move notation (e.g. `R`, `U'`, `F2`), plain-English caption (*"Turn the Right face clockwise 90°"*), and an isometric vector thumbnail with a curved direction arrow.
* **Interactive Playback:** Auto-play with adjustable speed (0.5× to 5×), scrubber slider, and keyboard shortcuts (<kbd>Space</kbd>, <kbd>←</kbd>, <kbd>→</kbd>).
* **Step-by-Step Manual Mode:** Waits for the user to execute the move physically before pressing Next.
* **Hold Your Cube Orientation Hint:** Displays spatial guidance (*"White on Top, Green in Front, Red on Right"*).
* **Beginner Explanation Breakdown:** Groups optimal moves into 3 instructional phases (*Phase 1: Base Layer*, *Phase 2: Top Orientation OLL*, *Phase 3: Corner Permutation PLL*).

---

## 📐 Mathematical Formulation & Sticker Indexing

The 2×2×2 Rubik's Cube (Pocket Cube) is composed of 8 corner cubies with no edge or center pieces. Each cubie exposes 3 colored stickers, totaling `8 × 3 = 24` visible facets.

### 24-Sticker State Indexing & Net Layout

```text
                  ┌───────┬───────┐
                  │ 0 (U) │ 1 (U) │
                  ├───────┼───────┤
                  │ 2 (U) │ 3 (U) │
  ┌───────┬───────┼───────┼───────┬───────┬───────┬───────┬───────┐
  │ 16(L) │ 17(L) │ 8 (F) │ 9 (F) │ 4 (R) │ 5 (R) │ 20(B) │ 21(B) │
  ├───────┼───────┼───────┼───────┼───────┼───────┼───────┼───────┤
  │ 18(L) │ 19(L) │ 10(F) │ 11(F) │ 6 (R) │ 7 (R) │ 22(B) │ 23(B) │
  └───────┴───────┴───────┴───────┴───────┴───────┴───────┴───────┘
                  │ 12(D) │ 13(D) │
                  ├───────┼───────┤
                  │ 14(D) │ 15(D) │
                  └───────┴───────┘
```

| Face ID | Name | Color | Slot Indices | Fixed Corner Anchor |
| :---: | :---: | :---: | :---: | :---: |
| `0` | **U** (Up) | White (`#f8fafc`) | `[0, 1, 2, 3]` | — |
| `1` | **R** (Right) | Red (`#ef4444`) | `[4, 5, 6, 7]` | — |
| `2` | **F** (Front) | Green (`#22c55e`) | `[8, 9, 10, 11]` | — |
| `3` | **D** (Down) | Yellow (`#facc15`) | `[12, 13, 14, 15]` | Slot 14 (D) |
| `4` | **L** (Left) | Orange (`#f97316`) | `[16, 17, 18, 19]` | Slot 18 (L) |
| `5` | **B** (Back) | Blue (`#3b82f6`) | `[20, 21, 22, 23]` | Slot 23 (B) |

The 8 corner cubies correspond to sticker index triplets:
- `0 (UFL)`: `[2, 8, 17]`
- `1 (UFR)`: `[3, 9, 4]`
- `2 (UBR)`: `[1, 5, 20]`
- `3 (UBL)`: `[0, 21, 16]`
- `4 (DFL)`: `[12, 19, 10]`
- `5 (DFR)`: `[13, 11, 6]`
- `6 (DBR)`: `[15, 7, 22]`
- **`7 (DBL)`**: `[14, 23, 18]` *(Fixed anchor — never moves under U, R, F)*

---

## 🛡 Validation Rules & Normalization

The validation module ([`validateCube.js`](file:///C:/Users/OM%20WATTAMWAR/Downloads/RubiksCubeSolver/src/solve-my-cube/validation/validateCube.js)) enforces strict mathematical constraints:

1. **Sticker Completeness:** All 24 slots must be assigned. Incomplete states report remaining sticker counts and highlight unassigned slots.
2. **Color Counts:** Each of the 6 colors must appear exactly 4 times ($6 \times 4 = 24$). Unbalanced counts highlight offending stickers.
3. **Opposite Color Detection:** Detects which pairs of faces are opposite (two faces are opposite iff their colors never share a corner cubie). Validates that custom or non-standard color schemes form 3 valid opposite pairs.
4. **Orientation Normalization:** Evaluates the 24 3D spatial rotation matrices in $SO(3)$ to rotate the user's reference corner to the fixed DBL anchor slot (`[14, 23, 18]`) with canonical orientation.
5. **Corner Uniqueness:** Asserts that each of the 8 physical corners matches exactly one canonical piece color set. Duplicate corners are rejected with offending pieces highlighted in red.
6. **Chirality (Handedness):** Checks that the clockwise cyclic order of colors on each corner cubie matches a right-handed physical cube. Physically mirrored corners are detected.
7. **Corner Twist Parity:** Computes the orientation twist $t \in \{0, 1, 2\}$ for each of the 8 corners relative to the U/D reference plane. Asserts that the total twist sum satisfies:
   $$\sum_{i=0}^7 \text{twist}(i) \equiv 0 \pmod 3$$
   If $\ne 0$, flags that one or more corners have been physically twisted.
8. **Already Solved Check:** Detects if the state is already solved ($0$ moves required).

---

## 🔌 Extensibility: How to Add a New Solver

The engine uses a decoupled generator-based telemetry interface. To add a new search algorithm (e.g. Bidirectional Search or Pattern Databases):

### Step 1: Implement the Search Generator
Add your algorithm to [`src/solver/SearchEngine.js`](file:///C:/Users/OM%20WATTAMWAR/Downloads/RubiksCubeSolver/src/solver/SearchEngine.js):

```javascript
export function* runCustomSearch(root, hFn, maxNodes, yieldEvery, heuristicId) {
  const open = new MinHeap(priorityCompare);
  open.push(root);
  let expanded = 0;
  let step = 0;

  while (open.size > 0 && expanded < maxNodes) {
    const current = open.pop();
    expanded++;
    const isGoal = isSolved(current.state);

    // Yield telemetry frame adhering to Contract 1.2
    if (isGoal || expanded % yieldEvery === 0) {
      yield buildFrame(step++, 'custom', current, open, expanded, isGoal);
    }
    if (isGoal) {
      return buildResult(current, 'custom', heuristicId, expanded);
    }

    for (const move of MOVES) {
      const nextState = applyMoveFast(current.state, MOVE_PERMUTATIONS[move]);
      const id = stateHash(nextState);
      const h = hFn(nextState);
      open.push(makeNode(nextState, id, current, move, current.g + 1, h, current.g + 1 + h));
    }
  }
  return buildResult(null, 'custom', heuristicId, expanded, true);
}
```

### Step 2: Register Algorithm Label & Key
In `src/solver/SearchEngine.js`:
```javascript
export const ALGORITHM_LABELS = {
  astar: 'A*',
  ida: 'IDA*',
  greedy: 'Greedy Best-First',
  custom: 'My Custom Search',
};
```

### Step 3: Connect to Dispatcher
Inside `search(startState, options)` in `SearchEngine.js`:
```javascript
if (algorithm === 'custom') {
  return yield* runCustomSearch(root, hFn, maxNodes, yieldEvery, heuristic);
}
```
The UI, Web Worker, and telemetry panels will automatically support the new solver!

---

## 🧪 Verification Test Gates

The project contains an automated 4-tier testing suite runnable headlessly via plain Node.js:

```bash
# Run all 4 verification gates
npm test

# Run individual test gates
npm run test:cube     # Gate 1: State permutations & group theory invariants
npm run test:solver   # Gate 2: Heuristic admissibility & search optimality
npm run test:three    # Gate 3: Three.js math & mesh alignment
npm run test:smc      # Gate 4: Solve My Cube pipeline, validation & property tests
```

### What Each Gate Verifies:

* **Gate 1 (`test-cube.js`):** Bijective mappings of size 24, fixed DBL anchor preservation, $U^4 = I$, $(R\,U\,R'\,U')^6 = I$, and move invertibility.
* **Gate 2 (`test-solver.js`):** Heuristic admissibility proofs ($h_1 \le h^*$ and $h_2 \le h^*$), A*/IDA* optimality, and sub-500ms benchmarks.
* **Gate 3 (`test-three.js`):** Three.js WebGL mesh synchronizations, animated move consistency, and lattice grid drift elimination.
* **Gate 4 (`test-solve-my-cube.js`):** Strict rejection of all invalid physical states (incomplete stickers, unbalanced counts, duplicate corners, chirality violations, twist parity errors), orientation normalization across all 24 spatial rotations, and 15-scramble end-to-end property solve tests.

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
| :---: | :--- |
| <kbd>Space</kbd> | Start / Stop search (Explore) • Play / Pause solution (Solve My Cube) |
| <kbd>Esc</kbd> | Stop search / Close open modal |
| <kbd>←</kbd> / <kbd>→</kbd> | Step backward / forward through solution steps |
| <kbd>S</kbd> | Scramble cube (7 random non-redundant moves) |
| <kbd>R</kbd> | Reset cube to solved state (Explore) • Clear all painted stickers (Solve My Cube) |
| <kbd>U</kbd> / <kbd>Shift</kbd> + <kbd>U</kbd> | Turn Up face (Clockwise / Counter-Clockwise) |
| <kbd>Alt</kbd> + <kbd>R</kbd> | Turn Right face (Clockwise) |
| <kbd>F</kbd> / <kbd>Shift</kbd> + <kbd>F</kbd> | Turn Front face (Clockwise / Counter-Clockwise) |
| <kbd>?</kbd> | Open Keyboard Shortcuts cheat sheet |

---

## 📜 Tech Stack

* **Core Framework:** [Next.js 16](https://nextjs.org/) (App Router)
* **UI Library:** [React 19](https://react.dev/)
* **3D Graphics:** [Three.js](https://threejs.org/) (`RoundedBoxGeometry`, `OrbitControls`, `MeshPhysicalMaterial`, `RoomEnvironment`)
* **2D Canvas Graph:** Native HTML5 High-DPI 2D Canvas API
* **Web Workers:** Native ES Module Web Workers for background graph search
* **Algorithms:** Native ES6 JavaScript (zero external dependencies for solvers and group theory)

---

## 📄 License

This project is licensed under the **MIT License**. Created for academic research, visualization, and education in Artificial Intelligence, Graph Theory, and Heuristic Search Algorithms.
