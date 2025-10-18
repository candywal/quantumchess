// Game state
let socket;
let gameId;
let playerColor;
let gameState;
let selectedPiece = null;
let selectedSquare = null;

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
    // Get game ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    gameId = urlParams.get('id');

    if (!gameId) {
        alert('No game ID provided');
        window.location.href = '/';
        return;
    }

    // Initialize socket connection
    socket = io();
    
    // Join game
    socket.emit('joinGame', gameId);

    // Set up event listeners
    setupSocketListeners();
    setupUIListeners();

    // Display game ID
    document.getElementById('gameId').textContent = `Game: ${gameId}`;
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
    });

    socket.on('gameUpdate', ({ gameState: state }) => {
        gameState = state;
        selectedPiece = null;
        selectedSquare = null;
        hideMoveOptions();
        updateTurnIndicator();
        renderBoard();
    });

    socket.on('collapseEvent', ({ collapseEvents, gameState: state }) => {
        gameState = state;
        showCollapseAnimation(collapseEvents);
        renderBoard();
    });

    socket.on('gameOver', ({ winner, collapseEvents }) => {
        if (collapseEvents) {
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
        if (selectedPiece && selectedSquare) {
            makeMove(false);
        }
    });

    document.getElementById('splitMoveBtn').addEventListener('click', () => {
        if (selectedPiece && selectedSquare) {
            makeMove(true);
        }
    });

    document.getElementById('cancelMoveBtn').addEventListener('click', () => {
        selectedPiece = null;
        selectedSquare = null;
        hideMoveOptions();
        renderBoard();
    });

    document.getElementById('closeModalBtn').addEventListener('click', () => {
        document.getElementById('collapseModal').classList.add('hidden');
    });

    document.getElementById('newGameBtn').addEventListener('click', () => {
        window.location.href = '/';
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

            // Highlight selected square
            if (selectedPiece && selectedPiece.states.some(s => s.square === squareId)) {
                square.classList.add('selected');
            }

            square.addEventListener('click', () => handleSquareClick(squareId));

            board.appendChild(square);
        }
    }

    // Render pieces
    if (gameState && gameState.pieces) {
        gameState.pieces.forEach(piece => {
            piece.states.forEach(state => {
                renderPiece(piece, state);
            });
        });
    }
}

function renderPiece(piece, state) {
    const squareElement = document.querySelector(`[data-square="${state.square}"]`);
    if (!squareElement) return;

    const pieceElement = document.createElement('div');
    pieceElement.className = 'piece';
    pieceElement.textContent = PIECES[piece.color][piece.type];
    pieceElement.dataset.pieceId = piece.id;

    // Apply quantum styling
    if (state.probability < 1.0) {
        pieceElement.classList.add('quantum');
        pieceElement.style.opacity = Math.max(0.3, state.probability);

        // Add probability label
        const probLabel = document.createElement('span');
        probLabel.className = 'prob-label';
        probLabel.textContent = `${Math.round(state.probability * 100)}%`;
        pieceElement.appendChild(probLabel);
    }

    squareElement.appendChild(pieceElement);
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
        hideMoveOptions();
        renderBoard();
        return;
    }

    // If a piece is selected, try to move to this square
    if (selectedPiece) {
        selectedSquare = squareId;
        showMoveOptions(squareId);
    }
}

function findPieceAtSquare(square, color) {
    if (!gameState || !gameState.pieces) return null;
    
    return gameState.pieces.find(piece => 
        piece.color === color && 
        piece.states.some(state => state.square === square)
    );
}

function showMoveOptions(targetSquare) {
    const moveOptions = document.getElementById('moveOptions');
    const targetSquareSpan = document.getElementById('targetSquare');
    const splitBtn = document.getElementById('splitMoveBtn');

    targetSquareSpan.textContent = targetSquare;
    moveOptions.classList.remove('hidden');

    // Hide split option for pawns
    if (selectedPiece.type === 'p') {
        splitBtn.style.display = 'none';
    } else {
        splitBtn.style.display = 'block';
    }
}

function hideMoveOptions() {
    document.getElementById('moveOptions').classList.add('hidden');
}

function makeMove(shouldSplit) {
    if (!selectedPiece || !selectedSquare) return;

    socket.emit('makeMove', {
        gameId,
        pieceId: selectedPiece.id,
        toSquare: selectedSquare,
        shouldSplit
    });

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
            detailsText.innerHTML = `
                <strong class="failure">Capture Failed!</strong><br>
                Roll: ${(roll * 100).toFixed(1)}% ≥ ${(threshold * 100).toFixed(1)}%<br>
                The attacking piece was NOT real at this location.<br>
                <br>
                ${getPieceName(event.capturedPiece.id)} survived at ${event.capturedPiece.square}
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

