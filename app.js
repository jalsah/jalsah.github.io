import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult,
  onAuthStateChanged, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  sendPasswordResetEmail, signInAnonymously, deleteUser, reauthenticateWithPopup,
  reauthenticateWithCredential, EmailAuthProvider, updateCurrentUser
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, onSnapshot,
  collection, query, where, runTransaction, writeBatch, serverTimestamp, deleteField,
  getCountFromServer, Timestamp, orderBy, limit, addDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getMessaging, getToken, isSupported as pushSupported } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging.js";
import { firebaseConfig, authUrl } from "./firebase-config.js?v=27";
import { WORDS, MOST, FIVE, LETTERS, HCATS, WHO, DRAW } from "./content.js?v=27";
import { ICONS } from "./icons.js?v=27";
import { UCOLORS, buildDeck, canPlay, cardName, cardSVG, tableSVG, TABLES, BACKS, seatSpots, isWild, cColor, cVal } from "./uno.js?v=31";

/* ================= helpers ================= */
const ar = n => String(n).replace(/\d/g, d => "٠١٢٣٤٥٦٧٨٩"[d]);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = a => a[Math.floor(Math.random() * a.length)];
const store = {
  get(k, d) { try { const v = localStorage.getItem("jalsa:" + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem("jalsa:" + k, JSON.stringify(v)); } catch (e) {} }
};
function toast(msg) {
  const t = document.createElement("div");
  t.className = "toast"; t.setAttribute("role", "status"); t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), 2000);
}
async function copyText(text, okMsg) {
  try { await navigator.clipboard.writeText(text); toast(okMsg); }
  catch (e) { toast(text); }
}
// زر يحتاج ضغطتين للتأكيد
function confirmTap(btn, label) {
  if (btn.dataset.armed) return true;
  btn.dataset.armed = "1"; btn.dataset.orig = btn.textContent; btn.textContent = label || "متأكد؟ اضغط مرة ثانية";
  setTimeout(() => { if (btn.isConnected) { btn.dataset.armed = ""; btn.textContent = btn.dataset.orig; } }, 4000);
  return false;
}

const USER_RE = /^[A-Za-z0-9_-]{3,20}$/;
const HAS_UPPER = /[A-Z]/;
const PW_MIN = 8;
// صاحب اللعبة: يطلع جنب يوزره تاج
const OWNER = "b_1";
const RESERVED = new Set(["admin", "owner", "jalsah", "jalsa", "support", "official", "moderator", "mod", "staff", "team"]);
/* ================= المستويات والإنجازات ================= */
// المستوى L يحتاج 25×L×(L-1) نقطة خبرة: ٢=٥٠، ٣=١٥٠، ٥=٥٠٠، ١٠=٢٢٥٠
const lvlOf = xp => Math.max(1, Math.floor((1 + Math.sqrt(1 + (xp || 0) * 4 / 25)) / 2));
const lvlXp = L => 25 * L * (L - 1);
// المالك والحساب الرسمي: أعلى مستوى وكل شي مفتوح
const STAFF = n => [OWNER, OFFICIAL].includes(String(n || "").toLowerCase());
const MAXL = 99;
const lvlOfP = p => STAFF(p?.username) ? MAXL : lvlOf(p?.xp);
const myLvl = () => lvlOfP(me);
const lvlTag = p => `<span class="lvl ${STAFF(p?.username) ? "max" : ""}" title="المستوى">${STAFF(p?.username) ? "👑" : "⭐"} ${ar(lvlOfP(p))}</span>`;
const ACH = [
  { id: "first", tier: "b", svg: '<path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z"/>', t: "أول جلسة", d: "العب أول جولة", ok: s => (s.games || 0) >= 1 },
  { id: "g50", tier: "s", svg: '<path d="M12 3c1 4 5 5.5 5 10.5a5 5 0 0 1-10 0c0-3 2-4 2-6.5 1 1.2 2 2 3 2 0-2-1-4 0-6z"/>', t: "مدمن جلسات", d: "العب ٥٠ جولة", ok: s => (s.games || 0) >= 50 },
  { id: "g200", tier: "g", svg: '<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"/>', t: "أسطورة الجلسات", d: "العب ٣٠٠ جولة", ok: s => (s.games || 0) >= 300 },
  { id: "win1", tier: "b", svg: '<path d="M7 4h10v4a5 5 0 0 1-10 0z"/><path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8"/>', t: "أول فوز", d: "اكسب نقاط في جولة", ok: s => (s.wins || 0) >= 1 },
  { id: "win25", tier: "s", svg: '<path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>', t: "ما ينغلب", d: "افز في ٢٥ جولة", ok: s => (s.wins || 0) >= 25 },
  { id: "uno", tier: "s", svg: '<path d="M9 3h9a1 1 0 0 1 1 1v13"/><rect x="5" y="6" width="11" height="15" rx="1.5"/>', t: "ملك الأونو", d: "افز بالأونو ١٠ مرات", ok: s => (s.w_uno || 0) >= 10 },
  { id: "imp", tier: "s", svg: '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5.5 5.5"/>', t: "صياد الدخلاء", d: "افز في الدخيل ١٠ مرات", ok: s => (s.w_imp || 0) >= 10 },
  { id: "draw", tier: "s", svg: '<path d="M4 20l4-1L19 8a2.1 2.1 0 0 0-3-3L5 16z"/><path d="M14 7l3 3"/>', t: "فنان الجلسة", d: "افز في ارسم وخمّن ١٠ مرات", ok: s => (s.w_draw || 0) >= 10 },
  { id: "all", tier: "s", svg: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>', t: "جرّب كل شي", d: "العب ٥ ألعاب مختلفة", ok: s => ["uno", "imp", "most", "hhnj", "who", "tf", "draw"].filter(g => s["g_" + g]).length >= 5 },
  { id: "night", tier: "b", svg: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>', t: "سهران", d: "العب بين ٢ و٥ الفجر", ok: s => (s.night || 0) >= 1 },
  { id: "lvl10", tier: "s", svg: '<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3l-5.5 2.9 1-6.2L3 9.6l6.2-.9z"/>', t: "نجم صاعد", d: "وصّل المستوى ١٠", ok: (s, xp) => lvlOf(xp) >= 10 },
  { id: "lvl25", tier: "g", svg: '<circle cx="12" cy="12" r="9.5"/><path d="M12 6.5l1.7 3.5 3.8.5-2.8 2.7.7 3.8L12 15.2 8.6 17l.7-3.8-2.8-2.7 3.8-.5z"/>', t: "نجم جلسة", d: "وصّل المستوى ٢٥", ok: (s, xp) => lvlOf(xp) >= 25 },
  { id: "lvl50", tier: "g", svg: '<path d="M6.5 4h11l3.5 5-9 11L3 9z"/><path d="M3 9h18M9.5 4L12 20l2.5-16"/>', t: "خرافي", d: "وصّل المستوى ٥٠", ok: (s, xp) => lvlOf(xp) >= 50 },
  { id: "g1000", tier: "g", svg: '<path d="M3 11l9-7 9 7"/><path d="M5 9.5V20h14V9.5"/><path d="M10 20v-5h4v5"/>', t: "ساكن جلسة", d: "العب ١٠٠٠ جولة", ok: s => (s.games || 0) >= 1000 },
  { id: "win100", tier: "g", svg: '<circle cx="12" cy="9" r="6"/><path d="M8.5 14L7 21l5-2.5 5 2.5-1.5-7"/><path d="M12 6.5v5M10 8.5h4" />', t: "الملك", d: "افز في ١٠٠ جولة", ok: s => (s.wins || 0) >= 100 }
];
const TIER_RANK = { g: 3, s: 2, b: 1 };
const medal = (x, on = true) => `<span class="medal ${on ? "t-" + x.tier : "off"}" title="${esc(x.t)}"><svg viewBox="0 0 24 24" aria-hidden="true">${on ? x.svg : '<rect x="6" y="11" width="12" height="9" rx="2"/><path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3"/>'}</svg></span>`;
const achGot = (s, xp, name) => STAFF(name) ? ACH : ACH.filter(x => x.ok(s || {}, xp || 0));
/* ================= متجر جلسة ================= */
const SHOP = [
  { id: "king", name: "باقة الملك", desc: "كل الحصريات + VIP سنة كاملة", price: 399, grants: ["t_royal", "b_royal", "f_gold", "f_fire", "f_sadu"], days: 365, hot: 1 },
  { id: "vip365", name: "VIP سنة", desc: "شارة VIP وكل الحصريات لمدة سنة", price: 249, grants: [], days: 365 },
  { id: "vip30", name: "VIP شهر", desc: "شارة VIP وكل الحصريات لمدة شهر", price: 39, grants: [], days: 30 },
  { id: "t_royal", name: "الطاولة الملكية", desc: "مخمل أحمر وإطار ذهبي يلمع", price: 39, grants: ["t_royal"], days: 0 },
  { id: "f_gold", name: "إطار ذهبي", desc: "إطار يدور حول صورتك ويشوفه الكل", price: 25, grants: ["f_gold"], days: 0 },
  { id: "f_fire", name: "إطار ناري", desc: "إطار يدور حول صورتك ويشوفه الكل", price: 25, grants: ["f_fire"], days: 0 },
  { id: "f_sadu", name: "إطار سدو", desc: "إطار يدور حول صورتك ويشوفه الكل", price: 25, grants: ["f_sadu"], days: 0 },
  { id: "b_royal", name: "ظهر الورق الملكي", desc: "عنابي بتاج ذهبي", price: 19, grants: ["b_royal"], days: 0 }
];
const FRAMES = { f_gold: "ذهبي", f_fire: "ناري", f_sadu: "سدو" };
let shopCfg = null; // روابط المنتجات في متجر جلسة
const vipOn = p => (p?.vipUntil || 0) > Date.now();
const owns = (p, id) => STAFF(p?.username) || vipOn(p) || (p?.owned || []).includes(id);
const lookOpen = (t, p = me) => t.shop ? owns(p, t.shop) : lvlOfP(p) >= t.lvl;
const myLook = () => ({ t: TABLES[me?.look?.t] && lookOpen(TABLES[me.look.t]) ? me.look.t : "felt", b: BACKS[me?.look?.b] && lookOpen(BACKS[me.look.b]) ? me.look.b : "classic" });
const frameOf = p => p?.frame && FRAMES[p.frame] && owns(p, p.frame) ? p.frame : "";
// الصورة مع الإطار (لو عنده)
const avF = (p, size) => { const f = frameOf(p), av = avatar(p?.username, p?.photo, size); return f ? `<span class="fr ${f}" style="--fs:${Math.max(3, Math.round(size / 18))}px">${av}</span>` : av; };
const vipTag = p => vipOn(p) && !STAFF(p?.username) ? `<span class="vip">VIP</span>` : "";

const OFFICIAL = "jalsah"; // حساب جلسة الرسمي (@Jalsah)، تحت تصرف المالك
const isOwner = () => [OWNER, OFFICIAL].includes(String(me?.username || "").toLowerCase());
const at = name => { const k = String(name).toLowerCase();
  return `@${esc(name)}${k === OWNER ? ' <span class="crown" title="صاحب اللعبة" aria-label="صاحب اللعبة">👑</span>' : k === OFFICIAL ? ' <span class="verified" title="الحساب الرسمي" aria-label="الحساب الرسمي">✓</span>' : ""}`; };
// صورة البروفايل: صورة اللاعب، أو أول حرف من يوزره بلون ثابت
const AV_COLORS = ["#ef6f6c", "#f2b134", "#74d6b8", "#8f7bea", "#5fb0f0", "#f08a24", "#e66aa8", "#4fc48a"];
const avColor = name => { let h = 0; for (const c of String(name || "")) h = (h * 31 + c.charCodeAt(0)) >>> 0; return AV_COLORS[h % AV_COLORS.length]; };
const safePhoto = p => typeof p === "string" && p.startsWith("data:image/jpeg;base64,") ? p : "";
function avatar(name, photo, size = 40, label) {
  const p = safePhoto(photo);
  const st = `width:${size}px;height:${size}px;font-size:${Math.round(size * .44)}px`;
  if (p) return `<span class="av" style="${st}"><img src="${esc(p)}" alt=""></span>`;
  const ch = label || String(name || "?").replace(/^@/, "").charAt(0).toUpperCase() || "?";
  return `<span class="av" style="${st};background:${avColor(name)}" aria-hidden="true">${esc(ch)}</span>`;
}
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const ONLINE_MS = 150000;
const INVITE_MS = 15 * 60 * 1000;
const GAMES = { draw: "ارسم وخمّن", who: "مين قالها؟", tf: "صح ولا خطأ", uno: "أونو", imp: "الدخيل", most: "مين أكثر واحد", hhnj: "إنسان حيوان نبات جماد" };
// كل ألعاب جلسة: وين تنلعب (أونلاين، بجوال واحد)
const CATALOG = [
  { id: "draw", icon: "draw", title: "ارسم وخمّن", desc: "واحد يرسم كلمة سرية، والباقين يخمّنونها بأسرع وقت. كل جولة يرسم واحد.", online: true, local: null, min: 2, hot: true },
  { id: "who", icon: "who", title: "مين قالها؟", desc: "سؤال، وكل واحد يكتب جوابه بالسر. بعدها تطلع الأجوبة وتخمّنون مين كاتب كل جواب.", online: true, local: null, min: 3, hot: true },
  { id: "tf", icon: "tf", title: "صح ولا خطأ", desc: "كل جولة واحد يكتب شي عن نفسه، والباقين يخمّنون: صح ولا كذب؟ تنفع حتى لو أنتم اثنين.", online: true, local: null, min: 2, hot: true },
  { id: "uno", icon: "uno", title: "أونو جلسة", desc: "الأونو اللي تعرفه، بأوراق وطاولة جلسة. من ٢ إلى ٨ لاعبين، كل واحد من جواله.", online: true, local: null, min: 2 },
  { id: "imp", icon: "imp", title: "الدخيل", desc: "الكل يعرف الكلمة إلا واحد. اكشفوه قبل ما يكشف الكلمة.", online: true, local: "l-imp", min: 3 },
  { id: "most", icon: "most", title: "مين أكثر واحد؟", desc: "سؤال، وكل واحد يصوّت على واحد من الشلة.", online: true, local: "l-most", min: 2 },
  { id: "hhnj", icon: "hhnj", title: "إنسان حيوان نبات جماد", desc: "حرف عشوائي، واكتب أربع كلمات تبدأ فيه قبل يخلص الوقت.", online: true, local: "l-hhnj", min: 2 },
  { id: "five", icon: "five", title: "خمسة بعشر", desc: "اذكر خمسة أشياء من الفئة خلال عشر ثواني.", online: false, local: "l-five", min: 2 }
];
const minPlayers = g => CATALOG.find(c => c.id === g)?.min || 3;

const V = document.getElementById("view");
const HDR = document.getElementById("hdr");
const BANNER = document.getElementById("banner");

/* ================= firebase ================= */
const configured = !String(firebaseConfig.apiKey || "").startsWith("PASTE");
let auth = null, db = null;
if (configured) {
  const fb = initializeApp(firebaseConfig);
  auth = getAuth(fb);
  auth.languageCode = "ar"; // إيميلات فايربيس (نسيت كلمة السر) تجي بالعربي
  db = getFirestore(fb);
}

/* ================= state ================= */
let me = null;               // { uid, username }
let screen = "loading";
const friends = new Map();   // uid -> { username, lastSeen }
let reqIn = [], reqOut = [], invites = [];
let room = null, roomCode = null, votes = {}, secret = null;
const ui = { shownRound: 0 };
let mostDeck = [];
let presenceTimer = null;
const subs = new Map();
function sub(k, unsub) { off(k); subs.set(k, unsub); }
function off(k) { const u = subs.get(k); if (u) { u(); subs.delete(k); } }
function offAll() { [...subs.keys()].forEach(off); }

let announce = null, banned = false, promo = null, guestUid = null, guestTimer = null;
let pubRooms = null;          // الغرف العامة
let inbox = [];               // محادثات الخاص
let roomChat = [];            // شات الغرفة
const profiles = new Map();   // uid -> { username, photo, bio }
const profWant = new Set();
function prof(uid) {
  if (uid === me?.uid) return { username: me.username, photo: me.photo, bio: me.bio, xp: me.xp, stats: me.stats, owned: me.owned, vipUntil: me.vipUntil, frame: me.frame };
  const f = friends.get(uid); if (f && f.username !== "…") return f;
  if (profiles.has(uid)) return profiles.get(uid);
  if (db && me && !profWant.has(uid)) {
    profWant.add(uid);
    getDoc(doc(db, "users", uid)).then(s => { if (s.exists()) { profiles.set(uid, s.data()); refresh(); } }).catch(() => {});
  }
  return null;
}
let pendingJoin = (new URLSearchParams(location.search).get("r") || "").toUpperCase() || null;

const isOnline = f => { const t = f?.lastSeen?.toMillis?.(); return !!t && Date.now() - t < ONLINE_MS; };
const pairId = (a, b) => [a, b].sort().join("_");

/* ================= navigation & rendering ================= */
const REFRESH = new Set(["home", "friends", "room", "profile", "admin", "inbox", "shop"]);
function go(name) {
  stopLocalTimers();
  if (screen === "dm" && name !== "dm") { off("dm"); ui.dmWith = null; }
  if (name !== "pub") { off("pub"); pubRooms = null; }
  if (name !== "room") { document.getElementById("chatPanel")?.remove(); document.getElementById("chatFab")?.remove(); }
  screen = name;
  render(true);
  window.scrollTo(0, 0);
}
function refresh() {
  if (REFRESH.has(screen)) render(false); else { renderHeader(); renderBanner(); }
}
function render(fresh) {
  // نحافظ على اللي مكتوب في الحقول لو انعاد الرسم
  const saved = {}; let focusId = null;
  if (!fresh) {
    V.querySelectorAll("input[id]:not([type=file]), textarea[id]").forEach(i => saved[i.id] = i.value);
    focusId = document.activeElement?.id || null;
  }
  renderHeader(); renderBanner();
  (VIEWS[screen] || VIEWS.loading)();
  if (!fresh) {
    for (const id in saved) { const el = document.getElementById(id); if (el) el.value = saved[id]; }
    if (focusId) { const el = document.getElementById(focusId); if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) el.focus(); }
  }
}
function on(id, ev, fn) { const el = document.getElementById(id); if (el) el.addEventListener(ev, fn); return el; }
function onAll(sel, fn) { V.querySelectorAll(sel).forEach(el => el.addEventListener("click", e => fn(e.currentTarget, e))); }

const BACK = {
  pub: "home", shop: "home", friends: "home", profile: "home", admin: "home", rename: "profile", inbox: "home", dm: "inbox",
  "l-hhnj": "local",
  email: "auth", forgot: () => (ui.emailMode = "login", "email"),
  local: () => me?.username ? "home" : (configured ? "auth" : "setup"),
  "l-players": "local", "l-imp": "local", "l-pass": "local", "l-play": "local",
  "l-most": "local", "l-five": "local", "l-scores": "local"
};
function renderHeader() {
  let h = "";
  if (roomCode && screen !== "room") h += `<button class="pill hot" id="hRoom">الغرفة ${esc(roomCode)}</button>`;
  const back = BACK[screen];
  if (back) h += `<button class="pill" id="hBack">رجوع</button>`;
  if (me?.username && !back && screen !== "room" && screen !== "welcome") {
    if (isOwner()) h += `<button class="pill hot" id="hAdmin" aria-label="لوحة المالك">👑</button>`;
    h += `<button class="pill add" id="hFriends"><span aria-hidden="true">+</span> أضف صديق${reqIn.length ? `<span class="badge">${ar(reqIn.length)}</span>` : ""}</button>`;
    const un = unreadCount();
    h += `<button class="pill icon" id="hChat" aria-label="الرسائل">💬${un ? `<span class="badge">${ar(un)}</span>` : ""}</button>`;
    h += `<button class="me-btn" id="hMe" aria-label="بروفايلي">${avatar(me.username, me.photo, 38)}</button>`;
  }
  HDR.innerHTML = h;
  HDR.querySelector("#hRoom")?.addEventListener("click", () => go("room"));
  HDR.querySelector("#hBack")?.addEventListener("click", () => go(typeof back === "function" ? back() : back));
  HDR.querySelector("#hFriends")?.addEventListener("click", () => go("friends"));
  HDR.querySelector("#hMe")?.addEventListener("click", () => go("profile"));
  HDR.querySelector("#hAdmin")?.addEventListener("click", () => go("admin"));
  HDR.querySelector("#hChat")?.addEventListener("click", () => go("inbox"));
}
function renderBanner() {
  const now = Date.now();
  const list = invites.filter(i => {
    const t = i.at?.toMillis?.() ?? now;
    return now - t < INVITE_MS && i.code !== roomCode;
  });
  renderAnnounce();
  const pimg = promo && typeof promo.img === "string" && promo.img.startsWith("data:image/jpeg;base64,") ? promo.img : "";
  const plink = promo && /^https:\/\//.test(promo.link || "") ? promo.link : "";
  const promoHtml = pimg && screen === "home"
    ? (plink ? `<a class="promo" href="${esc(plink)}" target="_blank" rel="noopener"><img src="${esc(pimg)}" alt="${esc(promo.alt || "إعلان جلسة")}"></a>`
             : `<div class="promo"><img src="${esc(pimg)}" alt="${esc(promo.alt || "إعلان جلسة")}"></div>`) : "";
  BANNER.innerHTML = promoHtml + list.map(i => `
    <div class="inv"><span class="txt"><span dir="ltr">${at(i.fromName)}</span> عزمك على غرفة</span>
    <button class="btn small" data-ij="${esc(i.id)}">ادخل</button>
    <button class="btn small ghost" data-ix="${esc(i.id)}">تجاهل</button></div>`).join("");
  BANNER.querySelectorAll("[data-ij]").forEach(b => b.addEventListener("click", async () => {
    const inv = invites.find(i => i.id === b.dataset.ij); if (!inv) return;
    deleteDoc(doc(db, "invites", inv.id)).catch(() => {});
    await joinRoom(inv.code);
  }));
  BANNER.querySelectorAll("[data-ix]").forEach(b => b.addEventListener("click", () => {
    deleteDoc(doc(db, "invites", b.dataset.ix)).catch(() => {});
  }));
}
// الإعلان: بطاقة تطلع فوق كل شي، مرة وحدة لكل إعلان
function renderAnnounce() {
  const show = announce?.text && store.get("annSeen", "") !== annKey(announce) && screen !== "admin";
  let el = document.getElementById("annModal");
  if (!show) { el?.remove(); return; }
  const key = annKey(announce);
  if (el && el.dataset.key === key) return;
  el?.remove();
  el = document.createElement("div");
  el.id = "annModal"; el.dataset.key = key;
  el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-labelledby", "annTitle");
  el.innerHTML = `<div class="ann-card">
      <div class="ann-top" aria-hidden="true">
        <span class="ann-spark s1">✦</span><span class="ann-spark s2">✦</span><span class="ann-spark s3">✦</span>
        <span class="ann-art">${MEGAPHONE}</span>
      </div>
      <div class="ann-body">
        <span class="ann-eyebrow" id="annTitle">جديد في جلسة</span>
        <p class="ann-text">${esc(announce.text)}</p>
        <button class="btn" id="annOk">تمام 👍</button>
      </div>
    </div>`;
  document.body.appendChild(el);
  const close = () => { store.set("annSeen", key); el.classList.add("out"); setTimeout(() => el.remove(), 220); };
  el.querySelector("#annOk").addEventListener("click", close);
  el.addEventListener("click", e => { if (e.target === el) close(); });
  el.querySelector("#annOk").focus({ preventScroll: true });
}
const MEGAPHONE = `<svg viewBox="0 0 120 100"><g transform="rotate(-14 60 50)">
  <rect x="14" y="40" width="20" height="24" rx="6" fill="#1c1530"/>
  <path d="M30 40 L82 18 Q90 15 90 24 V80 Q90 89 82 86 L30 64Z" fill="#fff8ec"/>
  <path d="M30 40 L82 18 Q90 15 90 24 V34 L30 52Z" fill="#ffd36b"/>
  <rect x="86" y="20" width="10" height="64" rx="5" fill="#ef6f6c"/>
  <path d="M22 64 l6 22 h10 l-4 -22z" fill="#1c1530"/>
  <path d="M104 36 q8 16 0 32" stroke="#1c1530" stroke-width="5" fill="none" stroke-linecap="round"/>
  <path d="M112 28 q14 24 0 48" stroke="#1c1530" stroke-width="5" fill="none" stroke-linecap="round" opacity=".5"/>
</g></svg>`;
const annKey = a => (a?.at?.toMillis?.() || 0) + ":" + (a?.text || "");

/* ================= auth ================= */
async function login() {
  const provider = new GoogleAuthProvider();
  try { await signInWithPopup(auth, provider); }
  catch (e) {
    if (["auth/popup-blocked", "auth/operation-not-supported-in-this-environment", "auth/web-storage-unsupported"].includes(e.code)) {
      await signInWithRedirect(auth, provider);
    } else if (!["auth/popup-closed-by-user", "auth/cancelled-popup-request"].includes(e.code)) {
      toast("ما زبط تسجيل الدخول، جرّب مرة ثانية");
    }
  }
}

/* ================= تبديل الحسابات ================= */
const accounts = () => { const a = store.get("accounts", []); return Array.isArray(a) ? a : []; };
// كل حساب له جلسة محفوظة لحاله، عشان التبديل يصير بدون كلمة سر
const accAuths = new Map();
function accAuth(uid) {
  if (!accAuths.has(uid)) accAuths.set(uid, getAuth(initializeApp(firebaseConfig, "acc_" + uid)));
  return accAuths.get(uid);
}
function rememberAccount() {
  const u = auth.currentUser; if (!u || !me?.username) return;
  updateCurrentUser(accAuth(u.uid), u).catch(e => console.error(e));
  const google = u.providerData.some(p => p.providerId === "google.com");
  const list = accounts().filter(a => a.uid !== u.uid);
  list.unshift({ uid: u.uid, username: me.username, email: u.email || "", google, photo: me.photo || "" });
  store.set("accounts", list.slice(0, 6));
}
function openSwitcher() {
  document.getElementById("swSheet")?.remove();
  const list = accounts(), cur = me?.uid;
  const el = document.createElement("div");
  el.id = "swSheet"; el.className = "sheet-bg"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "بدّل الحساب");
  el.innerHTML = `<div class="sheet"><b class="pf-name">🔄 بدّل الحساب</b>
    <div class="list sw-list">${list.map(a => `<div class="sw-acc ${a.uid === cur ? "cur" : ""}">
      <button class="sw-main" data-sw="${esc(a.uid)}" ${a.uid === cur ? "disabled" : ""}>${avatar(a.username, a.photo, 42)}
        <span class="sw-t"><span class="nm" dir="ltr">${at(a.username)}</span><span class="hint" dir="ltr">${esc(a.email || "")}</span></span>
        ${a.uid === cur ? `<span class="tag">الحالي</span>` : ""}</button>
      ${a.uid === cur ? "" : `<button class="inst-x" data-swrm="${esc(a.uid)}" aria-label="شيله من القائمة">×</button>`}
      ${a.google ? "" : `<form class="sw-pw" data-swf="${esc(a.uid)}" hidden><input class="txt" type="password" dir="ltr" autocomplete="current-password" placeholder="كلمة السر" aria-label="كلمة السر"><button class="btn small">ادخل</button></form>`}
    </div>`).join("")}</div>
    <p class="hint" id="swMsg" role="status"></p>
    <button class="btn ghost" id="swAdd">➕ أضف حساب</button>
    <button class="btn ghost" id="swX">إغلاق</button></div>`;
  document.body.appendChild(el);
  const close = () => el.remove(), msg = el.querySelector("#swMsg");
  el.addEventListener("click", e => { if (e.target === el) close(); });
  el.querySelector("#swX").addEventListener("click", close);
  el.querySelector("#swAdd").addEventListener("click", async () => {
    close(); if (roomCode) await leaveRoom(true).catch(() => {});
    ui.emailMode = "login"; await signOut(auth); go("auth");
  });
  el.querySelectorAll("[data-swrm]").forEach(b => b.addEventListener("click", () => {
    signOut(accAuth(b.dataset.swrm)).catch(() => {});
    store.set("accounts", accounts().filter(a => a.uid !== b.dataset.swrm)); close(); openSwitcher();
  }));
  const doSwitch = async (fn) => {
    try { if (roomCode) await leaveRoom(true).catch(() => {}); await fn(); close(); toast("بدّلت الحساب 👌"); }
    catch (e) {
      console.error(e); msg.className = "hint msg-bad";
      msg.textContent = ["auth/wrong-password", "auth/invalid-credential"].includes(e.code) ? "كلمة السر غلط."
        : ["auth/popup-closed-by-user", "auth/cancelled-popup-request"].includes(e.code) ? "" : "ما زبط التبديل، جرّب مرة ثانية.";
    }
  };
  el.querySelectorAll("[data-sw]").forEach(b => b.addEventListener("click", async () => {
    const a = accounts().find(x => x.uid === b.dataset.sw); if (!a) return;
    // أول شي: الجلسة المحفوظة (بدون كلمة سر)
    try {
      const saved = accAuth(a.uid); await saved.authStateReady();
      if (saved.currentUser) return doSwitch(() => updateCurrentUser(auth, saved.currentUser));
    } catch (e) { console.error(e); }
    if (a.google) {
      const p = new GoogleAuthProvider(); p.setCustomParameters({ prompt: "select_account", ...(a.email ? { login_hint: a.email } : {}) });
      doSwitch(() => signInWithPopup(auth, p));
    } else {
      const f = el.querySelector(`[data-swf="${CSS.escape(a.uid)}"]`);
      el.querySelectorAll("[data-swf]").forEach(x => x.hidden = x !== f);
      f.hidden = false; f.querySelector("input").focus();
    }
  }));
  el.querySelectorAll("[data-swf]").forEach(f => f.addEventListener("submit", e => {
    e.preventDefault();
    const a = accounts().find(x => x.uid === f.dataset.swf), pw = f.querySelector("input").value;
    if (!a || !pw) return;
    doSwitch(() => signInWithEmailAndPassword(auth, a.email, pw));
  }));
}

function afterLogin() {
  rememberAccount();
  if (pendingJoin) {
    const c = pendingJoin; pendingJoin = null;
    history.replaceState(null, "", location.pathname);
    joinRoom(c);
  } else go("home");
}

async function claimUsername(name) {
  await runTransaction(db, async tx => {
    const ref = doc(db, "usernames", name.toLowerCase());
    const s = await tx.get(ref);
    if (s.exists()) {
      // الحساب الرسمي: إيميله الرسمي يقدر يسترجع اليوزر من الحساب القديم
      if (name.toLowerCase() !== OFFICIAL || s.data().uid === me.uid) throw { code: "taken" };
      tx.delete(doc(db, "users", s.data().uid));
    }
    tx.set(ref, { uid: me.uid });
    tx.set(doc(db, "users", me.uid), { username: name, createdAt: serverTimestamp(), lastSeen: serverTimestamp() });
  });
}

/* ================= live data ================= */
function startGlobal() {
  if (pushState() === "granted") setTimeout(() => pushSaveToken(true), 3000);
  const ping = () => updateDoc(doc(db, "users", me.uid), { lastSeen: serverTimestamp() }).catch(() => {});
  ping();
  presenceTimer = setInterval(ping, 60000);
  document.addEventListener("visibilitychange", onVisible);

  sub("friendships", onSnapshot(query(collection(db, "friendships"), where("members", "array-contains", me.uid)), snap => {
    const ids = new Set();
    snap.forEach(d => { const m = d.data().members; ids.add(m[0] === me.uid ? m[1] : m[0]); });
    for (const uid of [...friends.keys()]) if (!ids.has(uid)) { friends.delete(uid); off("f:" + uid); }
    for (const uid of ids) if (!subs.has("f:" + uid)) {
      friends.set(uid, { username: "…", lastSeen: null });
      sub("f:" + uid, onSnapshot(doc(db, "users", uid), s => {
        if (s.exists()) { const d = s.data(); friends.set(uid, { username: d.username, lastSeen: d.lastSeen, photo: d.photo || "", bio: d.bio || "" }); }
        refresh();
      }));
    }
    refresh();
  }, err));
  sub("reqIn", onSnapshot(query(collection(db, "friendRequests"), where("to", "==", me.uid)), snap => {
    reqIn = snap.docs.map(d => d.data()); refresh();
  }, err));
  sub("reqOut", onSnapshot(query(collection(db, "friendRequests"), where("from", "==", me.uid)), snap => {
    reqOut = snap.docs.map(d => d.data()); refresh();
  }, err));
  sub("ban", onSnapshot(doc(db, "bans", me.uid), s => {
    const was = banned; banned = s.exists();
    if (banned && !was) { if (roomCode) leaveRoom(true); go("banned"); }
    else if (!banned && was && screen === "banned") go("home");
  }, err));
  sub("inbox", onSnapshot(query(collection(db, "chats"), where("members", "array-contains", me.uid)), snap => {
    inbox = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.lastAt?.toMillis?.() || 0) - (a.lastAt?.toMillis?.() || 0));
    if (screen === "inbox") render(false); else renderHeader();
  }, err));
  sub("invites", onSnapshot(query(collection(db, "invites"), where("to", "==", me.uid)), snap => {
    invites = snap.docs.map(d => ({ id: d.id, ...d.data() })); renderBanner();
  }, err));
}
function onVisible() {
  if (document.visibilityState === "visible" && me?.username) updateDoc(doc(db, "users", me.uid), { lastSeen: serverTimestamp() }).catch(() => {});
}
function stopGlobal() {
  offAll(); clearInterval(presenceTimer); presenceTimer = null;
  document.removeEventListener("visibilitychange", onVisible);
  friends.clear(); reqIn = []; reqOut = []; invites = []; banned = false; inbox = [];
  room = null; roomCode = null; votes = {}; secret = null;
}
function err(e) { console.error(e); }

