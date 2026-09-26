// Chess game: full rules (check, checkmate, stalemate, castling,
// en passant, promotion) for two players on one screen.

const FILES = 'abcdefgh';
const PIECE_VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

let state;
let history = [];
let selected = null;   // { r, c }
let legalFromSelected = [];
let flipped = false;
let pendingPromotion = null;

const boardEl = document.getElementById('board');
const statusEl = document.getElementById('status');

// ---------- Setup ----------

function initialState() {
  const back = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
  const board = Array.from({ length: 8 }, () => Array(8).fill(null));
  for (let c = 0; c < 8; c++) {
    board[0][c] = { type: back[c], color: 'b' };
    board[1][c] = { type: 'p', color: 'b' };
    board[6][c] = { type: 'p', color: 'w' };
    board[7][c] = { type: back[c], color: 'w' };
  }
  return {
    board,
    turn: 'w',
    castling: { wK: true, wQ: true, bK: true, bQ: true },
    enPassant: null,          // square a pawn can capture onto: { r, c }
    lastMove: null,
    captured: { w: [], b: [] }, // pieces captured BY that color
    halfmoveClock: 0,
    positions: {},
    over: false,
  };
}

function cloneState(s) {
  return {
    board: s.board.map(row => row.map(p => (p ? { ...p } : null))),
    turn: s.turn,
    castling: { ...s.castling },
    enPassant: s.enPassant ? { ...s.enPassant } : null,
    lastMove: s.lastMove ? { ...s.lastMove } : null,
    captured: { w: [...s.captured.w], b: [...s.captured.b] },
    halfmoveClock: s.halfmoveClock,
    positions: { ...s.positions },
    over: s.over,
  };
}

// ---------- Move generation ----------

const inside = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
const enemy = color => (color === 'w' ? 'b' : 'w');

// Moves ignoring whether our own king is left in check.
function pseudoMoves(s, r, c) {
  const piece = s.board[r][c];
  if (!piece) return [];
  const moves = [];
  const { type, color } = piece;

  const add = (tr, tc, extra = {}) => moves.push({ from: { r, c }, to: { r: tr, c: tc }, ...extra });

  const slide = dirs => {
    for (const [dr, dc] of dirs) {
      let tr = r + dr, tc = c + dc;
      while (inside(tr, tc)) {
        const target = s.board[tr][tc];
        if (!target) add(tr, tc);
        else {
          if (target.color !== color) add(tr, tc);
          break;
        }
        tr += dr; tc += dc;
      }
    }
  };

  const step = dirs => {
    for (const [dr, dc] of dirs) {
      const tr = r + dr, tc = c + dc;
      if (!inside(tr, tc)) continue;
      const target = s.board[tr][tc];
      if (!target || target.color !== color) add(tr, tc);
    }
  };

  switch (type) {
    case 'p': {
      const dir = color === 'w' ? -1 : 1;
      const startRow = color === 'w' ? 6 : 1;
      const lastRow = color === 'w' ? 0 : 7;
      const fwd = r + dir;
      if (inside(fwd, c) && !s.board[fwd][c]) {
        add(fwd, c, { promotion: fwd === lastRow });
        if (r === startRow && !s.board[r + 2 * dir][c]) add(r + 2 * dir, c, { double: true });
      }
      for (const dc of [-1, 1]) {
        const tc = c + dc;
        if (!inside(fwd, tc)) continue;
        const target = s.board[fwd][tc];
        if (target && target.color !== color) add(fwd, tc, { promotion: fwd === lastRow });
        else if (s.enPassant && s.enPassant.r === fwd && s.enPassant.c === tc) add(fwd, tc, { enPassant: true });
      }
      break;
    }
    case 'n':
      step([[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]);
      break;
    case 'b':
      slide([[-1, -1], [-1, 1], [1, -1], [1, 1]]);
      break;
    case 'r':
      slide([[-1, 0], [1, 0], [0, -1], [0, 1]]);
      break;
    case 'q':
      slide([[-1, -1], [-1, 1], [1, -1], [1, 1], [-1, 0], [1, 0], [0, -1], [0, 1]]);
      break;
    case 'k': {
      step([[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]]);
      // Castling
      const row = color === 'w' ? 7 : 0;
      if (r === row && c === 4 && !isAttacked(s, row, 4, enemy(color))) {
        const kSide = s.castling[color + 'K'];
        const qSide = s.castling[color + 'Q'];
        if (kSide && !s.board[row][5] && !s.board[row][6] &&
            s.board[row][7]?.type === 'r' && s.board[row][7]?.color === color &&
            !isAttacked(s, row, 5, enemy(color)) && !isAttacked(s, row, 6, enemy(color))) {
          add(row, 6, { castle: 'K' });
        }
        if (qSide && !s.board[row][3] && !s.board[row][2] && !s.board[row][1] &&
            s.board[row][0]?.type === 'r' && s.board[row][0]?.color === color &&
            !isAttacked(s, row, 3, enemy(color)) && !isAttacked(s, row, 2, enemy(color))) {
          add(row, 2, { castle: 'Q' });
        }
      }
      break;
    }
  }
  return moves;
}

// Is square (r, c) attacked by any piece of color `by`?
function isAttacked(s, r, c, by) {
  const b = s.board;
  const is = (tr, tc, types) => inside(tr, tc) && b[tr][tc] && b[tr][tc].color === by && types.includes(b[tr][tc].type);

  // Pawns
  const pawnDir = by === 'w' ? 1 : -1; // a white pawn attacks upward, so it sits below
  if (is(r + pawnDir, c - 1, 'p') || is(r + pawnDir, c + 1, 'p')) return true;
  // Knights
  for (const [dr, dc] of [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]) {
    if (is(r + dr, c + dc, 'n')) return true;
  }
  // King
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if ((dr || dc) && is(r + dr, c + dc, 'k')) return true;
    }
  }
  // Sliding pieces
  const rays = (dirs, types) => dirs.some(([dr, dc]) => {
    let tr = r + dr, tc = c + dc;
    while (inside(tr, tc)) {
      const p = b[tr][tc];
      if (p) return p.color === by && types.includes(p.type);
      tr += dr; tc += dc;
    }
    return false;
  });
  return rays([[-1, -1], [-1, 1], [1, -1], [1, 1]], 'bq') ||
         rays([[-1, 0], [1, 0], [0, -1], [0, 1]], 'rq');
}

