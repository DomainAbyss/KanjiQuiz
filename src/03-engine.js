/* ==========================================================================
   KanjiQuiz — engine: data, session, scoring, progress
   ========================================================================== */
'use strict';

var LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];
var SET_SIZE = 25;          // kartu per sesi
var GRID = 9;               // 3x3 pilihan

var DB = { kanji: null, vocab: null };
var S = {
  kind: 'kanji',            // 'kanji' | 'vocab'
  lang: 'id',               // bahasa jawaban: id | en | jp
  mode: 'fwd',              // 'fwd' (kanji->arti) | 'rev' (arti->kanji) | 'card' (flashcard)
  level: null,
  cards: [],                // kartu sesi (shuffled)
  idx: 0,
  answered: false,
  pick: -1,
  ok: 0, no: 0,
  setStartPct: 0,           // progress level saat sesi mulai (untuk delta +%)
  done: false,
  furigana: false,
  flipped: false,           // flashcard: sudah dibalik?
  selfMarked: false         // flashcard: user sudah menandai benar/salah
};

/* ---------- util ---------- */
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function shuffle(a) {
  a = a.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}
function sample(arr, n, notIn) {
  var out = [], seen = {};
  (notIn || []).forEach(function (x) { seen[x] = 1; });
  var pool = shuffle(arr), i = 0;
  while (out.length < n && i < pool.length) {
    var v = pool[i++];
    if (seen[v]) continue;
    seen[v] = 1;
    out.push(v);
  }
  return out;
}
function pct(a, b) { return b ? Math.round(a / b * 100) : 0; }

/* ---------- data ---------- */
function loadData() {
  var emb = document.getElementById('embedded-data');
  var payload = null;
  if (emb && emb.textContent.trim().length > 20) {
    try { payload = JSON.parse(emb.textContent); } catch (e) { payload = null; }
  }
  if (payload && payload.kanji && payload.vocab) {
    DB.kanji = payload.kanji;
    DB.vocab = payload.vocab;
    return Promise.resolve('embedded');
  }
  // fallback: fetch file JSON (butuh server lokal)
  return Promise.all([
    fetch('data/kanji.json', { cache: 'no-store' }).then(function (r) { return r.json(); }),
    fetch('data/vocab.json', { cache: 'no-store' }).then(function (r) { return r.json(); })
  ]).then(function (res) {
    DB.kanji = res[0].levels; DB.vocab = res[1].levels;
    return 'fetch';
  });
}

/* ---------- index bantu untuk vocab (detail kanji per karakter) ---------- */
var KJ_INDEX = null;
function kanjiIndex() {
  if (KJ_INDEX) return KJ_INDEX;
  KJ_INDEX = {};
  LEVELS.forEach(function (lv) {
    (DB.kanji[lv] || []).forEach(function (k) { if (!KJ_INDEX[k.k]) KJ_INDEX[k.k] = k; });
  });
  return KJ_INDEX;
}

/* ---------- kartu ---------- */
function buildCards(kind, level) {
  var out = [];
  if (kind === 'kanji') {
    (DB.kanji[level] || []).forEach(function (k) {
      out.push({
        kind: 'kanji', lv: level, key: k.k, glyph: k.k,
        meanId: k.id || '', meanEn: k.en || '',
        on: k.on || [], kun: k.kun || [],
        rad: k.rad || '', str: k.str || '', joyo: k.joyo || '', freq: k.freq || '',
        words: k.w || [], kj: []
      });
    });
  } else {
    (DB.vocab[level] || []).forEach(function (v) {
      var parts = (v.kj || []).map(function (c) { return kanjiIndex()[c] || { k: c, id: '', en: '', on: [], kun: [], words: [] }; });
      out.push({
        kind: 'vocab', lv: level, key: v.w, glyph: v.w,
        word: v.w, reading: v.r || '', romaji: v.ro || '',
        meanId: (v.id || []).join(', '), meanEn: (v.en || []).join(', '),
        meanIdList: v.id || [], meanEnList: v.en || [], src: v.src || '',
        kj: v.kj || [], parts: parts, words: []
      });
    });
  }
  return out;
}

/* teks jawaban sesuai bahasa + mode terpilih */
function answerText(card, lang) {
  if (S.mode === 'rev') return card.glyph;
  if (S.mode === 'card') return card.meanId || card.meanEn || '';   // flashcard: balik kartu = arti
  if (lang === 'jp') {
    if (card.kind === 'vocab') return card.reading || card.word;
    return card.on[0] || card.kun[0] || card.k;
  }
  if (lang === 'en') return card.meanEn || card.meanId || '';
  return card.meanId || card.meanEn || '';
}
/* arti yang ditampilkan di kartu (mode terbalik: arti jadi soal) */
function cardMeaningText(card) {
  if (S.lang === 'en') return card.meanEn || card.meanId || '';
  return card.meanId || card.meanEn || '';
}