/* ================= friends ================= */
async function sendRequest(raw) {
  const typed = raw.trim().replace(/^@/, "");
  const key = typed.toLowerCase();
  if (!USER_RE.test(typed)) return toast("اكتب يوزر صحيح");
  if (key === me.username.toLowerCase()) return toast("هذا يوزرك أنت 😄");
  try {
    const s = await getDoc(doc(db, "usernames", key));
    if (!s.exists()) return toast("ما لقينا هذا اليوزر");
    const to = s.data().uid;
    const u = await getDoc(doc(db, "users", to));
    if (!u.exists()) return toast("ما لقينا هذا اليوزر");
    const name = u.data().username;
    if (friends.has(to)) return toast("هو صديقك من قبل");
    const back = await getDoc(doc(db, "friendRequests", to + "_" + me.uid));
    if (back.exists()) { await acceptRequest(to); return; }
    await setDoc(doc(db, "friendRequests", me.uid + "_" + to), { from: me.uid, to, fromName: me.username, toName: name, at: serverTimestamp() });
    toast("انرسل الطلب إلى @" + name); pushNotify(to, "friend");
    const inp = document.getElementById("addName"); if (inp) inp.value = "";
  } catch (e) { console.error(e); toast("ما قدرنا نرسل الطلب"); }
}
async function acceptRequest(from) {
  const members = [from, me.uid].sort();
  const b = writeBatch(db);
  b.set(doc(db, "friendships", members.join("_")), { members, at: serverTimestamp() });
  b.delete(doc(db, "friendRequests", from + "_" + me.uid));
  try { await b.commit(); toast("صرتوا أصدقاء"); } catch (e) { console.error(e); toast("ما زبط القبول"); }
}
async function sendInvite(uid) {
  if (!roomCode) return;
  try {
    await setDoc(doc(db, "invites", me.uid + "_" + uid), { from: me.uid, fromName: me.username, to: uid, code: roomCode, at: serverTimestamp() });
    toast("انرسلت الدعوة"); pushNotify(uid, "invite");
  } catch (e) { console.error(e); toast("ما قدرنا نرسل الدعوة"); }
}

/* ================= rooms ================= */
const roomRef = () => doc(db, "rooms", roomCode);
const isHost = () => room?.host === me?.uid;
const order = () => Object.entries(room?.players || {}).sort((a, b) => a[1].at - b[1].at).map(([u]) => u);
const pname = u => room?.players?.[u]?.name || room?.names?.[u] || "—";
const atL = u => `<span dir="ltr">${at(pname(u))}</span>`;
const roundPlayers = () => (room?.roundPlayers || order()).filter(u => room.players[u]);

async function createRoom(game = "imp") {
  try {
    let code;
    for (let i = 0; i < 6; i++) {
      code = Array.from({ length: 5 }, () => pick(CODE_CHARS)).join("");
      if (!(await getDoc(doc(db, "rooms", code))).exists()) break;
    }
    await setDoc(doc(db, "rooms", code), {
      host: me.uid, createdAt: serverTimestamp(), phase: "lobby", game: GAMES[game] ? game : "imp", cat: "عشوائي", imps: 1,
      round: 0, players: { [me.uid]: { name: me.username, at: Date.now() } }, scores: {},
      public: !!ui.makePublic, listed: !!ui.makePublic, ping: Date.now(), hostName: me.username
    });
    ui.makePublic = false;
    enterRoom(code);
  } catch (e) { console.error(e); toast("ما قدرنا نسوي الغرفة"); }
}
async function joinRoom(raw) {
  const code = String(raw || "").trim().toUpperCase();
  if (!/^[A-Z0-9]{5}$/.test(code)) return toast("الكود ٥ خانات");
  if (code === roomCode) return go("room");
  try {
    const s = await getDoc(doc(db, "rooms", code));
    if (!s.exists()) return toast("ما لقينا غرفة بهذا الكود");
    const r = s.data();
    if (roomCode) await leaveRoom(true);
    if (!r.players[me.uid]) {
      if (r.kicked?.[me.uid]) return toast("المضيف طردك من هالغرفة 🚫");
      if (r.phase !== "lobby") return toast("اللعبة بدأت، انتظروا الجولة الجاية");
      if (Object.keys(r.players).length >= 12) return toast("الغرفة مليانة");
      await updateDoc(doc(db, "rooms", code), { [`players.${me.uid}`]: { name: me.username, at: Date.now() } });
    }
    enterRoom(code);
  } catch (e) { console.error(e); toast("ما قدرنا ندخل الغرفة"); }
}
function enterRoom(code) {
  roomCode = code; room = null; votes = {}; secret = null; ui.shownRound = 0;
  sub("room", onSnapshot(doc(db, "rooms", code), s => {
    if (!s.exists()) { exitRoomLocal("انتهت الغرفة"); return; }
    room = s.data();
    if (!room.players?.[me.uid]) { exitRoomLocal(room.kicked?.[me.uid] ? "المضيف طردك من الغرفة 🚫" : "طلعت من الغرفة"); return; }
    if (!subs.has("secret")) sub("secret", onSnapshot(doc(db, "rooms", code, "secrets", me.uid), d => { secret = d.exists() ? d.data() : null; if (screen === "room") render(false); }, err));
    if (!subs.has("votes")) sub("votes", onSnapshot(collection(db, "rooms", code, "votes"), q => {
      votes = {}; q.forEach(d => votes[d.id] = d.data()); if (screen === "room") render(false);
    }, err));
    if (!subs.has("rchat")) sub("rchat", onSnapshot(query(collection(db, "rooms", code, "chat"), orderBy("at", "desc"), limit(60)), q => {
      roomChat = q.docs.map(d => ({ id: d.id, ...d.data() })).reverse();
      updateRoomChat();
    }, err));
    if (room.phase === "hq" && !subs.has("hdone")) watchHhnjDone();
    if (screen === "room") render(false); else renderHeader();
  }, e => { console.error(e); exitRoomLocal("انقطع الاتصال بالغرفة"); }));
  clearInterval(ui.pingTimer);
  ui.pingTimer = setInterval(() => { if (roomCode && isHost() && room?.listed) updateDoc(roomRef(), { ping: Date.now() }).catch(() => {}); }, 45000);
  go("room");
}
function exitRoomLocal(msg) {
  clearInterval(ui.pingTimer); ui.pingTimer = null;
  off("room"); off("secret"); off("votes"); off("rchat"); off("hdone"); off("umoves"); off("priv"); off("dguess"); off("dcanvas"); DRAWS.strokes = []; DRAWS.sRound = 0; UNO.st = null; UNO.processed = {}; clearInterval(ui.hTimer); ui.hTimer = null;
  roomChat = []; closeChatPanel(); ui.chatSeen = 0;
  room = null; roomCode = null; votes = {}; secret = null;
  if (msg) toast(msg);
  if (screen === "room") go("home"); else renderHeader();
}
async function leaveRoom(silent) {
  if (!roomCode) return;
  const code = roomCode, host = isHost();
  exitRoomLocal(silent ? null : "طلعت من الغرفة");
  try {
    if (host) await deleteDoc(doc(db, "rooms", code));
    else await updateDoc(doc(db, "rooms", code), { [`players.${me.uid}`]: deleteField() });
  } catch (e) { console.error(e); }
}
const setRoom = data => updateDoc(roomRef(), data).catch(e => { console.error(e); toast("ما زبط، جرّب مرة ثانية"); });

// ---- الدخيل أونلاين (المضيف) ----
async function startImp() {
  const ps = order();
  if (ps.length < 3) return toast("تحتاجون ٣ لاعبين على الأقل");
  const cat = room.cat === "عشوائي" || !WORDS[room.cat] ? pick(Object.keys(WORDS)) : room.cat;
  const word = pick(WORDS[cat]);
  const n = ps.length >= 7 && room.imps === 2 ? 2 : 1;
  const imps = shuffle(ps).slice(0, n);
  const round = (room.round || 0) + 1;
  const names = {}; ps.forEach(u => names[u] = pname(u));
  const b = writeBatch(db);
  ps.forEach(u => b.set(doc(db, "rooms", roomCode, "secrets", u),
    imps.includes(u) ? { round, role: "imp", cat } : { round, role: "word", cat, word }));
  b.set(doc(db, "rooms", roomCode, "hidden", "answer"), { round, imps, word, cat });
  b.update(roomRef(), { game: "imp", phase: "reveal", round, starter: pick(ps), roundPlayers: ps, names, result: null });
  try { await b.commit(); } catch (e) { console.error(e); toast("ما قدرنا نبدأ الجولة"); }
}
async function revealImp() {
  try {
    const ans = (await getDoc(doc(db, "rooms", roomCode, "hidden", "answer"))).data();
    const tally = {};
    const ps = roundPlayers();
    Object.entries(votes).forEach(([voter, v]) => {
      if (v.round === room.round && ps.includes(voter) && ps.includes(v.target)) tally[v.target] = (tally[v.target] || 0) + 1;
    });
    const max = Math.max(0, ...Object.values(tally));
    const tops = Object.keys(tally).filter(u => tally[u] === max);
    const caught = max > 0 && tops.length === 1 && ans.imps.includes(tops[0]);
    const scores = { ...(room.scores || {}) };
    if (caught) ps.filter(u => !ans.imps.includes(u)).forEach(u => scores[u] = (scores[u] || 0) + 1);
    else ans.imps.forEach(u => scores[u] = (scores[u] || 0) + 2);
    await setRoom({ phase: "result", result: { imps: ans.imps, word: ans.word, cat: ans.cat, tally, caught, guessed: false }, scores });
  } catch (e) { console.error(e); toast("ما قدرنا نكشف النتيجة"); }
}
async function impGuessed() {
  const scores = { ...(room.scores || {}) };
  room.result.imps.forEach(u => scores[u] = (scores[u] || 0) + 1);
  await setRoom({ scores, "result.guessed": true, "result.wordShown": true });
}
// ---- مين أكثر واحد أونلاين (المضيف) ----
async function startMost() {
  const ps = order();
  if (ps.length < 2) return toast("تحتاجون لاعبين على الأقل");
  if (!mostDeck.length) mostDeck = shuffle(MOST);
  const names = {}; ps.forEach(u => names[u] = pname(u));
  await setRoom({ game: "most", phase: "mq", round: (room.round || 0) + 1, prompt: mostDeck.pop(), roundPlayers: ps, names, result: null });
}
async function revealMost() {
  const tally = {}; const ps = roundPlayers();
  Object.entries(votes).forEach(([voter, v]) => {
    if (v.round === room.round && ps.includes(voter) && ps.includes(v.target)) tally[v.target] = (tally[v.target] || 0) + 1;
  });
  await setRoom({ phase: "mresult", result: { tally } });
}
// ---- إنسان حيوان نبات جماد أونلاين ----
const HHNJ_SECS = 90;
const normAr = t => String(t || "").trim()
  .replace(/[\u064B-\u0652\u0640]/g, "")
  .replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه")
  .replace(/\s+/g, " ").toLowerCase();
const stripAl = t => t.replace(/^ال(?=..)/, "");
function startsWithLetter(word, letter) {
  const w = stripAl(normAr(word)), l = normAr(letter);
  return !!w && w.charAt(0) === l;
}
async function startHhnj() {
  const ps = order();
  if (ps.length < 2) return toast("تحتاجون لاعبين على الأقل");
  let letter = pick(LETTERS);
  if (letter === room.letter) letter = pick(LETTERS);
  const names = {}; ps.forEach(u => names[u] = pname(u));
  await setRoom({ game: "hhnj", phase: "hq", round: (room.round || 0) + 1, letter, deadline: Date.now() + HHNJ_SECS * 1000, roundPlayers: ps, names, result: null });
}
function hhnjScore(rows, letter, rej) {
  const out = {};
  const uids = Object.keys(rows);
  HCATS.forEach((_, ci) => {
    const seen = {};
    uids.forEach(u => {
      const a = rows[u].a[ci] || "";
      if (rej[u + "_" + ci] || !startsWithLetter(a, letter)) return;
      const k = stripAl(normAr(a)); seen[k] = (seen[k] || 0) + 1;
    });
    uids.forEach(u => {
      out[u] = out[u] || { a: rows[u].a, p: [], total: 0 };
      const a = rows[u].a[ci] || "";
      let p = 0;
      if (!rej[u + "_" + ci] && startsWithLetter(a, letter)) p = seen[stripAl(normAr(a))] > 1 ? 5 : 10;
      out[u].p[ci] = p; out[u].total += p;
    });
  });
  return out;
}
async function revealHhnj() {
  if (ui.hReveal) return; ui.hReveal = true;
  try {
    const snap = await getDocs(collection(db, "rooms", roomCode, "answers"));
    const ps = roundPlayers(), rows = {};
    ps.forEach(u => rows[u] = { a: ["", "", "", ""] });
    snap.forEach(d => { const v = d.data(); if (v.round === room.round && rows[d.id]) rows[d.id] = { a: (v.a || []).slice(0, 4).map(x => String(x || "").slice(0, 40)) }; });
    const scored = hhnjScore(rows, room.letter, {});
    const scores = { ...(room.scores || {}) }, applied = {};
    Object.entries(scored).forEach(([u, r]) => { scores[u] = (scores[u] || 0) + r.total; applied[u] = r.total; });
    await setRoom({ phase: "hres", result: { rows: scored, rej: {}, applied }, scores });
  } catch (e) { console.error(e); toast("ما قدرنا نجيب الأجوبة"); }
  ui.hReveal = false;
}
async function toggleReject(u, ci) {
  const r = room.result; if (!r) return;
  const rej = { ...(r.rej || {}) }, key = u + "_" + ci;
  if (rej[key]) delete rej[key]; else rej[key] = true;
  const rows = {}; Object.entries(r.rows).forEach(([k, v]) => rows[k] = { a: v.a });
  const scored = hhnjScore(rows, room.letter, rej);
  const scores = { ...(room.scores || {}) }, applied = {};
  Object.entries(scored).forEach(([k, v]) => { scores[k] = (scores[k] || 0) - ((r.applied || {})[k] || 0) + v.total; applied[k] = v.total; });
  await setRoom({ result: { rows: scored, rej, applied }, scores });
}
async function submitHhnj(done) {
  const a = [0, 1, 2, 3].map(i => (document.getElementById("h" + i)?.value || "").trim().slice(0, 40));
  try { await setDoc(doc(db, "rooms", roomCode, "answers", me.uid), { round: room.round, a, done: !!done }); }
  catch (e) { console.error(e); if (done) toast("ما انرسلت أجوبتك، جرّب مرة ثانية"); }
}

// ---- أونو (المضيف يدير اللعبة، واللاعبين يرسلون حركاتهم) ----
const UNO = { st: null, processed: {}, busy: false, queue: [] };
const unoState = () => room?.uno || null;
async function startUno() {
  const ps = order();
  if (ps.length < 2) return toast("تحتاجون لاعبين على الأقل");
  if (ps.length > 8) return toast("أونو لين ٨ لاعبين");
  let deck = shuffle(buildDeck());
  const hands = {};
  ps.forEach(u => hands[u] = deck.splice(0, 7));
  let top = deck.pop();
  while (isWild(top) || !/^\d$/.test(cVal(top))) { deck.unshift(top); top = deck.pop(); }
  const round = (room.round || 0) + 1, names = {}; ps.forEach(u => names[u] = pname(u));
  const counts = {}; ps.forEach(u => counts[u] = 7);
  const ord = shuffle(ps);
  const uno = { order: ord, turn: 0, dir: 1, top, color: cColor(top), counts, deck: deck.length, drew: null, last: "بدأت اللعبة! أول دور لـ @" + names[ord[0]], v: 1, winner: null, flash: null };
  UNO.st = { deck, discard: [], hands }; UNO.processed = {};
  const b = writeBatch(db);
  ps.forEach(u => b.set(doc(db, "rooms", roomCode, "secrets", u), { round, role: "uno", hand: hands[u] }));
  b.set(doc(db, "rooms", roomCode, "hidden", "uno"), { round, deck, discard: [], hands, processed: {} });
  b.update(roomRef(), { game: "uno", phase: "uno", round, roundPlayers: ps, names, uno, result: null });
  try { await b.commit(); } catch (e) { console.error(e); toast("ما قدرنا نبدأ أونو"); }
}
async function unoLoadHost() {
  if (UNO.st || !isHost()) return;
  const h = await getDoc(doc(db, "rooms", roomCode, "hidden", "uno")).catch(() => null);
  if (h?.exists() && h.data().round === room.round) { const d = h.data(); UNO.st = { deck: d.deck, discard: d.discard, hands: d.hands }; UNO.processed = d.processed || {}; }
}
function unoDraw(st, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    if (!st.deck.length) { st.deck = shuffle(st.discard); st.discard = []; }
    if (!st.deck.length) break;
    out.push(st.deck.pop());
  }
  return out;
}
// حركة وحدة من لاعب، يطبقها المضيف
function unoApply(u, mv, uno, st) {
  const ord = uno.order, n = ord.length, me_i = ord.indexOf(u);
  if (me_i < 0 || me_i !== uno.turn || uno.winner) return null;
  const at_ = k => ((uno.turn + k * uno.dir) % n + n) % n;
  const nm = x => "@" + pname(x);
  const changed = new Set();
  const hand = st.hands[u] || [];
  if (mv.type === "play") {
    const idx = hand.indexOf(mv.card);
    if (idx < 0 || !canPlay(mv.card, uno.top, uno.color)) return null;
    hand.splice(idx, 1); changed.add(u);
    st.discard.push(uno.top); uno.top = mv.card;
    uno.color = isWild(mv.card) ? (UCOLORS[mv.color] ? mv.color : "r") : cColor(mv.card);
    const v = cVal(mv.card);
    let nextTurn = at_(1), msg = `${nm(u)} لعب ${cardName(mv.card)}`;
    if (v === "S") { msg += ` وتخطّى ${nm(ord[at_(1)])}`; nextTurn = at_(2); }
    else if (v === "R") { uno.dir *= -1; nextTurn = n === 2 ? uno.turn : ((uno.turn + uno.dir) % n + n) % n; msg += " وعكس الدور 🔄"; }
    else if (v === "D" || v === "F") {
      const victim = ord[at_(1)], k = v === "D" ? 2 : 4;
      st.hands[victim].push(...unoDraw(st, k)); changed.add(victim);
      msg += ` و${nm(victim)} سحب ${k === 2 ? "٢" : "٤"} 😬`; nextTurn = at_(2);
    }
    if (isWild(mv.card)) msg += ` واختار ${UCOLORS[uno.color].name}`;
    uno.drew = null; uno.drewCard = null;
    uno.flash = hand.length === 1 ? u : null;
    if (!hand.length) { uno.winner = u; msg = `🏆 ${nm(u)} فاز!`; }
    else uno.turn = nextTurn;
    uno.last = msg;
  } else if (mv.type === "draw") {
    if (uno.drew === u) return null;
    const got = unoDraw(st, 1); hand.push(...got); changed.add(u);
    const c = got[0];
    if (c && canPlay(c, uno.top, uno.color)) { uno.drew = u; uno.drewCard = c; uno.last = `${nm(u)} سحب ورقة`; }
    else { uno.drew = null; uno.drewCard = null; uno.turn = at_(1); uno.last = `${nm(u)} سحب ورقة وعدّى`; }
    uno.flash = null;
  } else if (mv.type === "pass") {
    if (uno.drew !== u) return null;
    uno.drew = null; uno.drewCard = null; uno.turn = at_(1); uno.last = `${nm(u)} عدّى`;
  } else if (mv.type === "kick") { // المضيف يتخطى لاعب ما يلعب
    const already = uno.drew === u;
    if (!already) { const got = unoDraw(st, 1); hand.push(...got); changed.add(u); }
    uno.drew = null; uno.drewCard = null; uno.turn = at_(1); uno.last = already ? `${nm(u)} خلص وقته ⏰ وانتقل الدور` : `${nm(u)} خلص وقته ⏰ سحب ورقة وانتقل الدور`;
  } else return null;
  ord.forEach(x => uno.counts[x] = (st.hands[x] || []).length);
  uno.deck = st.deck.length; uno.v = (uno.v || 0) + 1;
  return changed;
}
async function unoProcess(list) {
  if (!isHost() || room?.phase !== "uno") return;
  UNO.queue.push(...list);
  if (UNO.busy) return;
  UNO.busy = true;
  try {
    await unoLoadHost();
    while (UNO.queue.length) {
      const { u, mv } = UNO.queue.shift();
      if (!UNO.st || mv.round !== room.round || (UNO.processed[u] || 0) >= mv.seq) continue;
      UNO.processed[u] = mv.seq;
      const uno = JSON.parse(JSON.stringify(room.uno));
      const changed = unoApply(u, mv, uno, UNO.st);
      if (!changed) continue;
      const b = writeBatch(db);
      changed.forEach(x => b.set(doc(db, "rooms", roomCode, "secrets", x), { round: room.round, role: "uno", hand: UNO.st.hands[x] }));
      b.set(doc(db, "rooms", roomCode, "hidden", "uno"), { round: room.round, ...UNO.st, processed: UNO.processed });
      const upd = { uno };
      if (uno.winner) {
        const scores = { ...(room.scores || {}) }; scores[uno.winner] = (scores[uno.winner] || 0) + 1;
        upd.scores = scores; upd.phase = "unoend";
      }
      b.update(roomRef(), upd);
      room.uno = uno; if (upd.phase) room.phase = upd.phase;
      await b.commit();
    }
  } catch (e) { console.error(e); }
  UNO.busy = false;
}
function unoCleanup() {
  const uno = room.uno; if (!uno || uno.winner || UNO.busy || ui.unoCleaning) return;
  const gone = uno.order.filter(u => !room.players[u]);
  if (!gone.length) return;
  ui.unoCleaning = true;
  (async () => {
    try {
      await unoLoadHost();
      const st = UNO.st; if (!st) return;
      const u2 = JSON.parse(JSON.stringify(uno));
      const cur = u2.order[u2.turn];
      gone.forEach(g => { st.deck.unshift(...(st.hands[g] || [])); delete st.hands[g]; delete u2.counts[g]; });
      u2.order = u2.order.filter(u => !gone.includes(u));
      let t = u2.order.indexOf(cur); if (t < 0) t = u2.turn % Math.max(1, u2.order.length);
      u2.turn = t; u2.deck = st.deck.length; u2.v++; u2.last = "طلع لاعب من اللعبة"; u2.drew = null; u2.drewCard = null;
      const upd = { uno: u2 };
      if (u2.order.length < 2) { u2.winner = u2.order[0] || null; upd.phase = "unoend"; u2.last = "باقي لاعب واحد، انتهت اللعبة"; }
      const b = writeBatch(db);
      b.set(doc(db, "rooms", roomCode, "hidden", "uno"), { round: room.round, ...st, processed: UNO.processed });
      b.update(roomRef(), upd);
      await b.commit();
    } catch (e) { console.error(e); }
    ui.unoCleaning = false;
  })();
}
function watchUnoMoves() {
  sub("umoves", onSnapshot(collection(db, "rooms", roomCode, "moves"), q => {
    const list = [];
    q.forEach(d => { const mv = d.data(); if (mv.round === room?.round && (UNO.processed[d.id] || 0) < mv.seq) list.push({ u: d.id, mv }); });
    list.sort((a, b) => a.mv.seq - b.mv.seq);
    if (list.length) unoProcess(list);
  }, err));
}
async function unoMove(type, card, color) {
  const uno = unoState(); if (!uno) return;
  ui.unoWait = uno.v; setTimeout(() => { if (ui.unoWait === uno.v) { ui.unoWait = null; render(false); } }, 5000);
  try { await setDoc(doc(db, "rooms", roomCode, "moves", me.uid), { round: room.round, seq: Date.now(), type, card: card || "", color: color || "" }); }
  catch (e) { console.error(e); ui.unoWait = null; toast("ما انرسلت الحركة، جرّب مرة ثانية"); }
  render(false);
}
// مؤقت الدور: ٣٠ ثانية (١٥ بعد السحب). يحسبه كل جوال من لحظة ما شاف الحركة، والمضيف ينفّذ لما يخلص
const UNO_T = 30, UNO_T_DREW = 15;
function unoTimeLeft(uno) {
  if (!ui.unoSeen || ui.unoSeen.v !== uno.v || ui.unoSeen.round !== room.round) ui.unoSeen = { v: uno.v, round: room.round, t: Date.now() };
  const dur = uno.drew && uno.drew === uno.order[uno.turn] ? UNO_T_DREW : UNO_T;
  return { dur, left: Math.max(0, dur - (Date.now() - ui.unoSeen.t) / 1000) };
}
function unoTimerStart() {
  if (ui.unoTimer) return;
  ui.unoTimer = setInterval(() => {
    const uno = unoState();
    if (screen !== "room" || room?.phase !== "uno" || !uno) { clearInterval(ui.unoTimer); ui.unoTimer = null; return; }
    if (uno.winner) return;
    const { left } = unoTimeLeft(uno);
    const el = document.getElementById("uSec");
    if (el) { el.textContent = "⏱ " + ar(Math.ceil(left)); el.classList.toggle("hot", left <= 5); }
    if (left <= 0 && isHost() && ui.unoKickV !== uno.v) { ui.unoKickV = uno.v; unoKick(); }
  }, 500);
}
// نقاط الخبرة: كل ما تخلص جولة لعبت فيها
const END_PHASES = { result: "imp", hres: "hhnj", unoend: "uno", mresult: "most", wres: "who", tres: "tf", dres: "draw" };
async function awardXp() {
  if (!me?.uid || !room || !roomCode) return;
  const myScore = room.scores?.[me.uid] || 0;
  if (!ui.xpBase || ui.xpBase.room !== roomCode) ui.xpBase = { room: roomCode, score: myScore, done: new Set() };
  const game = END_PHASES[room.phase];
  if (!game) { ui.xpBase.score = myScore; return; }
  const key = room.round + ":" + room.phase;
  if (ui.xpBase.done.has(key)) return;
  ui.xpBase.done.add(key);
  if (!(room.roundPlayers || []).includes(me.uid)) return;
  const gained = Math.max(0, myScore - ui.xpBase.score); ui.xpBase.score = myScore;
  const won = game === "uno" ? room.uno?.winner === me.uid : gained > 0;
  const add = Math.min(45, 10 + Math.min(gained, 4) * 5 + (game === "uno" && won ? 15 : 0));
  const s = { ...(me.stats || {}) };
  s.games = (s.games || 0) + 1; s["g_" + game] = (s["g_" + game] || 0) + 1;
  if (won) { s.wins = (s.wins || 0) + 1; s["w_" + game] = (s["w_" + game] || 0) + 1; }
  const h = new Date().getHours(); if (h >= 2 && h < 5) s.night = (s.night || 0) + 1;
  const before = achGot(me.stats, me.xp, me.username).map(x => x.id), oldL = myLvl();
  try {
    await updateDoc(doc(db, "users", me.uid), { xp: (me.xp || 0) + add, xpAt: serverTimestamp(), stats: s });
    me.xp = (me.xp || 0) + add; me.stats = s;
    const fresh = achGot(s, me.xp, me.username).filter(x => !before.includes(x.id));
    setTimeout(() => {
      toast(`+${ar(add)} خبرة ⭐`);
      if (myLvl() > oldL) setTimeout(() => toast(`🎉 وصلت المستوى ${ar(myLvl())}!`), 1400);
      fresh.forEach((x, i) => setTimeout(() => toast(`🎖️ إنجاز جديد: ${x.t}`), 2800 + i * 1400));
    }, 600);
  } catch (e) { console.warn("xp", e); }
}
async function unoKick() {
  const uno = unoState(); if (!uno || !isHost()) return;
  const u = uno.order[uno.turn];
  await unoProcess([{ u, mv: { round: room.round, seq: (UNO.processed[u] || 0) + 1, type: "kick" } }]);
}
// سحب الورقة بالإصبع وإفلاتها في الوسط
function unoDragCard(b, tryPlay) {
  b.addEventListener("pointerdown", e => {
    if (e.button > 0) return;
    const r0 = b.getBoundingClientRect(), sx = e.clientX, sy = e.clientY;
    let ghost = null;
    const move = ev => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      if (!ghost) {
        if (Math.hypot(dx, dy) < 8) return;
        ghost = document.createElement("div"); ghost.className = "ughost"; ghost.innerHTML = b.innerHTML;
        ghost.style.cssText = `left:${r0.left}px;top:${r0.top}px;width:${r0.width}px;height:${r0.height}px`;
        document.body.appendChild(ghost); b.classList.add("lifted");
      }
      ev.preventDefault();
      ghost.style.transform = `translate(${dx}px,${dy}px) rotate(${Math.max(-14, Math.min(14, dx / 10))}deg) scale(1.12)`;
      const d = document.getElementById("uDisc")?.getBoundingClientRect();
      ghost.classList.toggle("over", !!d && ev.clientX > d.left - 40 && ev.clientX < d.right + 40 && ev.clientY > d.top - 50 && ev.clientY < d.bottom + 50);
    };
    const up = ev => {
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up);
      if (!ghost) return;
      ui.unoDragged = true; setTimeout(() => ui.unoDragged = false, 50);
      const d = document.getElementById("uDisc")?.getBoundingClientRect();
      const inside = d && ev.clientX > d.left - 40 && ev.clientX < d.right + 40 && ev.clientY > d.top - 50 && ev.clientY < d.bottom + 50;
      const ok = (inside || ev.clientY < sy - 110) && ev.type === "pointerup" && tryPlay(b.dataset.card);
      if (ok && d) {
        ghost.style.transition = "transform .22s ease-in, opacity .22s";
        ghost.style.transform = `translate(${d.left + d.width / 2 - r0.left - r0.width / 2}px,${d.top + d.height / 2 - r0.top - r0.height / 2}px) rotate(-8deg) scale(.95)`;
        ghost.style.opacity = "0"; setTimeout(() => ghost.remove(), 240);
      } else {
        ghost.style.transition = "transform .2s ease-out"; ghost.style.transform = "none";
        setTimeout(() => { ghost.remove(); b.classList.remove("lifted"); }, 200);
      }
    };
    window.addEventListener("pointermove", move, { passive: false }); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
  });
}
function unoPickColor(card) {
  document.getElementById("uColor")?.remove();
  const el = document.createElement("div");
  el.id = "uColor"; el.className = "sheet-bg"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true");
  el.innerHTML = `<div class="sheet"><b class="pf-name">اختر اللون</b>
    <div class="ucolors">${Object.entries(UCOLORS).map(([k, c]) => `<button class="ucol" data-col="${k}" style="--c:${c.fill}">${c.name}</button>`).join("")}</div>
    <button class="btn ghost" id="ucX">إلغاء</button></div>`;
  document.body.appendChild(el);
  el.addEventListener("click", e => { if (e.target === el) el.remove(); });
  el.querySelector("#ucX").addEventListener("click", () => el.remove());
  el.querySelectorAll("[data-col]").forEach(b => b.addEventListener("click", () => { el.remove(); unoMove("play", card, b.dataset.col); }));
}

async function vote(target) {
  const v = { round: room.round, target };
  if (room.phase === "wv") v.i = room.wi || 0;
  try { await setDoc(doc(db, "rooms", roomCode, "votes", me.uid), v); }
  catch (e) { console.error(e); toast("ما انحسب صوتك، جرّب مرة ثانية"); }
}

