// زينة البروفايل: رسومات مجموعات روق الفاخرة (ثيم + لوحة اسم)
let N = 0; // رقم فريد لكل رسمة عشان ما تتعارض المعرفات
const rnd = seed => { let a = seed; return () => (a = (a * 9301 + 49297) % 233280) / 233280; };
const stars = (n, w, h, seed = 1, max = .6) => { const r = rnd(seed); let out = "";
  for (let i = 0; i < n; i++) out += `<circle cx="${(r() * w).toFixed(1)}" cy="${(r() * h * max).toFixed(1)}" r="${(r() * 1.3 + .3).toFixed(2)}" fill="#fff" opacity="${(r() * .7 + .3).toFixed(2)}"/>`; return out; };
const palm = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})" fill="#05060f"><path d="M0 0 C2 -30 -2 -60 3 -90 L7 -90 C3 -60 7 -30 6 0Z"/>${[-60, -25, 10, 40, 75, 120, 160].map(a => { const c = Math.cos(a * Math.PI / 180), s2 = Math.sin(a * Math.PI / 180);
  return `<path d="M5 -90 q${(30 * c).toFixed(1)} ${(-20 + 25 * s2).toFixed(1)} ${(55 * c).toFixed(1)} ${(10 + 40 * s2).toFixed(1)} q${(-20 * c).toFixed(1)} -8 -${(45 * c).toFixed(1)} -${(10 + 35 * s2).toFixed(1)}Z"/>`; }).join("")}</g>`;
const najdi = (w, y) => { let p = `M0 ${y + 60} L0 ${y + 20}`, x = 0, i = 0; const B = [[60, 30], [40, 10], [70, 26], [50, 0], [80, 22], [60, 14], [70, 30]];
  while (x < w) { const [bw, by] = B[i++ % B.length], top = y + by; p += ` L${x} ${top}`; for (let k = 0; k < bw; k += 10) p += ` L${x + k} ${top} L${x + k + 5} ${top - 6} L${x + k + 10} ${top}`; x += bw; p += ` L${x} ${top}`; }
  return `<path d="${p} L${w} ${y + 60}Z" fill="#05060f"/>`; };
const svg = (w, h, body) => `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">${body}</svg>`;

const NAJD = (w, h) => { const u = "dn" + (++N); return svg(w, h, `<defs>
 <linearGradient id="${u}a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#070b26"/><stop offset=".6" stop-color="#1b2a6e"/><stop offset="1" stop-color="#3b3f8f"/></linearGradient>
 <radialGradient id="${u}b"><stop offset="0" stop-color="#ffe7a3" stop-opacity=".55"/><stop offset="1" stop-color="#ffe7a3" stop-opacity="0"/></radialGradient></defs>
 <rect width="${w}" height="${h}" fill="url(#${u}a)"/>${stars(70, w, h, 3)}
 <circle cx="${w * .78}" cy="${h * .22}" r="${h * .32}" fill="url(#${u}b)"/><circle cx="${w * .78}" cy="${h * .22}" r="${h * .1}" fill="#ffe7a3"/><circle cx="${w * .8 + h * .04}" cy="${h * .2}" r="${h * .09}" fill="#11195a"/>
 ${najdi(w, h * .72)}${palm(w * .12, h * .86, h / 260)}${palm(w * .9, h * .9, h / 300)}`); };

const NEON = (w, h) => { const u = "dg" + (++N), sky = [[0, .62], [30, .5], [55, .55], [70, .38], [95, .44], [120, .58], [150, .3], [168, .2], [186, .3], [210, .52], [240, .4], [260, .48], [300, .56], [330, .45], [360, .6], [400, .5]];
  let p = `M0 ${h}`; sky.forEach(([x, y], i) => { const X = x / 400 * w, Y = y * h, NX = (sky[i + 1]?.[0] ?? 420) / 400 * w; p += ` L${X} ${Y} L${NX} ${Y}`; }); p += ` L${w} ${h}Z`;
  const kx = w * .42, kt = h * .14, k = Math.max(.5, h / 300);
  return svg(w, h, `<defs>
 <linearGradient id="${u}a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d0221"/><stop offset=".7" stop-color="#3a0b5e"/><stop offset="1" stop-color="#ff2e88"/></linearGradient>
 <filter id="${u}g"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
 <rect width="${w}" height="${h}" fill="url(#${u}a)"/>${stars(40, w, h, 7, .5)}
 <circle cx="${w * .5}" cy="${h * .62}" r="${h * .3}" fill="#ff8a3d" opacity=".9"/>${[0, 1, 2, 3, 4].map(i => `<rect x="0" y="${h * (.55 + i * .045)}" width="${w}" height="${(h * .012 + i * k).toFixed(1)}" fill="#3a0b5e"/>`).join("")}
 <path d="${p}" fill="#0d0221" stroke="#22e6ff" stroke-width="1.6" filter="url(#${u}g)"/>
 <path d="M${kx - 18 * k} ${h} L${kx - 12 * k} ${kt} Q${kx} ${kt - 14 * k} ${kx + 12 * k} ${kt} L${kx + 18 * k} ${h}Z M${kx - 7 * k} ${kt + 6 * k} Q${kx} ${kt + 26 * k} ${kx + 7 * k} ${kt + 6 * k}Z" fill="#0d0221" stroke="#ff2e88" stroke-width="1.8" filter="url(#${u}g)" fill-rule="evenodd"/>
 ${Array.from({ length: 9 }, (_, i) => `<line x1="${w / 2}" y1="${h * .78}" x2="${(i - 4) * w * .35 + w / 2}" y2="${h}" stroke="#ff2e88" stroke-width=".8" opacity=".7"/>`).join("")}
 ${[0, 1, 2, 3].map(i => `<line x1="0" y1="${h * (.8 + i * i * .02)}" x2="${w}" y2="${h * (.8 + i * i * .02)}" stroke="#ff2e88" stroke-width=".8" opacity=".6"/>`).join("")}`); };

