# Developer Quick Reference

## Project Structure

```
quantumchess/
├── server.js           # Game server with quantum mechanics
├── public/
│   ├── game.js        # Client-side game logic
│   ├── game.html      # Game interface
│   └── index.html     # Landing page
├── package.json       # Dependencies
└── docs/
    ├── new_plan.md                    # Original refactor plan
    ├── IMPLEMENTATION_SUMMARY.md      # What was implemented
    ├── QUANTUM_MECHANICS_GUIDE.md     # How quantum mechanics work
    └── DEVELOPER_REFERENCE.md         # This file
```

## Data Structures

### Piece Object
```javascript
{
  id: "w-n-1",              // Unique identifier
  type: "n",                // Piece type (k/q/r/b/n/p)
  color: "w",               // Color (w/b)
  states: [                 // Quantum states array
    {
      square: "c3",         // Board position (algebraic notation)
      probability: 0.5      // Probability (0.0 to 1.0)
    },
    {
      square: "a3",
      probability: 0.5
    }
  ],
  displayNum: 1             // Display number for tracking
}
```

### Game Object
```javascript
{
  id: "ABC123",            // Game ID
  players: [               // Array of players
    {
      socketId: "xyz",
      color: "w"
    }
  ],
  currentTurn: "w",        // Current player (w/b)
  pieces: [...],           // Array of piece objects
  pieceCounters: {         // Track piece numbering
    "w-n": 2,
    "w-p": 8
  },
  gameOver: false,
  winner: null,
  splittingMode: "optional", // Game mode
  timeControl: "unlimited"   // Time settings
}
```

## Key Functions (server.js)

### State Management
```javascript
setPieceStates(piece, states)
// Normalizes probabilities, consolidates states, removes zeros
// Returns: Array of normalized states

collapseToState(piece, targetSquare)
// Collapses piece to single deterministic state
// Modifies: piece.states in place

getPieceById(pieces, pieceId)
// Returns: Piece object or undefined

removePiece(pieces, pieceId)
// Removes piece from game
// Modifies: pieces array in place
```

### Move Validation
```javascript
getLegalMovesForPiece(pieces, pieceId)
// Returns: Array of legal destination squares (strings)

isMoveLegalFromPiece(pieces, pieceId, toSquare)
// Returns: Boolean

buildClassicalBoard(pieces)
// Returns: Chess.js instance with current board state
```

### Capture/Collapse
```javascript
detectCaptures(pieces, movingPieceId, toSquare)
// Returns: Array of capture objects
// [{pieceId, stateIndex, square, probability}, ...]

performCapture(pieces, attackerPieceId, defenderPieceId, captureSquare)
// Returns: Array of collapse events
// Modifies: pieces array (removes/collapses pieces)
```

### Game Logic
```javascript
checkGameOver(pieces)
// Returns: {gameOver: boolean, winner: string|null}

generateNotation(piece, toSquare, isCapture)
// Returns: Move notation string (e.g., "N(50%)xe4")

formatCollapseInfo(collapseEvents)
// Returns: Human-readable collapse description
```

## Key Functions (game.js)

### Rendering
```javascript
renderBoard()
// Renders entire board and all pieces
// Highlights selected piece states

renderPiece(piece)
// Renders all quantum states of a single piece
// Applies opacity based on probability
// Adds labels for quantum states

renderHistoricalState(historicalState)
// Renders a past game state for history navigation
```

### Interaction
```javascript
handleSquareClick(squareId)
// Handles user clicking on board squares
// Manages piece selection and move execution

findPieceAtSquare(square, color)
// Returns: Piece object or null
// Checks if any piece has a state at given square

makeMove(shouldSplit, firstTarget, secondTarget)
// Sends move to server via socket
```

### UI Updates
```javascript
updateTurnIndicator()
// Updates whose turn it is

updateGameStatus(message)
// Updates status message display

showCollapseAnimation(collapseEvents, callback)
// Displays quantum collapse modal with dice roll
```

## Socket Events

### Client → Server
```javascript
socket.emit('joinGame', {
  gameId: string,
  splittingMode: string,
  timeControl: string
});

socket.emit('makeMove', {
  gameId: string,
  pieceId: string,
  firstTarget: string,
  secondTarget: string|null,
  shouldSplit: boolean
});
```

### Server → Client
```javascript
socket.on('gameJoined', ({ color, gameState }))
socket.on('gameStart', ({ gameState }))
socket.on('gameUpdate', ({ gameState, moveNotation, collapseInfo }))
socket.on('collapseEvent', ({ collapseEvents, gameState }))
socket.on('gameOver', ({ winner, collapseEvents }))
socket.on('error', ({ message }))
socket.on('playerDisconnected', ())
```

## Common Development Tasks

### Adding a New Piece Type
1. Update starting positions in `initializeQuantumBoard()`
2. Add Unicode symbol to `PIECES` object in game.js
3. chess.js handles move validation automatically