// ---- الأجوبة السرية (مين قالها؟ و صح ولا خطأ): كل لاعب يكتب في priv، والمضيف بس يقراها ----
async function submitPriv(data) {
  try { await setDoc(doc(db, "rooms", roomCode, "priv", me.uid), { round: room.round, ...data }); return true; }
  catch (e) { console.error(e); toast("ما انرسل، جرّب مرة ثانية"); return false; }
}
function watchPriv() {
  sub("priv", onSnapshot(collection(db, "rooms", roomCode, "priv"), q => {
    if (!room || !isHost()) return;
    const ps = roundPlayers(), got = {};
    q.forEach(d => { const v = d.data(); if (v.round === room.round && ps.includes(d.id) && String(v.text || "").trim()) got[d.id] = v; });
    if (room.phase === "wq") {
      const n = Object.keys(got).length;
      if (n >= ps.length && n >= 2) whoReveal();
      else if (n !== (room.wDone || 0)) setRoom({ wDone: n });
    } else if (room.phase === "tw" && got[room.teller] && ui.tAdv !== room.round) {
      ui.tAdv = room.round;
      setRoom({ phase: "tv", tText: String(got[room.teller].text).trim().slice(0, 120) });
    }
  }, err));
}

// ---- مين قالها؟ (المضيف) ----
const WHOS = { deck: [], authors: null, round: 0 };
async function startWho() {
  const ps = order();
  if (ps.length < 3) return toast("تحتاجون ٣ لاعبين على الأقل");
  if (!WHOS.deck.length) WHOS.deck = shuffle(WHO);
  const names = {}; ps.forEach(u => names[u] = pname(u));
  WHOS.authors = null;
  await setRoom({ game: "who", phase: "wq", round: (room.round || 0) + 1, prompt: WHOS.deck.pop(), wDone: 0, wlist: [], wi: 0, wshow: false, wrev: [], roundPlayers: ps, names, result: null });
}
async function whoReveal() {
  if (ui.wBusy || room?.phase !== "wq") return; ui.wBusy = true;
  try {
    const snap = await getDocs(collection(db, "rooms", roomCode, "priv"));
    const ps = roundPlayers(), items = [];
    snap.forEach(d => { const v = d.data(), t = String(v.text || "").trim().slice(0, 100); if (v.round === room.round && ps.includes(d.id) && t) items.push({ u: d.id, t }); });
    if (items.length < 2) { toast("نحتاج جوابين على الأقل"); ui.wBusy = false; return; }
    const mixed = shuffle(items);
    WHOS.authors = mixed.map(x => x.u); WHOS.round = room.round;
    const b = writeBatch(db);
    b.set(doc(db, "rooms", roomCode, "hidden", "who"), { round: room.round, authors: WHOS.authors });
    b.update(roomRef(), { phase: "wv", wlist: mixed.map(x => x.t), wi: 0, wshow: false, wrev: [] });
    await b.commit();
  } catch (e) { console.error(e); toast("ما قدرنا نجيب الأجوبة"); }
  ui.wBusy = false;
}
async function whoAuthors() {
  if (WHOS.authors && WHOS.round === room.round) return WHOS.authors;
  const h = await getDoc(doc(db, "rooms", roomCode, "hidden", "who")).catch(() => null);
  if (h?.exists() && h.data().round === room.round) { WHOS.authors = h.data().authors; WHOS.round = room.round; return WHOS.authors; }
  return null;
}
function whoVotes() {
  const ps = roundPlayers(), out = {};
  Object.entries(votes).forEach(([u, v]) => { if (v.round === room.round && (v.i || 0) === (room.wi || 0) && ps.includes(u) && ps.includes(v.target)) out[u] = v.target; });
  return out;
}
async function whoShow() {
  if (ui.wBusy) return; ui.wBusy = true;
  try {
    const authors = await whoAuthors();
    if (!authors) { toast("ما قدرنا نكشف"); return; }
    const i = room.wi || 0, a = authors[i], vs = whoVotes();
    const right = [], tally = {}; let fooled = 0;
    Object.entries(vs).forEach(([u, t]) => { if (u === a) return; tally[t] = (tally[t] || 0) + 1; if (t === a) right.push(u); else fooled++; });
    const scores = { ...(room.scores || {}) };
    right.forEach(u => scores[u] = (scores[u] || 0) + 1);
    if (fooled) scores[a] = (scores[a] || 0) + fooled;
    const wrev = [...(room.wrev || [])];
    while (wrev.length < i) wrev.push(null);
    wrev[i] = { a, right, fooled, tally };
    await setRoom({ wshow: true, wrev, scores });
  } finally { ui.wBusy = false; }
}
async function whoNext() {
  const i = (room.wi || 0) + 1;
  if (i >= (room.wlist || []).length) await setRoom({ phase: "wres" });
  else await setRoom({ wi: i, wshow: false });
}

// ---- صح ولا خطأ (المضيف) ----
async function startTf() {
  const ps = order();
  if (ps.length < 2) return toast("تحتاجون لاعبين على الأقل");
  const t = ((room.tTurn ?? -1) + 1) % ps.length;
  const names = {}; ps.forEach(u => names[u] = pname(u));
  await setRoom({ game: "tf", phase: "tw", round: (room.round || 0) + 1, teller: ps[t], tTurn: t, tText: "", roundPlayers: ps, names, result: null });
}
async function tfReveal() {
  try {
    const d = await getDoc(doc(db, "rooms", roomCode, "priv", room.teller));
    const v = d.exists() ? d.data() : null;
    if (!v || v.round !== room.round) return toast("ما لقينا الجملة");
    const truth = !!v.truth, ps = roundPlayers(), right = [], wrong = [];
    Object.entries(votes).forEach(([u, x]) => {
      if (x.round !== room.round || u === room.teller || !ps.includes(u) || (x.target !== "t" && x.target !== "f")) return;
      ((x.target === "t") === truth ? right : wrong).push(u);
    });
    const scores = { ...(room.scores || {}) };
    right.forEach(u => scores[u] = (scores[u] || 0) + 1);
    if (wrong.length) scores[room.teller] = (scores[room.teller] || 0) + wrong.length;
    await setRoom({ phase: "tres", result: { truth, right, wrong }, scores });
  } catch (e) { console.error(e); toast("ما قدرنا نكشف"); }
}

// ---- ارسم وخمّن ----
const DRAW_SECS = 80;
const DCOLORS = ["#1c1530", "#ef6f6c", "#f2b134", "#3fbf9a", "#5fb0f0", "#8f7bea", "#8a5a2b", "#ffffff"];
const DSIZES = [6, 14, 32];
const DRAWS = { deck: [], word: null, wRound: 0, seen: {}, queue: [], busy: false, ending: 0, strokes: [], sRound: 0, c: 0, w: 1, pushT: null, dirty: false, tick: null };
const drawKey = t => stripAl(normAr(t)).replace(/\s+/g, "");
const encStrokes = st => st.map(k => `${k.c}.${k.w};${k.p.join(",")}`).join("|");
function decStrokes(s) {
  if (!s || typeof s !== "string") return [];
  return s.split("|").map(part => {
    const [h, pts] = part.split(";"); const [c, w] = (h || "").split(".").map(Number);
    const p = (pts || "").split(",").map(Number).filter(n => Number.isFinite(n)).map(n => Math.max(0, Math.min(1000, Math.round(n))));
    return { c: DCOLORS[c] ? c : 0, w: DSIZES[w] ? w : 1, p: p.length % 2 ? p.slice(0, -1) : p };
  }).filter(k => k.p.length >= 2);
}
function paintCanvas(cv = document.getElementById("dCanvas"), strokes = DRAWS.strokes) {
  if (!cv) return;
  const W = Math.max(1, Math.round(cv.clientWidth * (window.devicePixelRatio || 1)));
  if (cv.width !== W || cv.height !== W) { cv.width = W; cv.height = W; }
  const g = cv.getContext("2d"), k = W / 1000;
  g.fillStyle = "#fffaf0"; g.fillRect(0, 0, W, W);
  g.lineCap = "round"; g.lineJoin = "round";
  strokes.forEach(s => {
    g.strokeStyle = DCOLORS[s.c]; g.fillStyle = DCOLORS[s.c]; g.lineWidth = DSIZES[s.w] * k;
    const p = s.p;
    if (p.length === 2) { g.beginPath(); g.arc(p[0] * k, p[1] * k, DSIZES[s.w] * k / 2, 0, Math.PI * 2); g.fill(); return; }
    g.beginPath(); g.moveTo(p[0] * k, p[1] * k);
    for (let i = 2; i < p.length; i += 2) g.lineTo(p[i] * k, p[i + 1] * k);
    g.stroke();
  });
}
function pushCanvas() {
  if (DRAWS.pushT) { DRAWS.dirty = true; return; }
  const s = encStrokes(DRAWS.strokes);
  if (s.length > 250000) { toast("اللوحة امتلت، امسح شوي"); return; }
  DRAWS.dirty = false;
  setDoc(doc(db, "rooms", roomCode, "canvas", "live"), { round: room.round, s }).catch(e => console.error(e));
  DRAWS.pushT = setTimeout(() => { DRAWS.pushT = null; if (DRAWS.dirty) pushCanvas(); }, 600);
}
function watchCanvas() {
  sub("dcanvas", onSnapshot(doc(db, "rooms", roomCode, "canvas", "live"), d => {
    const v = d.exists() ? d.data() : null;
    if (!v || !room || v.round !== room.round) return;
    const amDrawer = room.drawer === me.uid && room.phase === "dq";
    if (amDrawer && DRAWS.sRound === room.round) return; // الرسام عنده النسخة الأحدث
    DRAWS.strokes = decStrokes(v.s); DRAWS.sRound = room.round;
    paintCanvas();
  }, err));
}
function bindDrawPad() {
  const cv = document.getElementById("dCanvas"); if (!cv) return;
  let cur = null, raf = 0;
  const pt = e => { const r = cv.getBoundingClientRect(); return [Math.round(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * 1000), Math.round(Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)) * 1000)]; };
  const repaint = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; paintCanvas(cv); }); };
  cv.addEventListener("pointerdown", e => {
    if (room?.phase !== "dq" || room.drawer !== me.uid) return;
    e.preventDefault(); cv.setPointerCapture?.(e.pointerId);
    if (DRAWS.sRound !== room.round) { DRAWS.strokes = []; DRAWS.sRound = room.round; }
    cur = { c: DRAWS.c, w: DRAWS.w, p: pt(e) };
    DRAWS.strokes.push(cur); repaint(); pushCanvas();
  });
  cv.addEventListener("pointermove", e => {
    if (!cur) return; e.preventDefault();
    const [x, y] = pt(e), p = cur.p, lx = p[p.length - 2], ly = p[p.length - 1];
    if (Math.abs(x - lx) + Math.abs(y - ly) < 6) return;
    p.push(x, y); repaint(); pushCanvas();
  });
  const end = () => { if (cur) { cur = null; pushCanvas(); } };
  cv.addEventListener("pointerup", end); cv.addEventListener("pointercancel", end); cv.addEventListener("pointerleave", end);
}
async function startDraw() {
  const ps = order();
  if (ps.length < 2) return toast("تحتاجون لاعبين على الأقل");
  const t = ((room.dTurn ?? -1) + 1) % ps.length, drawer = ps[t];
  if (!DRAWS.deck.length) DRAWS.deck = shuffle([...new Set(DRAW)]);
  const word = DRAWS.deck.pop(), round = (room.round || 0) + 1;
  const names = {}; ps.forEach(u => names[u] = pname(u));
  DRAWS.word = word; DRAWS.wRound = round; DRAWS.seen = {}; DRAWS.queue = [];
  const b = writeBatch(db);
  b.set(doc(db, "rooms", roomCode, "secrets", drawer), { round, role: "draw", word });
  b.set(doc(db, "rooms", roomCode, "hidden", "draw"), { round, word });
  b.update(roomRef(), { game: "draw", phase: "dq", round, drawer, dTurn: t, deadline: Date.now() + DRAW_SECS * 1000, dMask: word.split(" ").map(x => x.length), dgot: {}, dfeed: [], roundPlayers: ps, names, result: null });
  try { await b.commit(); } catch (e) { console.error(e); toast("ما قدرنا نبدأ الجولة"); }
}
async function drawWord() {
  if (DRAWS.word && DRAWS.wRound === room.round) return DRAWS.word;
  const h = await getDoc(doc(db, "rooms", roomCode, "hidden", "draw")).catch(() => null);
  if (h?.exists() && h.data().round === room.round) { DRAWS.word = h.data().word; DRAWS.wRound = room.round; return DRAWS.word; }
  return null;
}
function watchGuesses() {
  sub("dguess", onSnapshot(collection(db, "rooms", roomCode, "guesses"), q => {
    const list = [];
    q.forEach(d => { const g = d.data(); if (g.round === room?.round && (DRAWS.seen[d.id] || 0) < g.seq) list.push({ u: d.id, g }); });
    if (list.length) drawProcess(list);
  }, err));
}
async function drawProcess(list) {
  if (!isHost() || room?.phase !== "dq") return;
  DRAWS.queue.push(...list);
  if (DRAWS.busy) return;
  DRAWS.busy = true;
  try {
    const word = await drawWord();
    while (word && DRAWS.queue.length && room?.phase === "dq") {
      const batch = DRAWS.queue.splice(0).sort((a, b) => a.g.seq - b.g.seq);
      const dgot = { ...(room.dgot || {}) }, ps = roundPlayers();
      let feed = [...(room.dfeed || [])], changed = false;
      batch.forEach(({ u, g }) => {
        if ((DRAWS.seen[u] || 0) >= g.seq) return;
        DRAWS.seen[u] = g.seq;
        if (u === room.drawer || dgot[u] || !ps.includes(u)) return;
        const t = cleanMsg(g.text).slice(0, 30); if (!t) return;
        if (drawKey(t) === drawKey(word)) { dgot[u] = Object.keys(dgot).length + 1; feed.push({ u, ok: true }); }
        else feed.push({ u, t });
        changed = true;
      });
      if (!changed) continue;
      feed = feed.slice(-8);
      room.dgot = dgot; room.dfeed = feed;
      if (ps.filter(u => u !== room.drawer).every(u => dgot[u])) { await drawEnd(); break; }
      await updateDoc(roomRef(), { dgot, dfeed: feed });
    }
  } catch (e) { console.error(e); }
  DRAWS.busy = false;
}
async function drawEnd() {
  if (!isHost() || room?.phase !== "dq" || DRAWS.ending === room.round) return;
  DRAWS.ending = room.round;
  try {
    const word = await drawWord() || "؟";
    const dgot = room.dgot || {}, scores = { ...(room.scores || {}) };
    Object.entries(dgot).forEach(([u, r]) => scores[u] = (scores[u] || 0) + (r === 1 ? 3 : r === 2 ? 2 : 1));
    const n = Object.keys(dgot).length;
    if (n && room.drawer) scores[room.drawer] = (scores[room.drawer] || 0) + n;
    await updateDoc(roomRef(), { phase: "dres", dgot, dfeed: room.dfeed || [], result: { word, got: dgot }, scores });
  } catch (e) { console.error(e); DRAWS.ending = 0; toast("ما زبط، جرّب مرة ثانية"); }
}
async function sendGuess(text) {
  const t = cleanMsg(text).slice(0, 30); if (!t) return;
  if (botBad(t)) { await botWarn(t); return; }
  ui.gSeq = Math.max(Date.now(), (ui.gSeq || 0) + 1);
  try { await setDoc(doc(db, "rooms", roomCode, "guesses", me.uid), { round: room.round, text: t, seq: ui.gSeq }); }
  catch (e) { console.error(e); toast("ما انرسل تخمينك"); }
}
function drawTick() {
  if (screen !== "room" || room?.phase !== "dq") { clearInterval(DRAWS.tick); DRAWS.tick = null; return; }
  const ms = room.deadline - Date.now(), left = Math.max(0, Math.ceil(ms / 1000));
  const bar = document.getElementById("dBar"), lt = document.getElementById("dLeft");
  if (bar) bar.style.transform = `scaleX(${Math.max(0, Math.min(1, ms / (DRAW_SECS * 1000)))})`;
  if (lt) { lt.textContent = ar(left); lt.classList.toggle("low", left <= 10); }
  if (isHost() && ms < -1200) drawEnd();
}

/* ================= شارك النتيجة (صورة) ================= */
const appLink = () => location.origin + location.pathname.replace(/index\.html$/, "");
const waLink = () => "https://wa.me/?text=" + encodeURIComponent(`تعال العب معنا ${GAMES[room?.game] || ""} في جلسة 🎉\nادخل من هنا: ${appLink()}?r=${roomCode}\nأو اكتب كود الغرفة: ${roomCode}`);
function topOf(map, ids) {
  const max = Math.max(0, ...ids.map(u => map[u] || 0));
  return max > 0 ? ids.filter(u => (map[u] || 0) === max) : [];
}
function shareData() {
  const ps = order(), r = room.result || {};
  const d = { game: GAMES[room.game] || "جلسة", head: "", quote: "", names: [], sub: "", img: null };
  if (room.phase === "result") {
    d.head = r.caught ? "مسكنا الدخيل 🕵️" : "الدخيل نجا منّا 😈";
    d.names = (r.imps || []).map(pname); d.sub = r.wordShown ? "الكلمة كانت: " + r.word : "";
  } else if (room.phase === "mresult") {
    d.head = "مين أكثر واحد…"; d.quote = room.prompt + "؟";
    d.names = topOf(r.tally || {}, roundPlayers()).map(pname); if (!d.names.length) d.sub = "محد 😅";
  } else if (room.phase === "hres") {
    const rows = r.rows || {}, best = Object.keys(rows).sort((a, b) => rows[b].total - rows[a].total)[0];
    d.head = "إنسان حيوان نبات جماد · حرف " + room.letter; d.names = best ? [pname(best)] : []; d.sub = best ? `أعلى نقاط بالجولة: ${ar(rows[best].total)}` : "";
  } else if (room.phase === "unoend") {
    d.head = "فاز بأونو جلسة 🏆"; d.names = room.uno?.winner ? [pname(room.uno.winner)] : [];
  } else if (room.phase === "wres") {
    d.head = "مين قالها؟ 🤫"; d.quote = room.prompt;
    const best = topOf(room.scores || {}, ps); d.names = best.map(pname); d.sub = best.length ? "متصدّر الجلسة" : "";
  } else if (room.phase === "tres") {
    d.head = r.truth ? "طلعت صح ✅" : "طلعت كذبة ❌"; d.quote = room.tText; d.names = [pname(room.teller)];
    d.sub = r.right?.length ? `عرفها ${ar(r.right.length)} من ${ar((r.right?.length || 0) + (r.wrong?.length || 0))}` : "ما أحد عرفها 😏";
  } else if (room.phase === "dres") {
    d.names = [pname(room.drawer)]; d.sub = "الكلمة كانت: " + (r.word || "؟");
    d.head = "شوفوا وش رسم 🎨";
    const c = document.createElement("canvas"); c.style.width = "800px"; c.width = c.height = 800;
    const g = c.getContext("2d"); const k = 0.8; g.fillStyle = "#fffaf0"; g.fillRect(0, 0, 800, 800); g.lineCap = g.lineJoin = "round";
    DRAWS.strokes.forEach(s => { g.strokeStyle = g.fillStyle = DCOLORS[s.c]; g.lineWidth = DSIZES[s.w] * k; const p = s.p;
      if (p.length === 2) { g.beginPath(); g.arc(p[0] * k, p[1] * k, DSIZES[s.w] * k / 2, 0, 7); g.fill(); return; }
      g.beginPath(); g.moveTo(p[0] * k, p[1] * k); for (let i = 2; i < p.length; i += 2) g.lineTo(p[i] * k, p[i + 1] * k); g.stroke(); });
    d.img = c;
  }
  d.board = ps.map(u => ({ n: pname(u), p: room.scores?.[u] || 0 })).sort((a, b) => b.p - a.p).slice(0, 5);
  return d;
}
function wrapLines(g, text, maxW) {
  const words = String(text || "").split(/\s+/).filter(Boolean), lines = [];
  let line = "";
  words.forEach(w => { const t = line ? line + " " + w : w; if (g.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; });
  if (line) lines.push(line);
  return lines;
}
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
async function makeShareImage(d) {
  const DISP = "Lalezar, Tahoma, sans-serif", BODY = "'IBM Plex Sans Arabic', Tahoma, sans-serif";
  try { await Promise.all([document.fonts.load("80px Lalezar"), document.fonts.load("700 40px 'IBM Plex Sans Arabic'")]); } catch (e) {}
  const W = 1080, H = 1920, c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d");
  g.direction = "rtl"; g.textAlign = "center"; g.textBaseline = "alphabetic";
  // الخلفية
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#2b1f4d"); bg.addColorStop(1, "#140f24");
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  const glow = g.createRadialGradient(W / 2, 520, 40, W / 2, 520, 700); glow.addColorStop(0, "rgba(242,177,52,.18)"); glow.addColorStop(1, "rgba(242,177,52,0)");
  g.fillStyle = glow; g.fillRect(0, 0, W, H);
  const sadu = (y, col) => { g.fillStyle = col; for (let x = 0; x < W; x += 40) { g.beginPath(); g.moveTo(x, y + 28); g.lineTo(x + 20, y); g.lineTo(x + 40, y + 28); g.fill(); } };
  sadu(36, "rgba(239,111,108,.85)"); sadu(72, "rgba(242,177,52,.6)"); sadu(H - 100, "rgba(242,177,52,.6)"); sadu(H - 64, "rgba(239,111,108,.85)");
  // الشعار
  g.fillStyle = "#f2b134"; g.font = `150px ${DISP}`; g.fillText("جلسة", W / 2, 270);
  g.font = `600 40px ${BODY}`; const pillW = Math.min(W - 160, g.measureText(d.game).width + 90);
  g.fillStyle = "rgba(255,255,255,.08)"; rr(g, (W - pillW) / 2, 312, pillW, 76, 38); g.fill();
  g.fillStyle = "#f7f0e3"; g.fillText(d.game, W / 2, 364);
  // البطاقة: نقيس أول وبعدين نرسم
  const CW = 920, CX = (W - CW) / 2, inner = CW - 110;
  const items = [];
  if (d.head) { g.font = `66px ${DISP}`; wrapLines(g, d.head, inner).forEach(t => items.push({ t, font: `66px ${DISP}`, col: "#f7f0e3", h: 86 })); items.push({ gap: 14 }); }
  if (d.quote) { g.font = `600 50px ${BODY}`; wrapLines(g, "«" + d.quote + "»", inner).slice(0, 5).forEach(t => items.push({ t, font: `600 50px ${BODY}`, col: "#f2b134", h: 74 })); items.push({ gap: 18 }); }
  if (d.img) items.push({ img: d.img, h: 640 + 26 });
  d.names.slice(0, 3).forEach(n => { const s = "@" + n; let fs = 100; g.font = `${fs}px ${DISP}`; while (g.measureText(s).width > inner && fs > 50) { fs -= 6; g.font = `${fs}px ${DISP}`; } items.push({ t: s, font: `${fs}px ${DISP}`, col: "#74d6b8", h: fs + 20, ltr: true }); });
  if (d.sub) { items.push({ gap: 8 }); g.font = `500 42px ${BODY}`; wrapLines(g, d.sub, inner).forEach(t => items.push({ t, font: `500 42px ${BODY}`, col: "#b8adcf", h: 60 })); }
  const ch = items.reduce((s, it) => s + (it.gap || it.h), 0) + 120, CY = 450;
  g.fillStyle = "#2a2146"; rr(g, CX, CY, CW, ch, 56); g.fill();
  g.strokeStyle = "#3d3263"; g.lineWidth = 4; g.stroke();
  let y = CY + 60;
  items.forEach(it => {
    if (it.gap) { y += it.gap; return; }
    if (it.img) { const s = 640, x = (W - s) / 2; g.save(); rr(g, x, y, s, s, 30); g.clip(); g.drawImage(it.img, x, y, s, s); g.restore(); y += it.h; return; }
    g.font = it.font; g.fillStyle = it.col; g.direction = it.ltr ? "ltr" : "rtl";
    g.fillText(it.t, W / 2, y + it.h * .78); y += it.h;
  });
  g.direction = "rtl";
  y = CY + ch + 70;
  // النقاط
  const board = (d.board || []).filter(b => b.p > 0);
  if (board.length && y < H - 560) {
    g.font = `600 38px ${BODY}`; g.fillStyle = "#b8adcf"; g.fillText("النقاط", W / 2, y); y += 30;
    board.slice(0, Math.max(1, Math.floor((H - 470 - y) / 92))).forEach((b, i) => {
      g.fillStyle = i === 0 ? "rgba(242,177,52,.16)" : "rgba(255,255,255,.05)"; rr(g, CX, y, CW, 78, 26); g.fill();
      g.textAlign = "right"; g.fillStyle = "#f2b134"; g.font = `52px ${DISP}`; g.fillText(ar(i + 1), CX + CW - 34, y + 57);
      g.direction = "ltr"; g.textAlign = "right"; g.fillStyle = "#f7f0e3"; g.font = `700 42px ${BODY}`;
      let nm = "@" + b.n; while (g.measureText(nm).width > CW - 260 && nm.length > 4) nm = nm.slice(0, -2) + "…";
      g.fillText(nm, CX + CW - 100, y + 54);
      g.direction = "rtl"; g.textAlign = "left"; g.fillStyle = "#74d6b8"; g.font = `52px ${DISP}`; g.fillText(ar(b.p), CX + 36, y + 57);
      g.textAlign = "center"; y += 92;
    });
  }
  // الرابط
  g.textAlign = "center"; g.direction = "rtl";
  g.fillStyle = "#f7f0e3"; g.font = `600 44px ${BODY}`; g.fillText("تعالوا العبوا معنا 👇", W / 2, H - 290);
  const link = appLink().replace(/^https?:\/\//, "").replace(/\/$/, "");
  g.direction = "ltr"; let fs = 54; g.font = `${fs}px ${DISP}`; while (g.measureText(link).width > W - 140 && fs > 30) { fs -= 4; g.font = `${fs}px ${DISP}`; }
  const lw = g.measureText(link).width + 80;
  g.fillStyle = "#f2b134"; rr(g, (W - lw) / 2, H - 250, lw, fs + 46, (fs + 46) / 2); g.fill();
  g.fillStyle = "#1c1530"; g.fillText(link, W / 2, H - 250 + fs + 10);
  return await new Promise(ok => c.toBlob(ok, "image/jpeg", .9));
}
async function openShare() {
  if (!room) return;
  document.getElementById("shareSheet")?.remove();
  const el = document.createElement("div");
  el.id = "shareSheet"; el.className = "sheet-bg"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "شارك النتيجة");
  el.innerHTML = `<div class="sheet share-sheet"><b class="pf-name">شارك النتيجة 📸</b>
    <div class="share-prev" id="shPrev"><div class="spinner" aria-label="نجهز الصورة"></div></div>
    <button class="btn" id="shGo" disabled>شارك 📤</button>
    <p class="hint" id="shHint">نجهز الصورة…</p>
    <button class="btn ghost" id="shX">إغلاق</button></div>`;
  document.body.appendChild(el);
  const close = () => { el.remove(); if (url) URL.revokeObjectURL(url); };
  let url = null;
  el.addEventListener("click", e => { if (e.target === el) close(); });
  el.querySelector("#shX").addEventListener("click", close);
  try {
    const blob = await makeShareImage(shareData());
    if (!el.isConnected) return;
    url = URL.createObjectURL(blob);
    el.querySelector("#shPrev").innerHTML = `<img class="share-img" src="${url}" alt="صورة النتيجة">`;
    const file = new File([blob], "jalsa.jpg", { type: "image/jpeg" });
    const can = !!navigator.canShare?.({ files: [file] });
    const go = el.querySelector("#shGo"), hint = el.querySelector("#shHint");
    hint.textContent = can ? "نزّلها ستوري بالسناب أو الانستا، أو أرسلها للقروب." : "اضغط مطوّل على الصورة واحفظها، ونزّلها ستوري بالسناب أو الانستا.";
    if (can) {
      go.disabled = false;
      go.addEventListener("click", async () => {
        try { await navigator.share({ files: [file], text: `العبوا معنا جلسة 🎉 ${appLink()}` }); }
        catch (e) { if (e?.name !== "AbortError") toast("ما قدرنا نفتح المشاركة، احفظ الصورة"); }
      });
    } else go.remove();
  } catch (e) { console.error(e); el.querySelector("#shHint").textContent = "ما قدرنا نسوي الصورة"; }
}
const shareBtn = () => `<button class="btn ghost share" data-share>📸 شارك النتيجة</button>`;

/* ================= views ================= */
/* ================= owner tools ================= */
const adm = { stats: null, loading: false, banned: [], bannedLoaded: false, reports: [], repLoaded: false, repLoading: false };
async function loadReports() {
  adm.repLoading = true;
  try {
    const q = await getDocs(query(collection(db, "reports"), orderBy("at", "desc"), limit(50)));
    adm.reports = q.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) { console.error(e); }
  adm.repLoaded = true; adm.repLoading = false;
  if (screen === "admin") render(false);
}
async function delReport(id) {
  try { await deleteDoc(doc(db, "reports", id)); adm.reports = adm.reports.filter(r => r.id !== id); render(false); }
  catch (e) { console.error(e); toast("ما قدرنا نحذفه"); }
}
async function loadStats() {
  if (adm.loading) return;
  adm.loading = true; render(false);
  try {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const since = Timestamp.fromMillis(Date.now() - ONLINE_MS);
    const [total, online, today, rooms, bans, gOnline, gToday] = await Promise.all([
      getCountFromServer(collection(db, "users")),
      getCountFromServer(query(collection(db, "users"), where("lastSeen", ">", since))),
      getCountFromServer(query(collection(db, "users"), where("createdAt", ">=", Timestamp.fromDate(start)))),
      getCountFromServer(collection(db, "rooms")),
      getDocs(collection(db, "bans")),
      getCountFromServer(query(collection(db, "guests"), where("lastSeen", ">", since))).catch(() => null),
      getCountFromServer(query(collection(db, "guests"), where("firstSeen", ">=", Timestamp.fromDate(start)))).catch(() => null)
    ]);
    adm.stats = { total: total.data().count, online: online.data().count, today: today.data().count, rooms: rooms.data().count,
      gOnline: gOnline ? gOnline.data().count : null, gToday: gToday ? gToday.data().count : null, at: new Date() };
    adm.banned = bans.docs.map(d => ({ uid: d.id, ...d.data() }));
  } catch (e) { console.error(e); toast("ما قدرنا نجيب الأرقام"); }
  adm.loading = false; render(false);
}
async function banUser(raw) {
  const typed = raw.trim().replace(/^@/, ""), key = typed.toLowerCase();
  if (!USER_RE.test(typed)) return toast("اكتب يوزر صحيح");
  if (key === OWNER) return toast("ما تقدر تحظر نفسك 😄");
  try {
    const s = await getDoc(doc(db, "usernames", key));
    if (!s.exists()) return toast("ما لقينا هذا اليوزر");
    const uid = s.data().uid;
    const u = await getDoc(doc(db, "users", uid));
    const name = u.exists() ? u.data().username : typed;
    await setDoc(doc(db, "bans", uid), { name, at: serverTimestamp() });
    adm.banned = [{ uid, name }, ...adm.banned.filter(b => b.uid !== uid)];
    toast("انحظر @" + name);
    const inp = document.getElementById("banName"); if (inp) inp.value = "";
    render(false);
  } catch (e) { console.error(e); toast("ما قدرنا نحظره"); }
}
async function unbanUser(uid) {
  try {
    await deleteDoc(doc(db, "bans", uid));
    adm.banned = adm.banned.filter(b => b.uid !== uid);
    toast("انفك الحظر"); render(false);
  } catch (e) { console.error(e); toast("ما قدرنا نفك الحظر"); }
}
async function saveAnnounce(text) {
  try {
    if (!text.trim()) { await deleteDoc(doc(db, "config", "announce")); toast("انشال الإعلان"); return; }
    await setDoc(doc(db, "config", "announce"), { text: text.trim().slice(0, 200), at: serverTimestamp() });
    toast("انرسل الإعلان لكل اللاعبين");
  } catch (e) { console.error(e); toast("ما قدرنا ننشر الإعلان"); }
}

/* ================= الشات ================= */
const EMOJIS = ["😂", "🤣", "😅", "😍", "😎", "🤔", "😮", "😡", "😭", "👍", "👏", "🙏", "🔥", "❤️", "💯", "🎉", "👀", "🕵️", "🤝", "✋"];
const cleanMsg = t => String(t || "").replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "").trim();
const timeOf = ts => { const d = ts?.toDate?.(); return d ? d.toLocaleTimeString("ar-SA", { hour: "numeric", minute: "2-digit" }) : ""; };
function msgHtml(m, mine, showName) {
  return `<div class="msg ${mine ? "me" : ""}">
    ${mine ? "" : `<button class="msg-av" data-who="${esc(m.uid || m.from || "")}" aria-label="بروفايل ${esc(m.name || "")}">${avatar(m.name || "", prof(m.uid || m.from)?.photo, 28)}</button>`}
    <div class="bub">${showName && !mine ? `<span class="msg-n" dir="ltr">${at(m.name || "")}</span>` : ""}<span class="msg-t" dir="auto">${esc(censor(m.text))}</span><span class="msg-time">${timeOf(m.at)}</span></div>
  </div>`;
}
function emojiBar(target) {
  return `<div class="emo" role="group" aria-label="إيموجي">${EMOJIS.map(e => `<button type="button" data-emo="${e}" data-for="${target}">${e}</button>`).join("")}</div>`;
}
function bindEmoji(root) {
  root.querySelectorAll("[data-emo]").forEach(b => b.addEventListener("click", () => {
    const inp = document.getElementById(b.dataset.for); if (!inp) return;
    const st = inp.selectionStart ?? inp.value.length, en = inp.selectionEnd ?? inp.value.length;
    inp.value = inp.value.slice(0, st) + b.dataset.emo + inp.value.slice(en);
    inp.focus(); const p = st + b.dataset.emo.length; try { inp.setSelectionRange(p, p); } catch (e) {}
  }));
}

