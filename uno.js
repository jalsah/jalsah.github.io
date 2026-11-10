// أونو جلسة: الأوراق، القواعد، الرسم

export const UCOLORS = {
  r: { name: "أحمر", fill: "#ef6f6c", dark: "#b8324a" },
  y: { name: "أصفر", fill: "#f2b134", dark: "#c97f12" },
  g: { name: "أخضر", fill: "#3fbf9a", dark: "#1f8a6c" },
  b: { name: "بنفسجي", fill: "#8f7bea", dark: "#5b45c9" }
};
const AD = n => String(n).replace(/\d/g, d => "٠١٢٣٤٥٦٧٨٩"[d]);

// كود الورقة: لون + قيمة. القيم: 0-9، S تخطي، R عكس، D +٢، W جوكر، F جوكر +٤
export const cColor = c => c[0];
export const cVal = c => c.slice(1);
export const isWild = c => c[0] === "w";

export function buildDeck() {
  const d = [];
  for (const k of "rygb") {
    d.push(k + "0");
    for (let n = 1; n <= 9; n++) d.push(k + n, k + n);
    for (const v of ["S", "R", "D"]) d.push(k + v, k + v);
  }
  for (let i = 0; i < 4; i++) d.push("wW", "wF");
  return d;
}
export function canPlay(card, top, color) {
  if (isWild(card)) return true;
  return cColor(card) === color || (!isWild(top) && cVal(card) === cVal(top));
}
export function cardName(c) {
  const v = cVal(c);
  if (v === "W") return "جوكر";
  if (v === "F") return "جوكر +٤";
  const col = UCOLORS[cColor(c)].name;
  if (v === "S") return "تخطي " + col;
  if (v === "R") return "عكس " + col;
  if (v === "D") return "+٢ " + col;
  return AD(v) + " " + col;
}

// ---------- رسم الأوراق ----------
const SADU = id => `<pattern id="${id}" width="8" height="6" patternUnits="userSpaceOnUse"><path d="M0 6 L4 0 L8 6Z" fill="rgba(255,248,236,.55)"/></pattern>`;
function glyph(v, fill, size) {
  const ink = fill;
  if (v === "S") return `<g fill="none" stroke="${ink}" stroke-width="${size * .14}"><circle cx="0" cy="0" r="${size * .42}"/><path d="M${-size * .3} ${size * .3} L${size * .3} ${-size * .3}"/></g>`;
  if (v === "R") return `<g fill="${ink}"><path d="M${-size * .45} ${-size * .05} q0 ${-size * .35} ${size * .35} ${-size * .35} h${size * .12} v${-size * .16} l${size * .3} ${size * .28} l${-size * .3} ${size * .28} v${-size * .16} h${-size * .12} q${-size * .2} 0 ${-size * .2} ${size * .2}z"/><path transform="rotate(180)" d="M${-size * .45} ${-size * .05} q0 ${-size * .35} ${size * .35} ${-size * .35} h${size * .12} v${-size * .16} l${size * .3} ${size * .28} l${-size * .3} ${size * .28} v${-size * .16} h${-size * .12} q${-size * .2} 0 ${-size * .2} ${size * .2}z"/></g>`;
  if (v === "D") return `<text x="0" y="${size * .32}" text-anchor="middle" font-family="Lalezar,Tahoma,sans-serif" font-size="${size * .95}" fill="${ink}">+٢</text>`;
  return `<text x="0" y="${size * .36}" text-anchor="middle" font-family="Lalezar,Tahoma,sans-serif" font-size="${size * 1.15}" fill="${ink}">${AD(v)}</text>`;
}
function quad(rx, ry, id) {
  const c = UCOLORS;
  return `<clipPath id="${id}q"><ellipse rx="${rx}" ry="${ry}"/></clipPath>
    <g clip-path="url(#${id}q)"><rect x="-40" y="-40" width="40" height="40" fill="${c.r.fill}"/><rect x="0" y="-40" width="40" height="40" fill="${c.y.fill}"/>
    <rect x="-40" y="0" width="40" height="40" fill="${c.b.fill}"/><rect x="0" y="0" width="40" height="40" fill="${c.g.fill}"/></g>`;
}
let uid = 0;
export function cardSVG(c) {
  const id = "u" + (++uid);
  if (!c) { // ظهر الورقة
    return `<svg viewBox="0 0 60 90" class="ucard-svg" aria-hidden="true"><defs>${SADU(id)}</defs>
      <rect x="1" y="1" width="58" height="88" rx="8" fill="#fff8ec"/>
      <rect x="4" y="4" width="52" height="82" rx="6" fill="#1c1530"/>
      <rect x="4" y="8" width="52" height="6" fill="url(#${id})"/><rect x="4" y="76" width="52" height="6" fill="url(#${id})"/>
      <g transform="translate(30 45) rotate(-28)"><ellipse rx="21" ry="30" fill="#ef6f6c"/><ellipse rx="17" ry="26" fill="none" stroke="#f2b134" stroke-width="1.5"/></g>
      <text x="30" y="52" text-anchor="middle" font-family="Lalezar,Tahoma,sans-serif" font-size="17" fill="#fff8ec" transform="rotate(-28 30 45)">جلسة</text></svg>`;
  }
  const k = cColor(c), v = cVal(c), wild = k === "w";
  const col = wild ? { fill: "#1c1530", dark: "#0f0b1c" } : UCOLORS[k];
  const corner = v === "W" ? "" : v === "F" ? "+٤" : v === "D" ? "+٢" : v === "S" ? "⊘" : v === "R" ? "⇄" : AD(v);
  const center = wild
    ? `<g transform="translate(30 45) rotate(-28)">${quad(19, 27, id)}<ellipse rx="19" ry="27" fill="none" stroke="#fff8ec" stroke-width="2"/></g>
       ${v === "F" ? `<text x="30" y="55" text-anchor="middle" font-family="Lalezar,Tahoma,sans-serif" font-size="24" fill="#fff8ec" stroke="#1c1530" stroke-width="1.2" paint-order="stroke">+٤</text>` : ""}`
    : `<g transform="translate(30 45) rotate(-28)"><ellipse rx="20" ry="29" fill="#fff8ec"/></g><g transform="translate(30 45)">${glyph(v, col.fill, 22)}</g>`;
  return `<svg viewBox="0 0 60 90" class="ucard-svg" aria-hidden="true"><defs>${SADU(id)}</defs>
    <rect x="1" y="1" width="58" height="88" rx="8" fill="#fff8ec"/>
    <rect x="4" y="4" width="52" height="82" rx="6" fill="${col.fill}"/>
    <rect x="4" y="4" width="52" height="82" rx="6" fill="none" stroke="${col.dark}" stroke-width="1"/>
    <rect x="4" y="80" width="52" height="5" fill="url(#${id})"/>
    ${center}
    ${corner ? `<text x="9" y="17" font-family="Lalezar,Tahoma,sans-serif" font-size="12" fill="#fff8ec">${corner}</text>
    <text x="51" y="80" text-anchor="end" font-family="Lalezar,Tahoma,sans-serif" font-size="12" fill="#fff8ec" transform="rotate(180 46 76)">${corner}</text>` : ""}
  </svg>`;
}

