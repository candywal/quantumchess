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

  // Create pieces - each piece is independent with 100% probability
  for (const [square, piece] of Object.entries(startingPositions)) {
    const key = `${piece.color}-${piece.type}`;
    if (!pieceCounters[key]) pieceCounters[key] = 0;
    pieceCounters[key]++;
    
    pieces.push({
      id: `${piece.color}-${piece.type}-${pieceCounters[key]}`,
      type: piece.type,
      color: piece.color,
      square: square,
      probability: 1.0,
      displayNum: pieceCounters[key] // For display (B1, B2, etc.)
    });
  }

  return { pieces, pieceCounters };
}

// Check if a move is legal using chess.js
function isMoveLegal(pieces, fromSquare, toSquare, color) {
  const chess = new Chess();
  chess.clear();

  // Set up board with all pieces at their highest probability positions
  pieces.forEach(piece => {
    if (piece.states.length > 0) {
      // For validation, use the first state (highest probability typically)
      const mainState = piece.states[0];
      chess.put({ type: piece.type, color: piece.color }, mainState.square);
    }
  });

  // Check if move is legal
  try {
    const moves = chess.moves({ square: fromSquare, verbose: true });
    return moves.some(move => move.to === toSquare);
  } catch (e) {
    return false;
  }
}

// Get all valid moves for a piece from all its quantum states
function getValidMoves(pieces, pieceId) {
  const piece = pieces.find(p => p.id === pieceId);
  if (!piece) return [];

  const allMoves = new Set();

  piece.states.forEach(state => {
    const chess = new Chess();
    chess.clear();

    // Set up board
    pieces.forEach(p => {
      p.states.forEach(s => {
        if (chess.get(s.square) === null) {
          chess.put({ type: p.type, color: p.color }, s.square);
        }
      });
    });

    try {
      const moves = chess.moves({ square: state.square, verbose: true });
      moves.forEach(move => allMoves.add(move.to));
    } catch (e) {
      // Invalid position, skip
    }
  });

  return Array.from(allMoves);
}

// Detect if a move would cause a capture (overlap with enemy piece)
function detectCapture(pieces, movingPieceId, toSquare) {
  const movingPiece = pieces.find(p => p.id === movingPieceId);
  if (!movingPiece) return [];
  
  const captures = [];
  
  for (const piece of pieces) {
    if (piece.id === movingPieceId) continue;
    if (piece.color === movingPiece.color) continue;

    // Check if this piece is on the target square
    if (piece.square === toSquare) {
      captures.push({
        pieceId: piece.id,
        square: toSquare,
        probability: piece.probability
      });
    }
  }
  
  return captures;
}