// ---- شات الغرفة ----
function chatUnread() {
  const seen = ui.chatSeen || 0;
  return roomChat.filter(m => m.uid !== me?.uid && !isBlocked(m.uid) && (m.at?.toMillis?.() || 0) > seen).length;
}
function showChatFab() {
  let fab = document.getElementById("chatFab");
  if (!roomCode || screen !== "room") { fab?.remove(); return; }
  if (!fab) {
    fab = document.createElement("button");
    fab.id = "chatFab"; fab.className = "chat-fab"; fab.setAttribute("aria-label", "شات الغرفة");
    fab.addEventListener("click", openChatPanel);
    document.body.appendChild(fab);
  }
  const n = document.getElementById("chatPanel") ? 0 : chatUnread();
  fab.innerHTML = `💬<span>شات</span>${n ? `<i class="badge">${ar(n)}</i>` : ""}`;
}
function openChatPanel() {
  if (document.getElementById("chatPanel")) return;
  const el = document.createElement("div");
  el.id = "chatPanel"; el.className = "sheet-bg"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "شات الغرفة");
  el.innerHTML = `<div class="chat-sheet">
    <div class="chat-head"><b>شات الغرفة</b><span class="hint" dir="ltr">${esc(roomCode)}</span><button class="btn small ghost" id="chatX">إغلاق</button></div>
    <div class="chat-list" id="chatList"></div>
    ${emojiBar("chatIn")}
    <form class="chat-form" id="chatF"><input class="txt" id="chatIn" dir="auto" maxlength="300" placeholder="اكتب رسالة…" autocomplete="off"><button class="btn small">إرسال</button></form>
  </div>`;
  document.body.appendChild(el);
  bindEmoji(el);
  el.addEventListener("click", e => { if (e.target === el) closeChatPanel(); });
  el.querySelector("#chatX").addEventListener("click", closeChatPanel);
  el.querySelector("#chatList").addEventListener("click", e => { const b = e.target.closest("[data-who]"); if (b?.dataset.who) showProfile(b.dataset.who); });
  el.querySelector(".chat-head").insertAdjacentHTML("afterend", `<p class="hint chat-tip">اضغط صورة أي أحد عشان تبلّغ أو تحظر${isHost() ? " أو تطرد" : ""}.</p>`);
  el.querySelector("#chatF").addEventListener("submit", async e => {
    e.preventDefault();
    const inp = document.getElementById("chatIn"), text = cleanMsg(inp.value).slice(0, 300);
    if (!text || !roomCode) return;
    if (!(await botGate(text))) { inp.value = ""; return; }
    inp.value = "";
    try { await addDoc(collection(db, "rooms", roomCode, "chat"), { uid: me.uid, name: me.username, text, at: serverTimestamp() }); }
    catch (err) { console.error(err); toast("ما انرسلت الرسالة"); inp.value = text; }
  });
  updateRoomChat();
  showChatFab();
  document.getElementById("chatIn").focus({ preventScroll: true });
}
function closeChatPanel() {
  const el = document.getElementById("chatPanel"); if (!el) return;
  ui.chatSeen = Date.now(); el.remove(); showChatFab();
}
function updateRoomChat() {
  const list = document.getElementById("chatList");
  if (list) {
    const nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
    const shown = roomChat.filter(m => !isBlocked(m.uid));
    list.innerHTML = shown.length ? shown.map(m => msgHtml(m, m.uid === me.uid, true)).join("")
      : `<p class="hint center chat-empty">ما فيه رسايل للحين. قول هلا 👋</p>`;
    if (nearBottom || !list.dataset.init) { list.scrollTop = list.scrollHeight; list.dataset.init = "1"; }
    ui.chatSeen = Date.now();
  }
  showChatFab();
}

// ---- الخاص ----
const chatId = uid => pairId(me.uid, uid);
function unreadCount() {
  return inbox.filter(c => c.lastFrom && c.lastFrom !== me?.uid && (c.lastAt?.toMillis?.() || 0) > (c.read?.[me.uid]?.toMillis?.() || 0)).length;
}
let dmMsgs = [];
function openDm(uid) {
  if (!friends.has(uid)) { toast("لازم تكونون أصحاب عشان تراسله"); return; }
  ui.dmWith = uid; dmMsgs = [];
  go("dm");
  sub("dm", onSnapshot(query(collection(db, "chats", chatId(uid), "msgs"), orderBy("at", "desc"), limit(100)), q => {
    dmMsgs = q.docs.map(d => ({ id: d.id, ...d.data() })).reverse();
    updateDmList(); markDmRead();
  }, e => { console.error(e); }));
}
function markDmRead() {
  const uid = ui.dmWith; if (!uid) return;
  const c = inbox.find(x => x.id === chatId(uid));
  if (!c) return;
  if ((c.read?.[me.uid]?.toMillis?.() || 0) >= (c.lastAt?.toMillis?.() || 0)) return;
  updateDoc(doc(db, "chats", c.id), { ["read." + me.uid]: serverTimestamp() }).catch(() => {});
}
function updateDmList() {
  const list = document.getElementById("dmList"); if (!list) return;
  const f = friends.get(ui.dmWith);
  list.innerHTML = dmMsgs.length ? dmMsgs.map(m => msgHtml({ ...m, name: m.from === me.uid ? me.username : f?.username }, m.from === me.uid, false)).join("")
    : `<p class="hint center chat-empty">ابدأ السالفة 👋</p>`;
  list.scrollTop = list.scrollHeight;
}
async function sendDm(uid, text) {
  const pid = chatId(uid), b = writeBatch(db);
  b.set(doc(db, "chats", pid), { members: pid.split("_"), last: text.slice(0, 80), lastAt: serverTimestamp(), lastFrom: me.uid, read: { [me.uid]: serverTimestamp() } }, { merge: true });
  b.set(doc(collection(db, "chats", pid, "msgs")), { from: me.uid, text, at: serverTimestamp() });
  await b.commit();
  pushNotify(uid, "dm");
}

const VIEWS = {};

VIEWS.inbox = () => {
  const chatted = new Set();
  const rows = inbox.map(c => {
    const other = c.members.find(m => m !== me.uid); chatted.add(other);
    const f = friends.get(other) || prof(other) || { username: "…" };
    const unread = c.lastFrom !== me.uid && (c.lastAt?.toMillis?.() || 0) > (c.read?.[me.uid]?.toMillis?.() || 0);
    return `<button class="ib ${unread ? "unread" : ""}" data-dm="${esc(other)}">
      <span class="av-wrap">${avatar(f.username, f.photo, 46)}${friends.get(other) ? `<i class="dot ${isOnline(friends.get(other)) ? "on" : ""}"></i>` : ""}</span>
      <span class="ib-t"><span class="ib-n" dir="ltr">${at(f.username)}</span><span class="ib-l" dir="auto">${c.lastFrom === me.uid ? "أنت: " : ""}${esc(c.last || "")}</span></span>
      <span class="ib-r"><span class="ib-time">${timeOf(c.lastAt)}</span>${unread ? `<i class="ib-dot"></i>` : ""}</span></button>`;
  }).join("");
  const others = [...friends.entries()].filter(([u]) => !chatted.has(u));
  V.innerHTML = `<section>
    <h2>الرسائل</h2>
    ${rows ? `<div class="list">${rows}</div>` : `<p class="hint">ما عندك محادثات للحين.</p>`}
    ${others.length ? `<div class="field"><span class="label">ابدأ محادثة مع</span>
      <div class="onl">${others.map(([u, f]) => `<button class="onl-i" data-dm="${esc(u)}">${avatar(f.username, f.photo, 48)}${isOnline(f) ? `<i class="dot on"></i>` : ""}<span dir="ltr">${esc(f.username)}</span></button>`).join("")}</div></div>`
      : (friends.size ? "" : `<p class="hint">تقدر تراسل أصحابك بس. أضف أصحابك أول من زر «أضف صديق».</p>`)}
  </section>`;
  onAll("[data-dm]", b => openDm(b.dataset.dm));
};

VIEWS.dm = () => {
  const uid = ui.dmWith, f = friends.get(uid);
  if (!uid || !f) { go("inbox"); return; }
  V.innerHTML = `<section class="dm">
    <button class="dm-head" id="dmWho">${avatar(f.username, f.photo, 40)}<span class="who-t"><span class="nm" dir="ltr">${at(f.username)}</span><span class="who-bio">${isOnline(f) ? "أونلاين الحين" : "مو أونلاين"}</span></span></button>
    <div class="chat-list dm-list" id="dmList"></div>
    ${emojiBar("dmIn")}
    <form class="chat-form" id="dmF"><input class="txt" id="dmIn" dir="auto" maxlength="500" placeholder="اكتب رسالة…" autocomplete="off"><button class="btn small">إرسال</button></form>
  </section>`;
  bindEmoji(V);
  on("dmWho", "click", () => showProfile(uid));
  on("dmF", "submit", async e => {
    e.preventDefault();
    const inp = document.getElementById("dmIn"), text = cleanMsg(inp.value).slice(0, 500);
    if (!text) return;
    if (!(await botGate(text))) { inp.value = ""; return; }
    inp.value = "";
    try { await sendDm(uid, text); }
    catch (err) { console.error(err); toast("ما انرسلت. لازم تكونون أصحاب."); inp.value = text; }
  });
  updateDmList();
};

VIEWS.banned = () => {
  V.innerHTML = `<section><div class="card imposter"><span class="big">محظور</span>
    <span class="hint">حسابك موقوف من اللعب أونلاين. تقدر تلعب بجوال واحد بدون حساب.</span></div>
    <div class="foot"><button class="btn ghost" id="local">العب بجوال واحد</button><button class="btn ghost" id="out">تسجيل خروج</button></div></section>`;
  on("local", "click", () => go("local"));
  on("out", "click", () => signOut(auth));
};