### Modifying Collapse Rules
1. Edit `performCapture()` function in server.js
2. Update probability calculations as needed
3. Modify collapse event structure if needed
4. Update `showCollapseAnimation()` in game.js for new display

### Adding Validation Rules
1. Modify `getLegalMovesForPiece()` to add restrictions
2. Update filter logic for friendly pieces
3. Test with chess.js integration

### Changing Split Mechanics
1. Edit splitting section in `makeMove` handler
2. Modify probability division logic
3. Update `setPieceStates()` if consolidation changes

## Testing Checklist

### Unit Test Ideas
```javascript
// State Management
✓ setPieceStates normalizes to 100%
✓ setPieceStates consolidates same squares
✓ setPieceStates removes zero probabilities
✓ collapseToState creates single state at 100%

// Move Validation
✓ Legal moves respect chess rules
✓ Illegal moves are rejected
✓ Friendly pieces block moves
✓ Quantum states affect legal moves

// Capture Mechanics
✓ Success roll removes defender
✓ Failure roll removes attacker state
✓ Probabilities renormalize correctly
✓ Collapse events generated properly
```

### Integration Test Scenarios
```javascript
// Basic Gameplay
✓ Start new game
✓ Make normal move
✓ Make split move
✓ Attempt capture (success)
✓ Attempt capture (failure)
✓ Win by king capture

// Edge Cases
✓ Split already-split piece
✓ Capture with multiple attacker states
✓ Capture with multiple defender states
✓ Last state removed collapses piece
✓ Multiple collapses in one turn
```

## Performance Considerations

### Bottlenecks
- Building chess.js board for each state (O(n*m) where n=pieces, m=states)
- Rendering many quantum states (DOM operations)
- Socket event frequency (collapses can generate multiple events)

### Optimizations
- Consolidate states on same square immediately
- Cache legal moves per turn
- Batch DOM updates during rendering
- Debounce socket events if needed

## Debugging Tips

### Server-Side
```javascript
// Add logging to collapse
console.log('Collapse:', {
  attacker: attackerPieceId,
  defender: defenderPieceId,
  roll, threshold,
  result: roll < threshold ? 'success' : 'fail'
});

// Verify state probabilities
pieces.forEach(p => {
  const sum = p.states.reduce((acc, s) => acc + s.probability, 0);
  if (Math.abs(sum - 1.0) > 0.01) {
    console.error('Invalid probabilities:', p.id, sum);
  }
});
```

### Client-Side
```javascript
// Inspect game state
console.log('Game State:', gameState);

// Check rendering
console.log('Pieces:', gameState.pieces.length);
gameState.pieces.forEach(p => {
  console.log(p.id, p.states.length, 'states');
});

// Monitor socket events
socket.onAny((event, ...args) => {
  console.log('Socket event:', event, args);
});
```

## Code Style Guidelines

### Naming Conventions
- Functions: `camelCase` (e.g., `performCapture`)
- Constants: `UPPER_SNAKE_CASE` (e.g., `PIECES`)
- Variables: `camelCase` (e.g., `gameState`)
- Private helpers: Prefix with underscore (e.g., `_validateMove`)

### Documentation
- Add JSDoc for complex functions
- Explain quantum mechanics in comments
- Include examples for non-obvious code
- Keep comments concise but educational

### Code Organization
- Group related functions with section headers
- Helper functions before main functions
- Client/server separation clear
- Validation before execution

## Dependencies

### Production
- **express**: ^4.18.2 - Web server
- **socket.io**: ^4.6.1 - Real-time communication
- **chess.js**: ^1.0.0-beta.6 - Move validation

### Development
- **node**: >=16.x - Runtime environment

## Useful Commands

```bash
# Install dependencies
npm install

# Start server
npm start

# Development with auto-reload (if nodemon installed)
npm run dev

# Check syntax
node -c server.js
node -c public/game.js

# Run tests (if test framework added)
npm test
```

## Resources

### Internal Documentation
- `new_plan.md` - Original implementation plan
- `IMPLEMENTATION_SUMMARY.md` - What was built
- `QUANTUM_MECHANICS_GUIDE.md` - Game mechanics explained

### External References
- [chess.js Documentation](https://github.com/jhlywa/chess.js)
- [Socket.IO Documentation](https://socket.io/docs/)
- [Express.js Guide](https://expressjs.com/)

## Contributing Guidelines

### Before Submitting Changes
1. Test all quantum mechanics scenarios
2. Verify move validation still works
3. Check that probabilities always sum to 100%
4. Ensure collapse logic handles edge cases
5. Update documentation if mechanics changed
6. Run syntax checks on modified files

### Code Review Checklist
- ✓ Functions are well-documented
- ✓ Quantum mechanics are explained
- ✓ No magic numbers (use named constants)
- ✓ Error handling is present
- ✓ Edge cases are considered
- ✓ Code is modular and reusable

---

**Last Updated:** 2025-10-18
**Maintainer:** Development Team
**Status:** Active Development
