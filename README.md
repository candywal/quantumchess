This is going to be a simple game implementation of quantum chess. When you move a piece, you have the option to split the piece and have it in superposition in two places. You can play chess where there's like multiple states visible at once on the board.  Below is some vibecoded nonsense slop you can read if you want more info.

# ⚛️ Quantum Chess

A multiplayer chess game with quantum mechanics - pieces can exist in superposition states across multiple squares!

## Features

- **Quantum Superposition**: Non-pawn pieces can split into multiple states with different probabilities
- **Collapse Events**: When captures occur, quantum states collapse based on probability rolls
- **Real-time Multiplayer**: Play with friends via shareable links using WebSocket connections
- **Visual Feedback**: Quantum pieces shown with adjustable opacity and probability percentages
- **Intuitive UI**: Modern, responsive design with animations

## How to Play

1. **Standard Chess Rules**: The base game follows traditional chess rules
2. **Quantum Splitting**: When moving a non-pawn piece, you can choose to "split" it:
   - The piece exists in both locations simultaneously
   - Each state has a probability (50/50 for first split, can split further)
3. **Quantum Captures**: When a capture involves quantum pieces:
   - A dice is rolled (random number 0-1)
   - If the roll is less than the attacker's probability, the capture succeeds
   - Otherwise, the capture fails and the defender becomes real
4. **Renormalization**: When one quantum state is eliminated, remaining probabilities scale up to 100%
5. **Victory**: Capture the opponent's king to win

## Local Development

### Prerequisites

- Node.js 16.x or higher
- npm

### Installation

```bash
# Install dependencies
npm install

# Start the server
npm start
```

The game will be available at `http://localhost:3000`

### Testing Locally

1. Open `http://localhost:3000` in your browser
2. Click "Create New Game"
3. Copy the shareable link
4. Open the link in another browser/tab (or incognito window)
5. Start playing!

## Deployment to Render

### Option 1: Automatic Deployment (Recommended)

1. Push this code to a GitHub repository
2. Go to [Render Dashboard](https://dashboard.render.com/)
3. Click "New +" → "Web Service"
4. Connect your GitHub repository
5. Render will automatically detect the `render.yaml` configuration
6. Click "Create Web Service"
7. Wait for deployment to complete
8. Your game will be live at `https://your-app-name.onrender.com`

### Option 2: Manual Configuration

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click "New +" → "Web Service"
3. Connect your repository
4. Configure:
   - **Name**: quantum-chess (or your preferred name)
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
5. Click "Create Web Service"

### Important Notes

- Render's free tier includes 750 hours per month (plenty for personal use)
- The app may sleep after 15 minutes of inactivity on free tier
- First request after sleeping takes ~30 seconds to wake up
- For persistent uptime, consider upgrading to a paid plan

## Game Architecture

### Backend (server.js)
- Express.js web server
- Socket.io for real-time WebSocket communication
- Game state management with quantum mechanics
- Room-based multiplayer system

### Frontend
- Vanilla JavaScript (no framework overhead)
- Socket.io client for real-time updates
- Responsive CSS Grid chessboard
- Modal-based collapse animations

### Game State Structure

Each piece is represented as:
```javascript
{
  id: 'w-q-d1',
  type: 'q',  // queen
  color: 'w', // white
  states: [
    { square: 'd1', probability: 0.5 },
    { square: 'd4', probability: 0.5 }
  ]
}
```

## Technology Stack

- **Backend**: Node.js, Express, Socket.io
- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Chess Logic**: chess.js library (for move validation)
- **Deployment**: Render

## Contributing

This is a personal project, but feel free to fork and modify!

## License

MIT