VIEWS.admin = () => {
  if (!isOwner()) { go("home"); return; }
  if (!adm.stats && !adm.loading) { loadStats(); }
  const st = adm.stats;
  const tile = (n, label, tone) => `<div class="stat ${tone || ""}"><span class="n">${st ? ar(n) : "…"}</span><span class="l">${label}</span></div>`;
  V.innerHTML = `<section>
    <div><h2>لوحة المالك 👑</h2><p class="lead">تشوفها أنت بس.</p></div>

    <div class="field"><div class="row-h"><span class="label">الإحصائيات</span>
      <button class="link" id="reload">${adm.loading ? "يحدّث…" : "تحديث"}</button></div>
      <div class="stats">
        ${tile(st?.online, "أونلاين الحين", "good")}
        ${tile(st?.total, "كل اللاعبين")}
        ${tile(st?.today, "سجّلوا اليوم")}
        ${tile(st?.rooms, "غرف مفتوحة")}
        ${tile(st?.gOnline ?? "—", "زوار بدون حساب الحين", "good")}
        ${tile(st?.gToday ?? "—", "زوار بدون حساب اليوم")}
      </div>
      ${st ? `<p class="hint">آخر تحديث ${esc(st.at.toLocaleTimeString("ar-SA", { hour: "numeric", minute: "2-digit" }))}</p>` : ""}
    </div>

    <div class="field"><span class="label">إعلان لكل اللاعبين</span>
      <textarea class="txt" id="annText" rows="3" maxlength="200" placeholder="مثال: نزلت لعبة جديدة الليلة 🔥">${esc(announce?.text || "")}</textarea>
      <div class="row"><button class="btn" id="annSend">انشر الإعلان</button>${announce?.text ? `<button class="btn ghost" id="annDel">شيل الإعلان</button>` : ""}</div>
      <p class="hint">${announce?.text ? "فيه إعلان منشور الحين، ويطلع فوق الصفحة لكل اللاعبين." : "ما فيه إعلان منشور."}</p>
    </div>

    <div class="field"><span class="label">البنر (يطلع فوق تحت الشعار)</span>
      ${promo?.img ? `<div class="promo preview"><img src="${esc(safeJpeg(promo.img))}" alt=""></div>` : `<p class="hint">ما فيه بنر الحين.</p>`}
      <input type="file" id="bnFile" accept="image/*" hidden>
      <input class="txt" id="bnLink" dir="ltr" placeholder="رابط اختياري يفتح لما يضغطون البنر (https://...)" value="${esc(promo?.link || "")}">
      <div class="row"><label class="btn" for="bnFile">${promo?.img ? "غيّر صورة البنر" : "ارفع صورة البنر"}</label>${promo?.img ? `<button class="btn ghost" id="bnDel">شيل البنر</button>` : ""}</div>
      ${promo?.img ? `<button class="btn ghost" id="bnLinkSave">احفظ الرابط</button>` : ""}
      <p class="hint">أفضل مقاس: صورة عريضة، مثل ١٢٠٠×٤٠٠.</p>
    </div>

    <div class="field"><div class="row-h"><span class="label">البلاغات 🚩 ${adm.reports.length ? `(${ar(adm.reports.length)})` : ""}</span><button class="link" id="repLoad">تحديث</button></div>
      ${adm.reports.length ? `<div class="list">${adm.reports.map(r => `<div class="rep">
        <div class="row-h"><b dir="ltr">@${esc(r.targetName || "—")}</b><span class="tag">${esc(r.why || "")}</span></div>
        ${r.text ? `<p class="rep-t" dir="auto">${esc(r.text)}</p>` : ""}
        ${r.msgs ? `<p class="rep-m" dir="auto">رسايله: ${esc(r.msgs)}</p>` : ""}
        <span class="hint">بلّغ: <span dir="ltr">@${esc(r.byName || "")}</span> · ${esc(r.at?.toDate?.().toLocaleString("ar-SA", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) || "")}</span>
        <div class="row"><button class="btn small danger" data-repban="${esc(r.id)}">احظره</button><button class="btn small ghost" data-repdel="${esc(r.id)}">تجاهل</button></div></div>`).join("")}</div>`
        : `<p class="hint">${adm.repLoaded ? "ما فيه بلاغات 👌" : "…"}</p>`}
    </div>

    <div class="field"><span class="label">🛍️ أكواد المتجر</span>
      <form class="codegen" id="genF">
        <select class="txt" id="genItem" aria-label="المنتج">${SHOP.map(it => `<option value="${it.id}">${it.name} (${ar(it.price)} ريال)</option>`).join("")}</select>
        <div class="row"><input class="txt" id="genN" type="number" min="1" max="100" value="10" dir="ltr" aria-label="كم كود"><button class="btn small">ولّد الأكواد</button></div>
      </form>
      ${adm.codes ? `<div class="codes-out"><p class="hint">${ar(adm.codes.list.length)} كود لـ «${esc(adm.codes.name)}». انسخها وحطها في المنتج حقها في متجرك (كل كود في سطر).</p>
        <textarea class="txt" id="genOut" rows="6" dir="ltr" readonly>${adm.codes.list.join("\n")}</textarea>
        <button class="btn small" id="genCopy">انسخ الأكواد</button></div>` : ""}
      <details class="links" ${shopCfg?.base ? "" : "open"}><summary>رابط المتجر وروابط المنتجات</summary>
        <label class="lk"><span><b>رابط المتجر</b></span><input class="txt" id="shopBaseIn" dir="ltr" placeholder="https://jalsah.rmz.gg" value="${esc(shopCfg?.base || "")}"></label>
        <p class="hint">وتحت رابط كل منتج عشان زر «اشترِ» يفتحه على طول. إذا خليته فاضي يفتح رابط المتجر.</p>
        ${SHOP.map(it => `<label class="lk"><span>${it.name}</span><input class="txt" data-link="${it.id}" dir="ltr" placeholder="https://..." value="${esc(shopCfg?.links?.[it.id] || "")}"></label>`).join("")}
        <button class="btn small" id="saveLinks">احفظ الروابط</button></details></div>

    <div class="field"><span class="label">🤖 فك كتم / صفّر تحذيرات البوت</span>
      <form class="addf" id="unmuteF"><div class="uinput"><span>@</span><input id="unmuteName" autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="21" placeholder="يوزر اللاعب" aria-label="يوزر اللاعب"></div><button class="btn small good">صفّر</button></form>
      <p class="hint">البوت يحذّر اللي يسب، وبعد ٣ تحذيرات يكتمه ٢٤ ساعة. من هنا تفك كتمه وترجع تحذيراته صفر.</p></div>

    <div class="field"><span class="label">حظر لاعب</span>
      <form class="addf" id="banF"><div class="uinput"><span>@</span><input id="banName" autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="21" placeholder="يوزر اللاعب" aria-label="يوزر اللاعب"></div><button class="btn small danger">احظر</button></form>
      <p class="hint">المحظور ما يقدر يسوي غرف، ولا يدخلها، ولا يضيف أحد.</p>
      ${adm.banned.length ? `<div class="list">${adm.banned.map(b => `
        <div class="li"><span class="nm" dir="ltr">@${esc(b.name || "—")}</span><button class="btn small ghost" data-unban="${esc(b.uid)}">فك الحظر</button></div>`).join("")}</div>`
        : (st ? `<p class="hint">ما فيه أحد محظور.</p>` : "")}
    </div>
  </section>`;
  on("reload", "click", loadStats);
  if (!adm.repLoaded && !adm.repLoading) loadReports();
  on("repLoad", "click", loadReports);
  onAll("[data-repdel]", b => delReport(b.dataset.repdel));
  onAll("[data-repban]", async b => {
    if (!confirmTap(b, "متأكد؟")) return;
    const r = adm.reports.find(x => x.id === b.dataset.repban); if (!r) return;
    await banUser(r.targetName || ""); delReport(r.id);
  });
  on("annSend", "click", e => {
    const t = document.getElementById("annText").value;
    if (!t.trim()) return toast("اكتب الإعلان أول");
    if (!confirmTap(e.currentTarget, "بيطلع لكل اللاعبين، انشر؟")) return;
    saveAnnounce(t);
  });
  on("annDel", "click", () => saveAnnounce(""));
  on("banF", "submit", e => {
    e.preventDefault();
    const btn = e.currentTarget.querySelector("button");
    if (!confirmTap(btn, "متأكد؟")) return;
    banUser(document.getElementById("banName").value);
  });
  onAll("[data-unban]", b => unbanUser(b.dataset.unban));
  on("genF", "submit", async e => {
    e.preventDefault();
    const it = SHOP.find(x => x.id === document.getElementById("genItem").value); if (!it) return;
    const n = Math.max(1, Math.min(100, parseInt(document.getElementById("genN").value, 10) || 1));
    const rnd = () => { const b = crypto.getRandomValues(new Uint8Array(12)); return fmtCode([...b].map(x => CODE_CHARS[x % CODE_CHARS.length]).join("")); };
    const list = [...new Set(Array.from({ length: n }, rnd))];
    const b = writeBatch(db);
    list.forEach(c => b.set(doc(db, "codes", c), { item: it.id, grants: it.grants, days: it.days, by: null, at: serverTimestamp() }));
    try { await b.commit(); adm.codes = { name: it.name, list }; toast(`انسوت ${ar(list.length)} أكواد ✅`); render(true); }
    catch (err) { console.error(err); toast("ما انسوت الأكواد"); }
  });
  on("genCopy", "click", () => copyText(adm.codes.list.join("\n"), "انسخت الأكواد"));
  on("saveLinks", "click", async () => {
    const links = {};
    V.querySelectorAll("[data-link]").forEach(i => { const v = i.value.trim(); if (/^https:\/\//.test(v)) links[i.dataset.link] = v; });
    const base = document.getElementById("shopBaseIn").value.trim();
    try { await setDoc(doc(db, "config", "shop"), { links, base: /^https:\/\//.test(base) ? base : "" }); toast("انحفظت الروابط ✅"); } catch (err) { console.error(err); toast("ما انحفظت"); }
  });
  on("unmuteF", "submit", async e => {
    e.preventDefault();
    const key = document.getElementById("unmuteName").value.trim().replace(/^@/, "").toLowerCase();
    if (!USER_RE.test(key)) return toast("اكتب يوزر صحيح");
    try {
      const u = await getDoc(doc(db, "usernames", key)); if (!u.exists()) return toast("ما لقينا هذا اليوزر");
      await updateDoc(doc(db, "users", u.data().uid), { warns: 0, mutedUntil: 0 });
      document.getElementById("unmuteName").value = ""; toast("تصفّرت تحذيراته وانفك كتمه ✅");
    } catch (err) { console.error(err); toast("ما زبط"); }
  });
  on("bnFile", "change", async e => {
    const f = e.target.files?.[0]; if (!f) return;
    toast("نرفع البنر…");
    try {
      const img = await shrinkBanner(f);
      const link = document.getElementById("bnLink").value.trim();
      await setDoc(doc(db, "config", "banner"), { img, link: /^https:\/\//.test(link) ? link : "", at: serverTimestamp() });
      toast("انرفع البنر 👌");
    } catch (err) { console.error(err); toast("ما قدرنا نرفع البنر، جرّب صورة ثانية"); }
  });
  on("bnLinkSave", "click", async () => {
    const link = document.getElementById("bnLink").value.trim();
    if (link && !/^https:\/\//.test(link)) return toast("الرابط لازم يبدأ بـ https://");
    try { await updateDoc(doc(db, "config", "banner"), { link }); toast("انحفظ الرابط"); } catch (err) { console.error(err); }
  });
  on("bnDel", "click", async e => {
    if (!confirmTap(e.currentTarget, "متأكد؟")) return;
    try { await deleteDoc(doc(db, "config", "banner")); toast("انشال البنر"); } catch (err) { console.error(err); }
  });
};
const safeJpeg = p => typeof p === "string" && p.startsWith("data:image/jpeg;base64,") ? p : "";
async function shrinkBanner(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = url; });
    const W = Math.min(1200, img.naturalWidth), H = Math.round(img.naturalHeight * W / img.naturalWidth);
    const c = document.createElement("canvas"); c.width = W; c.height = Math.min(H, 900);
    c.getContext("2d").drawImage(img, 0, 0, W, H);
    let q = .85, out = c.toDataURL("image/jpeg", q);
    while (out.length > 600000 && q > .35) { q -= .1; out = c.toDataURL("image/jpeg", q); }
    if (out.length > 900000) throw new Error("big");
    return out;
  } finally { URL.revokeObjectURL(url); }
}

VIEWS.loading = () => { V.innerHTML = `<div class="spinner" aria-label="جاري التحميل"></div>`; };

VIEWS.setup = () => {
  V.innerHTML = `<section>
    <div><h2>باقي خطوة الإعداد</h2>
    <p class="lead">اللعب أونلاين يشتغل بعد ما تلصق إعدادات Firebase في ملف firebase-config.js. الشرح في ملف اقرأني.</p></div>
    <div class="foot"><button class="btn" id="local">العب بجوال واحد</button></div></section>`;
  on("local", "click", () => go("local"));
};

VIEWS.auth = () => {
  V.innerHTML = `<section>
    <div class="hero">
      <div class="hero-icons" aria-hidden="true">
        <span class="hi hi1">${ICONS.imp}</span><span class="hi hi2">${ICONS.most}</span><span class="hi hi3">${ICONS.five}</span>
      </div>
      <h2>أهلًا في جلسة</h2>
      <p class="lead">ألعاب جلسات تلعبها مع أصحابك. أونلاين كل واحد من جواله، أو بجوال واحد يتمرر بينكم.</p>
      <ul class="perks"><li>الدخيل</li><li>مين أكثر واحد</li><li>خمسة بعشر</li></ul>
    </div>
    <div class="foot">
      <button class="btn google" id="login"><span class="g-logo" aria-hidden="true">${GOOGLE_G}</span>كمّل بحساب قوقل</button>
      <button class="btn ghost" id="byEmail">تسجيل الدخول</button>
      <div class="or"><span>أو</span></div>
      <button class="btn ghost" id="local">العب بدون حساب</button>
      <p class="hint center">بدون حساب تلعبون بجوال واحد. للعب أونلاين وإضافة الأصحاب تحتاج حساب.</p>
    </div></section>`;
  on("login", "click", login);
  on("byEmail", "click", () => { ui.emailMode = "login"; go("email"); });
  on("local", "click", () => go("local"));
};

const GOOGLE_G = `<svg viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>`;

const AUTH_ERR = {
  "auth/email-already-in-use": "هذا الإيميل مسجّل من قبل. سجّل دخول بدل ما تسوي حساب.",
  "auth/invalid-email": "الإيميل مكتوب غلط.",
  "auth/weak-password": "كلمة السر لازم ٨ خانات أو أكثر، وفيها حرف كبير واحد على الأقل.",
  "auth/invalid-credential": "الإيميل أو كلمة السر غلط.",
  "auth/wrong-password": "الإيميل أو كلمة السر غلط.",
  "auth/user-not-found": "ما فيه حساب بهذا الإيميل. سوّ حساب جديد.",
  "auth/too-many-requests": "محاولات كثيرة. انتظر شوي وجرّب مرة ثانية.",
  "auth/network-request-failed": "فيه مشكلة في الإنترنت.",
  "auth/operation-not-allowed": "التسجيل بالإيميل مو مفعّل في إعدادات اللعبة."
};

const EYE_ON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="12" r="3.2" fill="currentColor"/></svg>`;
const EYE_OFF = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="12" r="3.2" fill="currentColor"/><path d="M4 4l16 16" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>`;
const eyeBtn = id => `<button type="button" class="eye" data-for="${id}" aria-label="إظهار كلمة السر" aria-pressed="false">${EYE_ON}</button>`;

async function callAuth(body) {
  const r = await fetch(authUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, ...data };
}
const LOGIN_ERR = {
  bad: "اليوزر أو كلمة السر غلط.",
  google: "هذا الحساب مسجّل بقوقل. ادخل بزر قوقل.",
  tooMany: "محاولات كثيرة. انتظر شوي وجرّب مرة ثانية.",
  disabled: "هذا الحساب موقوف."
};

function bindEyes() {
  V.querySelectorAll(".eye").forEach(b => b.addEventListener("click", () => {
    const inp = document.getElementById(b.dataset.for);
    const show = inp.type === "password";
    inp.type = show ? "text" : "password";
    b.setAttribute("aria-pressed", show);
    b.setAttribute("aria-label", show ? "إخفاء كلمة السر" : "إظهار كلمة السر");
    b.innerHTML = show ? EYE_OFF : EYE_ON;
  }));
}

VIEWS.email = () => {
  const signup = ui.emailMode !== "login";
  if (!ui.loginBy) ui.loginBy = authUrl ? "username" : "email";
  const byUser = !signup && ui.loginBy === "username";
  V.innerHTML = `<section>
    <div><h2>${signup ? "إنشاء حساب" : "تسجيل الدخول"}</h2>
    <p class="lead">${signup ? "بعدها تختار يوزرك وتبدأ تضيف أصحابك." : byUser ? "ادخل بيوزرك وكلمة السر." : "ادخل بالإيميل وكلمة السر اللي سجلت فيها."}</p></div>
    <form class="field" id="emailF" novalidate>
      ${byUser ? `<label class="label" for="un">اليوزر</label>
      <div class="uinput"><span>@</span><input id="un" autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="21"></div>`
      : `<label class="label" for="em">الإيميل</label>
      <input class="txt" id="em" type="email" dir="ltr" autocomplete="email" autocapitalize="none" inputmode="email" placeholder="name@gmail.com">`}
      <label class="label" for="pw">كلمة السر</label>
      <div class="pwbox"><input class="txt" id="pw" type="password" dir="ltr" autocomplete="${signup ? "new-password" : "current-password"}" placeholder="${signup ? "Dalp2026" : ""}">${eyeBtn("pw")}</div>
      ${signup ? `<p class="hint" id="pwHint">٨ خانات أو أكثر، وفيها حرف إنجليزي كبير واحد على الأقل.</p>` : ""}
      ${signup ? `<label class="label" for="pw2">أكّد كلمة السر</label>
      <div class="pwbox"><input class="txt" id="pw2" type="password" dir="ltr" autocomplete="new-password">${eyeBtn("pw2")}</div>` : ""}
      <p class="hint msg-bad" id="emMsg" role="alert"></p>
      <button class="btn" id="emGo">${signup ? "إنشاء الحساب" : "دخول"}</button>
      ${signup ? "" : `<div class="links">
        <button type="button" class="link" id="forgot">نسيت كلمة السر؟</button>
        ${authUrl ? `<button type="button" class="link" id="switchBy">${byUser ? "نسيت اليوزر؟ ادخل بالإيميل" : "ادخل باليوزر"}</button>` : ""}
      </div>`}
    </form>
    <p class="switch">${signup ? "عندك حساب؟" : "ما عندك حساب؟"} <button type="button" class="link" id="switchMode">${signup ? "تسجيل الدخول" : "إنشاء حساب"}</button></p>
    <div class="foot"><button class="btn ghost" id="gInstead"><span class="g-logo" aria-hidden="true">${GOOGLE_G}</span>أو كمّل بقوقل</button>
      <p class="hint center">بتسجيلك توافق على <a class="link" href="privacy.html" target="_blank" rel="noopener">سياسة الخصوصية</a></p></div>
  </section>`;
  const msg = document.getElementById("emMsg");
  bindEyes();
  const pwIn = document.getElementById("pw"), pwHint = document.getElementById("pwHint");
  if (pwHint) pwIn.addEventListener("input", () => {
    const v = pwIn.value, okLen = v.length >= PW_MIN, okUp = HAS_UPPER.test(v);
    pwHint.className = "hint " + (!v ? "" : okLen && okUp ? "msg-ok" : "msg-bad");
    pwHint.textContent = !v ? "٨ خانات أو أكثر، وفيها حرف إنجليزي كبير واحد على الأقل."
      : (okLen ? "✓ ٨ خانات" : "✗ ٨ خانات أو أكثر") + "  ·  " + (okUp ? "✓ حرف كبير" : "✗ حرف كبير (A-Z)");
  });
  on("switchMode", "click", () => { ui.emailMode = signup ? "login" : "signup"; render(true); });
  on("switchBy", "click", () => { ui.loginBy = byUser ? "email" : "username"; render(true); });
  on("gInstead", "click", login);
  on("forgot", "click", () => go("forgot"));
  on("emailF", "submit", async e => {
    e.preventDefault();
    msg.className = "hint msg-bad"; msg.textContent = "";
    const pw = document.getElementById("pw").value;
    const btn = document.getElementById("emGo");
    const busy = on => { btn.disabled = on; btn.textContent = on ? "لحظة…" : (signup ? "إنشاء الحساب" : "دخول"); };
    if (byUser) {
      const un = document.getElementById("un").value.trim().replace(/^@/, "");
      if (!USER_RE.test(un)) { msg.textContent = "اكتب يوزرك صح."; return; }
      if (!pw) { msg.textContent = "اكتب كلمة السر."; return; }
      busy(true);
      try {
        const r = await callAuth({ action: "login", username: un, password: pw });
        if (!r.ok || !r.email) { busy(false); msg.textContent = LOGIN_ERR[r.error] || "ما زبط، جرّب مرة ثانية."; return; }
        await signInWithEmailAndPassword(auth, r.email, pw);
      } catch (err) {
        busy(false); msg.textContent = AUTH_ERR[err.code] || "فيه مشكلة في الاتصال، جرّب مرة ثانية.";
      }
      return;
    }
    const em = document.getElementById("em").value.trim();
    if (!/^\S+@\S+\.\S+$/.test(em)) { msg.textContent = AUTH_ERR["auth/invalid-email"]; return; }
    if (signup && (pw.length < PW_MIN || !HAS_UPPER.test(pw))) { msg.textContent = AUTH_ERR["auth/weak-password"]; return; }
    if (!signup && !pw) { msg.textContent = "اكتب كلمة السر."; return; }
    if (signup && pw !== document.getElementById("pw2").value) { msg.textContent = "كلمتين السر مو نفس بعض."; return; }
    busy(true);
    try {
      if (signup) await createUserWithEmailAndPassword(auth, em, pw);
      else await signInWithEmailAndPassword(auth, em, pw);
    } catch (err) {
      busy(false); msg.textContent = AUTH_ERR[err.code] || "ما زبط، جرّب مرة ثانية.";
    }
  });
};

VIEWS.forgot = () => {
  V.innerHTML = `<section>
    <div><h2>نسيت كلمة السر؟</h2>
    <p class="lead">اكتب ${authUrl ? "إيميلك أو يوزرك" : "إيميلك"}، ونرسل لك رابط تغيّر فيه كلمة السر.</p></div>
    <form class="field" id="fgF" novalidate>
      <label class="label" for="fg">${authUrl ? "الإيميل أو اليوزر" : "الإيميل"}</label>
      <input class="txt" id="fg" dir="ltr" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="${authUrl ? "الإيميل أو اليوزر" : "name@gmail.com"}">
      <p class="hint" id="fgMsg" role="status"></p>
      <button class="btn" id="fgGo">أرسل الرابط</button>
    </form>
    <div class="foot"><button class="btn ghost" id="fgBack">رجوع لتسجيل الدخول</button></div>
  </section>`;
  const msg = document.getElementById("fgMsg"), btn = document.getElementById("fgGo");
  on("fgBack", "click", () => { ui.emailMode = "login"; go("email"); });
  on("fgF", "submit", async e => {
    e.preventDefault();
    const v = document.getElementById("fg").value.trim();
    msg.className = "hint msg-bad";
    const isEmail = v.includes("@") && /^\S+@\S+\.\S+$/.test(v);
    if (!isEmail && !(authUrl && USER_RE.test(v.replace(/^@/, "")))) {
      msg.textContent = authUrl ? "اكتب إيميلك أو يوزرك صح." : "اكتب إيميلك صح."; return;
    }
    btn.disabled = true; btn.textContent = "لحظة…";
    try {
      if (isEmail) await sendPasswordResetEmail(auth, v).catch(err => { if (err.code === "auth/too-many-requests" || err.code === "auth/network-request-failed") throw err; });
      else { const r = await callAuth({ action: "reset", username: v.replace(/^@/, "") }); if (!r.ok) throw new Error("server"); }
      msg.className = "hint msg-ok";
      msg.innerHTML = "إذا عندك حساب بالإيميل وكلمة سر، بيوصلك إيميل خلال دقايق فيه رابط تغيّر منه كلمة السر.<br>📥 <b>شيّك على البريد المزعج (Junk / Spam)</b>، غالبًا يروح هناك.<br>🔵 إذا كنت مسجّل بقوقل، ما عندك كلمة سر: ارجع واضغط «كمّل بقوقل».";
      btn.textContent = "انرسل ✓";
    } catch (err) {
      btn.disabled = false; btn.textContent = "أرسل الرابط";
      msg.textContent = AUTH_ERR[err.code] || "ما قدرنا نرسل الرابط، جرّب بعد شوي.";
    }
  });
};

/* ================= تغيير اليوزر ================= */
const RENAME_DAYS = 30;
function renameWait() {
  const t = me?.renamedAt?.toMillis?.(); if (!t) return 0;
  return Math.max(0, t + RENAME_DAYS * 864e5 - Date.now());
}
async function changeUsername(name) {
  const oldKey = me.username.toLowerCase(), newKey = name.toLowerCase();
  await runTransaction(db, async tx => {
    const ref = doc(db, "usernames", newKey);
    if (newKey !== oldKey) {
      const s = await tx.get(ref);
      if (s.exists()) throw { code: "taken" };
      tx.set(ref, { uid: me.uid });
      tx.delete(doc(db, "usernames", oldKey));
    }
    tx.update(doc(db, "users", me.uid), { username: name, usernameChangedAt: serverTimestamp() });
  });
}

VIEWS.rename = () => {
  if (isOwner()) { go("profile"); return; }
  const wait = renameWait();
  const days = Math.ceil(wait / 864e5);
  V.innerHTML = `<section>
    <div><h2>غيّر يوزرك</h2>
    <p class="lead">يوزرك الحين <b dir="ltr">@${esc(me.username)}</b>. تقدر تغيّره مرة كل ${ar(RENAME_DAYS)} يوم، ويوزرك القديم يصير متاح لغيرك.</p></div>
    ${wait ? `<div class="li"><span class="nm">تقدر تغيّره بعد ${days === 1 ? "يوم" : days === 2 ? "يومين" : ar(days) + (days <= 10 ? " أيام" : " يوم")}</span></div>` : `
    <div class="field"><label class="label" for="uname">اليوزر الجديد</label>
      <div class="uinput"><span>@</span><input id="uname" autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="20"></div>
      <p class="hint" id="unameMsg">${UNAME_HINT}</p></div>
    ${roomCode ? `<p class="hint msg-bad">اطلع من الغرفة أول، وبعدها غيّر يوزرك.</p>` : ""}
    <div class="foot"><button class="btn" id="claim" disabled>غيّر اليوزر</button></div>`}
  </section>`;
  if (wait) return;
  const inp = document.getElementById("uname"), msg = document.getElementById("unameMsg"), btn = document.getElementById("claim");
  const check = () => {
    const v = inp.value.replace(/\s+/g, "");
    if (v !== inp.value) inp.value = v;
    const ok = USER_RE.test(v) && HAS_UPPER.test(v) && !RESERVED.has(v.toLowerCase()) && v.toLowerCase() !== OWNER && v !== me.username && !roomCode;
    btn.disabled = !ok;
    if (!v) { msg.className = "hint"; msg.textContent = UNAME_HINT; }
    else if (/[^A-Za-z0-9_-]/.test(v)) { msg.className = "hint msg-bad"; msg.textContent = "مسموح بس: حروف إنجليزية وأرقام و _ و -"; }
    else if (v.length < 3) { msg.className = "hint msg-bad"; msg.textContent = "اليوزر لازم يكون ٣ خانات أو أكثر"; }
    else if (!HAS_UPPER.test(v)) { msg.className = "hint msg-bad"; msg.textContent = "لازم فيه حرف كبير واحد على الأقل، مثل D-A-L-P"; }
    else if (RESERVED.has(v.toLowerCase()) || v.toLowerCase() === OWNER) { msg.className = "hint msg-bad"; msg.textContent = "هذا اليوزر محجوز، جرّب غيره"; }
    else if (v === me.username) { msg.className = "hint msg-bad"; msg.textContent = "هذا يوزرك الحالي"; }
    else { msg.className = "hint msg-ok"; msg.textContent = "@" + v + " شكله حلو"; }
  };
  inp.addEventListener("input", check); check();
  btn.addEventListener("click", async e => {
    const name = inp.value;
    if (btn.disabled) return;
    if (!confirmTap(btn, "متأكد؟ ما تقدر تغيّره ثاني إلا بعد " + ar(RENAME_DAYS) + " يوم")) return;
    btn.disabled = true; btn.textContent = "لحظة…";
    try {
      await changeUsername(name);
      me.username = name; me.renamedAt = { toMillis: () => Date.now() };
      toast("صار يوزرك @" + name); go("profile");
    } catch (err) {
      btn.disabled = false; btn.dataset.armed = ""; btn.textContent = "غيّر اليوزر";
      if (err?.code === "taken") { msg.className = "hint msg-bad"; msg.textContent = "@" + name + " محجوز، جرّب غيره"; }
      else { console.error(err); toast("ما قدرنا نغيّر اليوزر"); }
    }
  });
};

/* ================= الترحيب وشرح اللعبة ================= */
const SLIDES = [
  { art: "local", t: "أهلًا فيك في جلسة 👋", d: "ألعاب جلسات عربية تلعبها مع أصحابك. خلنا نوريك كيف تمشي في دقيقة." },
  { art: "create", t: "العب أونلاين", d: "سوّ غرفة، وأرسل الكود أو رابط الدعوة لأصحابك. كل واحد يلعب من جواله." },
  { art: "imp", t: "الألعاب", d: "الدخيل، مين أكثر واحد، إنسان حيوان نبات جماد، وخمسة بعشر. تلقاها كلها في الصفحة الرئيسية تحت «الألعاب»." },
  { art: "friends", t: "أصحابك والرسائل", d: "من زر «أضف صديق» فوق، أضف أصحابك بيوزراتهم. وبعدها تقدر تراسلهم في الخاص 💬، وتسولف معهم في شات الغرفة." },
  { art: "five", t: "بجوال واحد", d: "ما عندكم نت أو قاعدين مع بعض؟ العبوا كل الألعاب على جوال واحد يتمرر بينكم." }
];
VIEWS.welcome = () => {
  const i = Math.min(ui.slide || 0, SLIDES.length - 1), sl = SLIDES[i], last = i === SLIDES.length - 1;
  V.innerHTML = `<section class="welcome">
    <div class="wl-top"><span class="wl-step">${ar(i + 1)} / ${ar(SLIDES.length)}</span>${last ? "" : `<button class="link" id="wlSkip">تخطي</button>`}</div>
    <div class="wl-art pop">${ICONS[sl.art]}</div>
    <h2 class="center">${sl.t}</h2>
    <p class="lead center wl-d">${sl.d}</p>
    <div class="wl-dots" aria-hidden="true">${SLIDES.map((_, k) => `<i class="${k === i ? "on" : ""}"></i>`).join("")}</div>
    <div class="foot">
      <button class="btn" id="wlNext">${last ? "يلا نبدأ 🎉" : "التالي"}</button>
      ${i > 0 ? `<button class="btn ghost" id="wlPrev">السابق</button>` : ""}
    </div></section>`;
  const done = () => { store.set("welcomed:" + me?.uid, true); ui.slide = 0; afterLogin(); };
  on("wlSkip", "click", done);
  on("wlNext", "click", () => { if (last) done(); else { ui.slide = i + 1; render(true); } });
  on("wlPrev", "click", () => { ui.slide = i - 1; render(true); });
};

const UNAME_HINT = "حروف إنجليزية وأرقام و _ و - ، من ٣ إلى ٢٠ خانة، وفيه حرف كبير واحد على الأقل.";

VIEWS.username = () => {
  V.innerHTML = `<section>
    <div><h2>اختر يوزرك</h2><p class="lead">أصحابك يضيفونك فيه. ما تقدر تغيّره بعدين، فاختره زين.</p></div>
    <div class="field"><label class="label" for="uname">اليوزر</label>
      <div class="uinput"><span>@</span><input id="uname" autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="20"></div>
      <p class="hint" id="unameMsg">${UNAME_HINT}</p></div>
    <div class="foot"><button class="btn" id="claim" disabled>اعتمد اليوزر</button>
    <button class="btn ghost" id="logout">تسجيل خروج</button></div></section>`;
  const inp = document.getElementById("uname"), msg = document.getElementById("unameMsg"), btn = document.getElementById("claim");
  const check = () => {
    const v = inp.value.replace(/\s+/g, "");
    if (v !== inp.value) inp.value = v;
    const ok = USER_RE.test(v) && HAS_UPPER.test(v) && (!RESERVED.has(v.toLowerCase()) || v.toLowerCase() === OFFICIAL);
    btn.disabled = !ok;
    if (!v) { msg.className = "hint"; msg.textContent = UNAME_HINT; }
    else if (/[^A-Za-z0-9_-]/.test(v)) { msg.className = "hint msg-bad"; msg.textContent = "مسموح بس: حروف إنجليزية وأرقام و _ و -"; }
    else if (v.length < 3) { msg.className = "hint msg-bad"; msg.textContent = "اليوزر لازم يكون ٣ خانات أو أكثر"; }
    else if (!HAS_UPPER.test(v)) { msg.className = "hint msg-bad"; msg.textContent = "لازم فيه حرف كبير واحد على الأقل، مثل D-A-L-P"; }
    else if (v.toLowerCase() === OFFICIAL) { msg.className = "hint"; msg.textContent = "هذا يوزر الحساب الرسمي، يشتغل بس على الإيميل الرسمي."; }
    else if (RESERVED.has(v.toLowerCase())) { msg.className = "hint msg-bad"; msg.textContent = "هذا اليوزر محجوز، جرّب غيره"; }
    else { msg.className = "hint msg-ok"; msg.textContent = "@" + v + " شكله حلو"; }
  };
  inp.addEventListener("input", check); check();
  btn.addEventListener("click", async () => {
    const name = inp.value;
    if (!USER_RE.test(name) || !HAS_UPPER.test(name) || (RESERVED.has(name.toLowerCase()) && name.toLowerCase() !== OFFICIAL)) return;
    btn.disabled = true; btn.textContent = "لحظة…";
    try {
      await claimUsername(name);
      me.username = name;
      startGlobal(); rememberAccount(); ui.slide = 0; go("welcome");
    } catch (e) {
      btn.disabled = false; btn.textContent = "اعتمد اليوزر";
      if (e?.code === "taken") { msg.className = "hint msg-bad"; msg.textContent = "@" + name + " محجوز، جرّب غيره"; }
      else if (name.toLowerCase() === OFFICIAL) { msg.className = "hint msg-bad"; msg.textContent = "هذا اليوزر للحساب الرسمي بس، ويشتغل على إيميله الرسمي."; }
      else { console.error(e); toast("ما قدرنا نحفظ اليوزر"); }
    }
  });
  on("logout", "click", () => signOut(auth));
};

/* ================= 🤖 بوت جلسة: يمنع السب والقذف ================= */
// السب القوي بس (القذف والكلام الجنسي). السب الخفيف مسموح
const BAD_HARD = ["شرموط","شرموطه","شراميط","قحبه","قحاب","عاهره","عاهر","منيوك","منيوكه","منيك","متناك","متناكه","نيك","انيك","ينيك","تنيك","نيكك","انيكك","مناكه","كس","كسك","كسمك","كسختك","كسخت","كسامك","زب","زبي","زبك","خول","لوطي","لوطيه","ديوث","معرص","عرص","عرصه","زاني","زانيه","ولد زنا","ابن زنا","بنت زنا","ابن الحرام","ولد الحرام","بنت الحرام","fuck","fucking","fucker","motherfucker","bitch","whore","slut","pussy","cunt","nigga","nigger","fag","faggot"];
const BAD_SOFT = []; // السب الخفيف مسموح
const botNorm = t => String(t || "").toLowerCase()
  .replace(/[ً-ْـ]/g, "").replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/ؤ/g, "و").replace(/ئ/g, "ي")
  .replace(/[0@]/g, "o").replace(/[1!|]/g, "i").replace(/3/g, "e").replace(/\$/g, "s")
  .replace(/[^a-zء-ي\s]/g, " ").replace(/(.)\1{2,}/g, "$1$1").replace(/\s+/g, " ").trim();
const one = w => w.replace(/(.)\1+/g, "$1");
const HARD_SET = new Set(BAD_HARD.map(botNorm).filter(w => !w.includes(" ")).flatMap(w => [w, one(w)]));
const HARD_MULTI = BAD_HARD.map(botNorm).filter(w => w.includes(" "));
const SOFT_SET = new Set(BAD_SOFT.map(botNorm).flatMap(w => [w, one(w)]));
const SOFT_PRE = ["يا", "ابن", "بنت", "ولد", "يابن", "يابنت", "ياولد", "انت", "انتي"];
const isHard = w => stripPre(w).some(v => HARD_SET.has(v) || HARD_SET.has(one(v)));
const isSoft = w => stripPre(w).some(v => SOFT_SET.has(v) || SOFT_SET.has(one(v)));
const stripPre = w => { const out = [w]; let x = w;
  for (const pre of ["وال", "بال", "يال", "ال", "و", "ب", "يا"]) if (x.startsWith(pre) && x.length - pre.length >= 2) out.push(x.slice(pre.length));
  return out; };
function botBad(text) {
  const n = botNorm(text); if (!n) return false;
  const toks = n.split(" ");
  // حروف مفرّقة: ك ل ب
  const joined = toks.reduce((a, w) => { if (w.length === 1) a[a.length - 1] += w; else a.push(w, ""); return a; }, [""]).filter(x => x.length > 1);
  const all = [...toks, ...joined];
  for (const w of all) {
    if (isHard(w)) return true;
    if (w.startsWith("يا") && isSoft(w.slice(2))) return true;
  }
  for (let i = 0; i < toks.length - 1; i++) if (SOFT_PRE.includes(toks[i]) && isSoft(toks[i + 1])) return true;
  return HARD_MULTI.some(m => (" " + n + " ").includes(" " + m + " "));
}
// يغطي الكلمات الممنوعة في رسايل غيرك (لو أحد تحايل)
function censor(text) {
  if (!botBad(text)) return text;
  let prev = "";
  const out = String(text).split(/(\s+)/).map(w => {
    if (!w.trim()) return w;
    const n = botNorm(w), bad = n && (isHard(n) || (n.startsWith("يا") && isSoft(n.slice(2))) || (SOFT_PRE.includes(prev) && isSoft(n)));
    prev = n;
    return bad ? "✱".repeat(Math.min(6, w.length)) : w;
  }).join("");
  return botBad(out) ? "✱✱✱" : out;
}
const isMuted = () => (me?.mutedUntil || 0) > Date.now();
const muteLeft = () => { const m = Math.ceil(((me?.mutedUntil || 0) - Date.now()) / 60000); return m >= 60 ? `${ar(Math.ceil(m / 60))} ساعة` : `${ar(Math.max(1, m))} دقيقة`; };
function botSheet(title, body) {
  document.getElementById("botSheet")?.remove();
  const el = document.createElement("div");
  el.id = "botSheet"; el.className = "sheet-bg"; el.setAttribute("role", "alertdialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "بوت جلسة");
  el.innerHTML = `<div class="sheet bot-sheet"><span class="bot-av" aria-hidden="true">🤖</span><b class="pf-name">${title}</b><p class="pf-bio">${body}</p><button class="btn" id="botOk">فاهم 👍</button></div>`;
  document.body.appendChild(el);
  el.querySelector("#botOk").addEventListener("click", () => el.remove());
  el.querySelector("#botOk").focus({ preventScroll: true });
}
async function botWarn(text) {
  const warns = (me.warns || 0) + 1;
  const upd = { warns };
  if (warns >= 3) upd.mutedUntil = Math.max(me.mutedUntil || 0, Date.now()) + 24 * 3600 * 1000;
  try { await updateDoc(doc(db, "users", me.uid), upd); } catch (e) { console.error(e); }
  me.warns = warns; if (upd.mutedUntil) me.mutedUntil = upd.mutedUntil;
  if (warns >= 3) {
    addDoc(collection(db, "reports"), { by: me.uid, byName: me.username, target: me.uid, targetName: me.username, why: "🤖 البوت: سب متكرر وانكتم",
      text: "", msgs: String(text).slice(0, 300), room: roomCode || "", at: serverTimestamp() }).catch(() => {});
    botSheet("انكتمت ٢٤ ساعة 🔇", `هذا التحذير رقم ${ar(warns)}. ما تقدر تكتب في الشات لمدة ${muteLeft()}. واللعب عادي تقدر تكمّله.`);
  } else botSheet(`تحذير ${ar(warns)} من ٣ ⚠️`, "ممنوع القذف والكلام البذيء في جلسة. رسالتك ما انرسلت.<br>بعد التحذير الثالث تنكتم ٢٤ ساعة.");
}
// كل نص يطلع لغيرك يمر من هنا. يرجع true لو مسموح
async function botGate(text) {
  if (isMuted()) { botSheet("أنت مكتوم 🔇", `باقي على فك الكتم: ${muteLeft()}.`); return false; }
  if (botBad(text)) { await botWarn(text); return false; }
  return true;
}

/* ================= الطرد والبلاغ والحظر ================= */
const blocked = new Set(store.get("blocked", []));
const isBlocked = u => blocked.has(u);
function toggleBlock(uid, name) {
  if (blocked.has(uid)) { blocked.delete(uid); toast("انفك الحظر عن @" + name); }
  else { blocked.add(uid); toast("حظرت @" + name + "، ما راح تشوف رسايله"); }
  store.set("blocked", [...blocked]);
  updateRoomChat(); refresh();
}
async function kickPlayer(uid) {
  if (!isHost() || !room?.players?.[uid] || uid === me.uid) return;
  const name = pname(uid);
  try { await updateDoc(roomRef(), { [`players.${uid}`]: deleteField(), [`kicked.${uid}`]: true }); toast("انطرد @" + name); }
  catch (e) { console.error(e); toast("ما قدرنا نطرده"); }
}
const REPORT_WHY = ["كلام مسيء أو سب", "إزعاج أو سبام", "محتوى غير لائق", "غش في اللعب", "شي ثاني"];
function openReport(uid, name) {
  document.getElementById("repSheet")?.remove();
  const el = document.createElement("div");
  el.id = "repSheet"; el.className = "sheet-bg"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "بلّغ عن لاعب");
  el.innerHTML = `<div class="sheet"><b class="pf-name">🚩 بلّغ عن <span dir="ltr">@${esc(name)}</span></b>
    <p class="pf-bio">وش المشكلة؟ البلاغ يوصل لإدارة جلسة، ومحد يعرف إنك أنت اللي بلّغت.</p>
    <div class="chips rep-why">${REPORT_WHY.map((w, i) => `<button class="chip" data-why="${i}" aria-pressed="false">${w}</button>`).join("")}</div>
    <textarea class="txt" id="repTxt" rows="2" maxlength="200" dir="auto" placeholder="تفاصيل (اختياري)"></textarea>
    <button class="btn danger" id="repGo" disabled>أرسل البلاغ</button>
    <button class="btn ghost" id="repX">إلغاء</button></div>`;
  document.body.appendChild(el);
  let why = null;
  const close = () => el.remove();
  el.addEventListener("click", e => { if (e.target === el) close(); });
  el.querySelector("#repX").addEventListener("click", close);
  el.querySelectorAll("[data-why]").forEach(b => b.addEventListener("click", () => {
    why = REPORT_WHY[Number(b.dataset.why)];
    el.querySelectorAll("[data-why]").forEach(x => x.setAttribute("aria-pressed", x === b));
    el.querySelector("#repGo").disabled = false;
  }));
  el.querySelector("#repGo").addEventListener("click", async e => {
    const btn = e.currentTarget; btn.disabled = true; btn.textContent = "لحظة…";
    const recent = roomChat.filter(m => m.uid === uid).slice(-3).map(m => m.text).join(" | ").slice(0, 300);
    try {
      await addDoc(collection(db, "reports"), { by: me.uid, byName: me.username, target: uid, targetName: name, why,
        text: cleanMsg(document.getElementById("repTxt").value).slice(0, 200), msgs: recent, room: roomCode || "", at: serverTimestamp() });
      close(); toast("وصل البلاغ، شكرًا 🙏");
    } catch (err) { console.error(err); btn.disabled = false; btn.textContent = "أرسل البلاغ"; toast("ما انرسل البلاغ"); }
  });
}

/* ================= الغرف العامة ================= */
const PUB_ALIVE = 150000;
function watchPub() {
  if (subs.has("pub")) return;
  sub("pub", onSnapshot(query(collection(db, "rooms"), where("listed", "==", true), limit(40)), q => {
    pubRooms = q.docs.map(d => ({ code: d.id, ...d.data() }));
    if (screen === "pub") render(false);
  }, e => { console.error(e); pubRooms = []; if (screen === "pub") render(false); }));
}
VIEWS.pub = () => {
  watchPub();
  const now = Date.now();
  const list = (pubRooms || []).filter(r => r.phase === "lobby" && r.public && now - (r.ping || 0) < PUB_ALIVE && Object.keys(r.players || {}).length < 12 && GAMES[r.game])
    .sort((a, b) => Object.keys(b.players).length - Object.keys(a.players).length);
  const icon = g => ICONS[CATALOG.find(c => c.id === g)?.icon || "imp"];
  V.innerHTML = `<section>
    <div><h2>غرف عامة 🌍</h2><p class="lead">ادخل أي غرفة والعب مع ناس جدد.</p></div>
    ${pubRooms === null ? `<div class="spinner" aria-label="جاري التحميل"></div>`
      : list.length ? `<div class="list">${list.map(r => {
        const n = Object.keys(r.players).length, need = minPlayers(r.game);
        return `<div class="pubroom"><span class="pr-ic">${icon(r.game)}</span>
          <div class="pr-t"><b>${GAMES[r.game]}</b><span class="hint" dir="ltr">${at(r.hostName || r.players[r.host]?.name || "")}</span>
          <span class="pr-n">${ar(n)} من ١٢ لاعب${n < need ? ` · يحتاجون ${ar(need - n)} 👀` : ""}</span></div>
          <button class="btn small" data-pjoin="${esc(r.code)}">${roomCode === r.code ? "ارجع" : "ادخل"}</button></div>`;
      }).join("")}</div>`
      : `<div class="card" style="min-height:200px"><span class="big">🌙</span><span class="mid">ما فيه غرف عامة الحين</span><span class="hint">سوّ وحدة، وخل الناس يدخلون عندك!</span></div>`}
    <div class="foot">
      <button class="btn" id="pubNew">${roomCode ? "ارجع لغرفتك" : "سوّ غرفة عامة"}</button>
      <p class="hint center">احترم الناس في الغرف العامة. أي أحد يسيء ينحظر 🚫</p>
    </div></section>`;
  onAll("[data-pjoin]", b => { b.disabled = true; joinRoom(b.dataset.pjoin); });
  on("pubNew", "click", () => { if (roomCode) return go("room"); ui.makePublic = true; createRoom("draw"); });
};

/* ================= الإشعارات ================= */
const VAPID = "BKamZekNiEBI9VTRRKJThJbC4WMA0HQXzCMkZMOPJx9U1Ew2kci-bIMtyW8yD7ohWd14VDf_ab2Tf3-xxrdvhuw";
const PUSH_URL = "https://jalsah-push.baselbadawood17.workers.dev"; // سيرفر Cloudflare
const pushLast = {};
// نطلب من السيرفر يرسل إشعار. الرسائل: مرة كل دقيقة لنفس الشخص بس
function pushNotify(to, kind) {
  if (!PUSH_URL || !to || !auth?.currentUser || auth.currentUser.isAnonymous) return;
  const k = kind + to;
  if (kind === "dm" && Date.now() - (pushLast[k] || 0) < 60e3) return;
  pushLast[k] = Date.now();
  auth.currentUser.getIdToken().then(t => fetch(PUSH_URL, { method: "POST", headers: { Authorization: "Bearer " + t, "Content-Type": "application/json" }, body: JSON.stringify({ to, kind }) })).catch(() => {});
}
const pushState = () => !("Notification" in window) || !("serviceWorker" in navigator) ? (isIOS() && !isStandalone() ? "ios" : "no") : Notification.permission;
async function pushSaveToken(quiet) {
  try {
    if (!(await pushSupported())) throw new Error("unsupported");
    const reg = await navigator.serviceWorker.register("./sw.js");
    await navigator.serviceWorker.ready;
    const token = await getToken(getMessaging(), { vapidKey: VAPID, serviceWorkerRegistration: reg });
    if (!token || !me?.uid) return false;
    const ref = doc(db, "pushTokens", me.uid);
    const cur = await getDoc(ref).catch(() => null);
    const list = (cur?.exists() ? cur.data().tokens || [] : []).filter(t => t !== token);
    list.push(token);
    if (!cur?.exists() || (cur.data().tokens || []).at(-1) !== token) await setDoc(ref, { tokens: list.slice(-5), at: serverTimestamp() });
    return true;
  } catch (e) { if (!quiet) console.error(e); return false; }
}
async function enablePush() {
  const st = pushState();
  if (st === "ios") { toast("أضف جلسة للشاشة الرئيسية أول، وافتحها من هناك"); doInstall(); return; }
  if (st === "no") return toast("جهازك أو متصفحك ما يدعم الإشعارات");
  if (st === "denied") return toast("الإشعارات مقفلة. فعّلها من إعدادات الجوال لجلسة");
  const p = await Notification.requestPermission();
  if (p !== "granted") { render(false); return toast("ما تفعّلت الإشعارات"); }
  toast("لحظة…");
  if (await pushSaveToken()) { store.set("pushOk", 1); toast("تفعّلت الإشعارات 🔔"); } else toast("ما قدرنا نفعّلها، جرّب مرة ثانية");
  render(false);
}
const showPushCard = () => me?.uid && ["default", "ios"].includes(pushState()) && Date.now() - store.get("pushHide", 0) > 3 * 864e5;

/* ================= صفحة المتجر ================= */
const shopBase = () => /^https:\/\//.test(shopCfg?.base || "") ? shopCfg.base : "https://jalsah.rmz.gg";
const shopLink = id => { const l = shopCfg?.links?.[id]; return /^https:\/\//.test(l || "") ? l : shopBase(); };
function shopPreview(it) {
  const g = it.grants || [];
  if (it.id === "king") return `<span class="sp-king">👑</span>`;
  if (it.days && !g.length) return `<span class="sp-vip">VIP</span>`;
  if (g[0] === "t_royal") return tableSVG("royal");
  if (g[0] === "b_royal") return `<span class="sp-back">${cardSVG(null, "royal")}</span>`;
  if (FRAMES[g[0]]) return `<span class="fr ${g[0]}" style="--fs:4px">${avatar(me.username, me.photo, 64)}</span>`;
  return "";
}
function fmtCode(raw) {
  const s = String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
  return s.match(/.{1,4}/g)?.join("-") || "";
}
async function redeemCode(raw) {
  const code = fmtCode(raw);
  if (code.length !== 14) return toast("اكتب الكود كامل (١٢ حرف ورقم)");
  try {
    let got = null;
    await runTransaction(db, async tx => {
      const cref = doc(db, "codes", code), uref = doc(db, "users", me.uid);
      const c = await tx.get(cref);
      if (!c.exists()) throw { code: "nf" };
      if (c.data().by) throw { code: "used" };
      const u = await tx.get(uref);
      const cur = u.data() || {};
      const owned = [...new Set([...(cur.owned || []), ...(c.data().grants || [])])];
      const base = Math.max(cur.vipUntil || 0, Date.now());
      const days = c.data().days || 0;
      const upd = { owned, lastCode: code };
      if (days) upd.vipUntil = base + days * 864e5 - 5 * 60e3;
      tx.update(uref, upd);
      tx.update(cref, { by: me.uid, usedAt: serverTimestamp() });
      got = { item: c.data().item, owned, vipUntil: upd.vipUntil };
    });
    me.owned = got.owned; if (got.vipUntil) me.vipUntil = got.vipUntil;
    const it = SHOP.find(x => x.id === got.item);
    toast(`🎉 انفتح لك: ${it ? it.name : "الشي اللي شريته"}`);
    const inp = document.getElementById("codeIn"); if (inp) inp.value = "";
    render(false);
  } catch (e) {
    if (e?.code === "nf") toast("الكود غلط، تأكد منه");
    else if (e?.code === "used") toast("هذا الكود مستخدم من قبل");
    else { console.error(e); toast("ما زبط، جرّب مرة ثانية"); }
  }
}
VIEWS.shop = () => {
  const p = prof(me.uid), vip = vipOn(p);
  V.innerHTML = `<section>
    <div><h2>متجر جلسة 🛍️</h2><p class="lead">تميّز قدام أصحابك. تشتري من متجر جلسة، ويوصلك كود تكتبه هنا.</p></div>
    <form class="redeem" id="codeF">
      <span class="label">عندك كود؟</span>
      <div class="row"><input class="txt" id="codeIn" dir="ltr" maxlength="14" placeholder="XXXX-XXXX-XXXX" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="الكود">
      <button class="btn small">فعّل</button></div>
    </form>
    ${vip ? `<div class="vipbox">👑 أنت VIP لين <b>${new Date(p.vipUntil).toLocaleDateString("ar-SA", { day: "numeric", month: "long", year: "numeric" })}</b>، وكل الحصريات مفتوحة لك.</div>` : ""}
    <div class="shop">${SHOP.map(it => {
      const mine = it.grants.length && it.grants.every(g => owns(p, g)) && !it.days;
      return `<div class="sitem ${it.hot ? "hot" : ""}">
        ${it.hot ? `<span class="s-hot">الأقوى 🔥</span>` : ""}
        <div class="s-pv">${shopPreview(it)}</div>
        <b class="s-name">${it.name}</b><span class="s-desc">${it.desc}</span>
        ${mine ? `<span class="s-own">✓ عندك</span>` : !shopLink(it.id) ? `<button class="btn small ghost" disabled><span>قريبًا</span><span class="s-price">${ar(it.price)} ريال</span></button>` : `<a class="btn small" href="${esc(shopLink(it.id))}" target="_blank" rel="noopener"><span>اشترِ</span><span class="s-price">${ar(it.price)} ريال</span></a>`}
      </div>`; }).join("")}</div>
    <p class="hint center">بعد الدفع يوصلك الكود من المتجر. انسخه واكتبه فوق في «عندك كود؟».</p>
  </section>`;
  const inp = document.getElementById("codeIn");
  inp.addEventListener("input", () => { const v = fmtCode(inp.value); if (v !== inp.value) inp.value = v; });
  on("codeF", "submit", e => { e.preventDefault(); redeemCode(inp.value); });
};

/* ================= ثبّت جلسة على الشاشة ================= */
let installEvt = null;
const isStandalone = () => window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone === true;
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const inAppBrowser = () => /Snapchat|Instagram|FBAN|FBAV|WhatsApp|TikTok|musical_ly|Twitter/i.test(navigator.userAgent);
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); installEvt = e; if (screen === "home") render(false); });
window.addEventListener("appinstalled", () => { installEvt = null; store.set("instHide", Date.now()); toast("انثبّتت جلسة 🎉"); if (screen === "home") render(false); });
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
function showInstallCard() {
  if (isStandalone()) return false;
  const hid = store.get("instHide", 0);
  if (hid && Date.now() - hid < 7 * 864e5) return false;
  return !!installEvt || isIOS();
}
const SHARE_IC = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7 8l5-5 5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
const ADD_IC = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 8v8M8 12h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
async function doInstall() {
  if (installEvt) {
    installEvt.prompt();
    try { const r = await installEvt.userChoice; if (r?.outcome === "accepted") store.set("instHide", Date.now()); } catch (e) {}
    installEvt = null; render(false); return;
  }
  document.getElementById("instSheet")?.remove();
  const el = document.createElement("div");
  el.id = "instSheet"; el.className = "sheet-bg"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "ثبّت جلسة");
  el.innerHTML = `<div class="sheet"><img src="icon-180.png" alt="" width="72" height="72" style="border-radius:18px">
    <b class="pf-name">ثبّت جلسة على شاشتك</b>
    ${inAppBrowser() ? `<p class="pf-bio">أنت فاتحها من داخل تطبيق (سناب أو واتساب…). افتح الرابط في <b>Safari</b> أول، بعدين سوّ الخطوات.</p>` : ""}
    <ol class="ios-steps">
      <li>${SHARE_IC}<span>اضغط زر <b>المشاركة</b> تحت الشاشة (المربع اللي فيه سهم لفوق)</span></li>
      <li>${ADD_IC}<span>انزل واختر <b>«إضافة إلى الشاشة الرئيسية»</b></span></li>
      <li><span>اضغط <b>«إضافة»</b> فوق، وتطلع لك أيقونة جلسة 🎉</span></li>
    </ol>
    ${inAppBrowser() ? `<button class="btn" id="instCopy">انسخ الرابط</button>` : ""}
    <button class="btn ghost" id="instX">تمام</button></div>`;
  document.body.appendChild(el);
  const close = () => el.remove();
  el.addEventListener("click", e => { if (e.target === el) close(); });
  el.querySelector("#instX").addEventListener("click", close);
  el.querySelector("#instCopy")?.addEventListener("click", () => copyText(appLink(), "انسخ الرابط، الصقه في Safari"));
}

VIEWS.home = () => {
  const onl = [...friends.entries()].filter(([, f]) => isOnline(f));
  V.innerHTML = `<section>
    <div class="hello">
      <button class="hello-av" id="hProf" aria-label="بروفايلي">${avF(prof(me.uid), 56)}</button>
      <div class="hello-t"><span class="hint">هلا والله</span><b dir="ltr">${at(me.username)}</b></div>
    </div>

    ${showInstallCard() ? `<div class="inst"><img src="icon-180.png" alt="" width="52" height="52">
      <div class="inst-t"><b>ثبّت جلسة على شاشتك</b><span class="hint">تفتح بضغطة مثل التطبيق، وبدون متصفح</span></div>
      <button class="btn small" id="instGo">ثبّت</button><button class="inst-x" id="instHide" aria-label="إخفاء">×</button></div>` : ""}

    ${!showInstallCard() && showPushCard() ? `<div class="inst push"><span class="push-ic" aria-hidden="true">🔔</span>
      <div class="inst-t"><b>فعّل الإشعارات</b><span class="hint">عشان توصلك العزايم والرسائل حتى لو جلسة مقفلة</span></div>
      <button class="btn small" id="pushGo">فعّل</button><button class="inst-x" id="pushHide" aria-label="إخفاء">×</button></div>` : ""}

    <h2>وش نلعب الليلة؟</h2>
    <div class="big2">
      <button class="bigbtn create" id="create"><span class="bb-ic">${ICONS.create}</span><b>${roomCode ? "ارجع لغرفتك" : "غرفة جديدة"}</b><span>واعزم أصحابك</span></button>
      <button class="bigbtn join" id="joinBtn"><span class="bb-ic">${ICONS.join}</span><b>ادخل بكود</b><span>عندك كود غرفة؟</span></button>
    </div>
    <button class="shopbtn" id="shopBtn"><span class="sb-ic" aria-hidden="true">🛍️</span><span class="pb-t"><b>متجر جلسة</b><span>أشكال حصرية واشتراك VIP</span></span><span class="pb-go">←</span></button>
    <button class="pubbtn" id="pubBtn"><span class="pb-ic">${ICONS.pub}</span><span class="pb-t"><b>غرف عامة</b><span>ادخل والعب مع ناس جدد</span></span><span class="pb-go">←</span></button>
    <form class="joinrow" id="joinF" ${ui.showJoin ? "" : "hidden"}>
      <input id="code" dir="ltr" maxlength="5" placeholder="K7M2P" autocomplete="off" autocapitalize="characters" aria-label="كود الغرفة">
      <button class="btn small">دخول</button>
    </form>

    ${onl.length ? `<div class="field"><span class="label">أونلاين الحين (${ar(onl.length)})</span>
      <div class="onl">${onl.map(([u, f]) => `<button class="onl-i" data-pf="${esc(u)}">${avatar(f.username, f.photo, 48)}<i class="dot on"></i><span dir="ltr">${esc(f.username)}</span></button>`).join("")}</div></div>` : ""}

    <div class="field"><div class="row-h"><span class="label">الألعاب</span><span class="hint">اضغط أي لعبة</span></div>
      <div class="games">${CATALOG.map(g => `<button class="gcard ${g.hot ? "hot" : ""}" data-game-card="${g.id}">${g.hot ? `<span class="gc-new">جديد 🔥</span>` : ""}
        <span class="gc-ic">${ICONS[g.icon]}</span>
        <b>${g.title}</b>
        <span class="gc-tags">${g.online ? `<i class="t-on">أونلاين</i>` : ""}${g.local ? `<i class="t-lo">بجوال واحد</i>` : ""}</span>
      </button>`).join("")}</div></div>

    <button class="mode wide" id="local"><span class="glyph">${ICONS.local}</span><b>بجوال واحد</b><span>كل الألعاب على جوال واحد يتمرر بينكم.</span></button>
  </section>`;
  on("hProf", "click", () => go("profile"));
  on("instGo", "click", doInstall);
  on("pushGo", "click", enablePush);
  on("pushHide", "click", () => { store.set("pushHide", Date.now()); render(false); });
  on("pubBtn", "click", () => go("pub"));
  on("shopBtn", "click", () => go("shop"));
  on("instHide", "click", () => { store.set("instHide", Date.now()); render(false); });
  on("create", "click", () => roomCode ? go("room") : createRoom());
  onAll("[data-game-card]", b => gameSheet(b.dataset.gameCard));
  on("joinBtn", "click", () => { ui.showJoin = true; const f = document.getElementById("joinF"); f.hidden = false; document.getElementById("code").focus(); });
  on("joinF", "submit", e => { e.preventDefault(); joinRoom(document.getElementById("code").value); });
  onAll("[data-pf]", b => showProfile(b.dataset.pf));
  on("local", "click", () => go("local"));
};

// بطاقة بروفايل لاعب ثاني
function gameSheet(id) {
  const g = CATALOG.find(c => c.id === id); if (!g) return;
  document.getElementById("gSheet")?.remove();
  const el = document.createElement("div");
  el.id = "gSheet"; el.className = "sheet-bg"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", g.title);
  el.innerHTML = `<div class="sheet">
    <span class="gs-ic">${ICONS[g.icon]}</span>
    <b class="pf-name">${g.title}</b>
    <p class="pf-bio">${g.desc}</p>
    ${g.online ? `<button class="btn" id="gsOn">العب أونلاين مع أصحابك</button>` : ""}
    ${g.local ? `<button class="btn ${g.online ? "ghost" : ""}" id="gsLo">العب بجوال واحد</button>` : ""}
    <button class="btn ghost" id="gsX">إغلاق</button></div>`;
  document.body.appendChild(el);
  const close = () => el.remove();
  el.addEventListener("click", e => { if (e.target === el) close(); });
  el.querySelector("#gsX").addEventListener("click", close);
  el.querySelector("#gsOn")?.addEventListener("click", () => {
    close();
    if (!me?.username) { toast("سجّل دخول عشان تلعب أونلاين"); go("auth"); return; }
    if (roomCode) { if (isHost() && room?.phase === "lobby") setRoom({ game: id }); go("room"); return; }
    createRoom(id);
  });
  el.querySelector("#gsLo")?.addEventListener("click", () => { close(); L.mostPrompt = null; L.fivePrompt = null; L.letter = null; go(g.local); });
}

function showProfile(uid) {
  if (uid === me?.uid) { go("profile"); return; }
  const p = prof(uid); if (!p) { toast("لحظة…"); return; }
  document.getElementById("pfModal")?.remove();
  const el = document.createElement("div");
  el.id = "pfModal"; el.className = "sheet-bg"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "بروفايل " + p.username);
  const f = friends.get(uid);
  const sent = reqOut.some(r => r.to === uid), got = reqIn.some(r => r.from === uid);
  const col = avColor(p.username);
  let acts = "";
  if (f) {
    acts += `<button class="btn" id="pfMsg">💬 رسالة</button>`;
    if (roomCode && !room?.players?.[uid]) acts += `<button class="btn ghost" id="pfInv">اعزمه لغرفتك</button>`;
  } else if (got) acts += `<button class="btn good" id="pfAcc">اقبل طلب الصداقة</button>`;
  else if (sent) acts += `<button class="btn ghost" disabled>انرسل طلب الصداقة ✓</button>`;
  else acts += `<button class="btn" id="pfAdd">+ أضف صديق</button>`;
  if (roomCode && isHost() && room?.players?.[uid]) acts += `<button class="btn danger" id="pfKick">اطرده من الغرفة</button>`;
  const modRow = `<div class="row pf-mod"><button class="btn small ghost" id="pfRep">🚩 بلّغ</button><button class="btn small ghost" id="pfBlk">${isBlocked(uid) ? "فك الحظر" : "🚫 احظر"}</button></div>`;
  el.innerHTML = `<div class="pcard">
    <div class="pcard-cover" style="--c:${col}" aria-hidden="true"><span class="pc-sadu"></span></div>
    <div class="pcard-av">${avF(p, 104)}</div>
    <div class="pcard-body">
      <b class="pf-name" dir="ltr">${at(p.username)}</b>
      ${f ? `<span class="chip-st ${isOnline(f) ? "on" : ""}">${isOnline(f) ? "أونلاين الحين" : "مو أونلاين"}</span>` : ""}
      <div class="row tags">${lvlTag(p)}${vipTag(p)}</div>
      ${p.bio ? `<p class="pcard-bio">${esc(p.bio)}</p>` : ""}
      ${(() => { const g = achGot(p.stats, p.xp, p.username); if (!g.length) return ""; const top = [...g].sort((q, r) => TIER_RANK[r.tier] - TIER_RANK[q.tier]).slice(0, 3);
        return `<div class="ach-mini" aria-label="الإنجازات">${top.map(x => medal(x)).join("")}<span class="ach-n">${ar(g.length)} ${g.length > 2 && g.length < 11 ? "إنجازات" : "إنجاز"}</span></div>`; })()}
      <div class="pcard-acts">${acts}</div>
      ${modRow}
      <button class="btn ghost" id="pfClose">إغلاق</button>
    </div></div>`;
  document.body.appendChild(el);
  const close = () => el.remove();
  el.addEventListener("click", e => { if (e.target === el) close(); });
  el.querySelector("#pfClose").addEventListener("click", close);
  el.querySelector("#pfInv")?.addEventListener("click", () => { sendInvite(uid); close(); });
  el.querySelector("#pfMsg")?.addEventListener("click", () => { close(); openDm(uid); });
  el.querySelector("#pfAcc")?.addEventListener("click", () => { acceptRequest(uid); close(); });
  el.querySelector("#pfAdd")?.addEventListener("click", () => { sendRequest(p.username); close(); });
  el.querySelector("#pfKick")?.addEventListener("click", e => { if (!confirmTap(e.currentTarget, "متأكد؟ ما يقدر يرجع للغرفة")) return; kickPlayer(uid); close(); });
  el.querySelector("#pfRep")?.addEventListener("click", () => { close(); openReport(uid, p.username); });
  el.querySelector("#pfBlk")?.addEventListener("click", () => { toggleBlock(uid, p.username); close(); });
  el.querySelector("#pfClose").focus({ preventScroll: true });
}

// نصغّر الصورة لمربع ١٦٠ بكسل، عشان تنحفظ مجانًا داخل قاعدة البيانات
async function shrinkPhoto(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = url; });
    const S = 160, c = document.createElement("canvas"); c.width = c.height = S;
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    c.getContext("2d").drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, S, S);
    let q = .82, out = c.toDataURL("image/jpeg", q);
    while (out.length > 60000 && q > .4) { q -= .12; out = c.toDataURL("image/jpeg", q); }
    return out;
  } finally { URL.revokeObjectURL(url); }
}

