/**
 * Quantum Chess Server
 *
 * This server implements quantum chess where pieces can exist in superposition
 * (multiple locations simultaneously) with associated probabilities.
 *
 * Key Concepts:
 * - Each piece has an array of quantum states, each with a square and probability
 * - Pieces can "split" into superposition by moving to two targets simultaneously
 * - When pieces attempt captures, quantum collapse occurs based on probability
 * - All moves are validated using chess.js to ensure legal moves
 *
 * Data Model:
 * - Piece: { id, type, color, states: [{ square, probability }], displayNum }
 * - All pieces maintain states array, even deterministic pieces (single state at 100%)
 */

const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { Chess } = require('chess.js');
const path = require('path');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

// Serve static files
app.use(express.static('public'));

// In-memory game storage
const games = new Map();

// Generate random game ID
function generateGameId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Initialize a new quantum chess game
function createGame(gameId, splittingMode = 'optional', timeControl = 'unlimited') {
  const { pieces, pieceCounters } = initializeQuantumBoard();
  const game = {
    id: gameId,
    players: [],
    currentTurn: 'w', // 'w' or 'b'
    pieces: pieces,
    pieceCounters: pieceCounters, // Track next number for each piece type
    gameOver: false,
    winner: null,
    splittingMode,
    timeControl
  };
  return game;
}

// Initialize standard chess starting position with quantum structure
function initializeQuantumBoard() {
  const pieces = [];
  const pieceCounters = {}; // Track piece numbering per type

  // Standard chess starting positions
  const startingPositions = {
    'a8': { type: 'r', color: 'b' }, 'b8': { type: 'n', color: 'b' },
    'c8': { type: 'b', color: 'b' }, 'd8': { type: 'q', color: 'b' },
    'e8': { type: 'k', color: 'b' }, 'f8': { type: 'b', color: 'b' },
    'g8': { type: 'n', color: 'b' }, 'h8': { type: 'r', color: 'b' },
    'a7': { type: 'p', color: 'b' }, 'b7': { type: 'p', color: 'b' },
    'c7': { type: 'p', color: 'b' }, 'd7': { type: 'p', color: 'b' },
    'e7': { type: 'p', color: 'b' }, 'f7': { type: 'p', color: 'b' },
    'g7': { type: 'p', color: 'b' }, 'h7': { type: 'p', color: 'b' },
    'a2': { type: 'p', color: 'w' }, 'b2': { type: 'p', color: 'w' },
    'c2': { type: 'p', color: 'w' }, 'd2': { type: 'p', color: 'w' },
    'e2': { type: 'p', color: 'w' }, 'f2': { type: 'p', color: 'w' },
    'g2': { type: 'p', color: 'w' }, 'h2': { type: 'p', color: 'w' },
    'a1': { type: 'r', color: 'w' }, 'b1': { type: 'n', color: 'w' },
    'c1': { type: 'b', color: 'w' }, 'd1': { type: 'q', color: 'w' },
    'e1': { type: 'k', color: 'w' }, 'f1': { type: 'b', color: 'w' },
    'g1': { type: 'n', color: 'w' }, 'h1': { type: 'r', color: 'w' }
  };

  // Create pieces with unified states array structure
  for (const [square, piece] of Object.entries(startingPositions)) {
    const key = `${piece.color}-${piece.type}`;
    if (!pieceCounters[key]) pieceCounters[key] = 0;
    pieceCounters[key]++;

    pieces.push({
      id: `${piece.color}-${piece.type}-${pieceCounters[key]}`,
      type: piece.type,
      color: piece.color,
      states: [{ square: square, probability: 1.0 }],
      displayNum: pieceCounters[key]
    });
  }

  return { pieces, pieceCounters };
}

// ============================================================================
// State Management Helpers
// ============================================================================

/**
 * Normalize probabilities and consolidate states
 * - Removes zero-probability states
 * - Consolidates multiple states on same square (adds probabilities)
 * - Normalizes all probabilities to sum to 1
 */
