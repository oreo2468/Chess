// Drawn chess pieces as SVG shapes (no letters or font symbols).
// Each piece is drawn on a 100x100 canvas. White pieces are white with a
// black outline, black pieces are black with a light outline.

const PIECE_SHAPES = {
  // Pawn: round head, collar, flared body
  p: `
    <circle cx="50" cy="30" r="12"/>
    <path d="M40 46 H60 L58 40 H42 Z"/>
    <path d="M42 46 C42 60 34 68 32 78 H68 C66 68 58 60 58 46 Z"/>
    <rect x="24" y="78" width="52" height="10" rx="3"/>`,

  // Rook: castle tower with battlements
  r: `
    <path d="M26 16 H36 V24 H45 V16 H55 V24 H64 V16 H74 V34 H26 Z"/>
    <path d="M32 34 H68 L64 40 H36 Z"/>
    <rect x="36" y="40" width="28" height="30"/>
    <path d="M30 70 H70 L72 78 H28 Z"/>
    <rect x="22" y="78" width="56" height="10" rx="3"/>`,

  // Knight: horse head with ear, mane and eye
  n: `
    <path d="M34 78 C34 66 40 60 48 54 C42 55 35 58 29 55
             C24 52 23 46 27 42 L42 28 L44 16 L52 25
             C68 26 77 42 73 78 Z"/>
    <circle class="detail" cx="45" cy="36" r="2.8"/>
    <path class="line" d="M28 49 L32 48"/>
    <path class="line" d="M58 30 C66 40 68 56 66 76"/>
    <rect x="24" y="78" width="54" height="10" rx="3"/>`,

  // Bishop: mitre hat with slit and ball on top
  b: `
    <circle cx="50" cy="14" r="5"/>
    <path d="M50 20 C63 30 66 44 59 56 H41 C34 44 37 30 50 20 Z"/>
    <path class="line" d="M55 30 L46 42"/>
    <path d="M38 56 H62 V62 H38 Z"/>
    <path d="M42 62 C42 70 36 74 34 78 H66 C64 74 58 70 58 62 Z"/>
    <rect x="24" y="78" width="52" height="10" rx="3"/>`,

  // Queen: crown with five pointed tips topped by balls
  q: `
    <path d="M28 66 L20 30 L36 50 L40 22 L50 48 L60 22 L64 50 L80 30 L72 66 Z"/>
    <circle cx="20" cy="28" r="4.5"/>
    <circle cx="40" cy="20" r="4.5"/>
    <circle cx="60" cy="20" r="4.5"/>
    <circle cx="80" cy="28" r="4.5"/>
    <circle cx="50" cy="44" r="4"/>
    <path d="M28 66 H72 L70 78 H30 Z"/>
    <rect x="22" y="78" width="56" height="10" rx="3"/>`,

  // King: cross on top of a rounded crown
  k: `
    <path d="M46 6 H54 V14 H62 V22 H54 V34 H46 V22 H38 V14 H46 Z"/>
    <path d="M30 66 C20 50 28 34 42 36 C46 36 48 38 50 42
             C52 38 54 36 58 36 C72 34 80 50 70 66 Z"/>
    <path class="line" d="M50 42 V66"/>
    <path d="M30 66 H70 L68 78 H32 Z"/>
    <rect x="22" y="78" width="56" height="10" rx="3"/>`,
};

function pieceSVG(type, color) {
  const fill = color === 'w' ? '#ffffff' : '#141414';
  const stroke = color === 'w' ? '#111111' : '#e8e8e8';
  const shapes = PIECE_SHAPES[type]
    .replaceAll('class="detail"', `fill="${stroke}"`)
    .replaceAll('class="line"', 'fill="none"');
  return `
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <g fill="${fill}" stroke="${stroke}" stroke-width="3"
         stroke-linejoin="round" stroke-linecap="round">
        ${shapes}
      </g>
    </svg>`;
}
