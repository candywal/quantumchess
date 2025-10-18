/**
 * Quantum Chess Client
 *
 * This client handles the visual representation and user interaction
 * for quantum chess pieces that exist in superposition.
 *
 * Key Features:
 * - Renders quantum states as multiple pieces with opacity based on probability
 * - Only shows probability labels for pieces in true superposition (prob < 100%)
 * - Handles piece selection and move target selection
 * - Displays quantum collapse animations with dice rolls
 * - Supports move history navigation
 */

// Game state
let socket;
let gameId;
let playerColor;
let gameState;
let selectedPiece = null;
let selectedSquare = null;
let splittingMode = 'optional'; // 'optional' or 'forced'
let timeControl = 'unlimited'; // e.g. '5+0', '10+5', 'unlimited'

// Split state (for selecting two squares)
let splitTargets = {
    first: null,
    second: null
};

// Clock state
let whiteTime = null; // in milliseconds
let blackTime = null;
let clockInterval = null;
let lastTickTime = null;

// Move history
let moveHistory = [];
let currentHistoryIndex = -1;
let viewingHistory = false;

// Unicode chess pieces
const PIECES = {
    'w': {
        'k': '♔', 'q': '♕', 'r': '♖', 'b': '♗', 'n': '♘', 'p': '♙'
    },
    'b': {
        'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟'
    }
};

// Initialize game
document.addEventListener('DOMContentLoaded', () => {
    // Get game ID and settings from URL
    const urlParams = new URLSearchParams(window.location.search);
    gameId = urlParams.get('id');
    splittingMode = urlParams.get('mode') || 'optional';
    timeControl = urlParams.get('time') || 'unlimited';
    
    // Decode time control (spaces back to +)
    if (timeControl && timeControl !== 'unlimited') {
        timeControl = timeControl.replace(/ /g, '+');
    }

    if (!gameId) {
        alert('No game ID provided');
        window.location.href = '/';
        return;
    }

    // Initialize socket connection
    socket = io();
    
    // Join game with settings
    socket.emit('joinGame', { gameId, splittingMode, timeControl });

    // Set up event listeners
    setupSocketListeners();
    setupUIListeners();

    // Display game ID and mode
    document.getElementById('gameId').textContent = `Game: ${gameId}`;
    displayGameMode();
    initializeClock();
});

function setupSocketListeners() {
    socket.on('gameJoined', ({ color, gameState: state }) => {
        playerColor = color;
        gameState = state;
        document.getElementById('playerColor').textContent = 
            `Playing as: ${color === 'w' ? 'White ⚪' : 'Black ⚫'}`;
        updateGameStatus('Waiting for opponent...');
        renderBoard();
    });

    socket.on('gameCreated', ({ color, gameState: state }) => {
        playerColor = color;
        gameState = state;
        document.getElementById('playerColor').textContent = 
            `Playing as: ${color === 'w' ? 'White ⚪' : 'Black ⚫'}`;
        updateGameStatus('Waiting for opponent...');
        renderBoard();
    });

    socket.on('gameStart', ({ gameState: state }) => {
        gameState = state;
        updateGameStatus('Game started! White to move.');
        updateTurnIndicator();
        renderBoard();
        startClock(); // Start clock when game begins
    });

    socket.on('gameUpdate', ({ gameState: state, moveNotation, collapseInfo }) => {
        // Store move in history
        addMoveToHistory(gameState, state, moveNotation, collapseInfo);
        
        gameState = state;
        
        // Add increment for the player who just moved
        const playerWhoMoved = state.currentTurn === 'w' ? 'b' : 'w';
        addIncrement(playerWhoMoved);
        
        selectedPiece = null;
        selectedSquare = null;
        splitTargets = { first: null, second: null };
        viewingHistory = false;
        hideMoveOptions();
        updateTurnIndicator();
        updateClockDisplay();
        renderBoard();
        updateHistoryDisplay();
        startClock(); // Restart clock for next player
    });

    socket.on('collapseEvent', ({ collapseEvents, gameState: state }) => {
        stopClock(); // Stop clock during collapse animation
        gameState = state;
        showCollapseAnimation(collapseEvents, () => {
            // After animation, update everything and restart clock
            const playerWhoMoved = state.currentTurn === 'w' ? 'b' : 'w';
            addIncrement(playerWhoMoved);
            updateTurnIndicator();
            updateClockDisplay();
            renderBoard();
            startClock();
        });
    });

    socket.on('gameOver', ({ winner, collapseEvents }) => {
        stopClock();
        if (collapseEvents && collapseEvents.length > 0) {
            showCollapseAnimation(collapseEvents, () => {
                showGameOver(winner);
            });
        } else {
            showGameOver(winner);
        }
    });

    socket.on('playerDisconnected', () => {
        updateGameStatus('Opponent disconnected. Game ended.');
        alert('Your opponent has disconnected.');
    });

    socket.on('error', ({ message }) => {
        alert(`Error: ${message}`);
    });
}

