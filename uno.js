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

// ---------- رسم الأوراق (شكل واقعي) ----------
const FONT = 'font-family="Lalezar,Tahoma,sans-serif"';
const OUT = 'stroke="#1a1426" stroke-linejoin="round" paint-order="stroke"';
function glyph(v, fill, size) {
  if (v === "S") return `<g fill="none" stroke="#1a1426" stroke-width="${size * .26}"><circle r="${size * .42}"/><path d="M${-size * .3} ${size * .3} L${size * .3} ${-size * .3}"/></g>
    <g fill="none" stroke="${fill}" stroke-width="${size * .14}"><circle r="${size * .42}"/><path d="M${-size * .3} ${size * .3} L${size * .3} ${-size * .3}"/></g>`;
  if (v === "R") {
    const a = `M${-size * .45} ${-size * .05} q0 ${-size * .35} ${size * .35} ${-size * .35} h${size * .12} v${-size * .16} l${size * .3} ${size * .28} l${-size * .3} ${size * .28} v${-size * .16} h${-size * .12} q${-size * .2} 0 ${-size * .2} ${size * .2}z`;
    return `<g fill="${fill}" stroke="#1a1426" stroke-width="1.6" stroke-linejoin="round" paint-order="stroke"><path d="${a}"/><path transform="rotate(180)" d="${a}"/></g>`;
  }
  const t = v === "D" ? "+٢" : AD(v), fs = v === "D" ? size * 1.05 : size * 1.35, y = v === "D" ? size * .36 : size * .44;
  return `<text x="1.6" y="${y + 1.8}" text-anchor="middle" ${FONT} font-size="${fs}" fill="#1a1426" opacity=".55">${t}</text>
    <text x="0" y="${y}" text-anchor="middle" ${FONT} font-size="${fs}" fill="${fill}" ${OUT} stroke-width="2.6">${t}</text>`;
}
function quad(rx, ry, id) {
  const c = UCOLORS;
  return `<clipPath id="${id}q"><ellipse rx="${rx}" ry="${ry}"/></clipPath>
    <g clip-path="url(#${id}q)"><rect x="-40" y="-40" width="40" height="40" fill="${c.r.fill}"/><rect x="0" y="-40" width="40" height="40" fill="${c.y.fill}"/>
    <rect x="-40" y="0" width="40" height="40" fill="${c.b.fill}"/><rect x="0" y="0" width="40" height="40" fill="${c.g.fill}"/></g>`;
}
// إطار الورقة: حافة بيضاء + لمعة
function frame(id, fill, dark) {
  return `<defs>
      <linearGradient id="${id}f" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${fill}"/><stop offset="1" stop-color="${dark}"/></linearGradient>
      <linearGradient id="${id}g" x1="0" y1="0" x2=".7" y2=".7"><stop offset="0" stop-color="#fff" stop-opacity=".38"/><stop offset=".45" stop-color="#fff" stop-opacity=".06"/><stop offset=".46" stop-color="#fff" stop-opacity="0"/></linearGradient>
      <linearGradient id="${id}e" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#e9e2d6"/></linearGradient>
    </defs>
    <rect x=".5" y=".5" width="59" height="89" rx="7" fill="url(#${id}e)" stroke="rgba(0,0,0,.25)" stroke-width=".6"/>
    <rect x="3.5" y="3.5" width="53" height="83" rx="5" fill="url(#${id}f)"/>`;
}
const gloss = id => `<rect x="3.5" y="3.5" width="53" height="83" rx="5" fill="url(#${id}g)" pointer-events="none"/>`;
let uid = 0;
export function cardSVG(c) {
  const id = "u" + (++uid);
  if (!c) { // ظهر الورقة
    return `<svg viewBox="0 0 60 90" class="ucard-svg" aria-hidden="true">${frame(id, "#2a2140", "#0c0816")}
      <g transform="translate(30 45) rotate(-30)"><ellipse rx="22" ry="34" fill="#e8483f" stroke="#1a1426" stroke-width="1"/><ellipse rx="19" ry="31" fill="none" stroke="#f2b134" stroke-width="1.2"/></g>
      <text x="30" y="51" text-anchor="middle" ${FONT} font-size="18" fill="#f7c948" ${OUT} stroke-width="2.4" transform="rotate(-30 30 45)">جلسة</text>${gloss(id)}</svg>`;
  }
  const k = cColor(c), v = cVal(c), wild = k === "w";
  const col = wild ? { fill: "#2a2140", dark: "#0c0816" } : UCOLORS[k];
  const corner = v === "W" ? "" : v === "F" ? "+٤" : v === "D" ? "+٢" : v === "S" ? "⊘" : v === "R" ? "⇄" : AD(v);
  const center = wild
    ? `<g transform="translate(30 45) rotate(-30)">${quad(20, 31, id)}<ellipse rx="20" ry="31" fill="none" stroke="#fff" stroke-width="2.4"/></g>
       ${v === "F" ? `<text x="30" y="55" text-anchor="middle" ${FONT} font-size="25" fill="#fff" ${OUT} stroke-width="3">+٤</text>` : ""}`
    : `<g transform="translate(30 45) rotate(-30)"><ellipse rx="21" ry="33" fill="#fff"/></g><g transform="translate(30 45)">${glyph(v, col.fill, 22)}</g>`;
  return `<svg viewBox="0 0 60 90" class="ucard-svg" aria-hidden="true">${frame(id, col.fill, col.dark)}
    ${center}
    ${corner ? `<text x="9" y="17" ${FONT} font-size="12.5" fill="#fff" ${OUT} stroke-width="2">${corner}</text>
    <text x="51" y="80" text-anchor="end" ${FONT} font-size="12.5" fill="#fff" ${OUT} stroke-width="2" transform="rotate(180 46 76)">${corner}</text>` : ""}
    ${gloss(id)}</svg>`;
}