VIEWS.profile = () => {
  const draft = ui.bioDraft ?? me.bio ?? "";
  V.innerHTML = `<section>
    <div class="pf-head">
      <div class="pf-av">${avF(prof(me.uid), 112)}
        <label class="pf-cam" for="photoIn" aria-label="غيّر الصورة">📷</label>
        <input type="file" id="photoIn" accept="image/*" hidden>
      </div>
      <b class="pf-name" dir="ltr">${at(me.username)}</b>
      ${STAFF(me.username) ? `<div class="lvlbox max"><div class="row-h"><b>👑 المستوى ${ar(MAXL)}</b><span class="hint">${me.username.toLowerCase() === OWNER ? "صاحب اللعبة" : "الحساب الرسمي"}</span></div><div class="lvlbar"><i style="width:100%"></i></div><span class="hint">كل الأشكال والإنجازات مفتوحة لك.</span></div>` : (() => { const L = lvlOf(me.xp), a0 = lvlXp(L), a1 = lvlXp(L + 1), pc = Math.round(((me.xp || 0) - a0) / (a1 - a0) * 100);
        return `<div class="lvlbox"><div class="row-h"><b>⭐ المستوى ${ar(L)}</b><span class="hint">${ar((me.xp || 0) - a0)} / ${ar(a1 - a0)} خبرة</span></div><div class="lvlbar"><i style="width:${pc}%"></i></div><span class="hint">العب جولات واكسب خبرة. الفوز يعطيك أكثر.</span></div>`; })()}
      <div class="row pf-acts">
        <label class="btn small ghost" for="photoIn">${me.photo ? "غيّر الصورة" : "أضف صورة"}</label>
        ${me.photo ? `<button class="btn small ghost" id="rmPhoto">شيل الصورة</button>` : ""}
      </div>
    </div>

    <div class="field"><label class="label" for="bio">نبذة عنك (اختياري)</label>
      <textarea class="txt" id="bio" rows="3" maxlength="120" placeholder="مثال: ملك الدخيل 🕵️ ما أحد يكشفني">${esc(draft)}</textarea>
      <div class="row-h"><span class="hint" id="bioCount">${ar(draft.length)} / ١٢٠</span>
      <button class="btn small" id="saveBio" ${draft === (me.bio || "") ? "disabled" : ""}>احفظ</button></div>
    </div>

    <div class="field"><span class="label">🔔 الإشعارات</span>
      <div class="li"><span class="nm">${{ granted: "مفعّلة ✓", denied: "مقفلة من إعدادات الجوال", ios: "تحتاج تضيف جلسة للشاشة الرئيسية", no: "جهازك ما يدعمها" }[pushState()] || "مو مفعّلة"}</span>
      ${pushState() === "granted" ? `<button class="btn small ghost" id="pushRe">حدّث</button>` : ["default", "ios"].includes(pushState()) ? `<button class="btn small" id="pushOn">فعّل</button>` : ""}</div>
      <p class="hint">توصلك العزايم وطلبات الصداقة والرسائل حتى لو جلسة مقفلة.</p></div>

    <div class="field"><span class="label">🎖️ إنجازاتك (${ar(achGot(me.stats, me.xp, me.username).length)} من ${ar(ACH.length)})</span>
      <div class="achs">${ACH.map(x => { const ok = STAFF(me.username) || x.ok(me.stats || {}, me.xp || 0); return `<div class="ach ${ok ? "on" : ""}">${medal(x, ok)}<b>${x.t}</b><span>${x.d}</span></div>`; }).join("")}</div></div>

    <div class="field"><span class="label">🎨 أشكالك</span>
      <span class="hint">شكل الطاولة</span>
      <div class="looks">${Object.entries(TABLES).map(([k, t]) => { const open = lookOpen(t), sel = myLook().t === k;
        return `<button class="look ${sel ? "sel" : ""} ${t.shop ? "excl" : ""}" data-lt="${k}" ${open ? "" : "aria-disabled=\"true\""} aria-pressed="${sel}"><span class="look-pv">${tableSVG(k)}</span><b>${t.name}</b><span class="hint">${open ? (sel ? "مختار ✓" : "متاح") : t.shop ? "🛍️ من المتجر" : "🔒 مستوى " + ar(t.lvl)}</span></button>`; }).join("")}</div>
      <span class="hint">ظهر الورق</span>
      <div class="looks">${Object.entries(BACKS).map(([k, t]) => { const open = lookOpen(t), sel = myLook().b === k;
        return `<button class="look back ${sel ? "sel" : ""} ${t.shop ? "excl" : ""}" data-lb="${k}" ${open ? "" : "aria-disabled=\"true\""} aria-pressed="${sel}"><span class="look-pv">${cardSVG(null, k)}</span><b>${t.name}</b><span class="hint">${open ? (sel ? "مختار ✓" : "متاح") : t.shop ? "🛍️ من المتجر" : "🔒 مستوى " + ar(t.lvl)}</span></button>`; }).join("")}</div>
      <span class="hint">إطار الصورة</span>
      <div class="looks">${[["", "بدون"], ...Object.entries(FRAMES)].map(([k, n]) => { const open = !k || owns(prof(me.uid), k), sel = (frameOf(prof(me.uid)) || "") === k;
        return `<button class="look frm ${sel ? "sel" : ""} ${k ? "excl" : ""}" data-lf="${k}" ${open ? "" : "aria-disabled=\"true\""} aria-pressed="${sel}"><span class="look-pv">${k ? `<span class="fr ${k}" style="--fs:4px">${avatar(me.username, me.photo, 56)}</span>` : avatar(me.username, me.photo, 56)}</span><b>${n}</b><span class="hint">${open ? (sel ? "مختار ✓" : "متاح") : "🛍️ من المتجر"}</span></button>`; }).join("")}</div>
      <button class="btn ghost" id="toShop">🛍️ متجر جلسة</button></div>

    <div class="field"><span class="label">يوزرك</span>
      <div class="li"><span class="nm" dir="ltr">@${esc(me.username)}</span><button class="btn small ghost" id="copy">انسخ</button>${isOwner() ? "" : `<button class="btn small ghost" id="rename">غيّر</button>`}</div>
      <p class="hint">أرسله لأصحابك عشان يضيفونك.</p></div>

    <div class="foot"><button class="btn ghost" id="tour">شرح اللعبة</button><button class="btn ghost" id="switchAcc">🔄 بدّل الحساب</button><button class="btn ghost" id="out">تسجيل خروج</button>
      <div class="row legal"><a class="link" href="privacy.html" target="_blank" rel="noopener">سياسة الخصوصية</a>${isOwner() ? "" : `<button class="link danger-link" id="delAcc">احذف حسابي</button>`}</div></div></section>`;
  on("tour", "click", () => { ui.slide = 0; go("welcome"); });
  on("delAcc", "click", openDeleteAccount);
  const setLook = async (kind, k, list) => {
    if (!lookOpen(list[k])) { if (list[k].shop) { toast("هذا من متجر جلسة 🛍️"); go("shop"); return; } return toast(`يفتح لك في المستوى ${ar(list[k].lvl)} ⭐`); }
    const look = { ...myLook(), [kind]: k };
    me.look = look; render(false);
    try { await updateDoc(doc(db, "users", me.uid), { look }); } catch (e) { console.error(e); }
  };
  onAll("[data-lt]", b => setLook("t", b.dataset.lt, TABLES));
  onAll("[data-lb]", b => setLook("b", b.dataset.lb, BACKS));
  onAll("[data-lf]", async b => {
    const k = b.dataset.lf;
    if (k && !owns(prof(me.uid), k)) { toast("هذا من متجر جلسة 🛍️"); go("shop"); return; }
    me.frame = k; render(false);
    try { await updateDoc(doc(db, "users", me.uid), { frame: k }); } catch (e) { console.error(e); }
  });
  on("toShop", "click", () => go("shop"));
  on("switchAcc", "click", openSwitcher);
  on("pushOn", "click", enablePush);
  on("pushRe", "click", async () => { toast(await pushSaveToken() ? "تمام، الإشعارات شغالة 🔔" : "ما زبط، جرّب مرة ثانية"); });
  const bio = document.getElementById("bio"), save = document.getElementById("saveBio");
  bio.addEventListener("input", () => {
    ui.bioDraft = bio.value;
    document.getElementById("bioCount").textContent = ar(bio.value.length) + " / ١٢٠";
    save.disabled = bio.value.trim() === (me.bio || "");
  });
  save.addEventListener("click", async () => {
    const v = bio.value.trim().slice(0, 120);
    if (botBad(v)) { botWarn(v); return; }
    save.disabled = true; save.textContent = "لحظة…";
    try { await updateDoc(doc(db, "users", me.uid), { bio: v }); me.bio = v; ui.bioDraft = null; toast("انحفظت النبذة"); render(true); }
    catch (e) { console.error(e); save.disabled = false; save.textContent = "احفظ"; toast("ما قدرنا نحفظ النبذة"); }
  });
  on("photoIn", "change", async e => {
    const file = e.target.files?.[0]; if (!file) return;
    if (!file.type.startsWith("image/")) return toast("اختر صورة");
    toast("نرفع الصورة…");
    try {
      const data = await shrinkPhoto(file);
      await updateDoc(doc(db, "users", me.uid), { photo: data });
      me.photo = data; toast("تغيّرت الصورة 👌"); render(true);
    } catch (err) { console.error(err); toast("ما قدرنا نرفع الصورة، جرّب صورة ثانية"); }
  });
  on("rmPhoto", "click", async e => {
    if (!confirmTap(e.currentTarget, "متأكد؟")) return;
    try { await updateDoc(doc(db, "users", me.uid), { photo: "" }); me.photo = ""; render(true); } catch (err) { console.error(err); }
  });
  on("copy", "click", () => copyText("@" + me.username, "انسخ اليوزر"));
  on("rename", "click", () => go("rename"));
  on("out", "click", async e => { if (!confirmTap(e.currentTarget)) return; await leaveRoom(true); signOut(accAuth(me.uid)).catch(() => {}); signOut(auth); });
};

/* ================= حذف الحساب ================= */
function openDeleteAccount() {
  const user = auth.currentUser; if (!user || !me?.username) return;
  const viaGoogle = user.providerData.some(p => p.providerId === "google.com");
  const viaPass = user.providerData.some(p => p.providerId === "password");
  document.getElementById("delSheet")?.remove();
  const el = document.createElement("div");
  el.id = "delSheet"; el.className = "sheet-bg"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "احذف حسابي");
  el.innerHTML = `<div class="sheet bot-sheet"><span class="bot-av" aria-hidden="true">🗑️</span><b class="pf-name">احذف حسابك نهائيًا؟</b>
    <p class="pf-bio">بينحذف يوزرك <b dir="ltr">@${esc(me.username)}</b> وصورتك ونبذتك وأصدقائك. وما تقدر ترجعه بعدين.</p>
    ${viaPass && !viaGoogle ? `<input class="txt" id="delPw" type="password" dir="ltr" autocomplete="current-password" placeholder="كلمة السر للتأكيد" aria-label="كلمة السر">` : ""}
    <input class="txt" id="delTxt" autocomplete="off" placeholder="اكتب: احذف" aria-label="اكتب احذف للتأكيد">
    <p class="hint" id="delMsg" role="status"></p>
    <button class="btn danger" id="delGo" disabled>احذف حسابي</button>
    <button class="btn ghost" id="delX">إلغاء</button></div>`;
  document.body.appendChild(el);
  const close = () => el.remove(), go2 = el.querySelector("#delGo"), msg = el.querySelector("#delMsg");
  el.addEventListener("click", e => { if (e.target === el) close(); });
  el.querySelector("#delX").addEventListener("click", close);
  el.querySelector("#delTxt").addEventListener("input", e => { go2.disabled = e.target.value.trim() !== "احذف"; });
  go2.addEventListener("click", async () => {
    go2.disabled = true; go2.textContent = "لحظة…"; msg.className = "hint";
    try {
      if (viaGoogle) await reauthenticateWithPopup(user, new GoogleAuthProvider());
      else if (viaPass) {
        const pw = el.querySelector("#delPw").value;
        if (!pw) throw { code: "need-pw" };
        await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, pw));
      }
      if (roomCode) await leaveRoom(true).catch(() => {});
      const refs = [];
      friends.forEach((_, u) => refs.push(doc(db, "friendships", pairId(me.uid, u))));
      [...reqIn, ...reqOut].forEach(r => { if (r.from && r.to) refs.push(doc(db, "friendRequests", r.from + "_" + r.to)); });
      for (let i = 0; i < refs.length; i += 400) { const b = writeBatch(db); refs.slice(i, i + 400).forEach(r => b.delete(r)); await b.commit().catch(e => console.error(e)); }
      const b = writeBatch(db);
      b.delete(doc(db, "usernames", me.username.toLowerCase()));
      b.delete(doc(db, "pushTokens", me.uid));
      b.delete(doc(db, "users", me.uid));
      await b.commit();
      ["welcomed:" + me.uid, "blocked", "instHide"].forEach(k => { try { localStorage.removeItem("jalsa:" + k); } catch (e) {} });
      offAll();
      signOut(accAuth(user.uid)).catch(() => {});
      store.set("accounts", accounts().filter(a => a.uid !== user.uid));
      await deleteUser(user);
      close(); toast("انحذف حسابك. الله يحييك أي وقت 👋");
    } catch (err) {
      console.error(err);
      go2.disabled = false; go2.textContent = "احذف حسابي"; msg.className = "hint msg-bad";
      msg.textContent = err.code === "need-pw" ? "اكتب كلمة السر أول."
        : err.code === "auth/wrong-password" || err.code === "auth/invalid-credential" ? "كلمة السر غلط."
        : err.code === "auth/popup-closed-by-user" || err.code === "auth/cancelled-popup-request" ? "لازم تأكد بحساب قوقل عشان نحذف."
        : err.code === "auth/requires-recent-login" ? "سجّل خروج وادخل مرة ثانية، بعدين احذف."
        : "ما قدرنا نحذف الحساب، جرّب مرة ثانية.";
    }
  });
}

VIEWS.friends = () => {
  const list = [...friends.entries()].sort((a, b) => (isOnline(b[1]) - isOnline(a[1])) || a[1].username.localeCompare(b[1].username));
  V.innerHTML = `<section>
    <h2>أضف صديق</h2>
    <p class="lead">اكتب يوزر صديقك. ويوزرك <b dir="ltr">@${esc(me.username)}</b> <button class="link" id="copyMe">انسخ</button></p>
    <form class="addf" id="addF"><div class="uinput"><span>@</span><input id="addName" autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="21" placeholder="يوزر صديقك" aria-label="يوزر صديقك"></div><button class="btn small">أضف</button></form>
    ${reqIn.length ? `<div class="field"><span class="label">طلبات صداقة</span><div class="list">${reqIn.map(r => `
      <div class="li">${avatar(r.fromName, prof(r.from)?.photo, 36)}<span class="nm" dir="ltr">${at(r.fromName)}</span>
      <button class="btn small good" data-acc="${esc(r.from)}">قبول</button>
      <button class="btn small ghost" data-dec="${esc(r.from)}">رفض</button></div>`).join("")}</div></div>` : ""}
    <div class="field"><span class="label">أصحابك (${ar(list.length)})</span>
    ${list.length ? `<div class="list">${list.map(([uid, f]) => `
      <div class="li"><button class="li-who" data-pf="${esc(uid)}"><span class="av-wrap">${avatar(f.username, f.photo, 40)}<i class="dot ${isOnline(f) ? "on" : ""}" title="${isOnline(f) ? "أونلاين" : "مو أونلاين"}"></i></span>
      <span class="who-t"><span class="nm" dir="ltr">${at(f.username)}</span>${f.bio ? `<span class="who-bio">${esc(f.bio)}</span>` : ""}</span></button>
      <button class="btn small ghost" data-msg="${esc(uid)}" aria-label="رسالة">💬</button>
      ${roomCode && !room?.players?.[uid] ? `<button class="btn small" data-inv="${esc(uid)}">اعزمه</button>` : ""}
      <button class="btn small ghost" data-rm="${esc(uid)}">حذف</button></div>`).join("")}</div>`
      : `<p class="hint">ما عندك أصدقاء للحين. اكتب يوزر صديقك فوق وأرسل له طلب.</p>`}</div>
    ${reqOut.length ? `<div class="field"><span class="label">طلبات أرسلتها</span><div class="list">${reqOut.map(r => `
      <div class="li"><span class="nm" dir="ltr">${at(r.toName)}</span><span class="tag">ينتظر</span>
      <button class="btn small ghost" data-can="${esc(r.to)}">إلغاء</button></div>`).join("")}</div></div>` : ""}
  </section>`;
  on("copyMe", "click", () => copyText("@" + me.username, "انسخ اليوزر"));
  on("addF", "submit", e => { e.preventDefault(); sendRequest(document.getElementById("addName").value); });
  onAll("[data-acc]", b => acceptRequest(b.dataset.acc));
  onAll("[data-pf]", b => showProfile(b.dataset.pf));
  onAll("[data-msg]", b => openDm(b.dataset.msg));
  onAll("[data-dec]", b => deleteDoc(doc(db, "friendRequests", b.dataset.dec + "_" + me.uid)).catch(err));
  onAll("[data-can]", b => deleteDoc(doc(db, "friendRequests", me.uid + "_" + b.dataset.can)).catch(err));
  onAll("[data-inv]", b => { b.disabled = true; sendInvite(b.dataset.inv); });
  onAll("[data-rm]", b => {
    if (!confirmTap(b, "متأكد؟")) return;
    deleteDoc(doc(db, "friendships", pairId(me.uid, b.dataset.rm))).then(() => toast("انحذف")).catch(err);
  });
};

/* ---------- room views ---------- */
function scoreBoard(ids) {
  const rows = ids.map(u => ({ u, pts: room.scores?.[u] || 0 })).sort((a, b) => b.pts - a.pts);
  const top = rows[0]?.pts || 0;
  return `<div class="board">${rows.map((r, k) => `<div class="r ${r.pts > 0 && r.pts === top ? "top" : ""}">
    <span class="rank">${ar(k + 1)}</span><span class="nm" dir="ltr">${at(pname(r.u))}</span><span class="pts">${ar(r.pts)}</span></div>`).join("")}</div>`;
}
function tallyList(tally, ids) {
  const rows = ids.map(u => ({ u, n: tally[u] || 0 })).sort((a, b) => b.n - a.n);
  const max = Math.max(1, ...rows.map(r => r.n));
  return `<div class="tally">${rows.map(r => `<div class="t"><span dir="ltr" style="text-align:right">${at(pname(r.u))}</span><span class="n">${ar(r.n)}</span>
    <div class="bar"><i style="width:${(r.n / max) * 100}%"></i></div></div>`).join("")}</div>`;
}
function voteList(ids, mine) {
  return `<div class="list">${ids.map(u => `<button class="vote" data-vote="${esc(u)}" aria-pressed="${mine === u}">
    ${avatar(pname(u), prof(u)?.photo, 32)}<span class="nm" dir="ltr">${at(pname(u))}${u === me.uid ? " (أنت)" : ""}</span>${mine === u ? `<span class="tag">صوتك</span>` : ""}</button>`).join("")}</div>`;
}
function votedCount() {
  const ps = roundPlayers();
  return Object.entries(votes).filter(([u, v]) => v.round === room.round && ps.includes(u)).length;
}
const statusBar = () => `<div class="status"><span>الغرفة <b dir="ltr">${esc(roomCode)}</b> · ${GAMES[room.game] || ""}</span><span>الجولة ${ar(room.round || 0)}</span></div>`;
const leaveBtn = () => `<button class="btn ghost" id="leave">${isHost() ? "إنهاء الغرفة" : "خروج من الغرفة"}</button>`;
function bindLeave() { on("leave", "click", e => { if (confirmTap(e.currentTarget)) leaveRoom(); }); }