function setPieceStates(piece, states) {
  const filtered = states.filter(s => s.probability > 0);
  if (filtered.length === 0) return [];

  // Consolidate states on the same square
  const consolidated = {};
  filtered.forEach(state => {
    if (consolidated[state.square]) {
      consolidated[state.square] += state.probability;
    } else {
      consolidated[state.square] = state.probability;
    }
  });

  // Convert back to array and normalize
  const consolidatedStates = Object.entries(consolidated).map(([square, probability]) => ({
    square,
    probability
  }));

  const sum = consolidatedStates.reduce((acc, s) => acc + s.probability, 0);
  return consolidatedStates.map(s => ({
    square: s.square,
    probability: s.probability / sum
  }));
}

// Collapse piece to a single state
function collapseToState(piece, targetSquare) {
  piece.states = [{ square: targetSquare, probability: 1.0 }];
}

// Get piece by ID
function getPieceById(pieces, pieceId) {
  return pieces.find(p => p.id === pieceId);
}

// Remove piece from array
function removePiece(pieces, pieceId) {
  const index = pieces.findIndex(p => p.id === pieceId);
  if (index !== -1) pieces.splice(index, 1);
}

// Build a classical chess board for validation (using highest probability state for each piece)
function buildClassicalBoard(pieces) {
  const chess = new Chess();
  chess.clear();

  pieces.forEach(piece => {
    if (piece.states.length > 0) {
      // Use highest probability state (or first state if all equal)
      const mainState = piece.states.reduce((max, state) =>
        state.probability > max.probability ? state : max
      );
      try {
        chess.put({ type: piece.type, color: piece.color }, mainState.square);
      } catch (e) {
        // Ignore overlapping pieces for validation
      }
    }
  });

  return chess;
}

// ============================================================================
// Move Validation
// ============================================================================

// Get all legal moves for a piece considering all its quantum states
function getLegalMovesForPiece(pieces, pieceId) {
  const piece = getPieceById(pieces, pieceId);
  if (!piece || piece.states.length === 0) return [];

  const legalMoves = new Set();

  // Check legal moves from each quantum state
  piece.states.forEach(state => {
    const chess = new Chess();
    chess.clear();

    // Build board with all piece states
    pieces.forEach(p => {
      p.states.forEach(s => {
        try {
          if (!chess.get(s.square)) {
            chess.put({ type: p.type, color: p.color }, s.square);
          }
        } catch (e) {
          // Square occupied, skip
        }
      });
    });

    try {
      const moves = chess.moves({ square: state.square, verbose: true });
      moves.forEach(move => {
        // Exclude moves to squares occupied by friendly pieces
        const hasFriendly = pieces.some(p =>
          p.color === piece.color &&
          p.states.some(s => s.square === move.to)
        );
        if (!hasFriendly) {
          legalMoves.add(move.to);
        }
      });
    } catch (e) {
      // Invalid position, skip
    }
  });

  return Array.from(legalMoves);
}

// Validate if a specific move is legal from any state of the piece
function isMoveLegalFromPiece(pieces, pieceId, toSquare) {
  const legalMoves = getLegalMovesForPiece(pieces, pieceId);
  return legalMoves.includes(toSquare);
}

// ============================================================================
// Capture and Collapse Logic
// ============================================================================

// Detect all enemy pieces that have states on the target square
function detectCaptures(pieces, movingPieceId, toSquare) {
  const movingPiece = getPieceById(pieces, movingPieceId);
  if (!movingPiece) return [];

  const captures = [];

  for (const piece of pieces) {
    if (piece.id === movingPieceId) continue;
    if (piece.color === movingPiece.color) continue;

    // Check if this piece has any state on the target square
    const stateIndex = piece.states.findIndex(s => s.square === toSquare);
    if (stateIndex !== -1) {
      captures.push({
        pieceId: piece.id,
        stateIndex: stateIndex,
        square: toSquare,
        probability: piece.states[stateIndex].probability
      });
    }
  }

  return captures;
}