// ---------- الطاولة: خشب + جوخ ----------
export const TABLE_SVG = `<svg viewBox="0 0 400 400" class="utable-svg" aria-hidden="true">
  <defs>
    <radialGradient id="felt" cx="50%" cy="48%" r="62%"><stop offset="0" stop-color="#23735a"/><stop offset=".7" stop-color="#155240"/><stop offset="1" stop-color="#0c3529"/></radialGradient>
    <linearGradient id="wood" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9a5f2e"/><stop offset=".35" stop-color="#6e3d1a"/><stop offset=".65" stop-color="#8a5226"/><stop offset="1" stop-color="#4f2a10"/></linearGradient>
    <linearGradient id="woodHi" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <filter id="feltN" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="4"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .22 0"/><feComposite in2="SourceGraphic" operator="in"/></filter>
    <filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".012 .35" numOctaves="2" seed="9"/><feColorMatrix values="0 0 0 0 .1  0 0 0 0 .05  0 0 0 0 0  0 0 0 .35 0"/><feComposite in2="SourceGraphic" operator="in"/></filter>
  </defs>
  <rect x="14" y="22" width="372" height="372" rx="92" fill="rgba(0,0,0,.45)"/>
  <rect x="10" y="10" width="380" height="380" rx="92" fill="url(#wood)"/>
  <rect x="10" y="10" width="380" height="380" rx="92" fill="#000" filter="url(#grain)"/>
  <rect x="10" y="10" width="380" height="380" rx="92" fill="url(#woodHi)"/>
  <rect x="12" y="12" width="376" height="376" rx="90" fill="none" stroke="rgba(255,220,170,.25)" stroke-width="1.5"/>
  <rect x="38" y="38" width="324" height="324" rx="70" fill="rgba(0,0,0,.5)"/>
  <rect x="40" y="41" width="320" height="320" rx="68" fill="url(#felt)"/>
  <rect x="40" y="41" width="320" height="320" rx="68" fill="#000" filter="url(#feltN)"/>
  <rect x="40" y="41" width="320" height="320" rx="68" fill="none" stroke="rgba(0,0,0,.45)" stroke-width="6"/>
  <rect x="56" y="57" width="288" height="288" rx="54" fill="none" stroke="#f2c46b" stroke-opacity=".35" stroke-width="1.5" stroke-dasharray="5 5"/>
  <text x="200" y="312" text-anchor="middle" font-family="Lalezar,Tahoma,sans-serif" font-size="28" fill="rgba(255,240,200,.08)">جلسة</text>
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