function findKing(s, color) {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = s.board[r][c];
      if (p && p.type === 'k' && p.color === color) return { r, c };
    }
  }
  return null;
}

function inCheck(s, color) {
  const k = findKing(s, color);
  return k ? isAttacked(s, k.r, k.c, enemy(color)) : false;
}

function legalMoves(s, r, c) {
  const piece = s.board[r][c];
  if (!piece) return [];
  return pseudoMoves(s, r, c).filter(m => {
    const next = applyMove(s, m, 'q');
    return !inCheck(next, piece.color);
  });
}

function allLegalMoves(s, color) {
  const moves = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (s.board[r][c]?.color === color) moves.push(...legalMoves(s, r, c));
    }
  }
  return moves;
}

// ---------- Applying moves ----------

function applyMove(s, move, promoteTo) {
  const n = cloneState(s);
  const { from, to } = move;
  const piece = n.board[from.r][from.c];
  let captured = n.board[to.r][to.c];

  if (move.enPassant) {
    captured = n.board[from.r][to.c];
    n.board[from.r][to.c] = null;
  }

  n.board[to.r][to.c] = piece;
  n.board[from.r][from.c] = null;

  if (move.castle) {
    const row = from.r;
    if (move.castle === 'K') { n.board[row][5] = n.board[row][7]; n.board[row][7] = null; }
    else { n.board[row][3] = n.board[row][0]; n.board[row][0] = null; }
  }

  if (move.promotion) n.board[to.r][to.c] = { type: promoteTo || 'q', color: piece.color };

  // Update castling rights
  if (piece.type === 'k') { n.castling[piece.color + 'K'] = false; n.castling[piece.color + 'Q'] = false; }
  const rookSquares = { '7,0': 'wQ', '7,7': 'wK', '0,0': 'bQ', '0,7': 'bK' };
  for (const sq of [`${from.r},${from.c}`, `${to.r},${to.c}`]) {
    if (rookSquares[sq]) n.castling[rookSquares[sq]] = false;
  }

  n.enPassant = move.double ? { r: (from.r + to.r) / 2, c: from.c } : null;
  if (captured) n.captured[piece.color].push(captured.type);
  n.halfmoveClock = (piece.type === 'p' || captured) ? 0 : n.halfmoveClock + 1;
  n.lastMove = { from, to };
  n.turn = enemy(piece.color);
  return n;
}

function positionKey(s) {
  const rows = s.board.map(row => row.map(p => (p ? (p.color === 'w' ? p.type.toUpperCase() : p.type) : '.')).join(''));
  const c = s.castling;
  const ep = s.enPassant ? `${s.enPassant.r}${s.enPassant.c}` : '-';
  return `${rows.join('/')} ${s.turn} ${+c.wK}${+c.wQ}${+c.bK}${+c.bQ} ${ep}`;
}

function insufficientMaterial(s) {
  const pieces = [];
  for (const row of s.board) for (const p of row) if (p && p.type !== 'k') pieces.push(p);
  if (pieces.length === 0) return true;
  if (pieces.length === 1 && 'bn'.includes(pieces[0].type)) return true;
  return false;
}

// ---------- UI ----------

function makeMove(move, promoteTo) {
  history.push(state);
  state = applyMove(state, move, promoteTo);
  const key = positionKey(state);
  state.positions[key] = (state.positions[key] || 0) + 1;
  selected = null;
  legalFromSelected = [];
  render();
}

