 const PIECES = {
            'K': { symbol: '\u2654', color: 'white', code: 'K' },
            'Q': { symbol: '\u2655', color: 'white', code: 'Q' },
            'R': { symbol: '\u2656', color: 'white', code: 'R' },
            'B': { symbol: '\u2657', color: 'white', code: 'B' },
            'N': { symbol: '\u2658', color: 'white', code: 'N' },
            'P': { symbol: '\u2659', color: 'white', code: 'P' },
            'k': { symbol: '\u265A', color: 'black', code: 'k' },
            'q': { symbol: '\u265B', color: 'black', code: 'q' },
            'r': { symbol: '\u265C', color: 'black', code: 'r' },
            'b': { symbol: '\u265D', color: 'black', code: 'b' },
            'n': { symbol: '\u265E', color: 'black', code: 'n' },
            'p': { symbol: '\u265F', color: 'black', code: 'p' },
        };

        const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

        let board = [];
        let turn = 'white'; // 'white' or 'black'
        let selectedSquare = null; // { row, col }
        let legalMoves = [];
        let castlingRights = { wK: true, wQ: true, bK: true, bQ: true }; // King/Queen side for white/black
        let enPassantTarget = null; // { row, col } or null

        const boardElement = document.getElementById('chessboard');
        const statusElement = document.getElementById('status-message');
        const resetButton = document.getElementById('reset-button');

        // --- Core Utility Functions ---

        /** Converts a FEN position (e.g., 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR') to the board array. */
        function fenToBoard(fenPosition) {
            const newBoard = [];
            const rows = fenPosition.split('/');
            for (let i = 0; i < 8; i++) {
                const row = [];
                let col = 0;
                for (const char of rows[i]) {
                    if (/[1-8]/.test(char)) {
                        const emptyCount = parseInt(char);
                        for (let j = 0; j < emptyCount; j++) {
                            row.push(null);
                            col++;
                        }
                    } else if (PIECES[char]) {
                        row.push(char);
                        col++;
                    }
                }
                newBoard.push(row);
            }
            return newBoard;
        }

        /** Parses the full FEN string to set up the game state. */
        function setupGame(fen) {
            const parts = fen.split(' ');
            board = fenToBoard(parts[0]);
            turn = (parts[1] === 'w') ? 'white' : 'black';
            castlingRights = {
                wK: parts[2].includes('K'), wQ: parts[2].includes('Q'),
                bK: parts[2].includes('k'), bQ: parts[2].includes('q')
            };
            enPassantTarget = parts[3] === '-' ? null : parseAlgebraic(parts[3]);
            // Halfmove and fullmove clocks are ignored for simplicity in this version.
            selectedSquare = null;
            legalMoves = [];
        }

        /** Converts algebraic notation (e.g., 'a1') to {row, col}. */
        function parseAlgebraic(alg) {
            if (alg.length !== 2) return null;
            const col = alg.charCodeAt(0) - 'a'.charCodeAt(0);
            const row = 8 - parseInt(alg[1]);
            if (row >= 0 && row < 8 && col >= 0 && col < 8) {
                return { row, col };
            }
            return null;
        }

        /** Finds the king position for the current turn's color. */
        function findKingPosition(color) {
            const kingCode = color === 'white' ? 'K' : 'k';
            for (let r = 0; r < 8; r++) {
                for (let c = 0; c < 8; c++) {
                    if (board[r][c] === kingCode) {
                        return { row: r, col: c };
                    }
                }
            }
            return null; // Should not happen in a valid game
        }

        // --- Check and Validation ---

        /** Checks if a square {r, c} is attacked by the opposite color (used to check if the king is safe). */
        function isSquareAttacked(r, c, attackerColor, currentBoard = board) {
            const attackerTurn = attackerColor === 'white' ? 'w' : 'b';

            for (let ar = 0; ar < 8; ar++) {
                for (let ac = 0; ac < 8; ac++) {
                    const attackerPiece = currentBoard[ar][ac];
                    if (attackerPiece && PIECES[attackerPiece].color === attackerColor) {
                        // Temporarily set turn to attacker's color to use getPossibleMoves
                        const originalTurn = turn;
                        turn = attackerColor;
                        const moves = getPossibleMoves({ row: ar, col: ac }, currentBoard, true); // true for attacking squares only
                        turn = originalTurn; // Restore original turn

                        for (const move of moves) {
                            if (move.row === r && move.col === c) {
                                return true;
                            }
                        }
                    }
                }
            }
            return false;
        }

        /** Checks if the current player's King is in check. */
        function isInCheck(currentBoard = board, color = turn) {
            const kingPos = findKingPosition(color);
            if (!kingPos) return false;

            const attackerColor = color === 'white' ? 'black' : 'white';
            return isSquareAttacked(kingPos.row, kingPos.col, attackerColor, currentBoard);
        }

        /** Executes a trial move and checks if the King is left in check. */
        function isMoveSafe(startPos, endPos) {
            // 1. Create a deep copy of the board
            const trialBoard = board.map(row => [...row]);

            // 2. Execute the move on the trial board
            const pieceCode = trialBoard[startPos.row][startPos.col];
            trialBoard[endPos.row][endPos.col] = pieceCode;
            trialBoard[startPos.row][startPos.col] = null;

            // Handle En Passant cleanup on trial board
            if (pieceCode === 'P' || pieceCode === 'p') {
                if (enPassantTarget && endPos.row === enPassantTarget.row && endPos.col === enPassantTarget.col) {
                    const capturedPawnRow = turn === 'white' ? endPos.row + 1 : endPos.row - 1;
                    trialBoard[capturedPawnRow][endPos.col] = null;
                }
            }
            
            // Handle Castling on trial board
            if ((pieceCode === 'K' || pieceCode === 'k') && Math.abs(startPos.col - endPos.col) === 2) {
                const rookStartCol = endPos.col === 6 ? 7 : 0;
                const rookEndCol = endPos.col === 6 ? 5 : 3;
                trialBoard[endPos.row][rookEndCol] = trialBoard[endPos.row][rookStartCol];
                trialBoard[endPos.row][rookStartCol] = null;
            }

            // 3. Check if the King is in check after the move
            return !isInCheck(trialBoard, turn);
        }

        // --- Piece Movement Logic ---

        /** Gets all pseudo-legal moves for a piece at startPos (without check validation). */
        function getPossibleMoves(startPos, currentBoard = board, includeAttacksOnly = false) {
            const { row: r, col: c } = startPos;
            const pieceCode = currentBoard[r][c];
            if (!pieceCode) return [];

            const piece = PIECES[pieceCode];
            if (piece.color !== turn && !includeAttacksOnly) return [];
            
            const moves = [];

            // Helper function for sliding pieces (Rook, Bishop, Queen)
            const addSlidingMoves = (directions) => {
                for (const [dr, dc] of directions) {
                    let tr = r + dr;
                    let tc = c + dc;
                    while (tr >= 0 && tr < 8 && tc >= 0 && tc < 8) {
                        const targetPiece = currentBoard[tr][tc];
                        if (!targetPiece) {
                            moves.push({ row: tr, col: tc });
                        } else {
                            if (PIECES[targetPiece].color !== piece.color) {
                                moves.push({ row: tr, col: tc }); // Capture
                            }
                            break; // Stop at the first occupied square
                        }
                        tr += dr;
                        tc += dc;
                    }
                }
            };

            // Helper function for jumping pieces (Knight, King)
            const addJumpingMoves = (jumps) => {
                for (const [dr, dc] of jumps) {
                    const tr = r + dr;
                    const tc = c + dc;
                    if (tr >= 0 && tr < 8 && tc >= 0 && tc < 8) {
                        const targetPiece = currentBoard[tr][tc];
                        if (!targetPiece || PIECES[targetPiece].color !== piece.color) {
                            moves.push({ row: tr, col: tc });
                        }
                    }
                }
            };

            switch (pieceCode.toUpperCase()) {
                case 'R': // Rook
                    addSlidingMoves([[0, 1], [0, -1], [1, 0], [-1, 0]]);
                    break;
                case 'B': // Bishop
                    addSlidingMoves([[1, 1], [1, -1], [-1, 1], [-1, -1]]);
                    break;
                case 'Q': // Queen
                    addSlidingMoves([[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]]);
                    break;
                case 'N': // Knight
                    addJumpingMoves([[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]);
                    break;
                case 'K': { // King
                    addJumpingMoves([[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]]);

                    // Castling logic (only if not checking for attacks)
                    if (!includeAttacksOnly) {
                        const isWhite = piece.color === 'white';
                        const homeRow = isWhite ? 7 : 0;
                        
                        if (r === homeRow && c === 4 && !isInCheck(currentBoard, piece.color)) {
                            // Kingside Castling (O-O)
                            if ((isWhite && castlingRights.wK) || (!isWhite && castlingRights.bK)) {
                                if (!currentBoard[r][5] && !currentBoard[r][6]) {
                                    if (!isSquareAttacked(r, 5, isWhite ? 'black' : 'white', currentBoard) &&
                                        !isSquareAttacked(r, 6, isWhite ? 'black' : 'white', currentBoard)) {
                                        moves.push({ row: r, col: 6, castling: 'K' });
                                    }
                                }
                            }
                            // Queenside Castling (O-O-O)
                            if ((isWhite && castlingRights.wQ) || (!isWhite && castlingRights.bQ)) {
                                if (!currentBoard[r][3] && !currentBoard[r][2] && !currentBoard[r][1]) {
                                    if (!isSquareAttacked(r, 3, isWhite ? 'black' : 'white', currentBoard) &&
                                        !isSquareAttacked(r, 2, isWhite ? 'black' : 'white', currentBoard)) {
                                        moves.push({ row: r, col: 2, castling: 'Q' });
                                    }
                                }
                            }
                        }
                    }
                    break;
                }
                case 'P': { // Pawn
                    const isWhite = piece.color === 'white';
                    const dir = isWhite ? -1 : 1;
                    const homeRow = isWhite ? 6 : 1;

                    // 1. Single forward move
                    if (r + dir >= 0 && r + dir < 8 && !currentBoard[r + dir][c]) {
                        if (!includeAttacksOnly) { // Cannot attack forward square
                            moves.push({ row: r + dir, col: c });
                        }
                        
                        // 2. Double forward move from home row
                        if (r === homeRow && !currentBoard[r + dir * 2][c]) {
                            if (!includeAttacksOnly) { // Cannot attack forward square
                                moves.push({ row: r + dir * 2, col: c, enPassant: true });
                            }
                        }
                    }

                    // 3. Captures
                    for (const dc of [-1, 1]) {
                        const tr = r + dir;
                        const tc = c + dc;
                        if (tr >= 0 && tr < 8 && tc >= 0 && tc < 8) {
                            const targetPiece = currentBoard[tr][tc];
                            
                            // Standard Capture
                            if (targetPiece && PIECES[targetPiece].color !== piece.color) {
                                moves.push({ row: tr, col: tc });
                            } 
                            
                            // En Passant Capture
                            if (enPassantTarget && tr === enPassantTarget.row && tc === enPassantTarget.col) {
                                moves.push({ row: tr, col: tc, enPassantCapture: true });
                            }
                        }
                    }
                    break;
                }
            }
            return moves;
        }

        /** Filters pseudo-legal moves to only include those that leave the King safe. */
        function getLegalMoves(startPos) {
            const pseudoLegalMoves = getPossibleMoves(startPos);
            const legalMoves = pseudoLegalMoves.filter(move => {
                return isMoveSafe(startPos, move);
            });
            return legalMoves;
        }

        /** Checks if there are any legal moves left for the current player. */
        function hasLegalMoves() {
            for (let r = 0; r < 8; r++) {
                for (let c = 0; c < 8; c++) {
                    const pieceCode = board[r][c];
                    if (pieceCode && PIECES[pieceCode].color === turn) {
                        const moves = getLegalMoves({ row: r, col: c });
                        if (moves.length > 0) {
                            return true;
                        }
                    }
                }
            }
            return false;
        }

        // --- Game Flow and UI ---

        /** Updates the game status message. */
        function updateStatus(message) {
            statusElement.textContent = message;
        }

        /** Draws the current board state to the DOM. */
        function renderBoard() {
            boardElement.innerHTML = ''; // Clear previous board

            // Check for game over conditions
            const inCheck = isInCheck();
            if (!hasLegalMoves()) {
                if (inCheck) {
                    updateStatus(turn === 'white' ? "Checkmate! Black wins." : "Checkmate! White wins.");
                } else {
                    updateStatus("Stalemate! Game is a draw.");
                }
                return;
            } else if (inCheck) {
                updateStatus(turn === 'white' ? "White is in Check!" : "Black is in Check!");
            } else {
                updateStatus((turn === 'white' ? 'White' : 'Black') + ' to move.');
            }

            // Draw squares and pieces
            for (let r = 0; r < 8; r++) {
                for (let c = 0; c < 8; c++) {
                    const isLight = (r + c) % 2 === 0;
                    const squareClass = isLight ? 'light' : 'dark';
                    const squareContainer = document.createElement('div');
                    squareContainer.className = 'square-container';

                    const squareDiv = document.createElement('div');
                    squareDiv.className = `square ${squareClass}`;
                    squareDiv.dataset.row = r;
                    squareDiv.dataset.col = c;
                    squareDiv.addEventListener('click', handleSquareClick);
                    
                    if (selectedSquare && selectedSquare.row === r && selectedSquare.col === c) {
                        squareDiv.classList.add('selected');
                    }

                    if (inCheck && PIECES[board[r][c]]?.code.toUpperCase() === 'K' && PIECES[board[r][c]]?.color === turn) {
                        squareDiv.classList.add('in-check');
                    }
                    
                    // Highlight possible move targets
                    if (legalMoves.some(move => move.row === r && move.col === c)) {
                        squareDiv.classList.add('possible-move');
                    }

                    const pieceCode = board[r][c];
                    if (pieceCode) {
                        const pieceData = PIECES[pieceCode];
                        const pieceSpan = document.createElement('span');
                        pieceSpan.className = `piece ${pieceData.color}`;
                        pieceSpan.textContent = pieceData.symbol;
                        squareDiv.appendChild(pieceSpan);
                    }
                    
                    squareContainer.appendChild(squareDiv);
                    boardElement.appendChild(squareContainer);
                }
            }
        }

        /** Executes the move and updates game state (castling, en passant, promotion). */
        function executeMove(startPos, endPos, moveData) {
            const pieceCode = board[startPos.row][startPos.col];

            // 1. Handle Castling
            if (pieceCode.toUpperCase() === 'K' && Math.abs(startPos.col - endPos.col) === 2) {
                const isKingside = endPos.col === 6;
                const rookStartCol = isKingside ? 7 : 0;
                const rookEndCol = isKingside ? 5 : 3;
                
                // Move the Rook
                board[endPos.row][rookEndCol] = board[endPos.row][rookStartCol];
                board[endPos.row][rookStartCol] = null;
            }

            // 2. Handle En Passant Capture
            if (pieceCode.toUpperCase() === 'P' && enPassantTarget && endPos.row === enPassantTarget.row && endPos.col === enPassantTarget.col) {
                // Remove the captured pawn
                const capturedPawnRow = turn === 'white' ? endPos.row + 1 : endPos.row - 1;
                board[capturedPawnRow][endPos.col] = null;
            }

            // 3. Update En Passant Target for next turn
            enPassantTarget = null;
            if (pieceCode.toUpperCase() === 'P' && Math.abs(startPos.row - endPos.row) === 2) {
                // Pawn moved two squares, set en passant target one square behind it
                const targetRow = turn === 'white' ? endPos.row + 1 : endPos.row - 1;
                enPassantTarget = { row: targetRow, col: endPos.col };
            }

            // 4. Move the piece
            board[endPos.row][endPos.col] = pieceCode;
            board[startPos.row][startPos.col] = null;

            // 5. Handle Pawn Promotion
            if (pieceCode.toUpperCase() === 'P') {
                const promotionRank = turn === 'white' ? 0 : 7;
                if (endPos.row === promotionRank) {
                    // Simple promotion to Queen
                    board[endPos.row][endPos.col] = turn === 'white' ? 'Q' : 'q';
                }
            }

            // 6. Update Castling Rights (If King or Rook moves)
            if (pieceCode.toUpperCase() === 'K') {
                if (turn === 'white') { castlingRights.wK = castlingRights.wQ = false; }
                else { castlingRights.bK = castlingRights.bQ = false; }
            } else if (pieceCode.toUpperCase() === 'R') {
                const homeRow = turn === 'white' ? 7 : 0;
                if (startPos.row === homeRow) {
                    if (startPos.col === 7) { // Kingside Rook
                        if (turn === 'white') castlingRights.wK = false; else castlingRights.bK = false;
                    } else if (startPos.col === 0) { // Queenside Rook
                        if (turn === 'white') castlingRights.wQ = false; else castlingRights.bQ = false;
                    }
                }
            }
        }

        /** Main click handler for the chessboard. */
        function handleSquareClick(event) {
            const squareDiv = event.currentTarget;
            const r = parseInt(squareDiv.dataset.row);
            const c = parseInt(squareDiv.dataset.col);
            const clickedPos = { row: r, col: c };
            const pieceCode = board[r][c];
            const piece = pieceCode ? PIECES[pieceCode] : null;

            if (selectedSquare) {
                // Case 1: A piece is already selected, try to move to the clicked square
                const targetMove = legalMoves.find(move => move.row === r && move.col === c);

                if (targetMove) {
                    // Valid Move
                    executeMove(selectedSquare, clickedPos, targetMove);
                    
                    // Reset selection and switch turn
                    selectedSquare = null;
                    legalMoves = [];
                    turn = turn === 'white' ? 'black' : 'white';
                    renderBoard();
                } else {
                    // Invalid move or clicking on a different piece/empty square
                    
                    if (piece && piece.color === turn) {
                        // Clicked on a piece of the same color: select new piece
                        selectedSquare = clickedPos;
                        legalMoves = getLegalMoves(selectedSquare);
                    } else {
                        // Clicked elsewhere: deselect
                        selectedSquare = null;
                        legalMoves = [];
                    }
                    renderBoard(); // Re-render to update highlights
                }

            } else {
                // Case 2: No piece is selected, try to select one
                if (piece && piece.color === turn) {
                    selectedSquare = clickedPos;
                    legalMoves = getLegalMoves(selectedSquare);
                    renderBoard(); // Re-render to show selected piece and target squares
                }
            }
        }

        /** Initializes the game, binds events, and renders the initial state. */
        function init() {
            setupGame(STARTING_FEN);
            renderBoard();
            resetButton.addEventListener('click', init);
            console.log("Game Initialized. White to move.");
        }

        // Start the game when the window loads
        window.onload = init;