const GOLD = (w, h) => { const u = "dk" + (++N), r = Math.min(14, h / 4);
  return svg(w, h, `<defs>
 <linearGradient id="${u}f" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8a5a10"/><stop offset=".3" stop-color="#ffe08a"/><stop offset=".5" stop-color="#fff6cc"/><stop offset=".7" stop-color="#d9a832"/><stop offset="1" stop-color="#7a4a08"/></linearGradient>
 <radialGradient id="${u}b" cx=".3" cy=".2"><stop offset="0" stop-color="#2a2a2e"/><stop offset="1" stop-color="#050505"/></radialGradient>
 <pattern id="${u}p" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M20 0 L40 20 L20 40 L0 20Z M20 8 L32 20 L20 32 L8 20Z" fill="none" stroke="url(#${u}f)" stroke-width=".7" opacity=".35"/><circle cx="20" cy="20" r="2" fill="url(#${u}f)" opacity=".5"/></pattern></defs>
 <rect width="${w}" height="${h}" fill="url(#${u}b)"/><rect width="${w}" height="${h}" fill="url(#${u}p)"/>
 <path d="M0 ${h * .3} C${w * .3} ${h * .1} ${w * .5} ${h * .6} ${w} ${h * .35}" stroke="#fff" stroke-width=".6" opacity=".12" fill="none"/><path d="M0 ${h * .7} C${w * .4} ${h * .5} ${w * .6} ${h * .95} ${w} ${h * .6}" stroke="#fff" stroke-width=".8" opacity=".1" fill="none"/>
 <rect x="4" y="4" width="${w - 8}" height="${h - 8}" rx="${r}" fill="none" stroke="url(#${u}f)" stroke-width="2.5"/>
 <rect x="9" y="9" width="${w - 18}" height="${h - 18}" rx="${Math.max(2, r - 4)}" fill="none" stroke="url(#${u}f)" stroke-width=".8" opacity=".7"/>`); };

const FALCON = (w, h) => { const u = "df" + (++N), cx = w * .5, cy = h * .95, R = Math.max(h, w * .45);
  const fe = Array.from({ length: 11 }, (_, i) => { const a = -100 + i * 9, L = R * (0.9 - Math.abs(i - 5) * .03), x2 = cx + Math.cos(a * Math.PI / 180) * L * 1.4, y2 = cy + Math.sin(a * Math.PI / 180) * L;
    return `<path d="M${cx} ${cy} Q${(cx + x2) / 2 + 12} ${(cy + y2) / 2} ${x2} ${y2} Q${(cx + x2) / 2 - 12} ${(cy + y2) / 2 + 10} ${cx} ${cy}Z" fill="url(#${u}w)" opacity="${.35 + (i % 3) * .1}"/>`; }).join("");
  return svg(w, h, `<defs>
 <linearGradient id="${u}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b1407"/><stop offset=".6" stop-color="#7a3d12"/><stop offset="1" stop-color="#d98a3a"/></linearGradient>
 <linearGradient id="${u}w" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffe0a3"/><stop offset="1" stop-color="#c9822f"/></linearGradient></defs>
 <rect width="${w}" height="${h}" fill="url(#${u}s)"/><circle cx="${cx}" cy="${cy}" r="${h * .5}" fill="#ffd27a" opacity=".18"/>${fe}
 <path d="M0 ${h * .88} Q${w * .25} ${h * .78} ${w * .5} ${h * .86} T${w} ${h * .82} L${w} ${h} L0 ${h}Z" fill="#3a1a08" opacity=".8"/>`); };

// k = اسم المجموعة. acc = لون الإضاءة. fx = نوع التأثير المتحرك
export const DECO = {
  najd: { name: "ليالي نجد", tag: "هلال ونخيل وبيوت طين تحت النجوم", fxName: "شهب تعبر السماء", acc: "#ffe7a3", fx: "star", art: NAJD },
  neon: { name: "نيون الرياض", tag: "برج المملكة بنيون، ستايل جيل ٢٠٠٠", fxName: "نيون يلمع", acc: "#22e6ff", fx: "neon", art: NEON },
  gold: { name: "الذهب الأسود", tag: "رخام أسود ونقوش ذهبية", fxName: "غبار ذهب يتطاير", acc: "#ffe08a", fx: "dust", art: GOLD },
  falcon: { name: "الصقّار", tag: "ريش صقر ذهبي وغروب صحراء", fxName: "ريش يطيح بهدوء", acc: "#ffd27a", fx: "feather", art: FALCON }
};
// طبقة التأثير المتحرك (CSS فقط، خفيفة)
export function fxLayer(kind, n = 10) { const r = rnd(kind.length * 7 + n); let s = "";
  for (let i = 0; i < n; i++) s += `<i style="--x:${(r() * 100).toFixed(1)}%;--y:${(r() * 70).toFixed(1)}%;--d:${(r() * 6).toFixed(2)}s;--t:${(3 + r() * 4).toFixed(2)}s;--s:${(.6 + r() * .8).toFixed(2)}"></i>`;
  return `<span class="fx fx-${kind}" aria-hidden="true">${s}</span>`; }
