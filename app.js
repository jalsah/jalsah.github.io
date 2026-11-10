import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult,
  onAuthStateChanged, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, onSnapshot,
  collection, query, where, runTransaction, writeBatch, serverTimestamp, deleteField
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js?v=6";
import { WORDS, MOST, FIVE } from "./content.js?v=6";
import { ICONS } from "./icons.js?v=6";

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
const at = name => `@${esc(name)}${String(name).toLowerCase() === OWNER ? ' <span class="crown" title="صاحب اللعبة" aria-label="صاحب اللعبة">👑</span>' : ""}`;
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const ONLINE_MS = 150000;
const INVITE_MS = 15 * 60 * 1000;
const GAMES = { imp: "الدخيل", most: "مين أكثر واحد" };

const V = document.getElementById("view");
const HDR = document.getElementById("hdr");
const BANNER = document.getElementById("banner");

/* ================= firebase ================= */
const configured = !String(firebaseConfig.apiKey || "").startsWith("PASTE");
let auth = null, db = null;
if (configured) {
  const fb = initializeApp(firebaseConfig);
  auth = getAuth(fb);
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

let pendingJoin = (new URLSearchParams(location.search).get("r") || "").toUpperCase() || null;

const isOnline = f => { const t = f?.lastSeen?.toMillis?.(); return !!t && Date.now() - t < ONLINE_MS; };
const pairId = (a, b) => [a, b].sort().join("_");

/* ================= navigation & rendering ================= */
const REFRESH = new Set(["home", "friends", "room", "profile"]);
function go(name) {
  stopLocalTimers();
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
    V.querySelectorAll("input[id]").forEach(i => saved[i.id] = i.value);
    focusId = document.activeElement?.id || null;
  }
  renderHeader(); renderBanner();
  (VIEWS[screen] || VIEWS.loading)();
  if (!fresh) {
    for (const id in saved) { const el = document.getElementById(id); if (el) el.value = saved[id]; }
    if (focusId) { const el = document.getElementById(focusId); if (el && el.tagName === "INPUT") el.focus(); }
  }
}
function on(id, ev, fn) { const el = document.getElementById(id); if (el) el.addEventListener(ev, fn); return el; }
function onAll(sel, fn) { V.querySelectorAll(sel).forEach(el => el.addEventListener("click", e => fn(e.currentTarget, e))); }