function setupUIListeners() {
    document.getElementById('normalMoveBtn').addEventListener('click', () => {
        if (selectedPiece && splitTargets.first) {
            makeMove(false, splitTargets.first);
        }
    });

    document.getElementById('confirmSplitBtn').addEventListener('click', () => {
        if (selectedPiece && splitTargets.first && splitTargets.second) {
            makeMove(true, splitTargets.first, splitTargets.second);
        }
    });

    document.getElementById('cancelMoveBtn').addEventListener('click', () => {
        selectedPiece = null;
        selectedSquare = null;
        splitTargets = { first: null, second: null };
        hideMoveOptions();
        renderBoard();
    });

    document.getElementById('closeModalBtn').addEventListener('click', () => {
        document.getElementById('collapseModal').classList.add('hidden');
    });

    document.getElementById('newGameBtn').addEventListener('click', () => {
        window.location.href = '/';
    });

    // History navigation
    document.getElementById('historyBackBtn').addEventListener('click', () => {
        navigateHistory(-1);
    });

    document.getElementById('historyForwardBtn').addEventListener('click', () => {
        navigateHistory(1);
    });

    // Arrow key navigation
    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            navigateHistory(-1);
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            navigateHistory(1);
        }
    });
}

function renderBoard() {
    const board = document.getElementById('chessboard');
    board.innerHTML = '';

    // Create 8x8 grid (flipped for black player)
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const actualRow = playerColor === 'b' ? row : 7 - row;
            const actualCol = playerColor === 'b' ? 7 - col : col;

            const square = document.createElement('div');
            const squareId = columnToLetter(actualCol) + (actualRow + 1);
            square.className = `square ${(actualRow + actualCol) % 2 === 0 ? 'light' : 'dark'}`;
            square.dataset.square = squareId;

            // Highlight selected piece's states
            if (selectedPiece && selectedPiece.states) {
                const hasState = selectedPiece.states.some(s => s.square === squareId);
                if (hasState) {
                    square.classList.add('selected');
                }
            }

            square.addEventListener('click', () => handleSquareClick(squareId));

            board.appendChild(square);
        }
    }

    // Render pieces with their quantum states
    if (gameState && gameState.pieces) {
        gameState.pieces.forEach(piece => {
            renderPiece(piece);
        });
    }
}

function renderPiece(piece) {
    if (!piece.states || piece.states.length === 0) return;

    // Render each quantum state of the piece
    piece.states.forEach(state => {
        const squareElement = document.querySelector(`[data-square="${state.square}"]`);
        if (!squareElement) return;

        const pieceElement = document.createElement('div');
        pieceElement.className = 'piece';
        pieceElement.textContent = PIECES[piece.color][piece.type];
        pieceElement.dataset.pieceId = piece.id;

        // Determine if piece is in superposition (multiple states OR single state with prob < 1)
        const isQuantum = piece.states.length > 1 || state.probability < 1.0;

        if (isQuantum) {
            pieceElement.classList.add('quantum');
            pieceElement.style.opacity = Math.max(0.3, state.probability);

            // Only show probability label if truly quantum (not 100% deterministic)
            if (piece.states.length > 1 || state.probability < 1.0) {
                const probLabel = document.createElement('span');
                probLabel.className = 'prob-label';
                probLabel.textContent = `${piece.type.toUpperCase()}${piece.displayNum} ${Math.round(state.probability * 100)}%`;
                pieceElement.appendChild(probLabel);
            }
        } else if (piece.displayNum > 1) {
            // Show piece number for deterministic pieces only if numbered > 1
            const probLabel = document.createElement('span');
            probLabel.className = 'prob-label';
            probLabel.textContent = `${piece.type.toUpperCase()}${piece.displayNum}`;
            pieceElement.appendChild(probLabel);
        }

        squareElement.appendChild(pieceElement);
    });
}

