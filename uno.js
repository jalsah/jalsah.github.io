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
export function cardSVG(c, back = "classic") {
  const id = "u" + (++uid);
  if (!c) return backSVG(id, back);
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

// ---------- ظهر الورقة: أشكال تنفتح بالمستوى ----------
export const BACKS = {
  classic: { name: "كلاسيك", lvl: 1 },
  sadu: { name: "سدو", lvl: 3 },
  night: { name: "ليل", lvl: 8 },
  gold: { name: "ذهبي", lvl: 20 },
  royal: { name: "ملكي", lvl: 9999, shop: "b_royal" }
};
function backSVG(id, back) {
  const word = (fill, stroke = "#1a1426") => `<text x="30" y="51" text-anchor="middle" ${FONT} font-size="18" fill="${fill}" stroke="${stroke}" stroke-linejoin="round" paint-order="stroke" stroke-width="2.4" transform="rotate(-30 30 45)">جلسة</text>`;
  if (back === "sadu") {
    const rows = [10, 22, 34, 46, 58, 70].map((y, i) => `<path d="${Array.from({ length: 7 }, (_, k) => `M${4 + k * 8} ${y + 8} l4 -8 l4 8z`).join(" ")}" fill="${i % 2 ? "#f2b134" : "#fff3e0"}" opacity=".9"/>`).join("");
    return `<svg viewBox="0 0 60 90" class="ucard-svg" aria-hidden="true">${frame(id, "#b8323a", "#6d1420")}
      <clipPath id="${id}c"><rect x="3.5" y="3.5" width="53" height="83" rx="5"/></clipPath><g clip-path="url(#${id}c)">${rows}<rect x="3.5" y="80" width="53" height="7" fill="#1a1426"/></g>
      <rect x="10" y="33" width="40" height="24" rx="12" fill="#1a1426" stroke="#f2b134" stroke-width="1.2"/>
      <text x="30" y="51" text-anchor="middle" ${FONT} font-size="16" fill="#f7c948">جلسة</text>${gloss(id)}</svg>`;
  }
  if (back === "night") {
    const stars = [[12, 14], [46, 12], [20, 74], [50, 70], [9, 48], [52, 40], [38, 80], [28, 10]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i % 3 ? .8 : 1.3}" fill="#fff" opacity=".85"/>`).join("");
    return `<svg viewBox="0 0 60 90" class="ucard-svg" aria-hidden="true">${frame(id, "#3e2f8a", "#120c2e")}${stars}
      <path d="M38 24 a12 12 0 1 0 6 20 a10 10 0 1 1 -6 -20z" fill="#f7c948"/>
      <text x="30" y="68" text-anchor="middle" ${FONT} font-size="15" fill="#fff" stroke="#120c2e" stroke-width="2" paint-order="stroke">جلسة</text>${gloss(id)}</svg>`;
  }
  if (back === "royal") {
    return `<svg viewBox="0 0 60 90" class="ucard-svg" aria-hidden="true">${frame(id, "#8e1430", "#3a0612")}
      <defs><linearGradient id="${id}au" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff1b8"/><stop offset=".5" stop-color="#f2c14e"/><stop offset="1" stop-color="#b8862b"/></linearGradient></defs>
      <rect x="7" y="7" width="46" height="76" rx="4" fill="none" stroke="url(#${id}au)" stroke-width="1.6"/>
      ${[[11, 11], [49, 11], [11, 79], [49, 79]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.6" fill="url(#${id}au)"/>`).join("")}
      <path d="M17 44 l4 -12 l9 8 l9 -8 l4 12 z" fill="url(#${id}au)" stroke="#3a0612" stroke-width=".8" stroke-linejoin="round"/>
      <rect x="17" y="45" width="26" height="4" rx="1" fill="url(#${id}au)"/>
      <circle cx="21" cy="31" r="1.8" fill="#fff1b8"/><circle cx="30" cy="38" r="1.8" fill="#fff1b8"/><circle cx="39" cy="31" r="1.8" fill="#fff1b8"/>
      <text x="30" y="64" text-anchor="middle" ${FONT} font-size="13" fill="url(#${id}au)">جلسة</text>${gloss(id)}</svg>`;
  }
  if (back === "gold") {
    return `<svg viewBox="0 0 60 90" class="ucard-svg" aria-hidden="true">${frame(id, "#1d1d22", "#050506")}
      <rect x="7" y="7" width="46" height="76" rx="4" fill="none" stroke="#e8c25a" stroke-width="1.2"/>
      <rect x="10" y="10" width="40" height="70" rx="3" fill="none" stroke="#e8c25a" stroke-width=".5" stroke-dasharray="2 2"/>
      <g transform="translate(30 45) rotate(45)"><rect x="-13" y="-13" width="26" height="26" fill="none" stroke="#e8c25a" stroke-width="1.4"/></g>
      ${word("#f7d77a", "#000")}${gloss(id)}</svg>`;
  }
  return `<svg viewBox="0 0 60 90" class="ucard-svg" aria-hidden="true">${frame(id, "#2a2140", "#0c0816")}
      <g transform="translate(30 45) rotate(-30)"><ellipse rx="22" ry="34" fill="#e8483f" stroke="#1a1426" stroke-width="1"/><ellipse rx="19" ry="31" fill="none" stroke="#f2b134" stroke-width="1.2"/></g>
      ${word("#f7c948")}${gloss(id)}</svg>`;
}

// ---------- الطاولة: خشب + جوخ، وأشكال تنفتح بالمستوى ----------
export const TABLES = {
  felt: { name: "جوخ أخضر", lvl: 1, rim: ["#9a5f2e", "#6e3d1a", "#8a5226", "#4f2a10"], felt: ["#23735a", "#155240", "#0c3529"], line: "#f2c46b", mark: "rgba(255,240,200,.08)", noise: 1 },
  sadu: { name: "سدو", lvl: 5, rim: ["#7a4a24", "#4f2a10", "#6e3d1a", "#2e1708"], felt: ["#b23a3d", "#842530", "#4e1218"], line: "#f2b134", mark: "rgba(255,240,200,.1)", noise: 1, sadu: 1 },
  night: { name: "ليل", lvl: 10, rim: ["#4a3a7c", "#271d4a", "#3b2e66", "#140e2a"], felt: ["#3d2f7a", "#251c52", "#140f30"], line: "#c9b8ff", mark: "rgba(255,255,255,.07)", noise: 1, stars: 1 },
  marble: { name: "رخام", lvl: 15, rim: ["#f0dfa8", "#b89a4e", "#dcc581", "#8e7232"], felt: ["#f6f3ec", "#e2ddd2", "#c7c0b2"], line: "#b89a4e", mark: "rgba(80,60,20,.09)", veins: 1 },
  royal: { name: "الملكية", lvl: 9999, shop: "t_royal", rim: ["#fff1b8", "#c9952f", "#f2c14e", "#7a5512"], felt: ["#9e1838", "#6d0d24", "#3a0612"], line: "#f2c14e", mark: "rgba(255,225,150,.12)", noise: 1, shine: 1 },
  gold: { name: "ذهبي", lvl: 30, rim: ["#f7d77a", "#b8862b", "#e8c25a", "#7a5512"], felt: ["#2e2e33", "#18181b", "#060607"], line: "#e8c25a", mark: "rgba(232,194,90,.1)", noise: 1 }
};
export function tableSVG(key = "felt") {
  const t = TABLES[key] || TABLES.felt, k = "t" + key;
  const deco = [];
  if (t.sadu) deco.push(`<g opacity=".55">${[70, 318].map(y => `<path d="${Array.from({ length: 22 }, (_, i) => `M${70 + i * 12} ${y + 10} l6 -10 l6 10z`).join(" ")}" fill="#f2b134"/>`).join("")}</g>`);
  if (t.stars) deco.push([[90, 110], [300, 96], [120, 280], [290, 300], [200, 80], [76, 200], [326, 190], [240, 330], [160, 120], [260, 140]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i % 3 ? 1.4 : 2.4}" fill="#fff" opacity="${i % 2 ? .5 : .8}"/>`).join("") + `<path d="M318 112 a22 22 0 1 0 12 38 a18 18 0 1 1 -12 -38z" fill="#f7c948" opacity=".7"/>`);
  if (t.veins) deco.push(`<g fill="none" stroke="#9e9584" stroke-opacity=".35" stroke-width="1.4"><path d="M50 120 C120 140 140 90 210 120 S300 200 352 170"/><path d="M60 300 C130 260 170 330 240 280 S320 260 350 300"/><path d="M120 60 C140 140 100 200 150 260" stroke-width=".8"/><path d="M280 60 C260 130 310 170 280 240" stroke-width=".8"/></g>`);
  return `<svg viewBox="0 0 400 400" class="utable-svg" aria-hidden="true">
  <defs>
    <radialGradient id="${k}felt" cx="50%" cy="48%" r="62%"><stop offset="0" stop-color="${t.felt[0]}"/><stop offset=".7" stop-color="${t.felt[1]}"/><stop offset="1" stop-color="${t.felt[2]}"/></radialGradient>
    <linearGradient id="${k}wood" x1="0" y1="0" x2="1" y2="1">${t.rim.map((c, i) => `<stop offset="${[0, .35, .65, 1][i]}" stop-color="${c}"/>`).join("")}</linearGradient>
    <linearGradient id="${k}hi" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <filter id="${k}n" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="4"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .22 0"/><feComposite in2="SourceGraphic" operator="in"/></filter>
    <filter id="${k}g" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".012 .35" numOctaves="2" seed="9"/><feColorMatrix values="0 0 0 0 .1  0 0 0 0 .05  0 0 0 0 0  0 0 0 .3 0"/><feComposite in2="SourceGraphic" operator="in"/></filter>
  </defs>
  <rect x="14" y="22" width="372" height="372" rx="92" fill="rgba(0,0,0,.45)"/>
  <rect x="10" y="10" width="380" height="380" rx="92" fill="url(#${k}wood)"/>
  ${key === "felt" || key === "sadu" ? `<rect x="10" y="10" width="380" height="380" rx="92" fill="#000" filter="url(#${k}g)"/>` : ""}
  <rect x="10" y="10" width="380" height="380" rx="92" fill="url(#${k}hi)"/>
  <rect x="12" y="12" width="376" height="376" rx="90" fill="none" stroke="rgba(255,230,180,.25)" stroke-width="1.5"/>
  <rect x="38" y="38" width="324" height="324" rx="70" fill="rgba(0,0,0,.5)"/>
  <rect x="40" y="41" width="320" height="320" rx="68" fill="url(#${k}felt)"/>
  ${t.noise ? `<rect x="40" y="41" width="320" height="320" rx="68" fill="#000" filter="url(#${k}n)"/>` : ""}
  ${deco.join("")}
  ${t.shine ? `<defs><linearGradient id="${k}sh" x1="-160" y1="0" x2="0" y2="160" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".6"/><stop offset="1" stop-color="#fff" stop-opacity="0"/><animateTransform attributeName="gradientTransform" type="translate" values="-100 -100;560 560" dur="3.4s" repeatCount="indefinite"/></linearGradient></defs>
  <rect x="23" y="23" width="354" height="354" rx="80" fill="none" stroke="url(#${k}sh)" stroke-width="24"/>` : ""}
  <rect x="40" y="41" width="320" height="320" rx="68" fill="none" stroke="rgba(0,0,0,.45)" stroke-width="6"/>
  <rect x="56" y="57" width="288" height="288" rx="54" fill="none" stroke="${t.line}" stroke-opacity=".4" stroke-width="1.5" stroke-dasharray="5 5"/>
  <text x="200" y="312" text-anchor="middle" font-family="Lalezar,Tahoma,sans-serif" font-size="28" fill="${t.mark}">جلسة</text>
</svg>`;
}
export const TABLE_SVG = tableSVG("felt");

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