VIEWS.room = () => {
  if (!room) { V.innerHTML = `<div class="spinner" aria-label="جاري التحميل"></div>`; return; }
  if (room.phase === "hq") { if (!subs.has("hdone")) watchHhnjDone(); } else if (subs.has("hdone")) { off("hdone"); ui.hDoneCount = 0; }
  awardXp();
  if (room.phase === "uno" && isHost()) { if (!subs.has("umoves")) watchUnoMoves(); unoCleanup(); } else if (subs.has("umoves")) off("umoves");
  if (room.phase !== "uno" && room.phase !== "unoend") { UNO.st = null; UNO.processed = {}; }
  const host = isHost();
  if (host) { const want = !!room.public && room.phase === "lobby"; if (!!room.listed !== want) setRoom({ listed: want, ping: Date.now(), hostName: me.username }); }
  if (host && (room.phase === "wq" || room.phase === "tw")) { if (!subs.has("priv")) watchPriv(); } else if (subs.has("priv")) off("priv");
  if (host && room.phase === "dq") { if (!subs.has("dguess")) watchGuesses(); } else if (subs.has("dguess")) off("dguess");
  if (room.phase === "dq" || room.phase === "dres") { if (!subs.has("dcanvas")) watchCanvas(); } else if (subs.has("dcanvas")) off("dcanvas");
  const view = ROOM_VIEWS[room.phase] || ROOM_VIEWS.lobby;
  if (view() === "kept") return; // شاشة الرسم ما تنعاد عشان ما ينقطع الرسم
  showChatFab();
  onAll("[data-share]", () => openShare());
  bindLeave();
  onAll("[data-vote]", b => vote(b.dataset.vote));
};

function hhnjTick() {
  if (screen !== "room" || room?.phase !== "hq") { clearInterval(ui.hTimer); ui.hTimer = null; return; }
  const ms = room.deadline - Date.now(), left = Math.max(0, Math.ceil(ms / 1000));
  const bar = document.getElementById("hBar"), lt = document.getElementById("hLeft");
  if (bar) bar.style.transform = `scaleX(${Math.max(0, ms) / (HHNJ_SECS * 1000)})`;
  if (lt) lt.textContent = left ? `باقي ${ar(left)} ثانية` : "خلص الوقت!";
  if (!left && ui.hDoneRound !== room.round && roundPlayers().includes(me.uid)) { ui.hDoneRound = room.round; submitHhnj(true).then(() => render(false)); }
  if (isHost() && (ms < -3000 || (ui.hDoneCount || 0) >= roundPlayers().length)) revealHhnj();
}
function watchHhnjDone() {
  sub("hdone", onSnapshot(collection(db, "rooms", roomCode, "answers"), q => {
    let n = 0; q.forEach(d => { const v = d.data(); if (v.round === room?.round && v.done) n++; });
    if (n !== ui.hDoneCount) { ui.hDoneCount = n; if (screen === "room" && room?.phase === "hq") render(false); }
  }, () => {}));
}

// تحديث أجزاء شاشة الرسم بدون ما نعيد رسم اللوحة
function drawParts() {
  const amDrawer = room.drawer === me.uid, mine = secret?.round === room.round && secret.role === "draw" ? secret.word : null;
  const w = document.getElementById("dWord");
  if (w) w.innerHTML = amDrawer
    ? `<span class="hint">ارسم:</span> <b>${mine ? esc(mine) : "…"}</b>`
    : `<span class="hint">${atL(room.drawer)} يرسم</span> <span class="dmask" aria-label="عدد الحروف">${(room.dMask || []).map(n => `<span>${"<i></i>".repeat(n)}</span>`).join("")}</span>`;
  const got = room.dgot || {};
  const box = document.getElementById("dGuessBox");
  if (box) {
    const inRound = roundPlayers().includes(me.uid);
    const st = !inRound ? "out" : got[me.uid] ? "got" : "guess";
    if (ui.dGuessState !== st) {
      ui.dGuessState = st;
      box.innerHTML = st === "guess" ? `<form class="dguess" id="dGF" autocomplete="off"><input class="txt" id="dGuess" maxlength="30" dir="auto" placeholder="وش يرسم؟ اكتب تخمينك" enterkeyhint="send"><button class="btn small">خمّن</button></form>`
        : st === "got" ? `<div class="dgot-me pop">عرفتها ✅ انتظر الباقين</div>` : `<p class="hint">انتظر الجولة الجاية.</p>`;
      document.getElementById("dGF")?.addEventListener("submit", e => {
        e.preventDefault(); const inp = document.getElementById("dGuess"); const t = inp.value; inp.value = ""; sendGuess(t); inp.focus();
      });
    }
  }
  const f = document.getElementById("dFeed");
  if (f) {
    const n = Object.keys(got).length, total = roundPlayers().filter(u => u !== room.drawer).length;
    f.innerHTML = `<span class="hint">عرفها ${ar(n)} من ${ar(total)}</span>` + (room.dfeed || []).slice().reverse().map(x =>
      x.ok ? `<span class="dfi ok">${atL(x.u)} <b>عرفها ✅</b></span>` : `<span class="dfi"><b dir="ltr">${esc(pname(x.u))}</b>: <span dir="auto">${esc(censor(x.t))}</span></span>`).join("");
  }
}

