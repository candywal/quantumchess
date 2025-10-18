# Quantum Chess Refactor & Fix Plan

This document captures the work needed to repair the current gameplay bugs and bring the quantum mechanics in line with the intended rules. It is aimed at a coding-focused agent who will implement the changes.

---

## 1. Current Issues Summary

- Deterministic pieces display labels even when probability is 100%.
- Move validation is effectively disabled; pieces can move illegally, pass through blockers, or land on allied squares.
- Piece data model on the server mixes legacy `square/probability` fields with code that expects a `states` array, creating inconsistent behaviour.
- Splitting logic removes the original piece before new states are tracked, causing capture checks and collapse logic to malfunction.
- Capture collapse does not collapse every state of the victim, nor does it properly remove invalid attacker states when a capture fails.
- Probability renormalisation and bookkeeping of `displayNum`/piece counters are unreliable after splits and collapses.

---

## 2. High-Level Objectives

1. **Unify Piece State Model**  
   Represent every piece as a single object with a `states` array (even when probability is 100%) and keep client/server in sync.

2. **Restore Chess Legality**  
   Integrate `chess.js` so only legal moves are allowed, considering blockers and captures from each quantum state.

3. **Fix Quantum Capture Mechanics**  
   Ensure captures resolve all quantum states correctly, respecting success/failure rules and renormalising probabilities.

4. **Improve Splitting & State Management**  
   Record new states before evaluation, prevent illegal overlap with allies, and keep counters/labels meaningful.

5. **Front-End Feedback Polish**  
   Update UI rendering, move selection, and history to reflect the new model and probability rules.

---

## 3. Implementation Steps

### 3.1 Data Model Refactor

1. Update `initializeQuantumBoard` to create pieces as:
   ```js
   {
     id, type, color,
     states: [{ square: 'e2', probability: 1 }],
     displayNum: 1
   }
   ```
2. Remove obsolete `square` and `probability` top-level fields or keep them as derived getters.
3. Add helpers:
   - `getPieceState(pieces, pieceId)` to retrieve piece and states.
   - `setPieceStates(piece, states)` that normalises probabilities (sum to 1) and removes zero-weight states.
   - `collapseToState(piece, targetSquare)` to keep only the resolved state and set probability to 1.
4. Adjust any server logic referencing `piece.square` or `piece.probability` to use the new helpers.

### 3.2 Move Validation Pipeline

1. Implement a function `buildClassicalBoard(pieces, resolveBy='max')` that returns a `Chess` instance placing each piece’s highest probability state (or iterate per state as needed).
2. When handling `makeMove`, determine all legal moves for each relevant state using `chess.js`:
   - Reject moves where no state of the selected piece can legally reach the target square.
   - Ensure destination squares containing friendly states are excluded.
3. Send the list of legal destinations to the client (e.g., via a new event `legalMovesForPiece`) when a piece is selected, or have client request them.
4. On the client, only allow selecting target squares that appear in the server-provided legal list (disable UI teleportation).

### 3.3 Splitting Logic

1. When a split is requested, verify both destinations are legal and distinct.
2. Create two new states for the piece (same `id`) rather than independent pieces:
   - Append states with 0.5 probability each (or adjust if more than two states already exist).
   - Renormalise probabilities if splitting an already split piece.
3. Before resolving captures, tentatively add the new states and use the shared collapse logic (see section 3.4).
4. Update `pieceCounters` / `displayNum` usage to reflect the number of states; decide whether numbering should track splits or remain per physical piece.

### 3.4 Capture & Collapse Handling

1. Modify `detectCapture` to consider all states of both attacker and defender; a capture attempt occurs when any attacker state lands on a square containing an opponent state.
2. Rewrite `collapseQuantumState`:
   - Input: attacker piece, defender piece, attacking state index, defender state index.
   - Perform probability roll based on the attacking state’s probability.
   - On success:
     - Remove **all** defender states (i.e., delete the piece).
     - Collapse attacker to the capturing square with probability 1 and remove other states.
   - On failure:
     - Remove the attacking state from the attacker piece and renormalise remaining attacker states.
     - Defender collapses to the contested square with probability 1; remove other defender states.
3. After collapse, clean up any pieces that have no remaining states.
4. Ensure multiple defenders on the same square (from other quantum states) are processed correctly—likely by iterating captures per unique defender piece.

### 3.5 Turn Resolution & Game State

1. After each move, recompute `game.currentTurn`, check for king existence, and emit consistent `gameUpdate` events with the new state structure.
2. Update move notation generation to read from states (e.g., using the origin state that actually moved).

### 3.6 Front-End Adjustments

1. Update rendering to:
   - Loop through each piece state, possibly drawing multiple translucent glyphs per square or the combined probability on a single glyph (decide on UX).
   - Only show probability labels for states where `probability < 1`.
2. Adjust selection logic to request server-validated move lists. Highlight legal squares only.
3. When receiving a `gameUpdate`, reconcile state arrays with the UI.
4. Update history, collapse animations, and status messages to consume the richer collapse event data (include attacker/defender state indices and resulting probabilities).

### 3.7 Testing & Quality

1. Write or update server-side unit tests (if adding a test framework) covering:
   - Splitting renormalisation.
   - Successful and failed capture collapse outcomes.
   - Illegal move rejection scenarios (moving through pieces, onto allies, etc.).
2. Manual QA checklist:
   - Verify deterministic pieces show no labels.
   - Attempt illegal rook and knight moves to confirm rejection.
   - Split a piece, then capture it with success and failure paths.
   - Ensure capture of a quantum piece removes all states when collapse succeeds.
   - Confirm game ends when a king’s final state is captured.

---

## 4. Suggested Order of Execution

1. Data model refactor (`server.js`, shared helpers).
2. Update move handling (validation + splitting) on the server.
3. Adjust capture/collapse logic.
4. Modify client rendering and interaction model.
5. Finalise UI polish (labels, animations, history).
6. Run tests/manual QA and document results.

---

## 5. Deliverables Checklist

- [ ] Updated `server.js` with unified state model, legal move enforcement, and corrected collapse behaviour.
- [ ] Updated client scripts (`public/game.js` and related assets) reflecting new APIs and UI expectations.
- [ ] Optional: new helper modules/tests if introduced.
- [ ] Documentation updates (README/DEPLOYMENT already addressed, but include change notes if behaviour differs).
- [ ] QA notes or test log demonstrating that core scenarios were exercised.

---

## 6. Additional Notes

- Keep communication protocol changes backward-compatible if possible, or bump version and handle reconnects gracefully.
- Consider adding a migration script or guard that converts legacy in-memory game objects to the new format if hot-reloading the server.
- Probability rolls currently use `Math.random()`; if determinism is desired for testing, inject a random provider.

Good luck, and thank you for carrying the implementation forward!
