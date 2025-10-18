# Quantum Chess - Quantum Mechanics Guide

## Introduction

This guide explains how the quantum mechanics work in Quantum Chess, helping players and developers understand the unique gameplay elements.

## Core Concepts

### 1. Quantum Superposition

In quantum chess, pieces can exist in **superposition** - simultaneously occupying multiple squares with associated probabilities.

**Example:**
- A knight at d4 can split its move to e6 and c6
- Result: The knight exists at both squares with 50% probability each
- On the board, you'll see two semi-transparent knights labeled "N1 50%"

### 2. Quantum States

Each piece maintains an array of **quantum states**:
```
Piece ID: w-n-1
States:
  - Square: e6, Probability: 50%
  - Square: c6, Probability: 50%
```

**Key Rules:**
- All probabilities for a piece sum to 100%
- A piece can have 1 to many quantum states
- States with 0% probability are automatically removed

### 3. Deterministic Pieces

Pieces with only one state at 100% probability are **deterministic**:
- They appear solid (not transparent)
- No probability label is shown
- They behave like normal chess pieces

## Game Mechanics

### Making Normal Moves

1. Click on your piece to select it
2. Click on a destination square
3. If no capture occurs, the piece moves normally
4. The piece remains or becomes deterministic (100% at new location)

**Move Validation:**
- All moves are validated using standard chess rules
- Pieces cannot move through other pieces
- Pieces cannot land on friendly pieces
- Each piece type moves according to chess rules

### Splitting (Quantum Superposition)

**When Available:**
- Optional Mode: All pieces except pawns can choose to split
- Forced Mode: All pieces except pawns must split

**How to Split:**
1. Select your piece
2. Click first destination (e.g., e4)
3. Click second destination (e.g., e5)
4. Confirm the split move

**What Happens:**
- Each existing state splits into two new states
- Probabilities are divided equally
- Example: 100% piece → 50% at A + 50% at B
- Example: [50% at A, 50% at B] → [25% at C, 25% at D] (consolidated)

### Quantum Capture

When a piece attempts to capture an opponent, **quantum collapse** occurs.

#### Capture Mechanics

1. **Setup:** Attacker moves to a square occupied by an enemy state
2. **Measurement:** A random dice roll (0-100%) is performed
3. **Comparison:** Roll is compared to attacker's probability at that square
4. **Collapse:** One of two outcomes occurs

#### Success (Roll < Attacker Probability)

**The attacker was REAL at this location:**
- ✅ Defender is completely captured (removed entirely)
- ✅ Attacker collapses to 100% at capture square
- ✅ All other attacker states are removed

**Visual Feedback:**
```
Capture Successful! ✓
Roll: 35.2% < 50.0%
The attacking piece was real at this location.
White Knight captured Black Pawn at e4
```

#### Failure (Roll ≥ Attacker Probability)

**The attacker was NOT real at this location:**
- ❌ The attacking state is removed
- ✅ Defender collapses to 100% at capture square
- ✅ Other attacker states are renormalized
- ⚠️  If attacker has no remaining states, it's removed entirely

**Visual Feedback:**
```
Capture Failed! ✗
Roll: 65.8% ≥ 50.0%
The attacking piece was NOT real at this location.
Black Pawn survived at e4
```

## Example Gameplay Scenarios

### Scenario 1: Simple Split and Capture

**Turn 1 (White):**
- Knight at b1 splits to c3 and a3
- Result: Knight exists at both squares (50%/50%)

**Turn 2 (Black):**
- Pawn at d7 moves to d5 (normal move, 100%)

**Turn 3 (White):**
- Knight state at c3 attempts to capture pawn at d5
- Roll: 42% < 50% → **Success!**
- Result: Pawn captured, knight collapses to 100% at d5
- Other knight state (at a3) disappears

### Scenario 2: Capture Failure

**Setup:**
- White Rook in superposition: [30% at a1, 70% at a5]
- Black Bishop at c3

