const pieces = {
  p: '<circle cx="50" cy="23" r="10"/><path d="M40 39c-7 4-9 11-4 18l5 17h18l5-17c5-7 3-14-4-18-5 4-15 4-20 0ZM28 79h44l6 10H22l6-10Z"/><path d="M38 75h24M31 84h38" fill="none"/>',
  n: '<path d="M24 87h55v-8h-7V66c0-8-5-14-14-19l11-11-6-15-16 7-9-14-7 15c-10 4-17 12-19 23l9 9-10 8v10h13v8Z"/><path d="m47 29 6 8 10-5M42 52c7-5 14-6 22-3M30 71h39M27 83h48" fill="none"/><circle cx="57" cy="40" r="2.3" class="piece-eye"/>',
  b: '<path d="M50 12c-11 11-15 21-12 31 2 7 7 11 12 14 5-3 10-7 12-14 3-10-1-20-12-31ZM40 58c-6 5-8 11-7 18h34c1-7-1-13-7-18-6 4-14 4-20 0ZM28 79h44l6 10H22l6-10Z"/><path d="m45 28 10 12M37 73h26M31 84h38" fill="none"/>',
  r: '<path d="M25 17h12v10h9V17h9v10h9V17h12v24H25V17ZM32 43h36l-4 31h-7v5h20l6 10H17l6-10h20v-5h-7l-4-31Z"/><path d="M34 49h32M31 84h38" fill="none"/>',
  q: '<path d="m26 35-8-17 17 9 15-16 15 16 17-9-8 17-8 13-3 26H37l-3-26-8-13ZM28 79h44l6 10H22l6-10Z"/><circle cx="18" cy="16" r="4"/><circle cx="35" cy="26" r="4"/><circle cx="50" cy="11" r="4"/><circle cx="65" cy="26" r="4"/><circle cx="82" cy="16" r="4"/><path d="M36 49h28M38 73h24M31 84h38" fill="none"/>',
  k: '<path d="M45 11h10v10h10v9H55v10h-10V30H35v-9h10V11ZM39 43c-8 6-12 13-10 21l7 10h28l7-10c2-8-2-15-10-21-6 5-16 5-22 0ZM28 79h44l6 10H22l6-10Z"/><path d="M38 69h24M31 84h38" fill="none"/>',
};

export function pieceSvg(piece) {
  const color = piece.color === 'w' ? 'white' : 'black';
  return `<svg class="piece-svg ${color}" viewBox="0 0 100 100" aria-hidden="true" focusable="false">${pieces[piece.type]}</svg>`;
}