function onSquareClick(r, c) {
  if (state.over || pendingPromotion) return;
  const piece = state.board[r][c];

  if (selected) {
    const move = legalFromSelected.find(m => m.to.r === r && m.to.c === c);
    if (move) {
      if (move.promotion) askPromotion(move);
      else makeMove(move);
      return;
    }
  }

  if (piece && piece.color === state.turn) {
    if (selected && selected.r === r && selected.c === c) {
      selected = null;
      legalFromSelected = [];
    } else {
      selected = { r, c };
      legalFromSelected = legalMoves(state, r, c);
    }
  } else {
    selected = null;
    legalFromSelected = [];
  }
  render();
}

function askPromotion(move) {
  pendingPromotion = move;
  const box = document.getElementById('promotion');
  const choices = document.getElementById('promotion-choices');
  choices.innerHTML = '';
  for (const type of ['q', 'r', 'b', 'n']) {
    const btn = document.createElement('button');
    btn.innerHTML = pieceSVG(type, state.turn);
    btn.title = { q: 'Queen', r: 'Rook', b: 'Bishop', n: 'Knight' }[type];
    btn.addEventListener('click', () => {
      box.classList.add('hidden');
      pendingPromotion = null;
      makeMove(move, type);
    });
    choices.appendChild(btn);
  }
  box.classList.remove('hidden');
}

function updateStatus() {
  const name = state.turn === 'w' ? 'White' : 'Black';
  const other = state.turn === 'w' ? 'Black' : 'White';
  const moves = allLegalMoves(state, state.turn);
  const check = inCheck(state, state.turn);
  let text;
  state.over = false;

  if (moves.length === 0) {
    state.over = true;
    text = check ? `Checkmate! ${other} wins.` : 'Stalemate — it\'s a draw.';
  } else if (insufficientMaterial(state)) {
    state.over = true;
    text = 'Draw — not enough pieces to checkmate.';
  } else if (state.halfmoveClock >= 100) {
    state.over = true;
    text = 'Draw — 50-move rule.';
  } else if (state.positions[positionKey(state)] >= 3) {
    state.over = true;
    text = 'Draw — threefold repetition.';
  } else {
    text = check ? `${name} is in check!` : `${name} to move`;
  }
  statusEl.textContent = text;
  statusEl.classList.toggle('alert', check || state.over);
  return check;
}

function renderCaptured() {
  // Top shows pieces captured by the player at the top of the board.
  const topColor = flipped ? 'w' : 'b';
  const bottomColor = enemy(topColor);
  const draw = (el, byColor) => {
    const list = [...state.captured[byColor]].sort((a, b) => PIECE_VALUE[b] - PIECE_VALUE[a]);
    el.innerHTML = list.map(t => pieceSVG(t, enemy(byColor))).join('');
  };
  draw(document.getElementById('captured-top'), topColor);
  draw(document.getElementById('captured-bottom'), bottomColor);
}

function render() {
  const check = updateStatus();
  const king = check ? findKing(state, state.turn) : null;
  boardEl.innerHTML = '';

  for (let vr = 0; vr < 8; vr++) {
    for (let vc = 0; vc < 8; vc++) {
      const r = flipped ? 7 - vr : vr;
      const c = flipped ? 7 - vc : vc;
      const sq = document.createElement('div');
      sq.className = 'square ' + ((r + c) % 2 === 0 ? 'light' : 'dark');
      sq.dataset.square = FILES[c] + (8 - r);

      const lm = state.lastMove;
      if (lm && ((lm.from.r === r && lm.from.c === c) || (lm.to.r === r && lm.to.c === c))) sq.classList.add('last-move');
      if (selected && selected.r === r && selected.c === c) sq.classList.add('selected');
      if (king && king.r === r && king.c === c) sq.classList.add('check');

      const target = legalFromSelected.find(m => m.to.r === r && m.to.c === c);
      if (target) sq.classList.add(state.board[r][c] || target.enPassant ? 'capture' : 'move');

      const piece = state.board[r][c];
      if (piece) sq.innerHTML = pieceSVG(piece.type, piece.color);

      if (vc === 0) sq.insertAdjacentHTML('beforeend', `<span class="coord rank">${8 - r}</span>`);
      if (vr === 7) sq.insertAdjacentHTML('beforeend', `<span class="coord file">${FILES[c]}</span>`);

      sq.addEventListener('click', () => onSquareClick(r, c));
      boardEl.appendChild(sq);
    }
  }
  renderCaptured();
}

function newGame() {
  state = initialState();
  state.positions[positionKey(state)] = 1;
  history = [];
  selected = null;
  legalFromSelected = [];
  pendingPromotion = null;
  document.getElementById('promotion').classList.add('hidden');
  render();
}

document.getElementById('new-game').addEventListener('click', newGame);
document.getElementById('undo').addEventListener('click', () => {
  if (pendingPromotion || history.length === 0) return;
  state = history.pop();
  selected = null;
  legalFromSelected = [];
  render();
});
document.getElementById('flip').addEventListener('click', () => {
  flipped = !flipped;
  render();
});

newGame();
