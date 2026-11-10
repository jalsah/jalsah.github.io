// رسومات أزرار اللعبة
const bg = (id, a, b) => `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="64" height="64" rx="18" fill="url(#${id})"/>`;
const shine = `<path d="M6 18 Q6 6 18 6 H46 Q30 10 6 30Z" fill="#fff" opacity=".14"/>`;
const wrap = s => `<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">${s}</svg>`;

export const ICONS = {
  // أونو جلسة: أوراق مروحة
  uno: wrap(bg("gUno", "#ff9b6b", "#d9475b") + shine + `
    <g transform="rotate(-22 32 50)"><rect x="18" y="16" width="20" height="30" rx="4" fill="#fff8ec"/><rect x="20" y="18" width="16" height="26" rx="3" fill="#8f7bea"/></g>
    <g transform="rotate(0 32 50)"><rect x="22" y="13" width="20" height="30" rx="4" fill="#fff8ec"/><rect x="24" y="15" width="16" height="26" rx="3" fill="#3fbf9a"/></g>
    <g transform="rotate(22 32 50)"><rect x="26" y="16" width="20" height="30" rx="4" fill="#fff8ec"/><rect x="28" y="18" width="16" height="26" rx="3" fill="#f2b134"/>
      <ellipse cx="36" cy="31" rx="6" ry="9" fill="#fff8ec" transform="rotate(-25 36 31)"/>
      <text x="36" y="35" text-anchor="middle" font-family="Lalezar,Tahoma,sans-serif" font-size="11" fill="#d9475b">+٤</text></g>
    <rect x="12" y="46" width="40" height="10" rx="5" fill="#1c1530"/>
    <text x="32" y="54.5" text-anchor="middle" font-family="Lalezar,Tahoma,sans-serif" font-size="9" fill="#f2b134">أونو</text>`),

  // ارسم وخمّن: لوحة وقلم
  draw: wrap(bg("gDraw", "#7fd3ff", "#3a7bd5") + shine + `
    <g transform="rotate(-6 32 34)">
      <rect x="9" y="12" width="38" height="36" rx="5" fill="#fff8ec"/>
      <path d="M15 38 q6 -14 12 -4 t12 -8" stroke="#ef6f6c" stroke-width="3.2" fill="none" stroke-linecap="round"/>
      <circle cx="37" cy="21" r="4.5" fill="#f2b134"/>
    </g>
    <g transform="rotate(40 46 40)">
      <rect x="41" y="20" width="9" height="30" rx="2" fill="#1c1530"/>
      <rect x="41" y="20" width="9" height="6" rx="2" fill="#ef6f6c"/>
      <path d="M41 50 h9 l-4.5 8z" fill="#ffd36b"/>
    </g>`),

  // مين قالها؟: فقاعة كلام وقناع
  who: wrap(bg("gWho", "#ffb3d1", "#d6457f") + shine + `
    <path d="M10 14 h36 a6 6 0 0 1 6 6 v18 a6 6 0 0 1 -6 6 h-20 l-9 8 v-8 h-7 a6 6 0 0 1 -6 -6 v-18 a6 6 0 0 1 6 -6z" fill="#fff8ec"/>
    <path d="M16 24 h24 M16 32 h16" stroke="#d6457f" stroke-width="3" stroke-linecap="round"/>
    <circle cx="48" cy="46" r="11" fill="#1c1530"/>
    <text x="48" y="52" text-anchor="middle" font-family="Lalezar,Tahoma,sans-serif" font-size="16" fill="#ffd36b">؟</text>`),

  // صح ولا خطأ: نص صح ونص خطأ
  tf: wrap(bg("gTf", "#ffe08a", "#f08a24") + shine + `
    <g transform="rotate(-10 32 32)">
      <rect x="8" y="16" width="24" height="32" rx="7" fill="#3fbf9a"/>
      <path d="M14 32 l5 5 l9 -11" stroke="#fff8ec" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
    <g transform="rotate(10 32 32)">
      <rect x="32" y="16" width="24" height="32" rx="7" fill="#ef6f6c"/>
      <path d="M39 26 l10 12 M49 26 l-10 12" stroke="#fff8ec" stroke-width="4" stroke-linecap="round"/>
    </g>
    <circle cx="32" cy="50" r="7" fill="#1c1530"/><text x="32" y="54" text-anchor="middle" font-family="Lalezar,Tahoma,sans-serif" font-size="10" fill="#ffd36b">؟</text>`),

  // غرف عامة: كرة أرضية وناس
  pub: wrap(bg("gPub", "#8ef0cf", "#2f8fd5") + shine + `
    <circle cx="32" cy="30" r="17" fill="#1c1530"/>
    <path d="M15 30 h34 M32 13 c-8 9 -8 25 0 34 M32 13 c8 9 8 25 0 34 M18 21 h28 M18 39 h28" stroke="#8ef0cf" stroke-width="2.4" fill="none"/>
    <circle cx="14" cy="48" r="5" fill="#fff8ec"/><path d="M6 60 a8 8 0 0 1 16 0z" fill="#fff8ec"/>
    <circle cx="50" cy="48" r="5" fill="#ffd36b"/><path d="M42 60 a8 8 0 0 1 16 0z" fill="#ffd36b"/>
    <circle cx="32" cy="52" r="5" fill="#ef6f6c"/><path d="M24 64 a8 8 0 0 1 16 0z" fill="#ef6f6c"/>`),

  // واتساب
  wa: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.8-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3z"/></svg>`,

  // إنسان حيوان نبات جماد: بلاطات حروف
  hhnj: wrap(bg("gHh", "#c9b8ff", "#6b4fd8") + shine + `
    <g transform="rotate(-8 32 32)">
      <rect x="9" y="14" width="22" height="22" rx="5" fill="#fff8ec"/>
      <text x="20" y="31" text-anchor="middle" font-family="Lalezar,Tahoma,sans-serif" font-size="17" fill="#1c1530">ح</text>
    </g>
    <g transform="rotate(7 32 32)">
      <rect x="33" y="12" width="22" height="22" rx="5" fill="#ffd36b"/>
      <text x="44" y="29" text-anchor="middle" font-family="Lalezar,Tahoma,sans-serif" font-size="17" fill="#1c1530">ن</text>
    </g>
    <rect x="20" y="36" width="24" height="16" rx="4" fill="#1c1530"/>
    <path d="M25 44 h14" stroke="#8ef0cf" stroke-width="3" stroke-linecap="round"/>
    <circle cx="50" cy="48" r="7" fill="#ef6f6c"/><path d="M50 44 v4 l3 2" stroke="#fff8ec" stroke-width="2" fill="none" stroke-linecap="round"/>`),

  // غرفة جديدة: باب مجلس مفتوح ونجمة +
  create: wrap(bg("gCreate", "#ffcf5c", "#f08a24") + shine + `
    <rect x="16" y="14" width="28" height="40" rx="14" fill="#2b1d4a"/>
    <path d="M20 54 V28 a10 10 0 0 1 20 0 V54Z" fill="#ffe7a8"/>
    <path d="M20 54 V28 a10 10 0 0 1 10 -10 V54Z" fill="#ffd36b"/>
    <circle cx="36" cy="40" r="1.8" fill="#2b1d4a"/>
    <path d="M8 54 H56" stroke="#2b1d4a" stroke-width="3" stroke-linecap="round"/>
    <circle cx="48" cy="17" r="9" fill="#2b1d4a"/>
    <path d="M48 12 V22 M43 17 H53" stroke="#ffcf5c" stroke-width="3" stroke-linecap="round"/>`),

  // ادخل بكود: تذكرة
  join: wrap(bg("gJoin", "#8ef0cf", "#2fb59a") + shine + `
    <g transform="rotate(-12 32 32)">
      <path d="M10 22 h44 v6 a4 4 0 0 0 0 8 v6 h-44 v-6 a4 4 0 0 0 0 -8z" fill="#fff8ec"/>
      <path d="M40 22 v20" stroke="#2fb59a" stroke-width="2" stroke-dasharray="3 3"/>
      <text x="25" y="38" text-anchor="middle" font-family="Lalezar,Tahoma,sans-serif" font-size="16" fill="#1c1530">K7M</text>
      <circle cx="47" cy="32" r="3.4" fill="#ef6f6c"/>
    </g>`),

  // الأصدقاء: شخصين وقلب
  friends: wrap(bg("gFr", "#ff9b8f", "#d9475b") + shine + `
    <circle cx="23" cy="25" r="8" fill="#fff8ec"/>
    <path d="M9 50 a14 14 0 0 1 28 0z" fill="#fff8ec"/>
    <circle cx="41" cy="27" r="7.5" fill="#2b1d4a"/>
    <path d="M28 52 a13 13 0 0 1 26 0z" fill="#2b1d4a"/>
    <path d="M47 9 c2.5-3 7-1.5 7 2 c0 3-4 5.5-7 8 c-3-2.5-7-5-7-8 c0-3.5 4.5-5 7-2z" fill="#ffd36b"/>`),

  // بجوال واحد: جوال ينتقل بين يدين
  local: wrap(bg("gLoc", "#a99af5", "#5b45c9") + shine + `
    <rect x="23" y="12" width="18" height="32" rx="4" fill="#1c1530"/>
    <rect x="25.5" y="16" width="13" height="22" rx="1.5" fill="#ffd36b"/>
    <text x="32" y="31" text-anchor="middle" font-family="Lalezar,Tahoma,sans-serif" font-size="11" fill="#1c1530">؟</text>
    <path d="M10 48 q8 -10 18 -4" stroke="#fff8ec" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M54 48 q-8 -10 -18 -4" stroke="#fff8ec" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M24 42 l4 2 -2 4" stroke="#fff8ec" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M40 42 l-4 2 2 4" stroke="#fff8ec" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`),

  // الدخيل: وجه بقناع
  imp: wrap(bg("gImp", "#ff8a80", "#b8324a") + shine + `
    <circle cx="32" cy="34" r="17" fill="#fff8ec"/>
    <path d="M13 31 q19 -10 38 0 q-2 10 -10 9 q-5 -1 -9 -4 q-4 3 -9 4 q-8 1 -10 -9z" fill="#1c1530"/>
    <ellipse cx="24" cy="33" rx="3.6" ry="2.6" fill="#ffd36b"/>
    <ellipse cx="40" cy="33" rx="3.6" ry="2.6" fill="#ffd36b"/>
    <path d="M26 44 q6 4 12 0" stroke="#1c1530" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <path d="M14 21 q18 -16 36 0 l-3 4 q-15 -8 -30 0z" fill="#1c1530"/>
    <circle cx="51" cy="13" r="8" fill="#ffd36b"/>
    <text x="51" y="18" text-anchor="middle" font-family="Lalezar,Tahoma,sans-serif" font-size="13" fill="#1c1530">؟</text>`),

  // مين أكثر واحد: ثلاث أشخاص وسهم على الوسط
  most: wrap(bg("gMost", "#ffd36b", "#e7891c") + shine + `
    <path d="M32 6 l9 18 h-18z" fill="#fff8ec" opacity=".55"/>
    <circle cx="14" cy="38" r="5.5" fill="#2b1d4a" opacity=".55"/>
    <path d="M5 56 a9 9 0 0 1 18 0z" fill="#2b1d4a" opacity=".55"/>
    <circle cx="50" cy="38" r="5.5" fill="#2b1d4a" opacity=".55"/>
    <path d="M41 56 a9 9 0 0 1 18 0z" fill="#2b1d4a" opacity=".55"/>
    <circle cx="32" cy="32" r="7" fill="#2b1d4a"/>
    <path d="M20 56 a12 12 0 0 1 24 0z" fill="#2b1d4a"/>
    <path d="M32 9 l3 6 6.5 .8 -4.8 4.4 1.3 6.4 -6 -3.2 -6 3.2 1.3 -6.4 -4.8 -4.4 6.5 -.8z" fill="#fff8ec"/>`),

  // خمسة بعشر: ساعة توقيت
  five: wrap(bg("gFive", "#8ef0cf", "#1f9c86") + shine + `
    <rect x="28" y="7" width="8" height="6" rx="2" fill="#1c1530"/>
    <path d="M45 14 l4 -4" stroke="#1c1530" stroke-width="4" stroke-linecap="round"/>
    <circle cx="32" cy="36" r="20" fill="#1c1530"/>
    <circle cx="32" cy="36" r="16" fill="#fff8ec"/>
    <path d="M32 36 L32 20 A16 16 0 0 1 47.2 31z" fill="#ef6f6c"/>
    <text x="32" y="45" text-anchor="middle" font-family="Lalezar,Tahoma,sans-serif" font-size="20" fill="#1c1530">٥</text>`)
};