// Collapse quantum states when capture occurs between two pieces
function collapseQuantumState(pieces, capturingPieceId, capturedPieceId, captureSquare) {
  const capturingPiece = pieces.find(p => p.id === capturingPieceId);
  const capturedPiece = pieces.find(p => p.id === capturedPieceId);

  if (!capturingPiece || !capturedPiece) return { pieces, collapseEvents: [] };

  const collapseEvents = [];

  // Roll the dice - compare attacking piece's probability
  const roll = Math.random();
  const threshold = capturingPiece.probability;

  if (roll < threshold) {
    // Capturing piece is "real" - capture succeeds
    collapseEvents.push({
      type: 'capture_success',
      roll: roll.toFixed(3),
      threshold: threshold.toFixed(3),
      capturingPiece: { id: capturingPieceId, square: captureSquare, probability: capturingPiece.probability },
      capturedPiece: { id: capturedPieceId, square: captureSquare, probability: capturedPiece.probability }
    });

    // Remove captured piece
    const capturedIndex = pieces.findIndex(p => p.id === capturedPieceId);
    if (capturedIndex !== -1) {
      pieces.splice(capturedIndex, 1);
    }

    // Capturing piece becomes 100% real at this position
    capturingPiece.probability = 1.0;
    capturingPiece.square = captureSquare;

  } else {
    // Capturing piece is NOT real - capture fails
    collapseEvents.push({
      type: 'capture_fail',
      roll: roll.toFixed(3),
      threshold: threshold.toFixed(3),
      capturingPiece: { id: capturingPieceId, square: captureSquare, probability: capturingPiece.probability },
      capturedPiece: { id: capturedPieceId, square: captureSquare, probability: capturedPiece.probability }
    });

    // Remove capturing piece (it wasn't real)
    const capturingIndex = pieces.findIndex(p => p.id === capturingPieceId);
    if (capturingIndex !== -1) {
      pieces.splice(capturingIndex, 1);
    }

    // Captured piece becomes 100% real at this position
    capturedPiece.probability = 1.0;
    capturedPiece.square = captureSquare;
  }

  return { pieces, collapseEvents };
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
function generateNotation(piece, fromSquare, toSquare, isCapture) {
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

    const piece = game.pieces.find(p => p.id === pieceId);
    if (!piece || piece.color !== player.color) {
      socket.emit('error', { message: 'Invalid piece' });
      return;
    }

    let collapseEvents = [];
    let moveNotation = '';
    let collapseInfo = null;
    const fromSquare = piece.square;

    // Handle splitting move
    if (shouldSplit && secondTarget && piece.type !== 'p') {
      // Create two new pieces at 50% probability each
      const key = `${piece.color}-${piece.type}`;
      
      // Increment counter for new pieces
      game.pieceCounters[key]++;
      const newPieceNum1 = game.pieceCounters[key];
      game.pieceCounters[key]++;
      const newPieceNum2 = game.pieceCounters[key];

      // Check for captures on both targets
      const captures1 = detectCapture(game.pieces, pieceId, firstTarget);
      const captures2 = detectCapture(game.pieces, pieceId, secondTarget);

      // Remove the original piece
      const pieceIndex = game.pieces.findIndex(p => p.id === pieceId);
      if (pieceIndex !== -1) {
        game.pieces.splice(pieceIndex, 1);
      }

      // Create first piece at firstTarget (50% probability)
      const piece1 = {
        id: `${piece.color}-${piece.type}-${newPieceNum1}`,
        type: piece.type,
        color: piece.color,
        square: firstTarget,
        probability: 0.5,
        displayNum: newPieceNum1
      };

      // Create second piece at secondTarget (50% probability)
      const piece2 = {
        id: `${piece.color}-${piece.type}-${newPieceNum2}`,
        type: piece.type,
        color: piece.color,
        square: secondTarget,
        probability: 0.5,
        displayNum: newPieceNum2
      };

      // Handle captures for piece1
      if (captures1.length > 0) {
        for (const capture of captures1) {
          const result = collapseQuantumState(game.pieces, piece1.id, capture.pieceId, firstTarget);
          // Check if piece1 survived
          if (game.pieces.find(p => p.id === piece1.id)) {
            collapseEvents = collapseEvents.concat(result.collapseEvents);
            if (!collapseInfo) collapseInfo = formatCollapseInfo(result.collapseEvents);
          }
        }
      } else {
        game.pieces.push(piece1);
      }

      // Handle captures for piece2 (only if it wasn't involved in a capture)
      if (captures2.length > 0) {
        // Add piece2 temporarily so collapse can find it
        if (!game.pieces.find(p => p.id === piece2.id)) {
          game.pieces.push(piece2);
        }
        for (const capture of captures2) {
          const result = collapseQuantumState(game.pieces, piece2.id, capture.pieceId, secondTarget);
          collapseEvents = collapseEvents.concat(result.collapseEvents);
          if (!collapseInfo) collapseInfo = formatCollapseInfo(result.collapseEvents);
        }
      } else {
        if (!game.pieces.find(p => p.id === piece2.id)) {
          game.pieces.push(piece2);
        }
      }

      moveNotation = `${piece.type.toUpperCase()}${firstTarget}|${secondTarget}`;

    } else {
      // Normal move (no split)
      const captures = detectCapture(game.pieces, pieceId, firstTarget);
      
      if (captures.length > 0) {
        // Handle all captures at this location
        for (const capture of captures) {
          const result = collapseQuantumState(game.pieces, pieceId, capture.pieceId, firstTarget);
          collapseEvents = collapseEvents.concat(result.collapseEvents);
          collapseInfo = formatCollapseInfo(result.collapseEvents);
        }
      } else {
        // Just move the piece normally
        piece.square = firstTarget;
        piece.probability = 1.0;
      }

      moveNotation = `${piece.type === 'p' ? '' : piece.type.toUpperCase()}${captures.length > 0 ? 'x' : ''}${firstTarget}`;
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