function handleSquareClick(squareId) {
    if (!gameState || gameState.gameOver) return;
    if (gameState.currentTurn !== playerColor) return;

    // Check if clicking on own piece
    const pieceOnSquare = findPieceAtSquare(squareId, playerColor);
    
    if (pieceOnSquare) {
        // Select this piece
        selectedPiece = pieceOnSquare;
        selectedSquare = null;
        splitTargets = { first: null, second: null };
        hideMoveOptions();
        renderBoard();
        return;
    }

    // If a piece is selected, handle split target selection
    if (selectedPiece) {
        handleTargetSelection(squareId);
    }
}

function handleTargetSelection(squareId) {
    const isPawn = selectedPiece.type === 'p';
    const forcedSplitting = splittingMode === 'forced' && !isPawn;

    if (!splitTargets.first) {
        // First target selected
        splitTargets.first = squareId;
        
        if (forcedSplitting) {
            // Must select second target
            document.getElementById('firstTarget').textContent = squareId;
            document.getElementById('splitMessage').textContent = 'Select second destination square';
            document.getElementById('splitInstructions').classList.remove('hidden');
        } else if (isPawn) {
            // Pawns can't split, just move normally
            makeMove(false, squareId);
            return;
        } else {
            // Optional splitting - show choice
            document.getElementById('firstTarget').textContent = squareId;
            document.getElementById('secondTarget').textContent = '--';
            document.getElementById('splitMessage').textContent = 'Move normally or select 2nd square to split';
            document.getElementById('normalMoveBtn').classList.remove('hidden');
            document.getElementById('splitInstructions').classList.remove('hidden');
        }
        renderBoard();
        
    } else if (!splitTargets.second && forcedSplitting) {
        // Second target for forced splitting
        if (squareId === splitTargets.first) {
            alert('Please select a different square for the second target');
            return;
        }
        splitTargets.second = squareId;
        document.getElementById('secondTarget').textContent = squareId;
        document.getElementById('confirmSplitBtn').classList.remove('hidden');
        document.getElementById('splitMessage').textContent = 'Confirm your split move';
        renderBoard();
        
    } else if (!splitTargets.second && splittingMode === 'optional') {
        // Second target for optional splitting
        if (squareId === splitTargets.first) {
            alert('Please select a different square for the second target');
            return;
        }
        splitTargets.second = squareId;
        document.getElementById('secondTarget').textContent = squareId;
        document.getElementById('normalMoveBtn').classList.add('hidden');
        document.getElementById('confirmSplitBtn').classList.remove('hidden');
        document.getElementById('splitMessage').textContent = 'Confirm your split move';
        renderBoard();
    }
}

function findPieceAtSquare(square, color) {
    if (!gameState || !gameState.pieces) return null;

    return gameState.pieces.find(piece =>
        piece.color === color &&
        piece.states &&
        piece.states.some(s => s.square === square)
    );
}

function hideMoveOptions() {
    document.getElementById('splitInstructions').classList.add('hidden');
    document.getElementById('normalMoveBtn').classList.add('hidden');
    document.getElementById('confirmSplitBtn').classList.add('hidden');
    document.getElementById('firstTarget').textContent = '--';
    document.getElementById('secondTarget').textContent = '--';
}

function makeMove(shouldSplit, firstTarget, secondTarget = null) {
    if (!selectedPiece || !firstTarget) return;

    socket.emit('makeMove', {
        gameId,
        pieceId: selectedPiece.id,
        firstTarget,
        secondTarget,
        shouldSplit
    });

    selectedPiece = null;
    splitTargets = { first: null, second: null };
    hideMoveOptions();
}

