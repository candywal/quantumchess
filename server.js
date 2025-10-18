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
function createGame(gameId) {
  const game = {
    id: gameId,
    players: [],
    currentTurn: 'w', // 'w' or 'b'
    pieces: initializeQuantumBoard(),
    gameOver: false,
    winner: null
  };
  return game;
}

// Initialize standard chess starting position with quantum structure
function initializeQuantumBoard() {
  const pieces = [];
  
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

  // Create pieces with single quantum state (100% probability)
  for (const [square, piece] of Object.entries(startingPositions)) {
    pieces.push({
      id: `${piece.color}-${piece.type}-${square}`,
      type: piece.type,
      color: piece.color,
      states: [{ square, probability: 1.0 }]
    });
  }

  return pieces;
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
  
  for (const piece of pieces) {
    if (piece.id === movingPieceId) continue;
    if (piece.color === movingPiece.color) continue;

    for (const state of piece.states) {
      if (state.square === toSquare) {
        return { captured: true, pieceId: piece.id, square: toSquare };
      }
    }
  }
  
  return { captured: false };
}

// Collapse quantum states when capture occurs
function collapseQuantumState(pieces, capturingPieceId, capturedPieceId, captureSquare) {
  const capturingPiece = pieces.find(p => p.id === capturingPieceId);
  const capturedPiece = pieces.find(p => p.id === capturedPieceId);

  const collapseEvents = [];

  // Find the capturing state
  const capturingStateIndex = capturingPiece.states.findIndex(s => s.square === captureSquare);
  if (capturingStateIndex === -1) return { pieces, collapseEvents };

  const capturingState = capturingPiece.states[capturingStateIndex];

  // Find the captured state
  const capturedStateIndex = capturedPiece.states.findIndex(s => s.square === captureSquare);
  if (capturedStateIndex === -1) return { pieces, collapseEvents };

  const capturedState = capturedPiece.states[capturedStateIndex];

  // Roll the dice
  const roll = Math.random();
  const threshold = capturingState.probability;

  if (roll < threshold) {
    // Capturing piece is "real" at this location - capture succeeds
    collapseEvents.push({
      type: 'capture_success',
      roll: roll.toFixed(3),
      threshold: threshold.toFixed(3),
      capturingPiece: { id: capturingPieceId, square: captureSquare, probability: capturingState.probability },
      capturedPiece: { id: capturedPieceId, square: captureSquare, probability: capturedState.probability }
    });

    // Remove captured state
    capturedPiece.states.splice(capturedStateIndex, 1);

    // Renormalize captured piece's remaining states
    if (capturedPiece.states.length > 0) {
      const sum = capturedPiece.states.reduce((acc, s) => acc + s.probability, 0);
      capturedPiece.states.forEach(s => s.probability = s.probability / sum);
    }

    // Capturing piece collapses to this position
    capturingPiece.states = [{ square: captureSquare, probability: 1.0 }];

  } else {
    // Capturing piece is NOT real at this location - capture fails
    collapseEvents.push({
      type: 'capture_fail',
      roll: roll.toFixed(3),
      threshold: threshold.toFixed(3),
      capturingPiece: { id: capturingPieceId, square: captureSquare, probability: capturingState.probability },
      capturedPiece: { id: capturedPieceId, square: captureSquare, probability: capturedState.probability }
    });

    // Remove capturing state
    capturingPiece.states.splice(capturingStateIndex, 1);

    // Renormalize capturing piece's remaining states
    if (capturingPiece.states.length > 0) {
      const sum = capturingPiece.states.reduce((acc, s) => acc + s.probability, 0);
      capturingPiece.states.forEach(s => s.probability = s.probability / sum);
    }

    // Captured piece collapses to this position
    capturedPiece.states = [{ square: captureSquare, probability: 1.0 }];
  }

  // Remove pieces with no states left
  const filteredPieces = pieces.filter(p => p.states.length > 0);

  return { pieces: filteredPieces, collapseEvents };
}

// Check if king is captured (game over)
function checkGameOver(pieces) {
  const whiteKing = pieces.find(p => p.type === 'k' && p.color === 'w');
  const blackKing = pieces.find(p => p.type === 'k' && p.color === 'b');

  if (!whiteKing) return { gameOver: true, winner: 'black' };
  if (!blackKing) return { gameOver: true, winner: 'white' };
  
  return { gameOver: false, winner: null };
}

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  // Create new game
  socket.on('createGame', () => {
    const gameId = generateGameId();
    const game = createGame(gameId);
    game.players.push({ socketId: socket.id, color: 'w' });
    games.set(gameId, game);
    
    socket.join(gameId);
    socket.emit('gameCreated', { 
      gameId, 
      color: 'w',
      gameState: game 
    });
    
    console.log(`Game created: ${gameId}`);
  });

  // Join existing game
  socket.on('joinGame', (gameId) => {
    const game = games.get(gameId);
    
    if (!game) {
      socket.emit('error', { message: 'Game not found' });
      return;
    }

    if (game.players.length >= 2) {
      socket.emit('error', { message: 'Game is full' });
      return;
    }

    game.players.push({ socketId: socket.id, color: 'b' });
    socket.join(gameId);
    
    socket.emit('gameJoined', { 
      gameId, 
      color: 'b',
      gameState: game 
    });

    // Notify both players that game can start
    io.to(gameId).emit('gameStart', { gameState: game });
    
    console.log(`Player joined game: ${gameId}`);
  });

  // Make a move
  socket.on('makeMove', ({ gameId, pieceId, toSquare, shouldSplit }) => {
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

    // Check for captures
    const captureInfo = detectCapture(game.pieces, pieceId, toSquare);
    
    if (captureInfo.captured) {
      // Handle quantum collapse
      const result = collapseQuantumState(game.pieces, pieceId, captureInfo.pieceId, toSquare);
      game.pieces = result.pieces;

      // Check if game is over
      const gameOverStatus = checkGameOver(game.pieces);
      if (gameOverStatus.gameOver) {
        game.gameOver = true;
        game.winner = gameOverStatus.winner;
        io.to(gameId).emit('gameOver', { 
          winner: gameOverStatus.winner,
          collapseEvents: result.collapseEvents 
        });
        return;
      }

      // Emit collapse event to both players
      io.to(gameId).emit('collapseEvent', { 
        collapseEvents: result.collapseEvents,
        gameState: game 
      });

    } else if (shouldSplit && piece.type !== 'p') {
      // Split the piece into quantum superposition
      const fromSquare = piece.states[0].square; // Assuming single state for now
      
      if (piece.states.length === 1) {
        // First split: 50/50
        piece.states = [
          { square: fromSquare, probability: 0.5 },
          { square: toSquare, probability: 0.5 }
        ];
      } else {
        // Already split - redistribute probabilities
        const fromStateIndex = piece.states.findIndex(s => s.square === fromSquare);
        if (fromStateIndex !== -1) {
          const fromProb = piece.states[fromStateIndex].probability;
          piece.states[fromStateIndex].probability = fromProb / 2;
          piece.states.push({ square: toSquare, probability: fromProb / 2 });
        }
      }

    } else {
      // Normal move - move all quantum states
      piece.states = [{ square: toSquare, probability: 1.0 }];
    }

    // Switch turns
    game.currentTurn = game.currentTurn === 'w' ? 'b' : 'w';

    // Emit updated game state
    io.to(gameId).emit('gameUpdate', { gameState: game });
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