/* ---------- sesi ---------- */
function dealChoices(card, pool) {
  if (S.mode === 'card') { card.choices = []; card.correct = -1; return; }
  var want = answerText(card, S.lang);
  var others = pool.filter(function (x) { return x.key !== card.key; })
    .map(function (x) { return answerText(x, S.lang); })
    .filter(function (t) { return t && t !== want; });
  var distract = sample(others, GRID - 1);
  var optsText = shuffle([want].concat(distract));
  card.choices = optsText;
  card.correct = optsText.indexOf(want);
}

function startSet(level, opts) {
  opts = opts || {};
  S.level = level;
  var pool = opts.pool || buildCards(S.kind, level);
  if (!pool.length) { alert('Data level ' + level + ' kosong.'); return false; }
  var cards = opts.keepOrder ? pool.slice(0, SET_SIZE) : shuffle(pool).slice(0, SET_SIZE);
  cards.forEach(function (c) { dealChoices(c, pool); });
  S.cards = cards; S.idx = 0; S.ok = 0; S.no = 0; S.answered = false; S.pick = -1; S.done = false;
  S.setStartPct = progressOf(S.kind, level).pct;
  S.furigana = false; S.flipped = false; S.selfMarked = false;
  saveSession();
  return true;
}

/* ---------- progress ---------- */
var PKEY = 'kq_progress_v1';
function loadProgress() {
  try { return JSON.parse(localStorage.getItem(PKEY) || '{}'); } catch (e) { return {}; }
}
function saveProgress(p) {
  try { localStorage.setItem(PKEY, JSON.stringify(p)); } catch (e) { }
}
function progressOf(kind, level) {
  var p = loadProgress(), k = kind + ':' + level;
  var d = p[k] || { ok: 0, tot: 0, sets: 0 };
  return { pct: d.tot ? Math.round(d.ok / d.tot * 100) : 0, ok: d.ok, tot: d.tot, sets: d.sets };
}
function progressAdd(kind, level, ok, tot) {
  var p = loadProgress(), k = kind + ':' + level;
  var d = p[k] || { ok: 0, tot: 0, sets: 0 };
  d.ok += ok; d.tot += tot; d.sets += 1;
  p[k] = d; saveProgress(p);
  return { pct: d.tot ? Math.round(d.ok / d.tot * 100) : 0, ok: d.ok, tot: d.tot, sets: d.sets };
}

/* ---------- simpan/restore sesi ---------- */
var SKEY = 'kq_session_v1';
function saveSession() {
  try {
    localStorage.setItem(SKEY, JSON.stringify({
      kind: S.kind, lang: S.lang, mode: S.mode, level: S.level, idx: S.idx, ok: S.ok, no: S.no,
      answered: S.answered, pick: S.pick, done: S.done, setStartPct: S.setStartPct,
      keys: S.cards.map(function (c) { return c.key; }),
      wrong: S.cards.filter(function (c) { return c._wrong; }).map(function (c) { return c.key; })
    }));
  } catch (e) { }
}
function clearSession() { try { localStorage.removeItem(SKEY); } catch (e) { } }
function restoreSession() {
  var raw = null;
  try { raw = JSON.parse(localStorage.getItem(SKEY) || 'null'); } catch (e) { }
  if (!raw || !raw.level || raw.done) return false;
  var pool = buildCards(raw.kind, raw.level);
  var byKey = {}; pool.forEach(function (c) { byKey[c.key] = c; });
  var cards = (raw.keys || []).map(function (k) { return byKey[k]; }).filter(Boolean);
  if (!cards.length) return false;
  S.kind = raw.kind; S.lang = raw.lang || 'id'; S.level = raw.level;
  S.mode = raw.mode || 'fwd';
  cards.forEach(function (c) { dealChoices(c, pool); });
  var wset = {}; (raw.wrong || []).forEach(function (k) { wset[k] = 1; });
  cards.forEach(function (c) { if (wset[c.key]) c._wrong = true; });
  S.cards = cards; S.idx = Math.min(raw.idx || 0, cards.length - 1);
  S.ok = raw.ok || 0; S.no = raw.no || 0; S.done = false; S.answered = false; S.pick = -1;
  S.setStartPct = raw.setStartPct || 0; S.furigana = false;
  S.flipped = false; S.selfMarked = false;
  return true;
}

/* ---------- statistik global (semua level) ---------- */
function globalStats() {
  var p = loadProgress(), ok = 0, tot = 0, sets = 0;
  Object.keys(p).forEach(function (k) { ok += p[k].ok; tot += p[k].tot; sets += p[k].sets; });
  return { ok: ok, tot: tot, sets: sets, pct: tot ? Math.round(ok / tot * 100) : 0 };
}