function updateTurnIndicator() {
    const indicator = document.getElementById('turnIndicator');
    const isMyTurn = gameState && gameState.currentTurn === playerColor;
    
    if (isMyTurn) {
        indicator.textContent = 'Your Turn';
        indicator.classList.add('your-turn');
        updateGameStatus("It's your turn!");
    } else {
        indicator.textContent = "Opponent's Turn";
        indicator.classList.remove('your-turn');
        updateGameStatus("Waiting for opponent...");
    }
}

function updateGameStatus(message) {
    document.getElementById('statusMessage').textContent = message;
}

function showCollapseAnimation(collapseEvents, callback) {
    const modal = document.getElementById('collapseModal');
    const details = document.getElementById('collapseDetails');
    
    details.innerHTML = '';

    collapseEvents.forEach(event => {
        const eventDiv = document.createElement('div');
        eventDiv.className = 'collapse-event';

        // Dice roll display
        const diceRoll = document.createElement('div');
        diceRoll.className = 'dice-roll';
        diceRoll.textContent = '🎲';
        eventDiv.appendChild(diceRoll);

        // Event details
        const detailsText = document.createElement('div');
        const roll = parseFloat(event.roll);
        const threshold = parseFloat(event.threshold);
        
        if (event.type === 'capture_success') {
            detailsText.innerHTML = `
                <strong class="success">Capture Successful!</strong><br>
                Roll: ${(roll * 100).toFixed(1)}% < ${(threshold * 100).toFixed(1)}%<br>
                The attacking piece was real at this location.<br>
                <br>
                ${getPieceName(event.capturingPiece.id)} captured ${getPieceName(event.capturedPiece.id)} at ${event.capturingPiece.square}
            `;
        } else {
            const actualLocation = event.defenderActualSquare
                ? `collapsed to ${event.defenderActualSquare}`
                : 'was removed (no other states)';
            detailsText.innerHTML = `
                <strong class="failure">Capture Failed!</strong><br>
                Roll: ${(roll * 100).toFixed(1)}% ≥ ${(threshold * 100).toFixed(1)}%<br>
                Neither piece was real at this location.<br>
                <br>
                ${getPieceName(event.capturedPiece.id)} ${actualLocation}<br>
                ${getPieceName(event.capturingPiece.id)} state removed from ${event.capturingPiece.square}
            `;
        }
        
        eventDiv.appendChild(detailsText);
        details.appendChild(eventDiv);
    });

    modal.classList.remove('hidden');

    if (callback) {
        document.getElementById('closeModalBtn').addEventListener('click', callback, { once: true });
    }
}

function showGameOver(winner) {
    const modal = document.getElementById('gameOverModal');
    const title = document.getElementById('gameOverTitle');
    const message = document.getElementById('gameOverMessage');

    if (winner === 'white') {
        title.textContent = playerColor === 'w' ? '🎉 You Won!' : '😢 You Lost';
        message.textContent = 'White captured the black king!';
    } else {
        title.textContent = playerColor === 'b' ? '🎉 You Won!' : '😢 You Lost';
        message.textContent = 'Black captured the white king!';
    }

    modal.classList.remove('hidden');
}

function getPieceName(pieceId) {
    const parts = pieceId.split('-');
    const color = parts[0] === 'w' ? 'White' : 'Black';
    const typeMap = {
        'k': 'King', 'q': 'Queen', 'r': 'Rook', 
        'b': 'Bishop', 'n': 'Knight', 'p': 'Pawn'
    };
    const type = typeMap[parts[1]] || 'Piece';
    return `${color} ${type}`;
}

function columnToLetter(col) {
    return String.fromCharCode(97 + col); // 97 is 'a' in ASCII
}

function letterToColumn(letter) {
    return letter.charCodeAt(0) - 97;
}

// Display game mode
function displayGameMode() {
    const modeDisplay = document.getElementById('gameModeDisplay');
    const modeText = splittingMode === 'forced' ? '⚛️ Forced Splitting Mode' : '🎮 Optional Splitting Mode';
    const timeText = timeControl === 'unlimited' ? ' | No Time Limit' : ` | ${timeControl}`;
    modeDisplay.textContent = modeText + timeText;
}