/**
 * Perform quantum collapse when a capture is attempted
 *
 * Quantum Collapse Rules:
 * 1. When an attacker tries to capture a defender, we perform a probability roll
 * 2. The attacking state's probability determines the success threshold
 * 3. Success (roll < threshold):
 *    - The attacker was "real" at this location
 *    - Defender is completely removed (all states)
 *    - Attacker collapses to 100% probability at capture square
 * 4. Failure (roll >= threshold):
 *    - The attacker was NOT real at this location
 *    - Remove the failed attacking state and renormalize remaining attacker states
 *    - Defender collapses to 100% probability at capture square (survives)
 *
 * @param {Array} pieces - The game pieces array (modified in place)
 * @param {string} attackerPieceId - ID of the attacking piece
 * @param {string} defenderPieceId - ID of the defending piece
 * @param {string} captureSquare - The square where capture is attempted
 * @returns {Array} Array of collapse events for display
 */
function performCapture(pieces, attackerPieceId, defenderPieceId, captureSquare) {
  const attacker = getPieceById(pieces, attackerPieceId);
  const defender = getPieceById(pieces, defenderPieceId);

  if (!attacker || !defender) return [];

  const collapseEvents = [];

  // Find the attacking state (the one moving to capture square)
  const attackingStateIndex = attacker.states.findIndex(s => s.square === captureSquare);
  const attackingState = attackingStateIndex >= 0 ? attacker.states[attackingStateIndex] : null;

  if (!attackingState) {
    console.error('Attacking state not found at capture square');
    return [];
  }

  // Quantum measurement: Roll dice based on attacking state's probability
  const roll = Math.random();
  const threshold = attackingState.probability;

  if (roll < threshold) {
    // CAPTURE SUCCESS: Attacker was real at this location
    collapseEvents.push({
      type: 'capture_success',
      roll: roll.toFixed(3),
      threshold: threshold.toFixed(3),
      capturingPiece: { id: attackerPieceId, square: captureSquare },
      capturedPiece: { id: defenderPieceId, square: captureSquare }
    });

    // Defender is completely captured (all quantum states removed)
    removePiece(pieces, defenderPieceId);

    // Attacker collapses to deterministic state at capture square
    collapseToState(attacker, captureSquare);

  } else {
    // CAPTURE FAILURE: Attacker was NOT real at this location
    collapseEvents.push({
      type: 'capture_fail',
      roll: roll.toFixed(3),
      threshold: threshold.toFixed(3),
      capturingPiece: { id: attackerPieceId, square: captureSquare },
      capturedPiece: { id: defenderPieceId, square: captureSquare }
    });

    // Remove the failed attacking state
    attacker.states.splice(attackingStateIndex, 1);

    // Renormalize remaining probabilities to sum to 1
    attacker.states = setPieceStates(attacker, attacker.states);

    // If attacker has no states left, it's completely removed
    if (attacker.states.length === 0) {
      removePiece(pieces, attackerPieceId);
    }

    // Defender survives and collapses to deterministic state
    collapseToState(defender, captureSquare);
  }

  return collapseEvents;
}

// Check if king is captured (game over)
function checkGameOver(pieces) {
  const whiteKing = pieces.find(p => p.type === 'k' && p.color === 'w');
  const blackKing = pieces.find(p => p.type === 'k' && p.color === 'b');

  if (!whiteKing) return { gameOver: true, winner: 'black' };
  if (!blackKing) return { gameOver: true, winner: 'white' };
  
  return { gameOver: false, winner: null };
}