const BACK = {
  friends: "home", profile: "home",
  email: "auth",
  local: () => me?.username ? "home" : (configured ? "auth" : "setup"),
  "l-players": "local", "l-imp": "local", "l-pass": "local", "l-play": "local",
  "l-most": "local", "l-five": "local", "l-scores": "local"
};
function renderHeader() {
  let h = "";
  if (roomCode && screen !== "room") h += `<button class="pill hot" id="hRoom">الغرفة ${esc(roomCode)}</button>`;
  const back = BACK[screen];
  if (back) h += `<button class="pill" id="hBack">رجوع</button>`;
  if (me?.username && !back && screen !== "room") {
    h += `<button class="pill" id="hFriends">الأصدقاء${reqIn.length ? `<span class="badge">${ar(reqIn.length)}</span>` : ""}</button>`;
    h += `<button class="pill" id="hMe" dir="ltr">${at(me.username)}</button>`;
  }
  HDR.innerHTML = h;
  HDR.querySelector("#hRoom")?.addEventListener("click", () => go("room"));
  HDR.querySelector("#hBack")?.addEventListener("click", () => go(typeof back === "function" ? back() : back));
  HDR.querySelector("#hFriends")?.addEventListener("click", () => go("friends"));
  HDR.querySelector("#hMe")?.addEventListener("click", () => go("profile"));
}
function renderBanner() {
  const now = Date.now();
  const list = invites.filter(i => {
    const t = i.at?.toMillis?.() ?? now;
    return now - t < INVITE_MS && i.code !== roomCode;
  });
  BANNER.innerHTML = list.map(i => `
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

function afterLogin() {
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
    if (s.exists()) throw { code: "taken" };
    tx.set(ref, { uid: me.uid });
    tx.set(doc(db, "users", me.uid), { username: name, createdAt: serverTimestamp(), lastSeen: serverTimestamp() });
  });
}

/* ================= live data ================= */
function startGlobal() {
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
        if (s.exists()) friends.set(uid, { username: s.data().username, lastSeen: s.data().lastSeen });
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
  friends.clear(); reqIn = []; reqOut = []; invites = [];
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
    toast("انرسل الطلب إلى @" + name);
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
    toast("انرسلت الدعوة");
  } catch (e) { console.error(e); toast("ما قدرنا نرسل الدعوة"); }
}

/* ================= rooms ================= */
const roomRef = () => doc(db, "rooms", roomCode);
const isHost = () => room?.host === me?.uid;
const order = () => Object.entries(room?.players || {}).sort((a, b) => a[1].at - b[1].at).map(([u]) => u);
const pname = u => room?.players?.[u]?.name || room?.names?.[u] || "—";
const roundPlayers = () => (room?.roundPlayers || order()).filter(u => room.players[u]);

async function createRoom() {
  try {
    let code;
    for (let i = 0; i < 6; i++) {
      code = Array.from({ length: 5 }, () => pick(CODE_CHARS)).join("");
      if (!(await getDoc(doc(db, "rooms", code))).exists()) break;
    }
    await setDoc(doc(db, "rooms", code), {
      host: me.uid, createdAt: serverTimestamp(), phase: "lobby", game: "imp", cat: "عشوائي", imps: 1,
      round: 0, players: { [me.uid]: { name: me.username, at: Date.now() } }, scores: {}
    });
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
    if (!room.players?.[me.uid]) { exitRoomLocal("طلعت من الغرفة"); return; }
    if (!subs.has("secret")) sub("secret", onSnapshot(doc(db, "rooms", code, "secrets", me.uid), d => { secret = d.exists() ? d.data() : null; if (screen === "room") render(false); }, err));
    if (!subs.has("votes")) sub("votes", onSnapshot(collection(db, "rooms", code, "votes"), q => {
      votes = {}; q.forEach(d => votes[d.id] = d.data()); if (screen === "room") render(false);
    }, err));
    if (screen === "room") render(false); else renderHeader();
  }, e => { console.error(e); exitRoomLocal("انقطع الاتصال بالغرفة"); }));
  go("room");
}
function exitRoomLocal(msg) {
  off("room"); off("secret"); off("votes");
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
  await setRoom({ scores, "result.guessed": true });
}
// ---- مين أكثر واحد أونلاين (المضيف) ----
async function startMost() {
  const ps = order();
  if (ps.length < 3) return toast("تحتاجون ٣ لاعبين على الأقل");
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
async function vote(target) {
  try { await setDoc(doc(db, "rooms", roomCode, "votes", me.uid), { round: room.round, target }); }
  catch (e) { console.error(e); toast("ما انحسب صوتك، جرّب مرة ثانية"); }
}

/* ================= views ================= */
const VIEWS = {};

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
      <button class="btn ghost" id="byEmail">سجّل بالإيميل</button>
      <div class="or"><span>أو</span></div>
      <button class="btn ghost" id="local">العب بدون حساب</button>
      <p class="hint center">بدون حساب تلعبون بجوال واحد. للعب أونلاين وإضافة الأصحاب تحتاج حساب.</p>
    </div></section>`;
  on("login", "click", login);
  on("byEmail", "click", () => { ui.emailMode = "signup"; go("email"); });
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

VIEWS.email = () => {
  const signup = ui.emailMode !== "login";
  V.innerHTML = `<section>
    <div><h2>${signup ? "سوّ حساب جديد" : "سجّل دخول"}</h2>
    <p class="lead">${signup ? "بعدها تختار يوزرك وتبدأ تضيف أصحابك." : "ادخل بالإيميل وكلمة السر اللي سجلت فيها."}</p></div>
    <div class="tabs" role="tablist">
      <button class="tab" role="tab" id="tSignup" aria-selected="${signup}">حساب جديد</button>
      <button class="tab" role="tab" id="tLogin" aria-selected="${!signup}">عندي حساب</button>
    </div>
    <form class="field" id="emailF" novalidate>
      <label class="label" for="em">الإيميل</label>
      <input class="txt" id="em" type="email" dir="ltr" autocomplete="email" autocapitalize="none" inputmode="email" placeholder="name@gmail.com">
      <label class="label" for="pw">كلمة السر</label>
      <input class="txt" id="pw" type="password" dir="ltr" autocomplete="${signup ? "new-password" : "current-password"}" placeholder="${signup ? "مثال: Dalp2026" : ""}">
      ${signup ? `<p class="hint" id="pwHint">٨ خانات أو أكثر، وفيها حرف إنجليزي كبير واحد على الأقل.</p>` : ""}
      ${signup ? `<label class="label" for="pw2">أكّد كلمة السر</label>
      <input class="txt" id="pw2" type="password" dir="ltr" autocomplete="new-password">` : ""}
      <p class="hint msg-bad" id="emMsg" role="alert"></p>
      <button class="btn" id="emGo">${signup ? "سوّ الحساب" : "دخول"}</button>
      ${signup ? "" : `<button type="button" class="link center" id="forgot">نسيت كلمة السر؟</button>`}
    </form>
    <div class="foot"><button class="btn ghost" id="gInstead"><span class="g-logo" aria-hidden="true">${GOOGLE_G}</span>أو كمّل بقوقل</button></div>
  </section>`;
  const msg = document.getElementById("emMsg");
  const pwIn = document.getElementById("pw"), pwHint = document.getElementById("pwHint");
  if (pwHint) pwIn.addEventListener("input", () => {
    const v = pwIn.value, okLen = v.length >= PW_MIN, okUp = HAS_UPPER.test(v);
    pwHint.className = "hint " + (!v ? "" : okLen && okUp ? "msg-ok" : "msg-bad");
    pwHint.textContent = !v ? "٨ خانات أو أكثر، وفيها حرف إنجليزي كبير واحد على الأقل."
      : (okLen ? "✓ ٨ خانات" : "✗ ٨ خانات أو أكثر") + "  ·  " + (okUp ? "✓ حرف كبير" : "✗ حرف كبير (A-Z)");
  });
  on("tSignup", "click", () => { ui.emailMode = "signup"; render(false); });
  on("tLogin", "click", () => { ui.emailMode = "login"; render(false); });
  on("gInstead", "click", login);
  on("forgot", "click", async () => {
    const em = document.getElementById("em").value.trim();
    if (!em) { msg.textContent = "اكتب إيميلك فوق، وبعدها اضغط نسيت كلمة السر."; return; }
    try { await sendPasswordResetEmail(auth, em); msg.className = "hint msg-ok"; msg.textContent = "أرسلنا لك رابط تغيير كلمة السر على الإيميل."; }
    catch (e) { msg.className = "hint msg-bad"; msg.textContent = AUTH_ERR[e.code] || "ما قدرنا نرسل الرابط."; }
  });
  on("emailF", "submit", async e => {
    e.preventDefault();
    msg.className = "hint msg-bad"; msg.textContent = "";
    const em = document.getElementById("em").value.trim();
    const pw = document.getElementById("pw").value;
    if (!/^\S+@\S+\.\S+$/.test(em)) { msg.textContent = AUTH_ERR["auth/invalid-email"]; return; }
    if (signup && (pw.length < PW_MIN || !HAS_UPPER.test(pw))) { msg.textContent = AUTH_ERR["auth/weak-password"]; return; }
    if (!signup && !pw) { msg.textContent = "اكتب كلمة السر."; return; }
    if (signup && pw !== document.getElementById("pw2").value) { msg.textContent = "كلمتين السر مو نفس بعض."; return; }
    const btn = document.getElementById("emGo"); btn.disabled = true; btn.textContent = "لحظة…";
    try {
      if (signup) await createUserWithEmailAndPassword(auth, em, pw);
      else await signInWithEmailAndPassword(auth, em, pw);
    } catch (err) {
      btn.disabled = false; btn.textContent = signup ? "سوّ الحساب" : "دخول";
      msg.textContent = AUTH_ERR[err.code] || "ما زبط، جرّب مرة ثانية.";
    }
  });
};

const UNAME_HINT = "حروف إنجليزية وأرقام و _ و - ، من ٣ إلى ٢٠ خانة، وفيه حرف كبير واحد على الأقل.";

VIEWS.username = () => {
  V.innerHTML = `<section>
    <div><h2>اختر يوزرك</h2><p class="lead">أصحابك يضيفونك فيه. ما تقدر تغيّره بعدين، فاختره زين.</p></div>
    <div class="field"><label class="label" for="uname">اليوزر</label>
      <div class="uinput"><span>@</span><input id="uname" autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="20" placeholder="D-A-L-P"></div>
      <p class="hint" id="unameMsg">${UNAME_HINT}</p></div>
    <div class="foot"><button class="btn" id="claim" disabled>اعتمد اليوزر</button>
    <button class="btn ghost" id="logout">تسجيل خروج</button></div></section>`;
  const inp = document.getElementById("uname"), msg = document.getElementById("unameMsg"), btn = document.getElementById("claim");
  const check = () => {
    const v = inp.value.replace(/\s+/g, "");
    if (v !== inp.value) inp.value = v;
    const ok = USER_RE.test(v) && HAS_UPPER.test(v) && !RESERVED.has(v.toLowerCase());
    btn.disabled = !ok;
    if (!v) { msg.className = "hint"; msg.textContent = UNAME_HINT; }
    else if (/[^A-Za-z0-9_-]/.test(v)) { msg.className = "hint msg-bad"; msg.textContent = "مسموح بس: حروف إنجليزية وأرقام و _ و -"; }
    else if (v.length < 3) { msg.className = "hint msg-bad"; msg.textContent = "اليوزر لازم يكون ٣ خانات أو أكثر"; }
    else if (!HAS_UPPER.test(v)) { msg.className = "hint msg-bad"; msg.textContent = "لازم فيه حرف كبير واحد على الأقل، مثل D-A-L-P"; }
    else if (RESERVED.has(v.toLowerCase())) { msg.className = "hint msg-bad"; msg.textContent = "هذا اليوزر محجوز، جرّب غيره"; }
    else { msg.className = "hint msg-ok"; msg.textContent = "@" + v + " شكله حلو"; }
  };
  inp.addEventListener("input", check); check();
  btn.addEventListener("click", async () => {
    const name = inp.value;
    if (!USER_RE.test(name) || !HAS_UPPER.test(name) || RESERVED.has(name.toLowerCase())) return;
    btn.disabled = true; btn.textContent = "لحظة…";
    try {
      await claimUsername(name);
      me.username = name;
      startGlobal(); afterLogin();
    } catch (e) {
      btn.disabled = false; btn.textContent = "اعتمد اليوزر";
      if (e?.code === "taken") { msg.className = "hint msg-bad"; msg.textContent = "@" + name + " محجوز، جرّب غيره"; }
      else { console.error(e); toast("ما قدرنا نحفظ اليوزر"); }
    }
  });
  on("logout", "click", () => signOut(auth));
};

VIEWS.home = () => {
  const online = [...friends.values()].filter(isOnline).length;
  V.innerHTML = `<section>
    <div><h2>وش نلعب الليلة؟</h2>
    <p class="lead">${online ? `${ar(online)} من أصحابك أونلاين الحين.` : "العب أونلاين مع أصحابك، أو بجوال واحد."}</p></div>
    <div class="modes">
      <button class="mode" id="create"><span class="glyph">${ICONS.create}</span><b>غرفة جديدة</b><span>سوّ غرفة واعزم أصحابك، كل واحد يلعب من جواله.</span></button>
      <div class="mode joinbox"><span class="glyph">${ICONS.join}</span><b>ادخل بكود</b>
        <form class="row" id="joinF"><input id="code" dir="ltr" maxlength="5" placeholder="K7M2P" autocomplete="off" autocapitalize="characters" aria-label="كود الغرفة"><button class="btn small">دخول</button></form></div>
      <button class="mode" id="fr"><span class="glyph">${ICONS.friends}</span><b>الأصدقاء${reqIn.length ? `<span class="badge">${ar(reqIn.length)}</span>` : ""}</b><span>أضف أصحابك بيوزراتهم وشوف مين أونلاين.</span></button>
      <button class="mode" id="local"><span class="glyph">${ICONS.local}</span><b>بجوال واحد</b><span>الدخيل، مين أكثر واحد، خمسة بعشر. مرّروا الجوال بينكم.</span></button>
    </div></section>`;
  on("create", "click", () => roomCode ? go("room") : createRoom());
  on("joinF", "submit", e => { e.preventDefault(); joinRoom(document.getElementById("code").value); });
  on("fr", "click", () => go("friends"));
  on("local", "click", () => go("local"));
};

VIEWS.profile = () => {
  V.innerHTML = `<section>
    <div><h2 dir="ltr" style="text-align:right">${at(me.username)}</h2><p class="lead">هذا يوزرك. أرسله لأصحابك عشان يضيفونك.</p></div>
    <button class="btn ghost" id="copy">انسخ يوزري</button>
    <div class="foot"><button class="btn ghost" id="out">تسجيل خروج</button></div></section>`;
  on("copy", "click", () => copyText("@" + me.username, "انسخ اليوزر"));
  on("out", "click", async e => { if (!confirmTap(e.currentTarget)) return; await leaveRoom(true); signOut(auth); });
};

VIEWS.friends = () => {
  const list = [...friends.entries()].sort((a, b) => (isOnline(b[1]) - isOnline(a[1])) || a[1].username.localeCompare(b[1].username));
  V.innerHTML = `<section>
    <h2>الأصدقاء</h2>
    <p class="lead">يوزرك <b dir="ltr">${at(me.username)}</b> <button class="link" id="copyMe">انسخ</button></p>
    <form class="addf" id="addF"><div class="uinput"><span>@</span><input id="addName" autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="21" placeholder="يوزر صديقك" aria-label="يوزر صديقك"></div><button class="btn small">أضف</button></form>
    ${reqIn.length ? `<div class="field"><span class="label">طلبات صداقة</span><div class="list">${reqIn.map(r => `
      <div class="li"><span class="nm" dir="ltr">${at(r.fromName)}</span>
      <button class="btn small good" data-acc="${esc(r.from)}">قبول</button>
      <button class="btn small ghost" data-dec="${esc(r.from)}">رفض</button></div>`).join("")}</div></div>` : ""}
    <div class="field"><span class="label">أصحابك (${ar(list.length)})</span>
    ${list.length ? `<div class="list">${list.map(([uid, f]) => `
      <div class="li"><i class="dot ${isOnline(f) ? "on" : ""}" title="${isOnline(f) ? "أونلاين" : "مو أونلاين"}"></i>
      <span class="nm" dir="ltr">${at(f.username)}</span>
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
    <span class="nm" dir="ltr">${at(pname(u))}${u === me.uid ? " (أنت)" : ""}</span>${mine === u ? `<span class="tag">صوتك</span>` : ""}</button>`).join("")}</div>`;
}
function votedCount() {
  const ps = roundPlayers();
  return Object.entries(votes).filter(([u, v]) => v.round === room.round && ps.includes(u)).length;
}
const statusBar = () => `<div class="status"><span>الغرفة <b dir="ltr">${esc(roomCode)}</b> · ${GAMES[room.game] || ""}</span><span>الجولة ${ar(room.round || 0)}</span></div>`;
const leaveBtn = () => `<button class="btn ghost" id="leave">${isHost() ? "أنهِ الغرفة" : "اطلع من الغرفة"}</button>`;
function bindLeave() { on("leave", "click", e => { if (confirmTap(e.currentTarget)) leaveRoom(); }); }

VIEWS.room = () => {
  if (!room) { V.innerHTML = `<div class="spinner" aria-label="جاري التحميل"></div>`; return; }
  const view = ROOM_VIEWS[room.phase] || ROOM_VIEWS.lobby;
  view();
  bindLeave();
  onAll("[data-vote]", b => vote(b.dataset.vote));
};

const ROOM_VIEWS = {
  lobby() {
    const ps = order(), host = isHost(), n = ps.length;
    const onlineFriends = [...friends.entries()].filter(([u, f]) => isOnline(f) && !room.players[u]);
    const hasScores = ps.some(u => room.scores?.[u]);
    V.innerHTML = `<section>
      <div class="codebox"><span class="label">كود الغرفة</span><span class="code" dir="ltr">${esc(roomCode)}</span>
        <button class="btn small ghost" id="copyLink">انسخ رابط الدعوة</button></div>
      <div class="field"><span class="label">اللاعبين (${ar(n)} من ١٢)</span><div class="list">${ps.map(u => `
        <div class="li"><span class="nm" dir="ltr">${at(pname(u))}</span>${u === room.host ? `<span class="tag">المضيف</span>` : ""}${u === me.uid ? `<span class="tag">أنت</span>` : ""}</div>`).join("")}</div></div>
      ${host ? `
        <div class="field"><span class="label">اللعبة</span><div class="chips">${Object.entries(GAMES).map(([k, t]) => `<button class="chip" data-game="${k}" aria-pressed="${room.game === k}">${t}</button>`).join("")}</div></div>
        ${room.game === "imp" ? `
        <div class="field"><span class="label">الفئة</span><div class="chips">${["عشوائي", ...Object.keys(WORDS)].map(c => `<button class="chip" data-cat="${esc(c)}" aria-pressed="${room.cat === c}">${esc(c)}</button>`).join("")}</div></div>
        <div class="field"><span class="label">عدد الدخلاء</span><div class="chips">
          <button class="chip" data-imps="1" aria-pressed="${room.imps !== 2 || n < 7}">واحد</button>
          <button class="chip" data-imps="2" aria-pressed="${room.imps === 2 && n >= 7}" ${n < 7 ? "disabled" : ""}>اثنين</button></div>
          ${n < 7 ? `<p class="hint">دخيلين يحتاجون ٧ لاعبين أو أكثر.</p>` : ""}</div>` : ""}`
      : `<p class="hint center">اللعبة: <b>${GAMES[room.game]}</b>${room.game === "imp" ? ` · الفئة: <b>${esc(room.cat)}</b>` : ""}<br>ننتظر المضيف يبدأ.</p>`}
      ${onlineFriends.length ? `<div class="field"><span class="label">أصحابك الأونلاين</span><div class="list">${onlineFriends.map(([u, f]) => `
        <div class="li"><i class="dot on"></i><span class="nm" dir="ltr">${at(f.username)}</span><button class="btn small" data-inv="${esc(u)}">اعزمه</button></div>`).join("")}</div></div>` : ""}
      ${hasScores ? `<div class="field"><span class="label">النقاط</span>${scoreBoard(ps)}</div>` : ""}
      <div class="foot">
        ${host ? `<button class="btn" id="start" ${n < 3 ? "disabled" : ""}>${n < 3 ? "تحتاجون ٣ لاعبين على الأقل" : "ابدأ"}</button>` : ""}
        ${leaveBtn()}
      </div></section>`;
    on("copyLink", "click", () => copyText(location.origin + location.pathname + "?r=" + roomCode, "انسخ رابط الدعوة"));
    onAll("[data-inv]", b => { b.disabled = true; sendInvite(b.dataset.inv); });
    onAll("[data-game]", b => setRoom({ game: b.dataset.game }));
    onAll("[data-cat]", b => setRoom({ cat: b.dataset.cat }));
    onAll("[data-imps]", b => setRoom({ imps: Number(b.dataset.imps) }));
    on("start", "click", () => room.game === "most" ? startMost() : startImp());
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
        <span class="hint">الكلمة كانت: <b>${esc(r.word)}</b>${r.guessed ? " · الدخيل خمّنها" : ""}</span></div>
      <div class="field"><span class="label">الأصوات</span>${tallyList(r.tally || {}, ps)}</div>
      <div class="field"><span class="label">النقاط</span>${scoreBoard(order())}</div>
      <div class="foot">${isHost() ? `
        ${r.guessed ? "" : `<button class="btn ghost" id="guessed">الدخيل خمّن الكلمة صح (+١)</button>`}
        <button class="btn" id="again">جولة جديدة</button>
        <button class="btn ghost" id="lobby">رجوع للغرفة</button>` : `<p class="hint center">المضيف يبدأ الجولة الجاية.</p>`}
        ${leaveBtn()}</div></section>`;
    on("guessed", "click", impGuessed);
    on("again", "click", startImp);
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
      <div class="foot">${isHost() ? `<button class="btn" id="again">سؤال ثاني</button><button class="btn ghost" id="lobby">رجوع للغرفة</button>` : `<p class="hint center">المضيف يجيب السؤال الجاي.</p>`}
      ${leaveBtn()}</div></section>`;
    on("again", "click", startMost);
    on("lobby", "click", () => setRoom({ phase: "lobby" }));
  }
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
    <button class="roster" id="roster"><b>${ar(L.count)} لاعبين</b><span class="names">${esc(Array.from({ length: L.count }, (_, i) => lname(i)).join("، "))}</span><span class="edit">تعديل</span></button>
    <div class="modes">
      <button class="mode" id="m1"><span class="glyph">${ICONS.imp}</span><b>الدخيل</b><span>الكل يعرف الكلمة إلا واحد. اكشفوه قبل ما يكشف الكلمة.</span></button>
      <button class="mode" id="m2"><span class="glyph">${ICONS.most}</span><b>مين أكثر واحد؟</b><span>سؤال على الشاشة، وعلى العد الكل يأشر على واحد.</span></button>
      <button class="mode" id="m3"><span class="glyph">${ICONS.five}</span><b>خمسة بعشر</b><span>اذكر خمسة أشياء من الفئة خلال عشر ثواني.</span></button>
    </div>
    <div class="foot"><button class="btn ghost" id="ls">النقاط</button></div></section>`;
  on("roster", "click", () => go("l-players"));
  on("m1", "click", () => go("l-imp"));
  on("m2", "click", () => { L.mostPrompt = null; go("l-most"); });
  on("m3", "click", () => { L.fivePrompt = null; go("l-five"); });
  on("ls", "click", () => go("l-scores"));
};

VIEWS["l-players"] = () => {
  V.innerHTML = `<section><h2>اللاعبين</h2>
    <div class="field"><span class="label">العدد</span><div class="stepper"><button id="pm" aria-label="أقل">−</button><output>${ar(L.count)}</output><button id="pp" aria-label="أكثر">+</button></div></div>
    <div class="field"><span class="label">الأسماء (اختياري)</span><div class="name-list">${Array.from({ length: L.count }, (_, i) =>
      `<input class="txt" id="ln${i}" maxlength="14" placeholder="اللاعب ${ar(i + 1)}" value="${esc(L.names[i] || "")}" aria-label="اسم اللاعب ${ar(i + 1)}">`).join("")}</div></div>
    <div class="foot"><button class="btn" id="done">تم</button></div></section>`;
  V.querySelectorAll(".name-list input").forEach((inp, i) => inp.addEventListener("input", () => { L.names[i] = inp.value; store.set("names", L.names); }));
  on("pm", "click", () => { L.count = Math.max(3, L.count - 1); store.set("players", L.count); render(true); });
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
    <span class="big">${ids.map(k => esc(lname(k))).join(" و ")}</span><span class="hint">الكلمة كانت: <b>${esc(r.word)}</b></span></div>
    <div class="foot"><p class="hint center">وش صار في التصويت؟</p>
    <div class="row"><button class="btn good" id="c" ${r.scored ? "disabled" : ""}>مسكناه</button><button class="btn danger" id="e" ${r.scored ? "disabled" : ""}>نجا منّا</button></div>
    <button class="btn ghost" id="g" ${r.guessed ? "disabled" : ""}>الدخيل خمّن الكلمة صح (+١)</button>
    <button class="btn ghost" id="ag">جولة جديدة</button></div></section>`;
  on("c", "click", () => { if (r.scored) return; for (let k = 0; k < L.count; k++) if (!r.imps.includes(k)) laddScore(k, 1); r.scored = true; toast("+١ لكل اللي مسكوه"); render(true); });
  on("e", "click", () => { if (r.scored) return; ids.forEach(k => laddScore(k, 2)); r.scored = true; toast("+٢ للدخيل"); render(true); });
  on("g", "click", () => { ids.forEach(k => laddScore(k, 1)); r.guessed = true; toast("+١ للدخيل"); render(true); });
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

// ابقِ الشاشة شغالة أثناء اللعب لو الجهاز يسمح
let wakeLock = null;
document.addEventListener("click", async () => {
  try { if ("wakeLock" in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request("screen"); wakeLock.addEventListener("release", () => wakeLock = null); } } catch (e) {}
});

/* ================= start ================= */
if (configured) {
  getRedirectResult(auth).catch(() => {});
  onAuthStateChanged(auth, async user => {
    stopGlobal();
    if (!user) { me = null; go("auth"); return; }
    try {
      const s = await getDoc(doc(db, "users", user.uid));
      if (!s.exists()) { me = { uid: user.uid }; go("username"); return; }
      me = { uid: user.uid, username: s.data().username };
      startGlobal();
      afterLogin();
    } catch (e) {
      console.error(e); me = { uid: user.uid }; toast("فيه مشكلة في الاتصال"); go("username");
    }
  });
} else {
  go("setup");
}