// Initialize clock
function initializeClock() {
    if (timeControl === 'unlimited') {
        document.getElementById('clockContainer').style.display = 'none';
        return;
    }

    const parts = timeControl.split('+');
    const minutes = parseInt(parts[0]) || 5;
    const increment = parts[1] ? parseInt(parts[1]) : 0;
    
    whiteTime = minutes * 60 * 1000; // convert to milliseconds
    blackTime = minutes * 60 * 1000;
    
    console.log(`Clock initialized: ${minutes} min + ${increment} sec increment`);
    updateClockDisplay();
}

// Update clock display
function updateClockDisplay() {
    const whiteClockEl = document.querySelector('#whiteClock .clock-time');
    const blackClockEl = document.querySelector('#blackClock .clock-time');
    
    whiteClockEl.textContent = formatTime(whiteTime);
    blackClockEl.textContent = formatTime(blackTime);

    // Highlight active player's clock
    const whiteClockContainer = document.getElementById('whiteClock');
    const blackClockContainer = document.getElementById('blackClock');
    
    if (gameState && gameState.currentTurn === 'w') {
        whiteClockContainer.classList.add('active');
        blackClockContainer.classList.remove('active');
    } else if (gameState) {
        blackClockContainer.classList.add('active');
        whiteClockContainer.classList.remove('active');
    }

    // Add low time warning
    if (whiteTime < 30000) { // less than 30 seconds
        whiteClockContainer.classList.add('low-time');
    } else {
        whiteClockContainer.classList.remove('low-time');
    }
    
    if (blackTime < 30000) {
        blackClockContainer.classList.add('low-time');
    } else {
        blackClockContainer.classList.remove('low-time');
    }
}

// Format time in MM:SS
function formatTime(milliseconds) {
    if (milliseconds === null || milliseconds < 0) return '--:--';
    
    const totalSeconds = Math.ceil(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// Start clock for current player
function startClock() {
    if (timeControl === 'unlimited') return;
    
    stopClock();
    lastTickTime = Date.now();
    
    clockInterval = setInterval(() => {
        const now = Date.now();
        const elapsed = now - lastTickTime;
        lastTickTime = now;
        
        if (gameState.currentTurn === 'w') {
            whiteTime -= elapsed;
            if (whiteTime <= 0) {
                whiteTime = 0;
                stopClock();
                handleTimeOut('white');
            }
        } else {
            blackTime -= elapsed;
            if (blackTime <= 0) {
                blackTime = 0;
                stopClock();
                handleTimeOut('black');
            }
        }
        
        updateClockDisplay();
    }, 100); // Update every 100ms for smooth countdown
}

// Stop clock
function stopClock() {
    if (clockInterval) {
        clearInterval(clockInterval);
        clockInterval = null;
    }
}

// Add time increment
function addIncrement(color) {
    if (timeControl === 'unlimited') return;
    
    const parts = timeControl.split('+');
    const increment = parts[1] ? parseInt(parts[1]) : 0;
    
    if (increment > 0) {
        if (color === 'w') {
            whiteTime += increment * 1000;
        } else {
            blackTime += increment * 1000;
        }
        console.log(`Added ${increment}s increment to ${color}`);
        updateClockDisplay();
    }
}

// Handle timeout
function handleTimeOut(color) {
    const winner = color === 'white' ? 'black' : 'white';
    showGameOver(winner, true);
}

// Update showGameOver to handle timeout
const originalShowGameOver = showGameOver;
function showGameOver(winner, isTimeout = false) {
    stopClock();
    const modal = document.getElementById('gameOverModal');
    const title = document.getElementById('gameOverTitle');
    const message = document.getElementById('gameOverMessage');

    if (isTimeout) {
        const loser = winner === 'white' ? 'Black' : 'White';
        title.textContent = playerColor === winner.charAt(0) ? '🎉 You Won!' : '😢 You Lost';
        message.textContent = `${loser} ran out of time!`;
    } else if (winner === 'white') {
        title.textContent = playerColor === 'w' ? '🎉 You Won!' : '😢 You Lost';
        message.textContent = 'White captured the black king!';
    } else {
        title.textContent = playerColor === 'b' ? '🎉 You Won!' : '😢 You Lost';
        message.textContent = 'Black captured the white king!';
    }

    modal.classList.remove('hidden');
}

// Move history functions
function addMoveToHistory(beforeState, afterState, notation, collapseInfo) {
    const move = {
        beforeState: JSON.parse(JSON.stringify(beforeState)),
        afterState: JSON.parse(JSON.stringify(afterState)),
        notation: notation || '???',
        collapseInfo: collapseInfo
    };
    
    moveHistory.push(move);
    currentHistoryIndex = moveHistory.length - 1;
}

function navigateHistory(direction) {
    const newIndex = currentHistoryIndex + direction;
    
    if (newIndex < -1 || newIndex >= moveHistory.length) return;
    
    currentHistoryIndex = newIndex;
    viewingHistory = (currentHistoryIndex >= 0 && currentHistoryIndex < moveHistory.length - 1);
    
    if (currentHistoryIndex >= 0 && moveHistory[currentHistoryIndex]) {
        renderHistoricalState(moveHistory[currentHistoryIndex].afterState);
    } else {
        viewingHistory = false;
        renderBoard();
    }
    
    updateHistoryDisplay();
    updateHistoryButtons();
}

function renderHistoricalState(historicalState) {
    const board = document.getElementById('chessboard');
    board.innerHTML = '';

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const actualRow = playerColor === 'b' ? row : 7 - row;
            const actualCol = playerColor === 'b' ? 7 - col : col;

            const square = document.createElement('div');
            const squareId = columnToLetter(actualCol) + (actualRow + 1);
            square.className = `square ${(actualRow + actualCol) % 2 === 0 ? 'light' : 'dark'}`;
            square.dataset.square = squareId;
            board.appendChild(square);
        }
    }

    if (historicalState && historicalState.pieces) {
        historicalState.pieces.forEach(piece => {
            renderPiece(piece);
        });
    }
}