// Generate move notation
function generateNotation(piece, toSquare, isCapture) {
  const pieceSymbol = piece.type === 'p' ? '' : piece.type.toUpperCase();
  let notation = pieceSymbol;

  // Add quantum indicator if piece is in superposition
  if (piece.states && piece.states.length > 1) {
    const maxProb = Math.max(...piece.states.map(s => s.probability));
    notation += `(${Math.round(maxProb * 100)}%)`;
  }

  // Add capture symbol
  if (isCapture) {
    notation += 'x';
  }

  // Add destination
  notation += toSquare;

  return notation;
}

// Format collapse info for display
function formatCollapseInfo(collapseEvents) {
  if (!collapseEvents || collapseEvents.length === 0) return null;
  
  const event = collapseEvents[0];
  const rollPercent = (parseFloat(event.roll) * 100).toFixed(1);
  const thresholdPercent = (parseFloat(event.threshold) * 100).toFixed(1);
  
  if (event.type === 'capture_success') {
    return `Roll: ${rollPercent}% < ${thresholdPercent}% ✓`;
  } else {
    return `Roll: ${rollPercent}% ≥ ${thresholdPercent}% ✗`;
  }
}

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  // Join or create game
  socket.on('joinGame', (data) => {
    const gameId = typeof data === 'string' ? data : data.gameId;
    const splittingMode = data.splittingMode || 'optional';
    const timeControl = data.timeControl || 'unlimited';
    
    let game = games.get(gameId);
    
    // If game doesn't exist, create it with settings
    if (!game) {
      game = createGame(gameId, splittingMode, timeControl);
      games.set(gameId, game);
      console.log(`Game created: ${gameId} (mode: ${splittingMode}, time: ${timeControl})`);
    }

    // Check if this socket is already in the game (reconnection)
    const existingPlayer = game.players.find(p => p.socketId === socket.id);
    if (existingPlayer) {
      socket.join(gameId);
      socket.emit('gameJoined', { 
        gameId, 
        color: existingPlayer.color,
        gameState: game 
      });
      
      if (game.players.length === 2) {
        socket.emit('gameStart', { gameState: game });
      }
      console.log(`Player reconnected to game: ${gameId}`);
      return;
    }

    if (game.players.length >= 2) {
      socket.emit('error', { message: 'Game is full' });
      return;
    }

    // Determine color for new player
    const color = game.players.length === 0 ? 'w' : 'b';
    game.players.push({ socketId: socket.id, color });
    socket.join(gameId);
    
    socket.emit('gameJoined', { 
      gameId, 
      color,
      gameState: game 
    });

    // Notify both players that game can start when 2 players present
    if (game.players.length === 2) {
      io.to(gameId).emit('gameStart', { gameState: game });
    }
    
    console.log(`Player joined game: ${gameId} as ${color}`);
  });

  // Make a move
  socket.on('makeMove', ({ gameId, pieceId, firstTarget, secondTarget, shouldSplit }) => {
    const game = games.get(gameId);

    if (!game) {
      socket.emit('error', { message: 'Game not found' });
      return;
    }

    const player = game.players.find(p => p.socketId === socket.id);
    if (!player) {
      socket.emit('error', { message: 'You are not in this game' });
      return;
    }

    if (game.currentTurn !== player.color) {
      socket.emit('error', { message: 'Not your turn' });
      return;
    }

    const piece = getPieceById(game.pieces, pieceId);
    if (!piece || piece.color !== player.color) {
      socket.emit('error', { message: 'Invalid piece' });
      return;
    }

    // Validate move legality
    if (!isMoveLegalFromPiece(game.pieces, pieceId, firstTarget)) {
      socket.emit('error', { message: 'Illegal move' });
      return;
    }

    if (shouldSplit && secondTarget) {
      if (!isMoveLegalFromPiece(game.pieces, pieceId, secondTarget)) {
        socket.emit('error', { message: 'Illegal split move' });
        return;
      }
      if (firstTarget === secondTarget) {
        socket.emit('error', { message: 'Split targets must be different' });
        return;
      }
    }

    let collapseEvents = [];
    let moveNotation = '';
    let collapseInfo = null;

    // Handle splitting move (quantum superposition)
    if (shouldSplit && secondTarget && piece.type !== 'p') {
      /**
       * Quantum Splitting:
       * - Each existing quantum state splits into two new states
       * - Each new state has half the probability of the original
       * - This creates superposition where piece exists at multiple locations
       * - Example: 100% at A → 50% at B + 50% at C
       * - Example: [50% at A, 50% at B] → [25% at C, 25% at D, 25% at C, 25% at D]
       *   which consolidates to [50% at C, 50% at D]
       */
      const newStates = [];

      // Each existing state splits into two destinations
      piece.states.forEach(state => {
        newStates.push({
          square: firstTarget,
          probability: state.probability / 2
        });
        newStates.push({
          square: secondTarget,
          probability: state.probability / 2
        });
      });

      // Update piece with new states (setPieceStates consolidates and normalizes)
      piece.states = setPieceStates(piece, newStates);

      // Check for captures at both targets
      const captures1 = detectCaptures(game.pieces, pieceId, firstTarget);
      const captures2 = detectCaptures(game.pieces, pieceId, secondTarget);

      // Handle captures at first target
      for (const capture of captures1) {
        const events = performCapture(game.pieces, pieceId, capture.pieceId, firstTarget);
        collapseEvents = collapseEvents.concat(events);
      }

      // Handle captures at second target (if piece still exists)
      if (getPieceById(game.pieces, pieceId)) {
        for (const capture of captures2) {
          const events = performCapture(game.pieces, pieceId, capture.pieceId, secondTarget);
          collapseEvents = collapseEvents.concat(events);
        }
      }

      moveNotation = `${piece.type.toUpperCase()}${firstTarget}|${secondTarget}`;
      collapseInfo = formatCollapseInfo(collapseEvents);

    } else {
      // Normal move (no split)
      const captures = detectCaptures(game.pieces, pieceId, firstTarget);

      if (captures.length > 0) {
        // Move piece to target square first, then handle captures
        collapseToState(piece, firstTarget);

        for (const capture of captures) {
          const events = performCapture(game.pieces, pieceId, capture.pieceId, firstTarget);
          collapseEvents = collapseEvents.concat(events);
        }

        collapseInfo = formatCollapseInfo(collapseEvents);
      } else {
        // Simple move with no capture
        collapseToState(piece, firstTarget);
      }

      const isCapture = captures.length > 0;
      moveNotation = `${piece.type === 'p' ? '' : piece.type.toUpperCase()}${isCapture ? 'x' : ''}${firstTarget}`;
    }

    // Check if game is over
    const gameOverStatus = checkGameOver(game.pieces);
    if (gameOverStatus.gameOver) {
      game.gameOver = true;
      game.winner = gameOverStatus.winner;
      io.to(gameId).emit('gameOver', {
        winner: gameOverStatus.winner,
        collapseEvents: collapseEvents.length > 0 ? collapseEvents : null
      });
      return;
    }

    // Switch turns
    game.currentTurn = game.currentTurn === 'w' ? 'b' : 'w';

    // Emit update
    if (collapseEvents.length > 0) {
      io.to(gameId).emit('collapseEvent', {
        collapseEvents,
        gameState: game
      });
      // Also emit regular update after collapse
      setTimeout(() => {
        io.to(gameId).emit('gameUpdate', {
          gameState: game,
          moveNotation,
          collapseInfo
        });
      }, 100);
    } else {
      io.to(gameId).emit('gameUpdate', {
        gameState: game,
        moveNotation,
        collapseInfo
      });
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    
    // Find and clean up game
    for (const [gameId, game] of games.entries()) {
      const playerIndex = game.players.findIndex(p => p.socketId === socket.id);
      if (playerIndex !== -1) {
        io.to(gameId).emit('playerDisconnected');
        games.delete(gameId);
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Quantum Chess server running on port ${PORT}`);
});