**White Turn:**
- The 30% rook state at a1 moves to c3 (attacks bishop)
- Roll: 55% ≥ 30% → **Failure!**
- Result:
  - Rook's 30% state disappears
  - Rook now has only [100% at a5] (renormalized from 70%)
  - Bishop collapses to 100% at c3

### Scenario 3: Multi-Level Superposition

**Setup:**
- Queen at d1 (100%)

**Turn 1:**
- Queen splits to d4 and d5
- Result: [50% at d4, 50% at d5]

**Turn 2:**
- Queen splits again, state at d4 → d7 and d8
- Result: [25% at d7, 25% at d8, 50% at d5]

**Turn 3:**
- Queen splits the d5 state → d6 and d2
- Result: [25% at d7, 25% at d8, 25% at d6, 25% at d2]
- Queen now exists at 4 locations!

## Visual Indicators

### Opacity
- **100% Probability:** Solid, fully opaque
- **50% Probability:** Semi-transparent
- **25% Probability:** Very transparent (minimum 30% opacity)

### Labels
- **No Label:** Deterministic piece (100%, single state)
- **"N1":** Piece type and number (for tracking)
- **"N1 50%":** Piece in superposition with probability
- **"N2":** Different piece (created from different source)

### Highlighting
- **Selected Piece:** All quantum states are highlighted
- **Legal Moves:** Shown when piece is selected
- **Quantum States:** Multiple ghosts of same piece visible

## Strategy Tips

### When to Split
- **Opening Flexibility:** Split to control multiple key squares
- **King Safety:** Create defensive superpositions
- **Attack Options:** Keep opponent guessing where your pieces are

### When NOT to Split
- **Low Probability Risk:** Don't dilute powerful pieces too much
- **Endgame Clarity:** Deterministic pieces can be more reliable
- **Before Captures:** High probability states have better capture chances

### Capture Probability
- **75%+ Probability:** Very reliable captures
- **50% Probability:** Coin flip, high risk
- **25% Probability:** Desperate measures, likely to fail

### Defensive Play
- **Protect Key Pieces:** Keep king and important pieces deterministic
- **Bait with Low Probability:** Use low probability states as decoys
- **Superposition Defense:** Spread defensive pieces across multiple squares

## Technical Details

### Probability Mathematics

**Normalization:**
```
Sum of all state probabilities = 100%

If states are: [30% at A, 20% at B]
After removal of A: [100% at B] (20% normalized to 100%)
```

**Splitting:**
```
Original: [P% at X]
After split: [P/2% at Y, P/2% at Z]

Original: [P1% at X1, P2% at X2]
After split: [P1/2% at Y, P1/2% at Z, P2/2% at Y, P2/2% at Z]
Consolidated: [(P1+P2)/2% at Y, (P1+P2)/2% at Z]
```

### State Consolidation

Multiple states on the same square are automatically consolidated:
```
Before: [25% at e4, 25% at e4, 50% at e5]
After:  [50% at e4, 50% at e5]
```

### Capture Roll Formula
```javascript
const roll = Math.random(); // 0.0 to 1.0
const threshold = attackingState.probability; // 0.0 to 1.0

if (roll < threshold) {
  // Capture succeeds
} else {
  // Capture fails
}
```

## Win Conditions

The game ends when a king is completely captured:
- All quantum states of one king are eliminated
- The remaining player wins
- Checkmate rules do not apply (capture only)

## Game Modes

### Optional Splitting
- Players choose whether to split each move
- More flexible strategy
- Can maintain deterministic pieces

### Forced Splitting
- All pieces (except pawns) must split every move
- Maximum quantum chaos
- More complex probability management

## Conclusion

Quantum chess combines classical chess strategy with quantum probability mechanics, creating a unique and educational gaming experience. Master both the rules of chess and the probabilistic nature of quantum mechanics to become a quantum chess champion!

---

**Remember:** The quantum nature of the pieces is what makes this game unique. Embrace the uncertainty, calculate probabilities, and may the wave function collapse in your favor! 🎲⚛️