// ---------- الطاولة ----------
export const TABLE_SVG = `<svg viewBox="0 0 400 400" class="utable-svg" aria-hidden="true">
  <defs>
    <radialGradient id="felt" cx="50%" cy="45%" r="60%"><stop offset="0" stop-color="#3a2d63"/><stop offset="1" stop-color="#1f1838"/></radialGradient>
    <linearGradient id="wood" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c58a4a"/><stop offset="1" stop-color="#8a5a2b"/></linearGradient>
    <pattern id="tsadu" width="16" height="12" patternUnits="userSpaceOnUse"><path d="M0 12 L8 0 L16 12Z" fill="rgba(242,177,52,.12)"/></pattern>
  </defs>
  <path d="M30 34 Q200 82 370 34 Q322 200 370 366 Q200 318 30 366 Q78 200 30 34Z" transform="translate(4 8)" fill="rgba(0,0,0,.35)" stroke="rgba(0,0,0,.35)" stroke-width="40" stroke-linejoin="round"/>
  <path d="M30 34 Q200 82 370 34 Q322 200 370 366 Q200 318 30 366 Q78 200 30 34Z" fill="url(#wood)" stroke="url(#wood)" stroke-width="40" stroke-linejoin="round"/>
  <path d="M30 34 Q200 82 370 34 Q322 200 370 366 Q200 318 30 366 Q78 200 30 34Z" fill="#f3e9d2" stroke="#f3e9d2" stroke-width="30" stroke-linejoin="round"/>
  <path d="M84 88 Q200 124 316 88 Q280 200 316 312 Q200 276 84 312 Q120 200 84 88Z" fill="url(#felt)" stroke="url(#felt)" stroke-width="34" stroke-linejoin="round"/>
  <path d="M84 88 Q200 124 316 88 Q280 200 316 312 Q200 276 84 312 Q120 200 84 88Z" fill="url(#tsadu)"/>
  <path d="M84 88 Q200 124 316 88 Q280 200 316 312 Q200 276 84 312 Q120 200 84 88Z" fill="none" stroke="#f2b134" stroke-opacity=".35" stroke-width="2" stroke-dasharray="6 6"/>
  ${[[34, 38], [366, 38], [34, 362], [366, 362]].map(([x, y]) => `<g transform="translate(${x} ${y})"><circle r="22" fill="#2a2146"/><circle r="17" fill="#120d22"/><path d="M-12 -6 A14 14 0 0 1 6 -14" stroke="rgba(255,255,255,.18)" stroke-width="3" fill="none" stroke-linecap="round"/></g>`).join("")}
  <text x="200" y="300" text-anchor="middle" font-family="Lalezar,Tahoma,sans-serif" font-size="26" fill="rgba(247,240,227,.08)">جلسة</text>
</svg>`;

// أماكن اللاعبين حول الطاولة (نسبة مئوية)، بترتيب الدور بعدك
export function seatSpots(n) {
  const spots = {
    1: [[50, 4]],
    2: [[16, 30], [84, 30]],
    3: [[8, 46], [50, 4], [92, 46]],
    4: [[8, 56], [24, 6], [76, 6], [92, 56]],
    5: [[6, 62], [10, 22], [50, 2], [90, 22], [94, 62]],
    6: [[6, 66], [6, 30], [32, 2], [68, 2], [94, 30], [94, 66]],
    7: [[6, 70], [6, 40], [16, 6], [50, 0], [84, 6], [94, 40], [94, 70]]
  };
  return spots[Math.min(n, 7)] || spots[7];
}