const ROOM_VIEWS = {
  lobby() {
    const ps = order(), host = isHost(), n = ps.length;
    const onlineFriends = [...friends.entries()].filter(([u, f]) => isOnline(f) && !room.players[u]);
    const hasScores = ps.some(u => room.scores?.[u]);
    V.innerHTML = `<section>
      <div class="codebox"><span class="label">كود الغرفة</span><span class="code" dir="ltr">${esc(roomCode)}</span>
        <div class="row inv-row"><a class="btn small wa" id="waInv" href="${esc(waLink())}" target="_blank" rel="noopener">${ICONS.wa} ادعُ بالواتساب</a>
        <button class="btn small ghost" id="copyLink">انسخ الرابط</button></div></div>
      <div class="field"><span class="label">اللاعبين (${ar(n)} من ١٢)</span><div class="list">${ps.map(u => `
        <div class="li"><button class="li-who" data-pf="${esc(u)}">${prof(u) ? avF(prof(u), 36) : avatar(pname(u), "", 36)}<span class="nm" dir="ltr">${at(pname(u))}</span>${prof(u) ? lvlTag(prof(u)) + vipTag(prof(u)) : ""}</button>${u === room.host ? `<span class="tag">المضيف</span>` : ""}${u === me.uid ? `<span class="tag">أنت</span>` : ""}${host && u !== me.uid ? `<button class="btn small ghost kick" data-kick="${esc(u)}" aria-label="اطرد ${esc(pname(u))}">اطرد</button>` : ""}</div>`).join("")}</div></div>
      ${host ? `
        <div class="field"><span class="label">نوع الغرفة</span><div class="chips">
          <button class="chip" data-pub="0" aria-pressed="${!room.public}">خاصة 🔒</button>
          <button class="chip" data-pub="1" aria-pressed="${!!room.public}">عامة 🌍</button></div>
          <p class="hint">${room.public ? "الغرفة تطلع لكل الناس في «غرف عامة»، وأي أحد يقدر يدخل." : "بس اللي معهم الكود أو الرابط يقدرون يدخلون."}</p></div>
        <div class="field"><span class="label">اللعبة</span><div class="chips">${Object.entries(GAMES).map(([k, t]) => `<button class="chip" data-game="${k}" aria-pressed="${room.game === k}" ${k === "uno" && n > 8 ? "disabled" : ""}>${t}</button>`).join("")}</div>${room.game === "uno" ? `<p class="hint">أونو من ٢ إلى ٨ لاعبين.</p>` : ""}${CATALOG.find(c => c.id === room.game)?.desc ? `<p class="hint">${CATALOG.find(c => c.id === room.game).desc}</p>` : ""}</div>
        ${room.game === "imp" ? `
        <div class="field"><span class="label">الفئة</span><div class="chips">${["عشوائي", ...Object.keys(WORDS)].map(c => `<button class="chip" data-cat="${esc(c)}" aria-pressed="${room.cat === c}">${esc(c)}</button>`).join("")}</div></div>
        <div class="field"><span class="label">عدد الدخلاء</span><div class="chips">
          <button class="chip" data-imps="1" aria-pressed="${room.imps !== 2 || n < 7}">واحد</button>
          <button class="chip" data-imps="2" aria-pressed="${room.imps === 2 && n >= 7}" ${n < 7 ? "disabled" : ""}>اثنين</button></div>
          ${n < 7 ? `<p class="hint">دخيلين يحتاجون ٧ لاعبين أو أكثر.</p>` : ""}</div>` : ""}`
      : `<p class="hint center">${room.public ? `<span class="tag">غرفة عامة 🌍</span><br>` : ""}اللعبة: <b>${GAMES[room.game]}</b>${room.game === "imp" ? ` · الفئة: <b>${esc(room.cat)}</b>` : ""}<br>ننتظر المضيف يبدأ.</p>`}
      ${onlineFriends.length ? `<div class="field"><span class="label">أصحابك الأونلاين</span><div class="list">${onlineFriends.map(([u, f]) => `
        <div class="li"><i class="dot on"></i><span class="nm" dir="ltr">${at(f.username)}</span><button class="btn small" data-inv="${esc(u)}">اعزمه</button></div>`).join("")}</div></div>` : ""}
      ${hasScores ? `<div class="field"><span class="label">النقاط</span>${scoreBoard(ps)}</div>` : ""}
      <div class="foot">
        ${host ? `<button class="btn" id="start" ${n < minPlayers(room.game) ? "disabled" : ""}>${n < minPlayers(room.game) ? (minPlayers(room.game) === 2 ? "تحتاجون لاعبين على الأقل" : `تحتاجون ${ar(minPlayers(room.game))} لاعبين على الأقل`) : "ابدأ"}</button>` : ""}
        ${leaveBtn()}
      </div></section>`;
    on("copyLink", "click", () => copyText(location.origin + location.pathname + "?r=" + roomCode, "انسخ رابط الدعوة"));
    onAll("[data-inv]", b => { b.disabled = true; sendInvite(b.dataset.inv); });
    onAll("[data-pf]", b => { if (b.dataset.pf !== me.uid) showProfile(b.dataset.pf); else go("profile"); });
    onAll("[data-game]", b => setRoom({ game: b.dataset.game }));
    onAll("[data-kick]", b => { if (!confirmTap(b, "متأكد؟")) return; kickPlayer(b.dataset.kick); });
    onAll("[data-pub]", b => { const pub = b.dataset.pub === "1"; setRoom({ public: pub, listed: pub, ping: Date.now(), hostName: me.username }); if (pub) toast("صارت غرفتك عامة 🌍"); });
    onAll("[data-cat]", b => setRoom({ cat: b.dataset.cat }));
    onAll("[data-imps]", b => setRoom({ imps: Number(b.dataset.imps) }));
    on("start", "click", () => ({ most: startMost, hhnj: startHhnj, uno: startUno, who: startWho, tf: startTf, draw: startDraw }[room.game] || startImp)());
  },

  reveal() {
    const mine = secret && secret.round === room.round ? secret : null;
    const shown = ui.shownRound === room.round;
    let card;
    if (!mine) card = `<div class="card"><span class="eyebrow">لحظة</span><span class="mid">نجهز كلمتك…</span></div>`;
    else if (!shown) card = `<div class="card tap" id="secretCard" role="button" tabindex="0"><span class="eyebrow">الفئة: ${esc(mine.cat)}</span><span class="big">كلمتك</span><span class="hint">تأكد ما أحد يشوف شاشتك، واضغط</span></div>`;
    else if (mine.role === "imp") card = `<div class="card imposter pop tap" id="secretCard" role="button" tabindex="0"><span class="eyebrow">الفئة: ${esc(mine.cat)}</span><span class="big">أنت الدخيل</span><span class="hint">ما تعرف الكلمة. جارِهم وحاول تكتشفها. اضغط عشان تخبيها.</span></div>`;
    else card = `<div class="card word pop tap" id="secretCard" role="button" tabindex="0"><span class="eyebrow">الفئة: ${esc(mine.cat)}</span><span class="big">${esc(mine.word)}</span><span class="hint">احفظها ولا تقولها. اضغط عشان تخبيها.</span></div>`;
    V.innerHTML = `<section>${statusBar()}${card}
      <div class="foot">${isHost() ? `<button class="btn" id="next">الكل شاف كلمته؟ ابدأوا السوالف</button>` : `<p class="hint center">شف كلمتك وانتظر المضيف.</p>`}${leaveBtn()}</div></section>`;
    const toggle = () => { ui.shownRound = ui.shownRound === room.round ? 0 : room.round; render(false); };
    on("secretCard", "click", toggle);
    on("secretCard", "keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } });
    on("next", "click", () => setRoom({ phase: "discuss" }));
  },

  discuss() {
    const mine = secret && secret.round === room.round ? secret : null;
    V.innerHTML = `<section>${statusBar()}
      <div class="card pop"><span class="eyebrow">يبدأ الأسئلة</span><span class="big" dir="ltr">${at(pname(room.starter))}</span>
      <span class="hint">كل واحد يسأل اللي بعده سؤال عن الكلمة بدون ما يفضحها. تكلموا بالصوت أو وأنتم قاعدين.</span></div>
      ${mine ? `<button class="btn ghost" id="peek">${ui.peek ? (mine.role === "imp" ? "أنت الدخيل" : "كلمتك: " + esc(mine.word)) : "شف كلمتك مرة ثانية"}</button>` : ""}
      <div class="foot">${isHost() ? `<button class="btn danger" id="next">ابدأوا التصويت</button>` : `<p class="hint center">المضيف يفتح التصويت لما تخلصون.</p>`}${leaveBtn()}</div></section>`;
    on("peek", "click", () => { ui.peek = !ui.peek; render(false); });
    on("next", "click", () => { ui.peek = false; setRoom({ phase: "vote" }); });
  },

  vote() {
    const ps = roundPlayers(), mine = votes[me.uid]?.round === room.round ? votes[me.uid].target : null;
    const inRound = ps.includes(me.uid);
    V.innerHTML = `<section>${statusBar()}
      <div><h2>مين الدخيل؟</h2><p class="lead">صوّتوا ${ar(votedCount())} من ${ar(ps.length)}</p></div>
      ${inRound ? voteList(ps.filter(u => u !== me.uid), mine) : `<p class="hint">دخلت بعد بداية الجولة، انتظر الجولة الجاية.</p>`}
      <div class="foot">${isHost() ? `<button class="btn danger" id="reveal">اكشف النتيجة</button>` : ""}${leaveBtn()}</div></section>`;
    on("reveal", "click", e => { if (votedCount() < ps.length && !confirmTap(e.currentTarget, "باقي ناس ما صوتوا، اكشف؟")) return; revealImp(); });
  },

  result() {
    const r = room.result || {}, ps = roundPlayers(), imps = r.imps || [];
    V.innerHTML = `<section>${statusBar()}
      <div class="card ${r.caught ? "safe" : "imposter"} pop">
        <span class="eyebrow">${r.caught ? "مسكتوا الدخيل!" : "الدخيل نجا!"}</span>
        <span class="big" dir="ltr">${imps.map(u => at(pname(u))).join(" و ")}</span>
        <span class="hint">${r.wordShown ? `الكلمة كانت: <b>${esc(r.word)}</b>${r.guessed ? " · الدخيل خمّنها ✓" : " · ما خمّنها"}` : "الدخيل يحاول يخمّن الكلمة… 🤔"}</span></div>
      <div class="field"><span class="label">الأصوات</span>${tallyList(r.tally || {}, ps)}</div>
      <div class="field"><span class="label">النقاط</span>${scoreBoard(order())}</div>
      <div class="foot">${r.wordShown ? shareBtn() : ""}${isHost() ? `
        ${r.wordShown ? "" : `<p class="hint center">خلّوا الدخيل يقول وش يتوقع الكلمة، وبعدها:</p>
        <div class="row"><button class="btn good" id="guessed">خمّن صح (+١)</button><button class="btn danger" id="notGuessed">خمّن غلط</button></div>`}
        <button class="btn" id="again">جولة جديدة</button>
        <button class="btn ghost" id="lobby">رجوع للغرفة</button>` : `<p class="hint center">${r.wordShown ? "المضيف يبدأ الجولة الجاية." : "الدخيل يخمّن الكلمة الحين…"}</p>`}
        ${leaveBtn()}</div></section>`;
    on("guessed", "click", impGuessed);
    on("notGuessed", "click", () => setRoom({ "result.wordShown": true }));
    on("again", "click", startImp);
    on("lobby", "click", () => setRoom({ phase: "lobby" }));
  },

  hq() {
    const ps = roundPlayers(), left = Math.max(0, Math.ceil((room.deadline - Date.now()) / 1000));
    const mineDone = ui.hDoneRound === room.round;
    const inRound = ps.includes(me.uid);
    V.innerHTML = `<section>${statusBar()}
      <div class="hletter pop"><span class="eyebrow">الحرف</span><span class="hl">${esc(room.letter)}</span>
        <div class="timer" aria-hidden="true"><i id="hBar" style="transform:scaleX(${left / HHNJ_SECS})"></i></div>
        <span class="hint" id="hLeft">باقي ${ar(left)} ثانية</span></div>
      ${inRound ? `<form class="hform" id="hF" autocomplete="off">
        ${HCATS.map((c, i) => `<label class="hrow"><span>${c}</span><input class="txt" id="h${i}" maxlength="40" ${mineDone || !left ? "disabled" : ""} placeholder="${esc(room.letter)}…"></label>`).join("")}
        <button class="btn" id="hDone" ${mineDone || !left ? "disabled" : ""}>${mineDone ? "انرسلت ✓ ننتظر الباقين" : "خلصت ✋"}</button>
      </form>` : `<p class="hint">انتظر الجولة الجاية.</p>`}
      <p class="hint center">خلص ${ar(ui.hDoneCount || 0)} من ${ar(ps.length)}</p>
      <div class="foot">${isHost() ? `<button class="btn ghost" id="hNow">اكشف الأجوبة الحين</button>` : ""}${leaveBtn()}</div></section>`;
    if (ui.hAns && ui.hAns.round === room.round) ui.hAns.a.forEach((v, i) => { const el = document.getElementById("h" + i); if (el && !el.value) el.value = v; });
    V.querySelectorAll(".hrow input").forEach(inp => inp.addEventListener("input", () => {
      ui.hAns = { round: room.round, a: [0, 1, 2, 3].map(i => document.getElementById("h" + i).value) };
    }));
    on("hF", "submit", async e => { e.preventDefault(); ui.hDoneRound = room.round; await submitHhnj(true); render(false); });
    on("hNow", "click", e => { if (!confirmTap(e.currentTarget, "باقي ناس ما خلصوا، اكشف؟")) return; revealHhnj(); });
    if (!ui.hTimer) ui.hTimer = setInterval(hhnjTick, 500);
  },

  hres() {
    const r = room.result || {}, rows = r.rows || {}, rej = r.rej || {};
    const ids = Object.keys(rows).sort((a, b) => rows[b].total - rows[a].total);
    V.innerHTML = `<section>${statusBar()}
      <div class="row-h"><h2>النتيجة · حرف <span class="hl-s">${esc(room.letter)}</span></h2></div>
      ${isHost() ? `<p class="hint">اضغط على أي جواب غلط عشان تلغيه (يصير صفر).</p>` : ""}
      <div class="htable">${ids.map(u => `<div class="hcard">
        <div class="hc-top">${avatar(pname(u), prof(u)?.photo, 32)}<span class="nm" dir="ltr">${at(pname(u))}</span><span class="hc-tot">+${ar(rows[u].total)}</span></div>
        <div class="hc-ans">${HCATS.map((c, i) => {
          const a = rows[u].a[i] || "", p = rows[u].p[i] || 0, x = rej[u + "_" + i];
          return `<button class="ha ${x ? "rej" : p === 10 ? "p10" : p === 5 ? "p5" : "p0"}" ${isHost() && a ? `data-rej="${esc(u)}|${i}"` : "disabled"}>
            <span class="ha-c">${c}</span><span class="ha-a">${a ? esc(a) : "—"}</span><span class="ha-p">${ar(p)}</span></button>`;
        }).join("")}</div></div>`).join("")}</div>
      <p class="hint">١٠ = جواب صح ومحد كتبه غيرك · ٥ = صح بس فيه أحد كاتبه · ٠ = فاضي أو ما يبدأ بالحرف</p>
      <div class="field"><span class="label">النقاط</span>${scoreBoard(order())}</div>
      <div class="foot">${shareBtn()}${isHost() ? `<button class="btn" id="again">حرف جديد</button><button class="btn ghost" id="lobby">رجوع للغرفة</button>` : `<p class="hint center">المضيف يبدأ الجولة الجاية.</p>`}${leaveBtn()}</div></section>`;
    onAll("[data-rej]", b => { const [u, i] = b.dataset.rej.split("|"); toggleReject(u, Number(i)); });
    on("again", "click", startHhnj);
    on("lobby", "click", () => setRoom({ phase: "lobby" }));
  },

  uno() {
    const uno = unoState(); if (!uno) { V.innerHTML = `<div class="spinner"></div>`; return; }
    const myHand = secret?.round === room.round && secret.role === "uno" ? secret.hand : [];
    const ord = uno.order, n = ord.length, myI = ord.indexOf(me.uid);
    const turnU = ord[uno.turn], myTurn = turnU === me.uid && !uno.winner;
    const waiting = ui.unoWait === uno.v;
    if (ui.unoWait && ui.unoWait !== uno.v) ui.unoWait = null;
    // اللاعبين حول الطاولة بترتيب الدور بعدي
    const others = myI < 0 ? ord : [...ord.slice(myI + 1), ...ord.slice(0, myI)];
    const spots = seatSpots(others.length);
    const col = UCOLORS[uno.color];
    const canDraw = myTurn && uno.drew !== me.uid && !waiting;
    const playable = c => myTurn && !waiting && canPlay(c, uno.top, uno.color);
    const anyPlayable = myHand.some(playable);
    const tm = unoTimeLeft(uno);
    // كومة اللعب: آخر كم ورقة تحت بعض بزوايا عشوائية مثل الواقع
    if (!ui.unoTrail || ui.unoTrail.round !== room.round) ui.unoTrail = { round: room.round, list: [] };
    const tr = ui.unoTrail.list;
    if (!tr.length || tr[tr.length - 1].v !== uno.v && tr[tr.length - 1].c !== uno.top) tr.push({ c: uno.top, v: uno.v, r: ((uno.v * 47) % 34) - 17, x: ((uno.v * 29) % 14) - 7, y: ((uno.v * 13) % 10) - 5 });
    else if (tr[tr.length - 1].c === uno.top) tr[tr.length - 1].v = uno.v;
    if (tr.length > 4) tr.splice(0, tr.length - 4);
    const under = tr.slice(0, -1), topT = tr[tr.length - 1];
    // اليد على شكل مروحة مثل ما تمسك الأوراق
    const ORD = { r: 0, y: 1, g: 2, b: 3, w: 4 }, VO = v => "0123456789SRDWF".indexOf(v);
    const hand = myHand.map((c, i) => ({ c, i })).sort((p, q) => (ORD[cColor(p.c)] - ORD[cColor(q.c)]) || (VO(cVal(p.c)) - VO(cVal(q.c))));
    const hn = hand.length, HW = Math.min(V.clientWidth || 360, 520) - 24, step = hn > 1 ? Math.min(46, (HW - 74) / (hn - 1)) : 0, da = Math.min(5, 40 / Math.max(hn, 1));
    const fan = k => { const d = k - (hn - 1) / 2, r = d * da; return `--x:${(d * step).toFixed(1)}px;--r:${r.toFixed(2)}deg;--y:${(r * r * .12).toFixed(1)}px;z-index:${k + 1}`; };
    V.innerHTML = `<section class="uno">
      ${statusBar()}
      <div class="utable" style="--cur:${col.fill}">
        ${tableSVG(myLook().t)}
        ${others.map((u, i) => `<button class="useat ${u === turnU ? "turn" : ""} ${uno.flash === u ? "flash" : ""}" style="left:${spots[i][0]}%;top:${spots[i][1]}%" data-pf="${esc(u)}">
          ${prof(u) ? avF(prof(u), 40) : avatar(pname(u), "", 40)}<span class="us-n" dir="ltr">${esc(pname(u))}</span><span class="us-c">🃏 ${ar(uno.counts[u] || 0)}</span></button>`).join("")}
        <div class="ucenter">
          <button class="upile ${canDraw ? "go" : ""}" id="uDraw" ${canDraw ? "" : "disabled"} aria-label="اسحب ورقة">${cardSVG(null, myLook().b)}<span class="up-n">${ar(uno.deck)}</span></button>
          <div class="udisc" id="uDisc" aria-label="الورقة اللي فوق: ${esc(cardName(uno.top))}"><span class="ring"></span>${under.map(t => `<span class="ucard old" style="--r:${t.r}deg;--x:${t.x}px;--y:${t.y}px">${cardSVG(t.c)}</span>`).join("")}<span class="ucard top" data-v="${uno.v}" style="--r:${topT.r}deg;--x:${topT.x}px;--y:${topT.y}px">${cardSVG(uno.top)}</span></div>
        </div>
        <div class="udir ${uno.dir < 0 ? "rev" : ""}" aria-hidden="true">⟳</div>
      </div>
      <div class="ubar ${myTurn ? "mine" : ""}">
        <span class="ub-t">${uno.winner ? "" : myTurn ? (waiting ? "لحظة…" : uno.drew === me.uid ? "سحبت ورقة. العب ورقة أو عدّي" : anyPlayable ? "دورك! حط ورقة في الوسط 👇" : "دورك! ما عندك ورقة تنلعب، اسحب من الكومة") : `مو دورك، ننتظر ${at(pname(turnU))}`}</span>
        <span class="ub-col">${uno.winner ? "" : `<b class="usec ${tm.left <= 5 ? "hot" : ""}" id="uSec">⏱ ${ar(Math.ceil(tm.left))}</b>`}<i style="background:${col.fill}"></i>${col.name}</span>
      </div>
      ${uno.winner ? "" : `<div class="utime ${myTurn ? "mine" : ""}" aria-hidden="true"><i style="--s:${(tm.left / tm.dur).toFixed(3)};--d:${tm.left.toFixed(2)}s"></i></div>`}
      <p class="ulast">${esc(uno.last || "")}</p>
      ${uno.flash && uno.flash !== me.uid ? `<div class="uno-call pop">أونو! 🔥 ${at(pname(uno.flash))}</div>` : uno.flash === me.uid ? `<div class="uno-call pop">أونو! 🔥 باقي لك ورقة</div>` : ""}
      <div class="uhand ${myTurn ? "" : "wait"}" id="uHand">${hand.map(({ c, i }, k) => `<button class="ucard ${playable(c) ? "ok" : myTurn ? "no" : ""}" style="${fan(k)}" data-card="${esc(c)}" data-i="${i}" ${playable(c) ? "" : "aria-disabled=\"true\""} aria-label="${esc(cardName(c))}">${cardSVG(c)}</button>`).join("")}</div>
      <p class="hint center">عندك ${ar(myHand.length)} ${myHand.length === 1 ? "ورقة" : "أوراق"}</p>
      <div class="foot">
        ${myTurn && uno.drew === me.uid && !waiting ? `<button class="btn ghost" id="uPass">عدّي</button>` : ""}
        ${leaveBtn()}
      </div></section>`;
    on("uDraw", "click", () => unoMove("draw"));
    on("uPass", "click", () => unoMove("pass"));
    unoTimerStart();
    const tryPlay = c => {
      if (!myTurn) { toast(uno.winner ? "انتهت اللعبة" : "مو دورك، ننتظر @" + pname(turnU)); return false; }
      if (waiting) return false;
      if (!playable(c)) { toast("هذي الورقة ما تنلعب على اللي في الوسط"); return false; }
      if (isWild(c)) unoPickColor(c); else unoMove("play", c);
      return true;
    };
    V.querySelectorAll("[data-card]").forEach(b => {
      b.addEventListener("click", () => { if (ui.unoDragged) { ui.unoDragged = false; return; } tryPlay(b.dataset.card); });
      unoDragCard(b, tryPlay);
    });
    onAll("[data-pf]", b => showProfile(b.dataset.pf));
  },

  unoend() {
    const uno = unoState() || {}, w = uno.winner;
    V.innerHTML = `<section>${statusBar()}
      <div class="card safe pop uwin"><span class="eyebrow">انتهت الجولة</span>
        ${w ? `${avatar(pname(w), prof(w)?.photo, 84)}<span class="big" dir="ltr">${at(pname(w))}</span><span class="hint">فاز بأونو جلسة 🏆</span>` : `<span class="big">انتهت</span>`}</div>
      <div class="field"><span class="label">الأوراق اللي بقت</span><div class="list">${(uno.order || []).filter(u => u !== w).map(u => `<div class="li">${avatar(pname(u), prof(u)?.photo, 32)}<span class="nm" dir="ltr">${at(pname(u))}</span><span class="tag">${ar(uno.counts?.[u] || 0)} ورقة</span></div>`).join("")}</div></div>
      <div class="field"><span class="label">النقاط</span>${scoreBoard(order())}</div>
      <div class="foot">${shareBtn()}${isHost() ? `<button class="btn" id="again">جولة جديدة</button><button class="btn ghost" id="lobby">رجوع للغرفة</button>` : `<p class="hint center">المضيف يبدأ الجولة الجاية.</p>`}${leaveBtn()}</div></section>`;
    on("again", "click", startUno);
    on("lobby", "click", () => setRoom({ phase: "lobby" }));
  },

  mq() {
    const ps = roundPlayers(), mine = votes[me.uid]?.round === room.round ? votes[me.uid].target : null;
    V.innerHTML = `<section>${statusBar()}
      <div class="card prompt pop" style="min-height:180px"><span class="eyebrow">مين أكثر واحد…</span><span class="mid">${esc(room.prompt)}؟</span>
      <span class="hint">صوّتوا ${ar(votedCount())} من ${ar(ps.length)}</span></div>
      ${ps.includes(me.uid) ? voteList(ps, mine) : `<p class="hint">انتظر السؤال الجاي.</p>`}
      <div class="foot">${isHost() ? `<button class="btn" id="reveal">اكشف النتيجة</button>` : ""}${leaveBtn()}</div></section>`;
    on("reveal", "click", e => { if (votedCount() < ps.length && !confirmTap(e.currentTarget, "باقي ناس ما صوتوا، اكشف؟")) return; revealMost(); });
  },

  mresult() {
    const ps = roundPlayers(), tally = room.result?.tally || {};
    const max = Math.max(0, ...Object.values(tally));
    const tops = ps.filter(u => max > 0 && tally[u] === max);
    V.innerHTML = `<section>${statusBar()}
      <div class="card prompt pop" style="min-height:180px"><span class="eyebrow">${esc(room.prompt)}؟</span>
      <span class="big" dir="ltr">${tops.length ? tops.map(u => at(pname(u))).join(" و ") : "محد"}</span></div>
      ${tallyList(tally, ps)}
      <div class="foot">${shareBtn()}${isHost() ? `<button class="btn" id="again">سؤال ثاني</button><button class="btn ghost" id="lobby">رجوع للغرفة</button>` : `<p class="hint center">المضيف يجيب السؤال الجاي.</p>`}
      ${leaveBtn()}</div></section>`;
    on("again", "click", startMost);
    on("lobby", "click", () => setRoom({ phase: "lobby" }));
  },

  // ---------- مين قالها؟ ----------
  wq() {
    const ps = roundPlayers(), inRound = ps.includes(me.uid), sent = ui.wSent === room.round;
    V.innerHTML = `<section>${statusBar()}
      <div class="card prompt pop" style="min-height:170px"><span class="eyebrow">مين قالها؟ · اكتب جوابك بالسر 🤫</span><span class="mid">${esc(room.prompt)}</span></div>
      ${inRound ? (sent ? `<div class="card safe" style="min-height:120px"><span class="mid">انرسل جوابك ✓</span><span class="hint">لا تقول لأحد وش كتبت 😏</span></div>
        <button class="btn ghost" id="wEdit">عدّل جوابي</button>`
        : `<form class="wform" id="wF" autocomplete="off"><textarea class="txt" id="wIn" rows="3" maxlength="100" dir="auto" placeholder="اكتب جوابك هنا…"></textarea>
          <button class="btn">أرسل جوابي</button></form><p class="hint">اكتب بأسلوب ما يفضحك، أو قلّد أسلوب واحد ثاني 😉</p>`)
        : `<p class="hint">دخلت بعد بداية الجولة، انتظر الجولة الجاية.</p>`}
      <p class="hint center">كتب ${ar(room.wDone || 0)} من ${ar(ps.length)}</p>
      <div class="foot">${isHost() ? `<button class="btn ghost" id="wNow">اكشف الأجوبة الحين</button>` : ""}${leaveBtn()}</div></section>`;
    if (ui.wDraft && ui.wDraft.round === room.round) { const t = document.getElementById("wIn"); if (t && !t.value) t.value = ui.wDraft.t; }
    on("wIn", "input", e => ui.wDraft = { round: room.round, t: e.target.value });
    on("wF", "submit", async e => {
      e.preventDefault();
      const t = cleanMsg(document.getElementById("wIn").value).slice(0, 100);
      if (!t) return toast("اكتب جوابك أول");
      if (botBad(t)) { await botWarn(t); return; }
      if (await submitPriv({ text: t })) { ui.wSent = room.round; render(false); }
    });
    on("wEdit", "click", () => { ui.wSent = 0; render(false); });
    on("wNow", "click", e => { if ((room.wDone || 0) < ps.length && !confirmTap(e.currentTarget, "باقي ناس ما كتبوا، اكشف؟")) return; whoReveal(); });
  },

  wv() {
    const ps = roundPlayers(), list = room.wlist || [], i = room.wi || 0, inRound = ps.includes(me.uid);
    const vs = whoVotes(), mine = vs[me.uid] || null, rev = room.wshow ? (room.wrev || [])[i] : null;
    V.innerHTML = `<section>${statusBar()}
      <div class="who-n">${list.map((_, k) => `<i class="${k < i ? "done" : k === i ? "cur" : ""}"></i>`).join("")}</div>
      <div class="card prompt who-card pop" style="min-height:200px"><span class="eyebrow">${esc(room.prompt)}</span>
        <span class="mid">«${esc(censor(list[i] || ""))}»</span>
        <span class="hint">جواب ${ar(i + 1)} من ${ar(list.length)}</span></div>
      ${rev ? `<div class="card safe pop who-rev" style="min-height:120px"><span class="eyebrow">كتبها</span>
          <span class="big" dir="ltr">${at(pname(rev.a))}</span>
          <span class="hint">${rev.right.length ? `عرفوها: ${rev.right.map(atL).join("، ")} (+١)` : "ما أحد عرفها!"}${rev.fooled ? ` · وقّع ${ar(rev.fooled)} (+${ar(rev.fooled)} له)` : ""}</span></div>`
        : `<div><h2>مين كتب هالجواب؟</h2><p class="lead">صوّتوا ${ar(Object.keys(vs).length)} من ${ar(ps.length)}</p></div>
          ${inRound ? voteList(ps.filter(u => u !== me.uid), mine) : `<p class="hint">انتظر الجولة الجاية.</p>`}`}
      <div class="foot">${isHost() ? (rev ? `<button class="btn" id="wNext">${i + 1 >= list.length ? "النتيجة النهائية" : "الجواب الجاي"}</button>` : `<button class="btn danger" id="wShow">اكشف مين كتبها</button>`) : ""}${leaveBtn()}</div></section>`;
    on("wShow", "click", e => { if (Object.keys(vs).length < ps.length && !confirmTap(e.currentTarget, "باقي ناس ما صوتوا، اكشف؟")) return; whoShow(); });
    on("wNext", "click", whoNext);
  },

  wres() {
    const list = room.wlist || [], rev = room.wrev || [];
    V.innerHTML = `<section>${statusBar()}
      <div class="row-h"><h2>مين قالها؟ النتيجة</h2></div>
      <p class="lead">${esc(room.prompt)}</p>
      <div class="list">${list.map((t, k) => `<div class="li who-li"><span class="who-t2" dir="auto">«${esc(censor(t))}»</span><span class="nm" dir="ltr">${rev[k] ? at(pname(rev[k].a)) : "؟"}</span></div>`).join("")}</div>
      <div class="field"><span class="label">النقاط</span>${scoreBoard(order())}</div>
      <div class="foot">${shareBtn()}${isHost() ? `<button class="btn" id="again">سؤال جديد</button><button class="btn ghost" id="lobby">رجوع للغرفة</button>` : `<p class="hint center">المضيف يبدأ الجولة الجاية.</p>`}${leaveBtn()}</div></section>`;
    on("again", "click", startWho);
    on("lobby", "click", () => setRoom({ phase: "lobby" }));
  },

  // ---------- صح ولا خطأ ----------
  tw() {
    const teller = room.teller, mineTurn = teller === me.uid, sent = ui.tSent === room.round;
    V.innerHTML = `<section>${statusBar()}
      ${mineTurn ? (sent ? `<div class="card safe pop"><span class="mid">انرسلت ✓</span><span class="hint">ننتظر تطلع للكل…</span></div>`
        : `<div><h2>دورك! 🎤</h2><p class="lead">اكتب شي عن نفسك، صح أو كذب، وخلهم يخمّنون.</p></div>
        <form class="wform" id="tF" autocomplete="off">
          <textarea class="txt" id="tIn" rows="3" maxlength="120" dir="auto" placeholder="مثال: مرة نمت بالمطار يومين"></textarea>
          <p class="hint">وش الصدق؟ اختر عشان ترسل:</p>
          <div class="row"><button type="button" class="btn good" data-truth="1">صح ✅</button><button type="button" class="btn danger" data-truth="0">كذب ❌</button></div>
        </form>`)
      : `<div class="card prompt pop"><span class="eyebrow">صح ولا خطأ</span><span class="big" dir="ltr">${at(pname(teller))}</span><span class="hint">يكتب شي عن نفسه الحين… ✍️</span></div>`}
      <div class="foot">${isHost() && !mineTurn ? `<button class="btn ghost" id="tSkip">${atL(teller)} تأخر؟ اللي بعده</button>` : ""}${leaveBtn()}</div></section>`;
    if (ui.tDraft && ui.tDraft.round === room.round) { const t = document.getElementById("tIn"); if (t && !t.value) t.value = ui.tDraft.t; }
    on("tIn", "input", e => ui.tDraft = { round: room.round, t: e.target.value });
    onAll("[data-truth]", async b => {
      const t = cleanMsg(document.getElementById("tIn").value).slice(0, 120);
      if (!t) return toast("اكتب الجملة أول");
      if (botBad(t)) { await botWarn(t); return; }
      b.disabled = true;
      if (await submitPriv({ text: t, truth: b.dataset.truth === "1" })) { ui.tSent = room.round; render(false); } else b.disabled = false;
    });
    on("tSkip", "click", e => { if (confirmTap(e.currentTarget, "متأكد؟")) startTf(); });
  },

  tv() {
    const ps = roundPlayers(), teller = room.teller, voters = ps.filter(u => u !== teller);
    const my = votes[me.uid]?.round === room.round ? votes[me.uid].target : null;
    const n = voters.filter(u => votes[u]?.round === room.round).length;
    V.innerHTML = `<section>${statusBar()}
      <div class="card prompt pop tf-card"><span class="eyebrow">${atL(teller)} يقول:</span><span class="mid">«${esc(censor(room.tText))}»</span></div>
      ${teller === me.uid ? `<p class="hint center">خلهم يصوتون 😏 لا تفضح نفسك بوجهك</p>`
        : ps.includes(me.uid) ? `<div class="tf-btns"><button class="tfb t" data-tv="t" aria-pressed="${my === "t"}">صح ✅</button><button class="tfb f" data-tv="f" aria-pressed="${my === "f"}">كذب ❌</button></div>`
        : `<p class="hint">انتظر الجولة الجاية.</p>`}
      <p class="hint center">صوّت ${ar(n)} من ${ar(voters.length)}</p>
      <div class="foot">${isHost() ? `<button class="btn danger" id="tShow">اكشف</button>` : ""}${leaveBtn()}</div></section>`;
    onAll("[data-tv]", b => vote(b.dataset.tv));
    on("tShow", "click", e => { if (n < voters.length && !confirmTap(e.currentTarget, "باقي ناس ما صوتوا، اكشف؟")) return; tfReveal(); });
  },

  tres() {
    const r = room.result || {};
    V.innerHTML = `<section>${statusBar()}
      <div class="card ${r.truth ? "safe" : "imposter"} pop tf-card"><span class="eyebrow">${atL(room.teller)} قال:</span>
        <span class="mid">«${esc(censor(room.tText))}»</span><span class="big">${r.truth ? "صح ✅" : "كذب ❌"}</span></div>
      <div class="field"><span class="label">عرفوها (+١)</span><p class="lead">${r.right?.length ? r.right.map(atL).join("، ") : "ولا أحد 😅"}</p></div>
      ${r.wrong?.length ? `<div class="field"><span class="label">انخدعوا (+${ar(r.wrong.length)} لـ ${atL(room.teller)})</span><p class="lead">${r.wrong.map(atL).join("، ")}</p></div>` : ""}
      <div class="field"><span class="label">النقاط</span>${scoreBoard(order())}</div>
      <div class="foot">${shareBtn()}${isHost() ? `<button class="btn" id="again">دور اللي بعده</button><button class="btn ghost" id="lobby">رجوع للغرفة</button>` : `<p class="hint center">المضيف يبدأ الدور الجاي.</p>`}${leaveBtn()}</div></section>`;
    on("again", "click", startTf);
    on("lobby", "click", () => setRoom({ phase: "lobby" }));
  },

  // ---------- ارسم وخمّن ----------
  dq() {
    const key = room.round + ":" + room.drawer, wrap = document.getElementById("dWrap");
    const amDrawer = room.drawer === me.uid;
    if (wrap && wrap.dataset.key === key) { drawParts(); return "kept"; }
    V.innerHTML = `<section class="drawv">${statusBar()}
      <div id="dWrap" data-key="${esc(key)}">
        <div class="dtop"><div class="dword" id="dWord"></div><span class="dleft" id="dLeft"></span></div>
        <div class="timer"><i id="dBar"></i></div>
        <div class="dpad ${amDrawer ? "mine" : ""}"><canvas id="dCanvas" aria-label="${amDrawer ? "لوحة الرسم" : "رسمة"}"></canvas></div>
        ${amDrawer ? `<div class="dtools">
          <div class="dcols">${DCOLORS.map((c, i) => `<button class="dcol" data-dc="${i}" style="--c:${c}" aria-label="لون" aria-pressed="${DRAWS.c === i}"></button>`).join("")}</div>
          <div class="drow">${DSIZES.map((s, i) => `<button class="dsz" data-ds="${i}" aria-label="حجم ${i + 1}" aria-pressed="${DRAWS.w === i}"><i style="width:${6 + i * 7}px;height:${6 + i * 7}px"></i></button>`).join("")}
            <button class="btn small ghost" id="dUndo">↩︎ تراجع</button><button class="btn small ghost" id="dClear">مسح</button></div></div>`
        : `<div id="dGuessBox"></div>`}
        <div class="dfeed" id="dFeed" aria-live="polite"></div>
      </div>
      <div class="foot">${isHost() ? `<button class="btn ghost" id="dEnd">إنهاء الجولة</button>` : ""}${leaveBtn()}</div></section>`;
    if (DRAWS.sRound !== room.round) { DRAWS.strokes = []; }
    paintCanvas();
    bindDrawPad();
    onAll("[data-dc]", b => { DRAWS.c = Number(b.dataset.dc); V.querySelectorAll("[data-dc]").forEach(x => x.setAttribute("aria-pressed", x === b)); });
    onAll("[data-ds]", b => { DRAWS.w = Number(b.dataset.ds); V.querySelectorAll("[data-ds]").forEach(x => x.setAttribute("aria-pressed", x === b)); });
    on("dUndo", "click", () => { DRAWS.strokes.pop(); paintCanvas(); pushCanvas(); });
    on("dClear", "click", e => { if (!confirmTap(e.currentTarget, "أكيد؟")) return; DRAWS.strokes = []; DRAWS.sRound = room.round; paintCanvas(); pushCanvas(); });
    on("dEnd", "click", e => { if (confirmTap(e.currentTarget, "تنهي الجولة؟")) drawEnd(); });
    ui.dGuessState = null;
    drawParts();
    if (!DRAWS.tick) DRAWS.tick = setInterval(drawTick, 300);
    drawTick();
  },

  dres() {
    const r = room.result || {}, got = r.got || {};
    const ids = Object.keys(got).sort((a, b) => got[a] - got[b]);
    V.innerHTML = `<section>${statusBar()}
      <div class="card prompt pop" style="min-height:120px"><span class="eyebrow">الكلمة كانت</span><span class="big">${esc(r.word || "؟")}</span>
        <span class="hint">رسمها ${atL(room.drawer)}${ids.length ? ` (+${ar(ids.length)})` : ""}</span></div>
      <div class="dpad"><canvas id="dCanvas" aria-label="الرسمة"></canvas></div>
      <div class="field"><span class="label">عرفوها</span>${ids.length ? `<div class="list">${ids.map(u => `<div class="li">${avatar(pname(u), prof(u)?.photo, 32)}<span class="nm" dir="ltr">${at(pname(u))}</span><span class="tag">+${ar(got[u] === 1 ? 3 : got[u] === 2 ? 2 : 1)}</span></div>`).join("")}</div>` : `<p class="lead">ولا أحد 😅</p>`}</div>
      <div class="field"><span class="label">النقاط</span>${scoreBoard(order())}</div>
      <div class="foot">${shareBtn()}${isHost() ? `<button class="btn" id="again">اللي بعده يرسم</button><button class="btn ghost" id="lobby">رجوع للغرفة</button>` : `<p class="hint center">المضيف يبدأ الجولة الجاية.</p>`}${leaveBtn()}</div></section>`;
    paintCanvas();
    on("again", "click", startDraw);
    on("lobby", "click", () => setRoom({ phase: "lobby" }));
  },
};

/* ================= بجوال واحد (offline) ================= */
const L = {
  count: store.get("players", 5), names: store.get("names", []), scores: store.get("scores", {}),
  imps: store.get("imps", 1), cat: store.get("cat", "عشوائي"), used: store.get("used", {}),
  fiveTurn: store.get("fiveTurn", 0), round: null, mostDeck: [], fiveDeck: [], timer: null, raf: null
};
const lname = i => (L.names[i] || "").trim() || "اللاعب " + ar(i + 1);
const lmaxImps = () => L.count >= 7 ? 2 : 1;
function laddScore(i, n) { L.scores["p" + i] = (L.scores["p" + i] || 0) + n; store.set("scores", L.scores); }
function stopLocalTimers() { clearInterval(L.timer); L.timer = null; if (L.raf) cancelAnimationFrame(L.raf); L.raf = null; }

VIEWS.local = () => {
  V.innerHTML = `<section>
    <div><h2>بجوال واحد</h2><p class="lead">مرّروا الجوال بينكم وخلوا السوالف تبدأ.</p></div>
    <div class="players-card">
      <div class="row-h"><b class="pc-t">اللاعبين <span class="pc-n">${ar(L.count)}</span></b>
      <button class="btn small" id="roster">✏️ عدّل اللاعبين</button></div>
      <div class="pchips">${Array.from({ length: L.count }, (_, i) => `<span class="pchip">${avatar(lname(i), "", 30, (L.names[i] || "").trim() ? "" : ar(i + 1))}<span>${esc(lname(i))}</span></span>`).join("")}</div>
      ${L.names.slice(0, L.count).some(n => (n || "").trim()) ? "" : `<p class="hint">اكتبوا أسماءكم عشان تطلع في اللعب والنقاط.</p>`}
    </div>
    <div class="modes">
      <button class="mode" id="m1"><span class="glyph">${ICONS.imp}</span><b>الدخيل</b><span>الكل يعرف الكلمة إلا واحد. اكشفوه قبل ما يكشف الكلمة.</span></button>
      <button class="mode" id="m2"><span class="glyph">${ICONS.most}</span><b>مين أكثر واحد؟</b><span>سؤال على الشاشة، وعلى العد الكل يأشر على واحد.</span></button>
      <button class="mode" id="m3"><span class="glyph">${ICONS.five}</span><b>خمسة بعشر</b><span>اذكر خمسة أشياء من الفئة خلال عشر ثواني.</span></button>
      <button class="mode" id="m4"><span class="glyph">${ICONS.hhnj}</span><b>إنسان حيوان نبات جماد</b><span>حرف عشوائي ومؤقت. اكتبوا بالورقة والقلم.</span></button>
    </div>
    <div class="foot"><button class="btn ghost" id="ls">النقاط</button></div></section>`;
  on("roster", "click", () => go("l-players"));
  on("m1", "click", () => go("l-imp"));
  on("m2", "click", () => { L.mostPrompt = null; go("l-most"); });
  on("m3", "click", () => { L.fivePrompt = null; go("l-five"); });
  on("m4", "click", () => { L.letter = null; go("l-hhnj"); });
  on("ls", "click", () => go("l-scores"));
};

VIEWS["l-players"] = () => {
  V.innerHTML = `<section><h2>اللاعبين</h2>
    <div class="field"><span class="label">العدد</span><div class="stepper"><button id="pm" aria-label="أقل">−</button><output>${ar(L.count)}</output><button id="pp" aria-label="أكثر">+</button></div></div>
    <div class="field"><span class="label">الأسماء (اختياري)</span><div class="name-list">${Array.from({ length: L.count }, (_, i) =>
      `<input class="txt" id="ln${i}" maxlength="14" placeholder="اللاعب ${ar(i + 1)}" value="${esc(L.names[i] || "")}" aria-label="اسم اللاعب ${ar(i + 1)}">`).join("")}</div></div>
    <div class="foot"><button class="btn" id="done">تم</button></div></section>`;
  V.querySelectorAll(".name-list input").forEach((inp, i) => inp.addEventListener("input", () => { L.names[i] = inp.value; store.set("names", L.names); }));
  on("pm", "click", () => { L.count = Math.max(2, L.count - 1); store.set("players", L.count); render(true); });
  on("pp", "click", () => { L.count = Math.min(12, L.count + 1); store.set("players", L.count); render(true); });
  on("done", "click", () => go("local"));
};

VIEWS["l-scores"] = () => {
  const rows = Array.from({ length: L.count }, (_, i) => ({ i, pts: L.scores["p" + i] || 0 })).sort((a, b) => b.pts - a.pts);
  const top = rows[0]?.pts || 0;
  V.innerHTML = `<section><h2>النقاط</h2><p class="lead">تنحسب من الدخيل وخمسة بعشر.</p>
    <div class="board">${rows.map((r, k) => `<div class="r ${r.pts > 0 && r.pts === top ? "top" : ""}"><span class="rank">${ar(k + 1)}</span><span class="nm">${esc(lname(r.i))}</span><span class="pts">${ar(r.pts)}</span></div>`).join("")}</div>
    <div class="foot"><button class="btn ghost" id="reset">صفّر النقاط</button></div></section>`;
  on("reset", "click", e => { if (!confirmTap(e.currentTarget)) return; L.scores = {}; store.set("scores", {}); toast("تصفّرت النقاط"); render(true); });
};

VIEWS["l-imp"] = () => {
  L.imps = Math.min(L.imps, lmaxImps());
  V.innerHTML = `<section><h2>الدخيل</h2>
    <div class="field"><span class="label">عدد الدخلاء</span><div class="stepper"><button id="im" aria-label="أقل">−</button><output>${ar(L.imps)}</output><button id="ip" aria-label="أكثر">+</button></div>
    ${L.count < 7 ? `<p class="hint">دخيلين يحتاجون ٧ لاعبين أو أكثر.</p>` : ""}</div>
    <div class="field"><span class="label">الفئة</span><div class="chips">${["عشوائي", ...Object.keys(WORDS)].map(c => `<button class="chip" data-c="${esc(c)}" aria-pressed="${L.cat === c}">${esc(c)}</button>`).join("")}</div></div>
    <div class="foot"><button class="btn" id="go">ابدأ التوزيع</button></div></section>`;
  on("im", "click", () => { L.imps = Math.max(1, L.imps - 1); store.set("imps", L.imps); render(true); });
  on("ip", "click", () => { L.imps = Math.min(lmaxImps(), L.imps + 1); store.set("imps", L.imps); render(true); });
  onAll("[data-c]", b => { L.cat = b.dataset.c; store.set("cat", L.cat); render(true); });
  on("go", "click", lNewRound);
};
function lPickWord(c) {
  const used = new Set(L.used[c] || []);
  let pool = WORDS[c].filter(w => !used.has(w));
  if (!pool.length) { L.used[c] = []; pool = WORDS[c]; }
  const w = pick(pool);
  L.used[c] = [...(L.used[c] || []), w]; store.set("used", L.used);
  return w;
}
function lNewRound() {
  if (L.count < 3) { toast("الدخيل يحتاج ٣ لاعبين على الأقل"); return; }
  const c = L.cat === "عشوائي" || !WORDS[L.cat] ? pick(Object.keys(WORDS)) : L.cat;
  L.round = { cat: c, word: lPickWord(c), imps: shuffle([...Array(L.count).keys()]).slice(0, Math.min(L.imps, lmaxImps())), i: 0, shown: false, starter: Math.floor(Math.random() * L.count), stage: "play" };
  go("l-pass");
}
VIEWS["l-pass"] = () => {
  const r = L.round, isImp = r.imps.includes(r.i);
  let card;
  if (!r.shown) card = `<div class="card tap" id="pc" role="button" tabindex="0"><span class="eyebrow">الجوال عند</span><span class="big">${esc(lname(r.i))}</span><span class="hint">تأكد ما أحد يشوف الشاشة، واضغط عشان تشوف كلمتك</span></div>`;
  else if (isImp) card = `<div class="card imposter pop"><span class="eyebrow">الفئة: ${esc(r.cat)}</span><span class="big">أنت الدخيل</span><span class="hint">ما تعرف الكلمة. جارِهم وحاول تكتشفها.</span></div>`;
  else card = `<div class="card word pop"><span class="eyebrow">الفئة: ${esc(r.cat)}</span><span class="big">${esc(r.word)}</span><span class="hint">احفظها ولا تقولها.</span></div>`;
  V.innerHTML = `<section><div class="dots" aria-hidden="true">${Array.from({ length: L.count }, (_, k) => `<i class="${k < r.i ? "on" : ""}"></i>`).join("")}</div>${card}
    <div class="foot">${r.shown ? `<button class="btn" id="nx">${r.i === L.count - 1 ? "خبّيتها، ابدأوا" : "خبّيتها، مرّر الجوال"}</button>` : ""}</div></section>`;
  const reveal = () => { r.shown = true; render(true); };
  on("pc", "click", reveal);
  on("pc", "keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); reveal(); } });
  on("nx", "click", () => { r.i++; r.shown = false; if (r.i < L.count) render(true); else { r.stage = "play"; r.scored = false; go("l-play"); } });
};
VIEWS["l-play"] = () => {
  const r = L.round;
  if (r.stage === "play") {
    V.innerHTML = `<section><div class="card pop"><span class="eyebrow">يبدأ الأسئلة</span><span class="big">${esc(lname(r.starter))}</span>
      <span class="hint">كل واحد يسأل اللي بعده سؤال عن الكلمة بدون ما يفضحها. بعدها صوّتوا على الدخيل.</span></div>
      <div class="foot"><button class="btn danger" id="rv">صوّتنا، اكشف الدخيل</button><button class="btn ghost" id="ag">جولة جديدة</button></div></section>`;
    on("rv", "click", e => { if (!confirmTap(e.currentTarget, "متأكدين؟ اضغط مرة ثانية")) return; r.stage = "result"; render(true); });
    on("ag", "click", lNewRound);
    return;
  }
  const ids = [...r.imps].sort((a, b) => a - b);
  V.innerHTML = `<section><div class="card imposter pop"><span class="eyebrow">${ids.length > 1 ? "الدخلاء" : "الدخيل"}</span>
    <span class="big">${ids.map(k => esc(lname(k))).join(" و ")}</span><span class="hint">${r.wordShown ? `الكلمة كانت: <b>${esc(r.word)}</b>${r.guessed ? " · خمّنها ✓" : ""}` : "الكلمة مخفية لين يخمّن الدخيل 🤔"}</span></div>
    <div class="foot"><p class="hint center">وش صار في التصويت؟</p>
    <div class="row"><button class="btn good" id="c" ${r.scored ? "disabled" : ""}>مسكناه</button><button class="btn danger" id="e" ${r.scored ? "disabled" : ""}>نجا منّا</button></div>
    ${r.wordShown ? "" : `<p class="hint center">الدخيل يقول وش يتوقع الكلمة:</p>
    <div class="row"><button class="btn ghost" id="g">خمّن صح (+١)</button><button class="btn ghost" id="gn">خمّن غلط</button></div>`}
    <button class="btn ghost" id="ag">جولة جديدة</button></div></section>`;
  on("c", "click", () => { if (r.scored) return; for (let k = 0; k < L.count; k++) if (!r.imps.includes(k)) laddScore(k, 1); r.scored = true; toast("+١ لكل اللي مسكوه"); render(true); });
  on("e", "click", () => { if (r.scored) return; ids.forEach(k => laddScore(k, 2)); r.scored = true; toast("+٢ للدخيل"); render(true); });
  on("g", "click", () => { ids.forEach(k => laddScore(k, 1)); r.guessed = true; r.wordShown = true; toast("+١ للدخيل"); render(true); });
  on("gn", "click", () => { r.wordShown = true; render(true); });
  on("ag", "click", lNewRound);
};

VIEWS["l-most"] = () => {
  if (!L.mostPrompt) { if (!L.mostDeck.length) L.mostDeck = shuffle(MOST); L.mostPrompt = L.mostDeck.pop(); }
  V.innerHTML = `<section><div class="card prompt pop"><span class="eyebrow">مين أكثر واحد…</span><span class="mid">${esc(L.mostPrompt)}؟</span>
    <span class="count" id="cnt" hidden></span></div>
    <div class="foot"><button class="btn" id="cb">عدّ وأشّروا</button><button class="btn ghost" id="nx">سؤال ثاني</button></div></section>`;
  on("nx", "click", () => { stopLocalTimers(); L.mostPrompt = null; render(true); });
  on("cb", "click", e => {
    const btn = e.currentTarget, cnt = document.getElementById("cnt");
    let n = 3; cnt.hidden = false; cnt.textContent = ar(n); btn.disabled = true;
    stopLocalTimers();
    L.timer = setInterval(() => { n--; if (n > 0) cnt.textContent = ar(n); else { stopLocalTimers(); cnt.textContent = "أشّروا!"; btn.disabled = false; } }, 800);
  });
};

VIEWS["l-five"] = () => {
  if (!L.fivePrompt) { if (!L.fiveDeck.length) L.fiveDeck = shuffle(FIVE); L.fivePrompt = L.fiveDeck.pop(); }
  L.fiveTurn = L.fiveTurn % L.count;
  V.innerHTML = `<section><div class="card prompt"><span class="eyebrow">الدور على ${esc(lname(L.fiveTurn))}</span><span class="eyebrow">اذكر خمسة…</span>
    <span class="mid">${esc(L.fivePrompt)}</span><div class="timer" aria-hidden="true"><i id="bar"></i></div><span class="count" id="sec">${ar(10)}</span></div>
    <div class="foot" id="ff"><button class="btn" id="go">ابدأ العد</button><button class="btn ghost" id="sk">فئة ثانية</button></div></section>`;
  const next = () => { L.fiveTurn = (L.fiveTurn + 1) % L.count; store.set("fiveTurn", L.fiveTurn); L.fivePrompt = null; render(true); };
  on("sk", "click", () => { stopLocalTimers(); L.fivePrompt = null; render(true); });
  on("go", "click", () => {
    document.getElementById("go").disabled = true; document.getElementById("sk").disabled = true;
    const t0 = performance.now(), dur = 10000;
    const tick = now => {
      const left = Math.max(0, dur - (now - t0));
      const bar = document.getElementById("bar"), sec = document.getElementById("sec");
      if (!bar) return;
      bar.style.transform = `scaleX(${left / dur})`;
      sec.textContent = left > 0 ? ar(Math.ceil(left / 1000)) : "خلص الوقت!";
      if (left > 0) { L.raf = requestAnimationFrame(tick); return; }
      L.raf = null;
      document.getElementById("ff").innerHTML = `<p class="hint center">قال خمسة؟</p><div class="row"><button class="btn good" id="y">إيه (+١)</button><button class="btn danger" id="n">لا</button></div>`;
      on("y", "click", () => { laddScore(L.fiveTurn, 1); toast("+١ لـ" + lname(L.fiveTurn)); next(); });
      on("n", "click", next);
    };
    L.raf = requestAnimationFrame(tick);
  });
};

VIEWS["l-hhnj"] = () => {
  if (!L.letter) L.letter = pick(LETTERS);
  const SECS = 60;
  V.innerHTML = `<section>
    <div class="hletter pop"><span class="eyebrow">الحرف</span><span class="hl">${esc(L.letter)}</span>
      <div class="timer" aria-hidden="true"><i id="bar"></i></div><span class="count" id="sec">${ar(SECS)}</span></div>
    <div class="hcats">${HCATS.map(c => `<span>${c}</span>`).join("")}</div>
    <p class="hint center">كل واحد يكتب بورقته أربع كلمات تبدأ بالحرف. ١٠ نقاط للجواب اللي محد كتبه، و٥ لو تكرر.</p>
    <div class="foot" id="ff"><button class="btn" id="go">ابدأ الوقت</button><button class="btn ghost" id="nl">حرف ثاني</button></div></section>`;
  on("nl", "click", () => { stopLocalTimers(); L.letter = null; render(true); });
  on("go", "click", () => {
    document.getElementById("go").disabled = true;
    const t0 = performance.now(), dur = SECS * 1000;
    const tick = now => {
      const left = Math.max(0, dur - (now - t0));
      const bar = document.getElementById("bar"), sec = document.getElementById("sec");
      if (!bar) return;
      bar.style.transform = `scaleX(${left / dur})`;
      sec.textContent = left > 0 ? ar(Math.ceil(left / 1000)) : "وقّفوا! ✋";
      if (left > 0) { L.raf = requestAnimationFrame(tick); return; }
      L.raf = null;
      document.getElementById("ff").innerHTML = `<button class="btn" id="nl2">حرف جديد</button>`;
      on("nl2", "click", () => { L.letter = null; render(true); });
    };
    L.raf = requestAnimationFrame(tick);
  });
};

// ابقِ الشاشة شغالة أثناء اللعب لو الجهاز يسمح
let wakeLock = null;
document.addEventListener("click", async () => {
  try { if ("wakeLock" in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request("screen"); wakeLock.addEventListener("release", () => wakeLock = null); } } catch (e) {}
});

/* ================= الزوار بدون حساب (للإحصائيات) ================= */
function startGuest(uid) {
  guestUid = uid;
  const ping = async () => {
    try { await updateDoc(doc(db, "guests", uid), { lastSeen: serverTimestamp() }); }
    catch (e) { setDoc(doc(db, "guests", uid), { firstSeen: serverTimestamp(), lastSeen: serverTimestamp() }).catch(() => {}); }
  };
  ping(); guestTimer = setInterval(ping, 60000);
}
function stopGuest() { clearInterval(guestTimer); guestTimer = null; guestUid = null; }

/* ================= start ================= */
if (configured) {
  // الإعلان يوصل للكل، حتى اللي يلعبون بدون حساب
  onSnapshot(doc(db, "config", "announce"), s => {
    announce = s.exists() ? s.data() : null; renderBanner(); if (screen === "admin") render(false);
  }, err);
  getRedirectResult(auth).catch(() => {});
  onSnapshot(doc(db, "config", "shop"), s => { shopCfg = s.exists() ? s.data() : null; if (screen === "shop" || screen === "admin") render(false); }, () => {});
  onSnapshot(doc(db, "config", "banner"), s => {
    promo = s.exists() ? s.data() : null; renderBanner(); if (screen === "admin") render(false);
  }, err);
  const GUEST_OK = new Set(["auth", "email", "forgot", "local", "setup", "l-players", "l-imp", "l-pass", "l-play", "l-most", "l-five", "l-scores", "l-hhnj"]);
  onAuthStateChanged(auth, async user => {
    stopGlobal(); stopGuest();
    if (!user) {
      me = null;
      if (!GUEST_OK.has(screen)) go("auth");
      signInAnonymously(auth).catch(() => {});
      return;
    }
    if (user.isAnonymous) {
      me = null; startGuest(user.uid);
      if (!GUEST_OK.has(screen)) go("auth"); else renderHeader();
      return;
    }
    try {
      const s = await getDoc(doc(db, "users", user.uid));
      if (!s.exists()) { me = { uid: user.uid }; go("username"); return; }
      me = { uid: user.uid, username: s.data().username, photo: s.data().photo || "", bio: s.data().bio || "", xp: s.data().xp || 0, stats: s.data().stats || {}, look: s.data().look || null, owned: s.data().owned || [], vipUntil: s.data().vipUntil || 0, frame: s.data().frame || "", renamedAt: s.data().usernameChangedAt || null, warns: s.data().warns || 0, mutedUntil: s.data().mutedUntil || 0 };
      startGlobal();
      const b = await getDoc(doc(db, "bans", user.uid)).catch(() => null);
      if (b?.exists()) { banned = true; go("banned"); return; }
      afterLogin();
    } catch (e) {
      console.error(e); me = { uid: user.uid }; toast("فيه مشكلة في الاتصال"); go("username");
    }
  });
} else {
  go("setup");
}
