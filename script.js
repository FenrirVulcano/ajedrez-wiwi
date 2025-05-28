document.addEventListener('DOMContentLoaded', (event) => {
    // --- LÓGICA DEL TEMA OSCURO ---
    const themeToggleButton = document.getElementById('theme-toggle-button');
    const currentTheme = localStorage.getItem('theme');

    if (currentTheme === 'dark') {
        document.body.classList.add('dark-mode');
        themeToggleButton.textContent = '☀️';
    }

    themeToggleButton.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        let theme = 'light';
        if (document.body.classList.contains('dark-mode')) {
            theme = 'dark';
            themeToggleButton.textContent = '☀️';
        } else {
            themeToggleButton.textContent = '🌙';
        }
        localStorage.setItem('theme', theme);
    });

    // --- VARIABLES DEL JUEGO ---
    const tablero = document.getElementById('tablero');
    let estado = Array(9).fill(null);
    let fichasDisponibles = {};
    let turnoJugador = 1;
    let fichaSeleccionada = { jugador: 1, tamano: 1 };
    let juegoTerminado = false;
    let piezasColocadas = 0;
    let aiWorker = null;
    const openingBook = new Map();

    // --- VARIABLES PARA EL APRENDIZAJE DE LA IA ---
    let gameHistory = []; // Registra los movimientos de la partida actual
    let knowledgeBook = new Map(); // El "cerebro" o memoria a largo plazo de la IA
    const BOOK_CONFIDENCE_THRESHOLD = 3; // La IA usará su experiencia si ha visto una jugada al menos esta cantidad de veces

    // --- Cargar el conocimiento de la IA al iniciar la aplicación ---
    loadKnowledge();

    // --- LÓGICA DE INICIALIZACIÓN ---
    for (let i = 0; i < 9; i++) {
        const casilla = document.createElement('div');
        casilla.className = 'casilla';
        casilla.dataset.index = i;
        casilla.addEventListener('click', () => colocarPieza(i));
        tablero.appendChild(casilla);
    }

    document.querySelectorAll('.ficha-opcion').forEach(el => {
        el.addEventListener('click', () => {
            if (juegoTerminado || el.classList.contains('deshabilitada')) return;

            const jugadorOpcion = parseInt(el.dataset.jugador);
            if (turnoJugador !== jugadorOpcion) {
                showMessage("No es tu turno.");
                return;
            }

            document.querySelectorAll('.ficha-opcion').forEach(op => op.classList.remove('seleccionada'));
            el.classList.add('seleccionada');
            fichaSeleccionada.jugador = jugadorOpcion;
            fichaSeleccionada.tamano = parseInt(el.dataset.tamano);
        });
    });

    // --- Asignación de eventos a los botones ---
    window.reiniciarJuego = reiniciarJuego;
    window.sugerirMejorJugada = sugerirMejorJugada;

    function inicializarLibroDeAperturas() {
        openingBook.clear();
        const tableroVacioKey = Array(9).fill(null).map(p => p ? `${p.jugador}${p.tamano}` : '0').join('');
        openingBook.set(tableroVacioKey, { index: 4, tamano: 2 });

        const tableroRespuesta1 = Array(9).fill(null);
        tableroRespuesta1[4] = { jugador: 1, tamano: 2 };
        const tableroRespuesta1Key = tableroRespuesta1.map(p => p ? `${p.jugador}${p.tamano}` : '0').join('');
        openingBook.set(tableroRespuesta1Key, { index: 0, tamano: 3 });
    }

    function showMessage(message, duration = 2500) {
        const messageBox = document.createElement('div');
        messageBox.style.cssText = `position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background-color: #333; color: white; padding: 15px 25px; border-radius: 10px; box-shadow: 0 5px 15px rgba(0,0,0,0.3); z-index: 1000; font-size: 1.1em; opacity: 0; transition: opacity 0.3s ease-in-out;`;
        messageBox.innerText = message;
        document.body.appendChild(messageBox);
        setTimeout(() => messageBox.style.opacity = '1', 10);
        setTimeout(() => {
            messageBox.style.opacity = '0';
            messageBox.addEventListener('transitionend', () => messageBox.remove());
        }, duration);
    }

    function colocarPieza(i) {
        if (juegoTerminado) return;

        if (piezasColocadas === 0 && turnoJugador === 1 && fichaSeleccionada.tamano === 3 && i === 4) {
            showMessage("Regla especial: El Jugador 1 no puede usar una ficha grande en la casilla central en el primer turno.");
            return;
        }

        if (turnoJugador !== fichaSeleccionada.jugador) {
            showMessage("No es tu turno.");
            return;
        }

        if (fichasDisponibles[fichaSeleccionada.jugador][fichaSeleccionada.tamano] <= 0) {
            showMessage("No tienes más fichas de este tamaño.");
            return;
        }

        const actual = estado[i];
        if (!actual || (actual.jugador !== fichaSeleccionada.jugador && actual.tamano < fichaSeleccionada.tamano)) {
            const boardKey = estado.map(p => p ? `${p.jugador}${p.tamano}` : '0').join('');
            const move = { index: i, tamano: fichaSeleccionada.tamano, jugador: fichaSeleccionada.jugador };
            gameHistory.push({ boardKey, move });

            estado[i] = { jugador: fichaSeleccionada.jugador, tamano: fichaSeleccionada.tamano };
            fichasDisponibles[fichaSeleccionada.jugador][fichaSeleccionada.tamano]--;
            piezasColocadas++;

            actualizarTablero();
            actualizarPanelFichas();

            if (verificarFinDeJuego()) return;

            turnoJugador = 3 - turnoJugador;
            document.getElementById('estadoJuego').innerText = "Turno de Jugador " + turnoJugador;
            seleccionarPrimeraFichaDisponible();
        } else {
            showMessage("Movimiento no válido.");
        }
    }

    function actualizarTablero() {
        [...tablero.children].forEach((casilla, i) => {
            casilla.innerHTML = '';
            const pieza = estado[i];
            if (pieza) {
                const div = document.createElement('div');
                div.className = `pieza p${pieza.jugador} t${pieza.tamano}`;
                casilla.appendChild(div);
            }
        });
    }

    function actualizarPanelFichas() {
        for (let jug = 1; jug <= 2; jug++) {
            for (let tam = 1; tam <= 3; tam++) {
                const opcion = document.querySelector(`.ficha-opcion[data-jugador="${jug}"][data-tamano="${tam}"]`);
                const spanCantidad = opcion.querySelector(`span#cantidad-p${jug}-t${tam}`);
                spanCantidad.innerText = fichasDisponibles[jug][tam];
                opcion.classList.toggle('deshabilitada', fichasDisponibles[jug][tam] === 0);
            }
        }
    }

    function seleccionarPrimeraFichaDisponible() {
        document.querySelectorAll('.ficha-opcion').forEach(op => op.classList.remove('seleccionada'));
        const ordenPrioridadTamano = [2, 1, 3];
        for (const tamano of ordenPrioridadTamano) {
            const opcion = document.querySelector(`.ficha-opcion[data-jugador="${turnoJugador}"][data-tamano="${tamano}"]`);
            if (opcion && !opcion.classList.contains('deshabilitada')) {
                opcion.classList.add('seleccionada');
                fichaSeleccionada = { jugador: turnoJugador, tamano: tamano };
                return;
            }
        }
    }

    function checkWin(boardState) {
        const combinacionesGanadoras = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]
        ];
        for (const combo of combinacionesGanadoras) {
            const [a, b, c] = combo;
            if (boardState[a] && boardState[b] && boardState[c] &&
                boardState[a].jugador === boardState[b].jugador &&
                boardState[a].jugador === boardState[c].jugador) {
                return boardState[a].jugador;
            }
        }
        return null;
    }

    function checkDraw(boardState, availablePieces) {
        if (checkWin(boardState)) return false;
        for(let p=1; p<=2; p++){
            for(let t=1; t<=3; t++){
                if(availablePieces[p][t] > 0) {
                    for(let i=0; i<9; i++){
                        const cell = boardState[i];
                        if (!cell || (cell.jugador !== p && cell.tamano < t)) return false;
                    }
                }
            }
        }
        return true;
    }

    function determinarGanadorPorPiezas(boardState) {
        let conteoJ1 = { 3: 0, 2: 0, 1: 0 };
        let conteoJ2 = { 3: 0, 2: 0, 1: 0 };

        for (const pieza of boardState) {
            if (pieza) {
                if (pieza.jugador === 1) {
                    conteoJ1[pieza.tamano]++;
                } else {
                    conteoJ2[pieza.tamano]++;
                }
            }
        }

        if (conteoJ1[3] > conteoJ2[3]) return 1;
        if (conteoJ2[3] > conteoJ1[3]) return 2;
        if (conteoJ1[2] > conteoJ2[2]) return 1;
        if (conteoJ2[2] > conteoJ1[2]) return 2;
        if (conteoJ1[1] > conteoJ2[1]) return 1;
        if (conteoJ2[1] > conteoJ1[1]) return 2;

        return null;
    }

    function verificarFinDeJuego() {
        const ganador = checkWin(estado);
        if (ganador) {
            document.getElementById('estadoJuego').innerText = `¡Ganó el Jugador ${ganador}!`;
            juegoTerminado = true;
            document.querySelectorAll('.ficha-opcion').forEach(op => op.classList.add('deshabilitada'));
            document.querySelectorAll('.seccion-ia button').forEach(b => b.disabled = true);
            if (aiWorker) aiWorker.terminate();
            learnFromGameResult(ganador);
            return true;
        }

        if (checkDraw(estado, fichasDisponibles)) {
            juegoTerminado = true;
            document.querySelectorAll('.ficha-opcion').forEach(op => op.classList.add('deshabilitada'));
            document.querySelectorAll('.seccion-ia button').forEach(b => b.disabled = true);
            if (aiWorker) aiWorker.terminate();

            const ganadorPorPiezas = determinarGanadorPorPiezas(estado);
            if (ganadorPorPiezas) {
                document.getElementById('estadoJuego').innerText = `¡Fin del juego! Gana el Jugador ${ganadorPorPiezas} por tener piezas de mayor tamaño.`;
                learnFromGameResult(ganadorPorPiezas);
            } else {
                document.getElementById('estadoJuego').innerText = "¡Empate por bloqueo! No hay más movimientos posibles.";
            }
            return true;
        }
        return false;
    }

    function reiniciarJuego() {
        if (aiWorker) {
            aiWorker.terminate();
            aiWorker = null;
        }
        estado = Array(9).fill(null);
        turnoJugador = 1;
        juegoTerminado = false;
        piezasColocadas = 0;
        gameHistory = [];

        fichasDisponibles = {
            1: { 1: 3, 2: 3, 3: 2 },
            2: { 1: 3, 2: 3, 3: 2 }
        };
        document.getElementById('estadoJuego').innerText = "Turno de Jugador 1";
        actualizarTablero();
        actualizarPanelFichas();
        seleccionarPrimeraFichaDisponible();
        document.querySelectorAll('.seccion-ia button').forEach(b => b.disabled = false);
        inicializarLibroDeAperturas();
    }

    // ====================================================================
    // ===== CÓDIGO MODIFICADO PARA USAR LA BASE DE DATOS (FIREBASE) =====
    // ====================================================================
    
    async function loadKnowledge() {
        try {
            // Llama a nuestra Netlify Function para obtener los datos
            const response = await fetch('/.netlify/functions/get-knowledge');
            const knowledgeData = await response.json();
            if (knowledgeData && knowledgeData.length > 0) {
                knowledgeBook = new Map(knowledgeData);
                console.log(`Conocimiento cargado desde la base de datos: ${knowledgeBook.size} posiciones recordadas.`);
            } else {
                console.log('No se encontró conocimiento previo en la base de datos. La IA empieza de cero.');
            }
        } catch (error) {
            console.error('Error al cargar el conocimiento desde el backend:', error);
            // Si hay un error, la IA simplemente empezará de cero para esta sesión.
        }
    }
    
    async function saveKnowledge() {
        try {
            // Llama a nuestra Netlify Function para guardar los datos
            await fetch('/.netlify/functions/save-knowledge', {
                method: 'POST',
                // Convierte el Map a un array para poder enviarlo como JSON
                body: JSON.stringify({ knowledgeBook: Array.from(knowledgeBook.entries()) }),
            });
            console.log("Conocimiento de la IA guardado en la base de datos.");
        } catch (error) {
            console.error('Error al guardar el conocimiento en el backend:', error);
        }
    }
    
    // ====================================================================
    // ====================================================================


    function learnFromGameResult(winner) {
        console.log(`Aprendiendo de la partida. Ganador: Jugador ${winner}`);
        const loser = 3 - winner;

        for (const record of gameHistory) {
            const { boardKey, move } = record;
            if (!knowledgeBook.has(boardKey)) {
                knowledgeBook.set(boardKey, {});
            }
            const positionKnowledge = knowledgeBook.get(boardKey);
            const moveKey = `move_${move.index}_${move.tamano}`;

            if (!positionKnowledge[moveKey]) {
                positionKnowledge[moveKey] = { wins: 0, losses: 0 };
            }
            if (move.jugador === winner) {
                positionKnowledge[moveKey].wins++;
            } else if (move.jugador === loser) {
                positionKnowledge[moveKey].losses++;
            }
        }
        // Llama a la nueva función para guardar en la base de datos
        saveKnowledge();
    }

    function getAIWorkerCode() {
        const aiLogic = () => {
            const IA_PROFUNDIDAD = 7;
            const combinacionesGanadoras = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
            const transpositionTable = new Map();
            function getStateKey(boardState, availablePieces, player, isMaximizing) {
                const boardString = boardState.map(p => p ? `${p.jugador}${p.tamano}` : '0').join('');
                const piecesString = `${availablePieces[1][1]}${availablePieces[1][2]}${availablePieces[1][3]}${availablePieces[2][1]}${availablePieces[2][2]}${availablePieces[2][3]}`;
                return `${boardString}|${piecesString}|${player}|${isMaximizing}`;
            }
            function minimax(boardState, availablePieces, depth, alpha, beta, isMaximizingPlayer, playerFor) {
                const stateKey = getStateKey(boardState, availablePieces, playerFor, isMaximizingPlayer);
                const cached = transpositionTable.get(stateKey);
                if (cached && cached.depth >= depth) return cached;
                const winner = checkWin(boardState);
                if (winner !== null || depth === 0 || checkDraw(boardState, availablePieces)) {
                    return { score: evaluateBoard(boardState, playerFor, availablePieces, depth) };
                }
                const currentPlayer = isMaximizingPlayer ? playerFor : (3 - playerFor);
                let possibleMoves = getPossibleMoves(boardState, availablePieces, currentPlayer);
                if (boardState.filter(p => p !== null).length === 0 && currentPlayer === 1) {
                    possibleMoves = possibleMoves.filter(move => !(move.tamano === 3 && move.index === 4));
                }
                if (possibleMoves.length === 0) {
                        return { score: evaluateBoard(boardState, playerFor, availablePieces, depth) };
                }
                const scoredMoves = possibleMoves.map(move => {
                    const { newBoard } = simulateMove(boardState, availablePieces, move, currentPlayer);
                    let score = 0;
                    if (checkWin(newBoard) === currentPlayer) {
                        score = 1000;
                    } else {
                        const strategicScores = { 4: 25, 0: 15, 2: 15, 6: 15, 8: 15, 1: 5, 3: 5, 5: 5, 7: 5 };
                        score += strategicScores[move.index];
                        score += move.tamano * 3;
                    }
                    return { move, score };
                });
                scoredMoves.sort((a, b) => b.score - a.score);
                possibleMoves = scoredMoves.map(m => m.move);
                let bestMove = possibleMoves[0];
                let bestResult;
                if (isMaximizingPlayer) {
                    let maxEval = -Infinity;
                    for (const move of possibleMoves) {
                        const { newBoard, newPieces } = simulateMove(boardState, availablePieces, move, currentPlayer);
                        const { score } = minimax(newBoard, newPieces, depth - 1, alpha, beta, false, playerFor);
                        if (score > maxEval) {
                            maxEval = score;
                            bestMove = move;
                        }
                        alpha = Math.max(alpha, score);
                        if (beta <= alpha) break;
                    }
                    bestResult = { score: maxEval, move: bestMove };
                } else {
                    let minEval = +Infinity;
                    for (const move of possibleMoves) {
                        const { newBoard, newPieces } = simulateMove(boardState, availablePieces, move, currentPlayer);
                        const { score } = minimax(newBoard, newPieces, depth - 1, alpha, beta, true, playerFor);
                        if (score < minEval) {
                            minEval = score;
                            bestMove = move;
                        }
                        beta = Math.min(beta, score);
                        if (beta <= alpha) break;
                    }
                    bestResult = { score: minEval, move: bestMove };
                }
                transpositionTable.set(stateKey, { ...bestResult, depth: depth });
                return bestResult;
            }
            function evaluateBoard(boardState, player, availablePieces, depth) {
                const opponent = 3 - player;
                const winner = checkWin(boardState);
                if (winner === player) return 10000 + depth;
                if (winner === opponent) return -10000 - depth;
                let score = 0;
                score += evaluateThreats(boardState, player) * 12;
                score -= evaluateThreats(boardState, opponent) * 10;
                const strategicScores = { 4: 25, 0: 15, 2: 15, 6: 15, 8: 15, 1: 5, 3: 5, 5: 5, 7: 5 };
                for(let i=0; i<9; i++) {
                    if (boardState[i]) {
                        const pieceValue = boardState[i].tamano * 5;
                        if (boardState[i].jugador === player) {
                            score += strategicScores[i] + pieceValue;
                        } else {
                            score -= strategicScores[i] + pieceValue;
                        }
                    }
                }
                const myMoves = getPossibleMoves(boardState, availablePieces, player).length;
                const opponentMoves = getPossibleMoves(boardState, availablePieces, opponent).length;
                score += (myMoves - opponentMoves);
                score += (availablePieces[player][3] * 10 + availablePieces[player][2] * 5);
                score -= (availablePieces[opponent][3] * 10 + availablePieces[opponent][2] * 5);
                return score;
            }
            function evaluateThreats(boardState, player) {
                let threatScore = 0;
                for (const combo of combinacionesGanadoras) {
                    const line = [boardState[combo[0]], boardState[combo[1]], boardState[combo[2]]];
                    const playerCount = line.filter(p => p && p.jugador === player).length;
                    const emptyCount = line.filter(p => !p).length;
                    if (playerCount === 2 && emptyCount === 1) {
                        threatScore += 10;
                    }
                }
                return threatScore;
            }
            function getPossibleMoves(boardState, availablePieces, player) {
                const moves = [];
                for (let tamano = 1; tamano <= 3; tamano++) {
                    if (availablePieces[player][tamano] > 0) {
                        for (let i = 0; i < 9; i++) {
                            const cell = boardState[i];
                            if (!cell || (cell.jugador !== player && cell.tamano < tamano)) {
                                moves.push({ index: i, tamano: tamano });
                            }
                        }
                    }
                }
                return moves;
            }
            function simulateMove(boardState, availablePieces, move, player) {
                const newBoard = JSON.parse(JSON.stringify(boardState));
                const newPieces = JSON.parse(JSON.stringify(availablePieces));
                newBoard[move.index] = { jugador: player, tamano: move.tamano };
                newPieces[player][move.tamano]--;
                return { newBoard, newPieces };
            }
            function checkWin(boardState) { for (const combo of combinacionesGanadoras) { const [a, b, c] = combo; if (boardState[a] && boardState[b] && boardState[c] && boardState[a].jugador === boardState[b].jugador && boardState[a].jugador === boardState[c].jugador) { return boardState[a].jugador; } } return null; }
            function checkDraw(boardState, availablePieces) { if (checkWin(boardState)) return false; for(let p=1; p<=2; p++){ for(let t=1; t<=3; t++){ if(availablePieces[p][t] > 0) { for(let i=0; i<9; i++){ const cell = boardState[i]; if (!cell || (cell.jugador !== p && cell.tamano < t)) return false; } } } } return true; }
            self.onmessage = (e) => {
                const { boardState, availablePieces, playerFor } = e.data;
                const { move } = minimax(boardState, availablePieces, IA_PROFUNDIDAD, -Infinity, Infinity, true, playerFor);
                self.postMessage({ move });
            };
        };
        return `(${aiLogic.toString()})()`;
    }

    function sugerirMejorJugada(jugadorParaSugerir) {
        if (juegoTerminado) { showMessage("El juego ha terminado."); return; }
        if (aiWorker) { showMessage("La IA ya está pensando..."); return; }

        const boardKey = estado.map(p => p ? `${p.jugador}${p.tamano}` : '0').join('');

        if (knowledgeBook.has(boardKey)) {
            const positionKnowledge = knowledgeBook.get(boardKey);
            let bestMove = null;
            let bestScore = -1;

            for (const moveKey in positionKnowledge) {
                const stats = positionKnowledge[moveKey];
                const totalPlays = stats.wins + stats.losses;

                if (totalPlays >= BOOK_CONFIDENCE_THRESHOLD) {
                    const winRate = stats.wins / totalPlays;
                    if (winRate > bestScore) {
                        bestScore = winRate;
                        const [, , index, tamano] = moveKey.split('_');
                        bestMove = { index: parseInt(index), tamano: parseInt(tamano) };
                    }
                }
            }

            if (bestMove && fichasDisponibles[jugadorParaSugerir][bestMove.tamano] > 0) {
                let tamanoTexto = {1: 'Pequeña', 2: 'Mediana', 3: 'Grande'};
                showMessage(`IA sugiere (por experiencia): ficha ${tamanoTexto[bestMove.tamano]} en casilla ${bestMove.index + 1}.`);
                console.log(`Jugada sugerida desde el libro de conocimiento con una tasa de victoria del ${(bestScore * 100).toFixed(0)}%.`, bestMove);
                return;
            }
        }

        const iaButtons = document.querySelectorAll('.seccion-ia button');
        if (openingBook.has(boardKey) && turnoJugador === jugadorParaSugerir) {
            const move = openingBook.get(boardKey);
            if (move && typeof move.tamano !== 'undefined' && fichasDisponibles[jugadorParaSugerir][move.tamano] > 0) {
                let tamanoTexto = {1: 'Pequeña', 2: 'Mediana', 3: 'Grande'};
                showMessage(`IA sugiere (del libro): ficha ${tamanoTexto[move.tamano]} en casilla ${move.index + 1}.`);
                return;
            }
        }

        showMessage("IA pensando profundamente... (la interfaz no se congelará)", 4000);
        iaButtons.forEach(b => b.disabled = true);

        const workerCode = getAIWorkerCode();
        const workerBlob = new Blob([workerCode], { type: 'application/javascript' });
        aiWorker = new Worker(URL.createObjectURL(workerBlob));

        aiWorker.postMessage({
            boardState: estado,
            availablePieces: fichasDisponibles,
            playerFor: jugadorParaSugerir
        });

        aiWorker.onmessage = (e) => {
            const { move } = e.data;
            iaButtons.forEach(b => b.disabled = false);

            if (move) {
                let tamanoTexto = {1: 'Pequeña', 2: 'Mediana', 3: 'Grande'};
                showMessage(`IA sugiere (por cálculo): ficha ${tamanoTexto[move.tamano]} en casilla ${move.index + 1}.`);
            } else {
                showMessage("La IA no encontró movimientos válidos o se rindió.");
            }
            aiWorker.terminate();
            aiWorker = null;
        };

        aiWorker.onerror = (e) => {
            console.error('Error en el AI Worker:', e);
            showMessage('Ocurrió un error con la IA.');
            iaButtons.forEach(b => b.disabled = false);
            aiWorker.terminate();
            aiWorker = null;
        };
    }

    // Iniciar el juego por primera vez
    reiniciarJuego();
});