function updateHistoryButtons() {
    const backBtn = document.getElementById('historyBackBtn');
    const forwardBtn = document.getElementById('historyForwardBtn');
    
    backBtn.disabled = (currentHistoryIndex < 0);
    forwardBtn.disabled = (currentHistoryIndex >= moveHistory.length - 1);
}

function updateHistoryDisplay() {
    const moveList = document.getElementById('moveList');
    const counter = document.getElementById('historyCounter');
    
    counter.textContent = `(${moveHistory.length})`;
    moveList.innerHTML = '';
    
    for (let i = 0; i < moveHistory.length; i++) {
        const move = moveHistory[i];
        const moveNum = Math.floor(i / 2) + 1;
        const isWhite = i % 2 === 0;
        
        let entry;
        if (isWhite) {
            entry = document.createElement('div');
            entry.className = 'move-entry';
            if (i === currentHistoryIndex) entry.classList.add('viewing');
            
            const numSpan = document.createElement('span');
            numSpan.className = 'move-number';
            numSpan.textContent = `${moveNum}.`;
            entry.appendChild(numSpan);
            
            const notationSpan = document.createElement('span');
            notationSpan.className = 'move-notation white';
            notationSpan.textContent = move.notation;
            entry.appendChild(notationSpan);
            
            moveList.appendChild(entry);
        } else {
            const entries = moveList.getElementsByClassName('move-entry');
            entry = entries[entries.length - 1];
            if (i === currentHistoryIndex) entry.classList.add('viewing');
            
            const notationSpan = document.createElement('span');
            notationSpan.className = 'move-notation black';
            notationSpan.textContent = move.notation;
            entry.appendChild(notationSpan);
        }
        
        if (move.collapseInfo) {
            const collapseSpan = document.createElement('span');
            collapseSpan.className = 'collapse-indicator';
            collapseSpan.textContent = `⚛️ ${move.collapseInfo}`;
            entry.appendChild(collapseSpan);
        }
    }
    
    updateHistoryButtons();
    
    if (!viewingHistory && moveList.lastChild) {
        moveList.lastChild.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}
