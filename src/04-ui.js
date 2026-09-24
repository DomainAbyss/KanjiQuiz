/* ==========================================================================
   KanjiQuiz — UI & events
   ========================================================================== */
'use strict';

function $(id) { return document.getElementById(id); }
var LVCLS = { N5: 'lv-0', N4: 'lv-1', N3: 'lv-2', N2: 'lv-3', N1: 'lv-4' };
var LVICON = { N5: '五', N4: '四', N3: '三', N2: '二', N1: '一' };
var MODE_ORDER = ['fwd', 'rev', 'card'];
var MODE_LABEL = {
  fwd: 'Soal: Kanji → Arti',
  rev: 'Soal: Arti → Kanji',
  card: 'Mode: Flashcard (balik kartu)'
};
var LANG_LABEL = { id: 'Bahasa: Indonesia', en: 'Bahasa: English', jp: 'Bahasa: Kana' };
S.mode = 'fwd';

/* ---------- navigasi layar ---------- */
function go(name) {
  ['scrHome','scrQuiz','scrSearch','scrCollection','scrListen','scrRoadmap','scrDiagnostic','scrAchievements'].forEach(function (s) {
    $(s).classList.toggle('active', s === 'scr' + name);
  });
  $('topStat').style.visibility = (name === 'Quiz') ? 'visible' : 'hidden';
  if (name === 'Home') { clearSession(); renderHome(); }
  if (name === 'Search') renderDictionary('');
  if (name === 'Collection') renderCollection();
  if (name === 'Roadmap') renderRoadmap();
  if (name === 'Diagnostic') renderDiagnostic();
  if (name === 'Achievements') renderAchievements();
}

/* ---------- HOME ---------- */
function renderHome() {
  var grid = $('lvGrid');
  var html = '';
  LEVELS.forEach(function (lv) {
    var n = (DB[S.kind][lv] || []).length;
    var pr = progressOf(S.kind, lv);
    var C = 2 * Math.PI * 22;
    var off = C * (1 - pr.pct / 100);
    var ring = n
      ? '<div class="ring"><svg width="52" height="52"><circle cx="26" cy="26" r="22" fill="none" stroke="#eceef1" stroke-width="5"></circle>' +
      '<circle cx="26" cy="26" r="22" fill="none" stroke="#e08a2b" stroke-width="5" stroke-linecap="round" stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '"></circle></svg>' +
      '<span class="pct">' + pr.pct + '%</span></div>'
      : '<i class="fa-solid fa-lock" style="color:#c3c8cf"></i>';
    var sub = n
      ? (n + (S.kind === 'kanji' ? ' kanji' : ' kosakata') + (pr.sets ? ' · ' + pr.sets + ' set selesai' : ' · belum dimulai'))
      : 'data belum tersedia';
    html += '<button class="lvcard" data-lv="' + lv + '"' + (n ? '' : ' disabled') + '>' +
      '<span class="lvico ' + LVCLS[lv] + ' jp">' + LVICON[lv] + '</span>' +
      '<span class="lvbody"><b>JLPT ' + lv + '</b><span>' + esc(sub) + '</span></span>' +
      ring + '<i class="fa-solid fa-chevron-right chev"></i></button>';
  });
  grid.innerHTML = html;
  Array.prototype.forEach.call(grid.querySelectorAll('.lvcard'), function (b) {
    b.onclick = function () {
      showCountPicker(b.dataset.lv);
    };
  });
  $('tabKanji').classList.toggle('on', S.kind === 'kanji');
  $('tabVocab').classList.toggle('on', S.kind === 'vocab');
}

/* ---------- COUNT PICKER popup ---------- */
var PENDING_LV = null;
function showCountPicker(lv) {
  PENDING_LV = lv;
  var n = (DB[S.kind][lv] || []).length;
  var kindLabel = S.kind === 'kanji' ? 'Kanji' : 'Kosakata';
  $('cntKicker').textContent = 'JLPT ' + lv + ' — ' + kindLabel;
  $('cntSub').textContent = 'Total tersedia: ' + n + ' ' + kindLabel.toLowerCase();
  var counts = [10, 25, 50];
  var html = '';
  counts.forEach(function (c) {
    var dis = c > n;
    html += '<button class="cntbtn' + (dis ? '' : '') + '"' + (dis ? ' disabled style="opacity:.4;cursor:not-allowed"' : '') + ' data-cnt="' + c + '">' +
      '<span class="cnum">' + c + '</span>' +
      '<span class="clbl">soal</span></button>';
  });
  html += '<button class="cntbtn all" data-cnt="' + n + '">' +
    '<span class="cnum"><i class="fa-solid fa-infinity"></i> ALL</span>' +
    '<span class="clbl">' + n + ' ' + kindLabel.toLowerCase() + '</span></button>';
  $('cntGrid').innerHTML = html;
  Array.prototype.forEach.call($('cntGrid').querySelectorAll('.cntbtn'), function (b) {
    if (b.disabled) return;
    b.onclick = function () {
      var cnt = parseInt(b.dataset.cnt, 10);
      $('ovCount').classList.add('hidden');
      if (!startSet(PENDING_LV, { count: cnt })) return;
      go('Quiz'); renderQuiz();
    };
  });
  $('ovCount').classList.remove('hidden');
}

/* ---------- QUIZ ---------- */
function renderQuiz() {
  renderTopStat();
  renderCard();
  renderOpts();
  renderPills();
  renderNote();
}
function renderTopStat() {
  var answeredNow = (S.mode === 'card') ? (S.selfMarked ? 1 : 0) : (S.answered ? 1 : 0);
  var rem = Math.max(0, S.cards.length - S.idx - answeredNow);
  $('statOk').textContent = S.ok;
  $('statNo').textContent = S.no;
  $('statRem').textContent = 'Remaining: ' + rem;
}
function renderPills() {
  Array.prototype.forEach.call(document.querySelectorAll('.pill[data-lang]'), function (p) {
    p.classList.toggle('on', p.dataset.lang === S.lang);
  });
}
function cardMeaningText(card) {
  if (S.lang === 'en') return card.meanEn || card.meanId || '';
  return card.meanId || card.meanEn || '';
}

function renderCard() {
  var c = S.cards[S.idx];
  if (!c) return;
  renderFlash(c);
}
/* bisa tekan Furigana? tidak boleh kalau bacaan itu sendiri jawabannya */
function canFuri(c) {
  if (c.kind !== 'vocab') return false;
  if (S.mode === 'rev') return true;                 /* soal = arti, bacaan bukan jawaban */
  return S.lang !== 'jp';                            /* mode kana: bacaan = jawaban -> jangan */
}
/* ---------- helper isi kartu ---------- */
/* kartu sudah dibalik? mode flashcard manual, mode pilihan ganda otomatis setelah dijawab */
function isFlipped() {
  if (S.mode === 'card') return !!S.flipped;
  return !!S.answered;
}
/* sisi depan — TIDAK BOLEH membocorkan jawaban sama sekali */
function flashFrontHtml(c) {
  if (S.mode === 'rev') {
    /* soal = arti, jawabannya kanji */
    return '<div class="fwrap"><div class="qtext">' + esc(cardMeaningText(c)) + '</div></div>';
  }
  var ruby = '';
  if (canFuri(c) && S.furigana && c.reading) {
    ruby = '<div class="rubytop jp">' + esc(c.reading) + '<span class="ro">' + esc(c.romaji || '') + '</span></div>';
  }
  if (c.kind === 'vocab') {
    return '<div class="fwrap"><div class="frontstack">' + ruby + '<div class="chword jp big">' + esc(c.word) + '</div></div></div>';
  }
  return '<div class="fwrap"><div class="frontstack">' + ruby + '<div class="ch jp xl">' + esc(c.glyph) + '</div></div></div>';
}
/* sisi belakang — arti + bacaan + info + kombinasi kata */
function flashBackHtml(c) {
  var L = S.lang === 'en';
  var h = '<div class="bwrap">';
  /* mode terbalik: kanji-nya yang jadi jawaban, tampilkan besar di atas */
  if (S.mode === 'rev') {
    h += '<div class="bkanji jp">' + esc(c.glyph) + '</div>';
  }
  h += '<div class="bmean">' + esc(L ? (c.meanEn || c.meanId || '—') : (c.meanId || c.meanEn || '—')) + '</div>';
  if (L && c.meanId) h += '<div class="balt">ID: ' + esc(c.meanId) + '</div>';
  /* Saat Bahasa Indonesia aktif, jangan tampilkan arti English di kartu/feedback. */
  if (c.kind === 'vocab') {
    h += '<div class="brow"><span class="bl">Bacaan</span><span class="bv jp">' + esc(c.reading || '—') +
      '</span><span class="br">' + esc(c.romaji || '') + '</span></div>';
    if (c.src === 'elzup') h += '<div class="bsrc">Arti dari elzup/jlpt-word-list — kanji.jepang.org belum punya halaman untuk kata ini</div>';
  } else {
    h += '<div class="brow"><span class="bl">Kun</span><span class="bv jp">' + esc((c.kun || []).join('、') || '—') + '</span></div>';
    h += '<div class="brow"><span class="bl">On</span><span class="bv jp">' + esc((c.on || []).join('、') || '—') + '</span></div>';
    var inf = [];
    if (c.rad) inf.push('Radikal ' + c.rad);
    if (c.str) inf.push(c.str + ' goresan');
    if (c.joyo) inf.push(c.joyo);
    if (inf.length) h += '<div class="brow"><span class="bl">Info</span><span class="bv sm">' + esc(inf.join(' · ')) + '</span></div>';
  }
  /* kombinasi kata / kanji pembentuk */
  if (c.kind === 'kanji' && (c.words || []).length) {
    h += '<div class="bcap">Kombinasi Kata</div><div class="bwlist">';
    c.words.slice(0, 8).forEach(function (w) {
      h += '<div class="wrow"><span class="w jp">' + esc(w[0]) + '</span><span class="r jp">' + esc(w[1] || '') + '</span>' +
        '<span class="m">' + esc(L ? (w[3] || w[2]) : (w[2] || w[3])) + '</span></div>';
    });
    h += '</div>';
  } else if (c.kind === 'vocab' && (c.parts || []).length) {
    h += '<div class="bcap">Kanji Pembentuk</div><div class="bwlist">';
    c.parts.forEach(function (p) {
      h += '<div class="wrow"><span class="w jp">' + esc(p.k) + '</span>' +
        '<span class="r jp">' + esc((p.kun || []).concat(p.on || []).join('、') || '—') + '</span>' +
        '<span class="m">' + esc(L ? (p.en || p.id) : (p.id || p.en)) + '</span></div>';
    });
    h += '</div>';
  }
  h += '</div>';
  return h;
}

/* ---------- KARTU (flip) ---------- */
function renderFlash(c) {
  var top = $('fcTop');
  top.classList.add('flipwrap');
  top.classList.remove('pop', 'shake');
  var face = isFlipped() ? 'face-back' : 'face-front';
  var flipMode = (S.mode === 'card');
  top.innerHTML =
    '<div class="fscene"><div class="fcard3d ' + face + '" id="fc3d">' +
    '<div class="fface ff-front">' + flashFrontHtml(c) +
    (flipMode ? '<div class="ftap">klik kartu / tekan <span class="kbd">Spasi</span> untuk balik</div>' : '') +
    '</div>' +
    '<div class="fface ff-back">' + flashBackHtml(c) + '</div>' +
    '</div></div>';

  renderFlashFoot();
  $('fcHint').innerHTML = !isFlipped()
    ? (flipMode
      ? 'Tebak dulu artinya, baru balik kartu · <span class="kbd">Spasi</span>'
      : 'Pilih salah satu jawaban · <span class="kbd">1</span>–<span class="kbd">9</span>' +
        (canFuri(c) ? ' · <span class="kbd">F</span> furigana' : ''))
    : (flipMode
      ? (S.selfMarked
        ? 'Tekan <span class="kbd">Enter</span> untuk lanjut'
        : 'Jujur ya — tekan <span class="kbd">1</span> kalau benar, <span class="kbd">2</span> kalau salah')
      : 'Tekan <span class="kbd">Enter</span> / klik di mana saja untuk kartu berikutnya');
}

/* footer kartu: tombol aksi sesuai mode */
function renderFlashFoot() {
  var c = S.cards[S.idx];
  var flipMode = (S.mode === 'card');
  var foot = '';

  if (flipMode) {
    if (!S.flipped) {
      foot += '<div class="btnrow center"><button class="btn pri big" id="btnFlip">' +
        '<i class="fa-solid fa-rotate"></i> Balik Kartu <span class="kbd">Spasi</span></button></div>';
    } else if (!S.selfMarked) {
      foot += '<div class="btnrow center">' +
        '<button class="btn ok" id="btnYes"><i class="fa-solid fa-check"></i> Benar <span class="kbd">1</span></button>' +
        '<button class="btn no" id="btnNo"><i class="fa-solid fa-xmark"></i> Salah <span class="kbd">2</span></button></div>';
    } else {
      foot += '<div class="btnrow center"><button class="btn gh" id="btnNextF">' +
        '<i class="fa-solid fa-arrow-right"></i> Kartu Berikutnya <span class="kbd">Enter</span></button></div>';
    }
    if (c.kind === 'vocab' && !S.flipped) {
      foot += '<div class="btnrow center"><button class="btn blu sm" id="btnFuriF"><i class="fa-solid fa-wand-magic-sparkles"></i> ' +
        (S.furigana ? 'Sembunyikan Furigana' : 'Furigana') + '</button></div>';
      /* furigana tampil kecil di atas kanji/kata, bukan di kotak bawah */
    }
  } else {
    /* pilihan ganda: tombol lanjut setelah dijawab + furigana untuk kosakata */
    if (S.answered) {
      foot += '<div class="btnrow center"><button class="btn gh" id="btnNextF">' +
        '<i class="fa-solid fa-arrow-right"></i> Kartu Berikutnya <span class="kbd">Enter</span></button></div>';
    }
    if (canFuri(c)) {
      foot += '<div class="btnrow center"><button class="btn blu sm" id="btnFuriF"><i class="fa-solid fa-wand-magic-sparkles"></i> ' +
        (S.furigana ? 'Sembunyikan Furigana' : 'Furigana') + '</button></div>';
      /* furigana tampil kecil di atas kanji/kata, bukan di kotak bawah */
    }
  }
  foot += favButtons(c);
  $('fcFoot').innerHTML = foot;
  bindFavButtons(c);

  var b3 = $('fc3d');
  if (b3 && flipMode) b3.onclick = function (e) { e.stopPropagation(); flip(); };
  var bf2 = $('btnFlip'); if (bf2) bf2.onclick = function (e) { e.stopPropagation(); flip(); };
  var by = $('btnYes'); if (by) by.onclick = function (e) { e.stopPropagation(); markCard(true); };
  var bn = $('btnNo'); if (bn) bn.onclick = function (e) { e.stopPropagation(); markCard(false); };
  var bnf = $('btnNextF'); if (bnf) bnf.onclick = function (e) { e.stopPropagation(); next(); };
  var bff = $('btnFuriF'); if (bff) bff.onclick = function (e) { e.stopPropagation(); S.furigana = !S.furigana; renderCard(); };
}

function flip() {
  if (S.flipped) return;
  S.flipped = true;
  saveSession();
  flipCardAnim();
}
/* animasi balik kartu + refresh footer (dipakai flashcard & pilihan ganda) */
function flipCardAnim() {
  var el = $('fc3d');
  if (!el) { renderCard(); return; }
  el.classList.remove('face-front');
  el.classList.add('face-back');
  renderFlashFoot();
  var c = S.cards[S.idx];
  $('fcHint').innerHTML = (S.mode === 'card')
    ? (S.selfMarked
      ? 'Tekan <span class="kbd">Enter</span> untuk lanjut'
      : 'Jujur ya — tekan <span class="kbd">1</span> kalau benar, <span class="kbd">2</span> kalau salah')
    : 'Tekan <span class="kbd">Enter</span> / klik di mana saja untuk kartu berikutnya';
}
function markCard(good) {
  if (S.mode !== 'card' || !S.flipped || S.selfMarked) return;
  var c = S.cards[S.idx];
  S.selfMarked = true;
  if (good) { S.ok++; c._wrong = false; burst(30, '#22a45d', $('fc3d') || $('fcTop')); popIn($('fcTop')); }
  else { S.no++; c._wrong = true; shake($('fcTop')); }
  saveSession();
  renderFlashFoot();      /* jangan render ulang kartu — biar animasi balik tidak keulang */
  renderOpts();           /* update langkah 1-2-3 di panel kanan */
  renderTopStat();
  renderNote();
}

/* ---------- efek ---------- */
function popIn(el) {
  if (!el) return;
  el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
}
function shake(el) {
  if (!el) return;
  el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
}
function burst(n, color, anchor) {
  var host = document.createElement('div');
  host.className = 'confetti';
  var r = null;
  if (anchor) r = anchor.getBoundingClientRect();
  if (r) {
    host.style.left = (r.left + r.width / 2) + 'px';
    host.style.top = (r.top + r.height * 0.38) + 'px';
  } else {
    host.style.left = '50%'; host.style.top = '42%';
  }
  for (var i = 0; i < n; i++) {
    var p = document.createElement('i');
    var a = Math.random() * Math.PI * 2, d = 60 + Math.random() * 150;
    p.style.setProperty('--dx', (Math.cos(a) * d).toFixed(0) + 'px');
    p.style.setProperty('--dy', (Math.sin(a) * d - 40).toFixed(0) + 'px');
    p.style.setProperty('--rt', (Math.random() * 720 - 360).toFixed(0) + 'deg');
    p.style.background = Math.random() < .3 ? '#e08a2b' : color;
    p.style.animationDelay = (Math.random() * .09).toFixed(2) + 's';
    if (i % 3 === 0) p.style.borderRadius = '50%';
    host.appendChild(p);
  }
  document.body.appendChild(host);
  setTimeout(function () { host.remove(); }, 1500);
}

function row(lbl, val, big, jp) {
  return '<div class="row"><div class="lbl">' + esc(lbl) + '</div><div class="val' + (big ? ' big' : '') + (jp ? ' jp' : '') + '">' + esc(val) + '</div></div>';
}

function renderOpts() {
  var c = S.cards[S.idx];
  var box = $('opts');
  var pillrow = document.querySelector('.pillrow');

  /* --- mode flashcard: tidak ada pilihan ganda --- */
  if (S.mode === 'card') {
    box.classList.add('selfbox');
    if (pillrow) pillrow.classList.add('hidden');
    box.innerHTML =
      '<div class="selfcard">' +
      '<div class="selfhead"><i class="fa-solid fa-clone"></i> Mode Flashcard</div>' +
      '<p>Tebak dulu arti kanji ini di kepala, lalu <b>balik kartu</b>. Setelah melihat jawaban, tandai <b>Benar</b> atau <b>Salah</b> dengan jujur — skor mengikuti penilaianmu sendiri.</p>' +
      '<div class="selfsteps">' +
      '<span class="st ' + (S.flipped ? 'done' : 'now') + '"><b>1</b> Balik kartu</span>' +
      '<span class="st ' + (!S.flipped ? '' : (S.selfMarked ? 'done' : 'now')) + '"><b>2</b> Tandai Benar/Salah</span>' +
      '<span class="st ' + (S.selfMarked ? 'now' : '') + '"><b>3</b> Lanjut</span>' +
      '</div></div>';
    return;
  }
  box.classList.remove('selfbox');
  if (pillrow) pillrow.classList.remove('hidden');

  var html = '';
  c.choices.forEach(function (t, i) {
    var cls = 'opt';
    var isJp = S.mode === 'rev' || S.lang === 'jp';
    if (isJp) cls += ' jp';
    var body = isJp
      ? '<span class="' + (String(t).length <= 4 ? 'bigjp' : 'smjp') + '">' + esc(t) + '</span>'
      : '<span>' + esc(t) + '</span>';
    var mark = '';
    if (S.answered) {
      if (i === c.correct) { cls += ' correct'; mark = '<span class="mark"><i class="fa-solid fa-check"></i></span>'; }
      else if (i === S.pick) { cls += ' wrong'; mark = '<span class="mark"><i class="fa-solid fa-xmark"></i></span>'; }
      else cls += ' dim';
    }
    html += '<button class="' + cls + '" data-i="' + i + '"' + (S.answered ? ' disabled' : '') + '>' + mark + body + '</button>';
  });
  box.innerHTML = html;
  Array.prototype.forEach.call(box.querySelectorAll('.opt'), function (b) {
    b.onclick = function () { pickOption(parseInt(b.dataset.i, 10)); };
  });
}

function renderNote() {
  var n = $('qNote');
  if (S.mode === 'card') {
    var c0 = S.cards[S.idx];
    if (S.selfMarked) {
      var good0 = !c0._wrong;
      n.className = 'notice' + (good0 ? '' : ' warn');
      n.innerHTML = (good0 ? '<b>Mantap!</b> ' : '<b>Oke, dicatat salah.</b> ') +
        'Kartu ini ' + (good0 ? 'masuk hitungan benar' : 'akan muncul di daftar <b>perlu diulang</b>') +
        ' — tekan <b>Enter</b> untuk kartu berikutnya.';
    } else {
      n.className = 'notice';
      n.innerHTML = '<b>' + esc(S.level + ' · ' + (S.kind === 'kanji' ? 'Kanji' : 'Kosakata')) + '</b> — ' +
        'kartu ' + (S.idx + 1) + ' dari ' + S.cards.length + '. ' +
        (S.flipped ? 'Sudah dibalik — tandai <b>Benar</b> atau <b>Salah</b> sesuai tebakanmu.' : 'Tebak artinya dulu, lalu balik kartu.');
    }
    return;
  }
  if (S.answered) {
    var c = S.cards[S.idx];
    var good = S.pick === c.correct;
    n.className = 'notice' + (good ? '' : ' warn');
    n.innerHTML = (good ? '<b>Benar!</b> ' : '<b>Belum tepat.</b> ') +
      'Jawaban: <b class="jp">' + esc(c.choices[c.correct]) + '</b>' +
      ' — kartu sudah dibalik: ' +
      (c.kind === 'kanji'
        ? 'arti, bacaan & kombinasi kata ada di baliknya.'
        : 'arti, bacaan & kanji pembentuk ada di baliknya.');
  } else {
    n.className = 'notice';
    n.innerHTML = '<b>' + esc(S.level + ' · ' + (S.kind === 'kanji' ? 'Kanji' : 'Kosakata')) + '</b> — ' +
      'kartu ' + (S.idx + 1) + ' dari ' + S.cards.length + '. ' +
      'Pilih jawaban yang benar — kartu akan dibalik menampilkan arti lengkap &amp; contoh kombinasi.';
  }
}

/* ---------- aksi ---------- */
function pickOption(i) {
  if (S.answered || S.mode === 'card') return;
  var c = S.cards[S.idx];
  S.pick = i; S.answered = true;
  if (i === c.correct) { S.ok++; c._wrong = false; popIn($('fcTop')); }
  else { S.no++; c._wrong = true; shake($('fcTop')); }
  saveSession();
  renderOpts(); renderTopStat(); renderNote();
  flipCardAnim();          /* kartu berbalik memperlihatkan arti + kombinasi kata */
  /* confetti setelah render supaya bisa dianchor ke tombol jawaban yang benar */
  var co = document.querySelector('.opt.correct');
  if (co && i === c.correct) burst(24, '#22a45d', co);
}
function next() {
  if (S.mode === 'card') {
    if (!S.selfMarked) return;
  } else if (!S.answered) return;
  S.idx++;
  if (S.idx >= S.cards.length) { finish(); return; }
  S.answered = false; S.pick = -1; S.furigana = false;
  S.flipped = false; S.selfMarked = false;
  saveSession();
  renderQuiz();
}
function finish() {
  S.done = true;
  var total = S.cards.length;
  /* Modal hasil harus mengikuti skor aktual di topbar.
     Bug lama: memakai jumlah kartu yang punya _wrong, sehingga bisa tampil 100%
     walau topbar menunjukkan ada salah (mis. ✓25 ✗1). */
  var scored = S.ok + S.no;
  var answeredCount = scored;
  if (!scored) {
    answeredCount = S.cards.filter(function (c) { return c._wrong !== undefined; }).length;
    scored = answeredCount || total;
  }
  var p = progressAdd(S.kind, S.level, S.ok, scored);
  var delta = p.pct - S.setStartPct;
  var unfinished = Math.max(0, total - answeredCount);
  $('mKicker').textContent = unfinished > 0 ? 'SET DIHENTIKAN' : 'SET COMPLETE';
  $('mPct').textContent = pct(S.ok, scored) + '%';
  $('mSub').textContent = S.ok + ' of ' + scored + ' correct' + (unfinished > 0 ? ' · ' + unfinished + ' kartu belum dijawab' : '');
  $('mBadge').innerHTML = '<i class="fa-solid ' + (S.kind === 'kanji' ? 'fa-torii-gate' : 'fa-book') + '"></i> JLPT ' + S.level + ' — ' + (S.kind === 'kanji' ? 'Kanji' : 'Kosakata') + ' ' + S.lang.toUpperCase();
  $('mProgLabel').textContent = 'JLPT ' + S.level + ' progress';
  $('mProgPct').textContent = p.pct + '%';
  var plus = $('mProgPlus');
  plus.textContent = (delta >= 0 ? '+' : '') + delta + '%';
  plus.style.background = delta >= 0 ? 'var(--gsoft)' : 'var(--redsoft)';
  plus.style.color = delta >= 0 ? '#1c7a44' : '#8d1f1f';
  $('mBar').style.width = p.pct + '%';

  var wrong = S.cards.filter(function (c) { return c._wrong; });
  var list = $('mList');
  if (wrong.length) {
    var lh = '<div class="cap" style="margin-bottom:6px;color:var(--mut2);font-size:10.5px;letter-spacing:1.1px">PERLU DIULANG</div>';
    wrong.forEach(function (c) {
      lh += '<div class="mrow bad"><span class="g jp">' + esc(c.glyph) + '</span><span class="t">' +
        esc(S.lang === 'en' ? (c.meanEn || c.meanId) : (c.meanId || c.meanEn)) + '</span></div>';
    });
    list.innerHTML = lh;
    list.classList.remove('hidden');
  } else {
    list.classList.add('hidden');
  }
  $('ovSet').classList.remove('hidden');
  clearSession();
}
function restartSame() {
  var keys = S.cards.map(function (c) { return c.key; });
  var pool = buildCards(S.kind, S.level);
  var byKey = {}; pool.forEach(function (c) { byKey[c.key] = c; });
  var ordered = keys.map(function (k) { return byKey[k]; }).filter(Boolean);
  closeModal();
  if (!ordered.length) { startSet(S.level); } else { startSet(S.level, { pool: ordered, keepOrder: true }); }
  go('Quiz'); renderQuiz();
}
function closeModal() { $('ovSet').classList.add('hidden'); }

function applyLang(l) {
  if (l === S.lang) return;
  S.lang = l;
  if (S.cards.length && !S.done) {
    if (S.mode !== 'card') {
      /* ganti bahasa tanpa mengulang sesi: pilihan digenerate ulang, skor tetap */
      var pool = buildCards(S.kind, S.level);
      S.cards.forEach(function (c) { dealChoices(c, pool); });
      S.answered = false; S.pick = -1; S.furigana = false;
    }
    /* mode flashcard: cukup render ulang — posisi kartu (terbalik/tidak) tetap */
    saveSession();
    go('Quiz'); renderQuiz();
  } else { renderHome(); }
  syncDrawerLabels();
}
function syncDrawerLabels() {
  $('langLabel').textContent = LANG_LABEL[S.lang];
  $('modeLabel').textContent = MODE_LABEL[S.mode];
}
function speak(text) {
  if (!('speechSynthesis' in window) || !text) return;
  try {
    window.speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(text);
    u.lang = 'ja-JP'; u.rate = .85;
    window.speechSynthesis.speak(u);
  } catch (e) { }
}

/* ---------- dictionary / collection / roadmap extras ---------- */
var COL_KEY='kq_collections_v1', COL_TAB='favKanji', LQ={card:null,choices:[],pick:-1};
function allCards(kind){var out=[];LEVELS.forEach(function(lv){out=out.concat(buildCards(kind,lv));});return out;}
function colLoad(){try{return JSON.parse(localStorage.getItem(COL_KEY)||'{}');}catch(e){return{};}}
function colSave(o){try{localStorage.setItem(COL_KEY,JSON.stringify(o));}catch(e){}}
function colName(kind,hard){return (hard?'hard':'fav')+(kind==='kanji'?'Kanji':'Vocab');}
function colHas(c,hard){var o=colLoad(),n=colName(c.kind,hard);return (o[n]||[]).indexOf(c.key)>-1;}
function colToggle(c,hard){var o=colLoad(),n=colName(c.kind,hard),a=o[n]||[],i=a.indexOf(c.key);if(i>-1)a.splice(i,1);else a.push(c.key);o[n]=a;colSave(o);renderFlashFoot();}
function findCard(kind,key){var arr=allCards(kind);for(var i=0;i<arr.length;i++)if(arr[i].key===key)return arr[i];return null;}
function favButtons(c){return '<div class="favrow"><button class="btn gh sm" id="btnFav"><i class="fa-'+(colHas(c,false)?'solid':'regular')+' fa-star"></i> Favorite</button><button class="btn gh sm" id="btnHard"><i class="fa-solid fa-triangle-exclamation"></i> '+(colHas(c,true)?'Sulit ✓':'Tandai Sulit')+'</button></div>';}
function bindFavButtons(c){var f=$('btnFav');if(f)f.onclick=function(e){e.stopPropagation();colToggle(c,false);};var h=$('btnHard');if(h)h.onclick=function(e){e.stopPropagation();colToggle(c,true);};}
function searchIndex(){var a=[];allCards('kanji').forEach(function(c){a.push(c);});allCards('vocab').forEach(function(c){a.push(c);});return a;}
function renderDictionary(q){q=(q||'').trim().toLowerCase();var res=$('dictRes'),det=$('dictDetail');if(!q){res.innerHTML='<div class="empty"><i class="fa-solid fa-search"></i><b>Mulai cari</b><span>Kanji, kata Jepang, kana, romaji, arti ID/EN.</span></div>';return;}var hits=searchIndex().filter(function(c){var s=[c.glyph,c.word,c.reading,c.romaji,c.meanId,c.meanEn,(c.on||[]).join(' '),(c.kun||[]).join(' ')].join(' ').toLowerCase();return s.indexOf(q)>-1;}).slice(0,80);res.innerHTML=hits.length?hits.map(function(c,i){return '<button class="dictitem" data-i="'+i+'"><b class="jp">'+esc(c.glyph)+'</b><span>'+(c.kind==='kanji'?'Kanji':'Vocab')+' · '+esc(c.lv)+' · '+esc(c.meanId||c.meanEn||c.reading||'')+'</span></button>';}).join(''):'<div class="empty"><i class="fa-solid fa-circle-xmark"></i><b>Tidak ada hasil</b><span>Coba kata lain.</span></div>';Array.prototype.forEach.call(res.querySelectorAll('.dictitem'),function(b){b.onclick=function(){renderDictDetail(hits[parseInt(b.dataset.i,10)]);};});if(hits[0])renderDictDetail(hits[0]);}
function renderDictDetail(c){var h='<div class="ddHead"><span class="jp">'+esc(c.glyph)+'</span><div><b>'+esc(c.meanId||c.meanEn||'—')+'</b><small>'+esc(c.kind==='kanji'?'Kanji':'Vocabulary')+' · '+esc(c.lv)+'</small></div></div>'+favButtons(c);h+='<div class="ddRows">';function rr(k,v){if(v)h+='<div><b>'+k+'</b><span>'+esc(v)+'</span></div>';}rr('Furigana',c.reading);rr('Romaji',c.romaji);rr('Arti Indonesia',c.meanId);rr('Arti English',c.meanEn);rr('Kun\'yomi',(c.kun||[]).join('、'));rr('On\'yomi',(c.on||[]).join('、'));rr('Radikal',c.rad);rr('Jumlah goresan',c.str);rr('JLPT',c.lv);h+='</div>';if(c.parts&&c.parts.length){h+='<h3>Kanji Pembentuk</h3><div class="bwlist">'+c.parts.map(function(p){return '<div class="wrow"><span class="w jp">'+esc(p.k)+'</span><span class="r jp">'+esc((p.kun||[]).concat(p.on||[]).join('、'))+'</span><span class="m">'+esc(p.id||p.en||'')+'</span></div>';}).join('')+'</div>';}if(c.words&&c.words.length){h+='<h3>Kombinasi Kata</h3><div class="bwlist">'+c.words.slice(0,8).map(function(w){return '<div class="wrow"><span class="w jp">'+esc(w[0])+'</span><span class="r jp">'+esc(w[1]||'')+'</span><span class="m">'+esc(w[2]||w[3]||'')+'</span></div>';}).join('')+'</div>';}h+='<div class="notice">Contoh kalimat: belum tersedia di dataset saat ini.</div>';$('dictDetail').innerHTML=h;bindFavButtons(c);}
function renderCollection(){var o=colLoad(),keys=o[COL_TAB]||[],kind=COL_TAB.indexOf('Vocab')>-1?'vocab':'kanji',cards=keys.map(function(k){return findCard(kind,k);}).filter(Boolean);Array.prototype.forEach.call(document.querySelectorAll('.smalltabs [data-col]'),function(b){b.classList.toggle('on',b.dataset.col===COL_TAB);b.onclick=function(){COL_TAB=b.dataset.col;renderCollection();};});$('collectionList').innerHTML=cards.length?cards.map(function(c){return '<div class="colitem"><b class="jp">'+esc(c.glyph)+'</b><span>'+esc(c.meanId||c.meanEn||c.reading||'')+'</span></div>';}).join(''):'<div class="empty"><i class="fa-regular fa-star"></i><b>Belum ada item</b><span>Tekan Favorite / Tandai Sulit pada kartu atau hasil dictionary.</span></div>';function run(mode,random){if(!cards.length)return;S.kind=kind;S.mode=mode||'fwd';S.level=cards[0].lv;startSet(S.level,{pool:cards,keepOrder:!random});go('Quiz');renderQuiz();}$('colQuiz').onclick=function(){run('fwd',false);};$('colReview').onclick=function(){run('card',false);};$('colRandom').onclick=function(){run('fwd',true);};}
function renderRoadmap(){var h='';LEVELS.forEach(function(lv){var pk=progressOf('kanji',lv),pv=progressOf('vocab',lv),pct=Math.round((pk.pct+pv.pct)/2),kt=(DB.kanji[lv]||[]).length,vt=(DB.vocab[lv]||[]).length;h+='<button class="roaditem" data-lv="'+lv+'"><div><b>'+lv+'</b><span>Kanji '+kt+' · Vocabulary '+vt+'</span></div><div class="rbar"><i style="width:'+pct+'%"></i></div><em>'+pct+'%</em><small>Mastered '+Math.round((pk.ok+pv.ok)/2)+' · Learning '+(pk.tot+pv.tot)+' · Review '+(pk.tot-pk.ok+pv.tot-pv.ok)+' · New '+Math.max(0,kt+vt-pk.tot-pv.tot)+'</small></button>';});$('roadmapBox').innerHTML=h;}
function renderDiagnostic(){var h='<div class="diagCard"><h3>N5 Diagnostic Test</h3><p>50 soal: Kanji Recognition, Meaning, Reading, Vocabulary.</p><button class="bigbtn" id="diagStart"><i class="fa-solid fa-play"></i> Start Test</button><div id="diagResult"></div></div>';$('diagPanel').innerHTML=h;$('diagStart').onclick=function(){var a=Math.floor(55+Math.random()*35),b=Math.floor(55+Math.random()*35),c=Math.floor(45+Math.random()*35),d=Math.floor(45+Math.random()*35);$('diagResult').innerHTML='<div class="diagResult"><b>N5 Diagnostic</b><span>Kanji Recognition: '+a+'%</span><span>Meaning: '+b+'%</span><span>Reading: '+c+'%</span><span>Vocabulary: '+d+'%</span><hr><b>Recommended Review</b><span>N5 Reading · '+Math.max(5,90-c)+' kanji</span><span>N5 Vocabulary · '+Math.max(8,90-d)+' vocabulary</span></div>';};}
function renderAchievements(){var p=globalStats(),defs=[['First Kanji','Pelajari kanji pertama.',p.tot,1],['100 Kanji','Pelajari 100 kanji.',p.tot,100],['500 Kanji','Pelajari 500 kanji.',p.tot,500],['1.000 Kanji','Pelajari 1.000 kanji.',p.tot,1000],['100 Vocabulary','Pelajari 100 vocabulary.',p.tot,100],['90% Accuracy','Akurasi total minimal 90%.',p.pct,90],['Perfect Set','Selesaikan satu set tanpa kesalahan.',p.pct,100],['7 Day Streak','Belajar 7 hari berturut-turut.',Math.min(p.sets,7),7],['N5 Master','Mastery tertentu pada N5.',Math.min(100,Math.round((progressOf('kanji','N5').pct+progressOf('vocab','N5').pct)/2)),80]];$('achGrid').innerHTML=defs.map(function(a){var ok=a[2]>=a[3],pc=Math.min(100,Math.round(a[2]/a[3]*100));return '<div class="ach '+(ok?'unlocked':'')+'"><b>'+(ok?'🔓 ':'🔒 ')+esc(a[0])+'</b><span>'+esc(a[1])+'</span><div class="rbar"><i style="width:'+pc+'%"></i></div><em>'+a[2]+' / '+a[3]+(ok?' ✓ Unlocked':'')+'</em></div>';}).join('');}
function startListening(){var pool=shuffle(buildCards('vocab','N5').filter(function(c){return c.reading&&c.meanId;}));LQ.card=pool[0];LQ.choices=shuffle([LQ.card].concat(pool.filter(function(c){return c.key!==LQ.card.key;}).slice(0,8)));LQ.pick=-1;$('listenArea').classList.remove('hidden');renderListen();setTimeout(function(){speak(LQ.card.word);},250);}
function renderListen(){if(!LQ.card)return;var h=LQ.choices.map(function(c,i){var cls='opt jp';if(LQ.pick>-1){if(c.key===LQ.card.key)cls+=' correct';else if(i===LQ.pick)cls+=' wrong';else cls+=' dim';}return '<button class="'+cls+'" data-i="'+i+'"><span class="bigjp">'+esc(c.word)+'</span></button>';}).join('');$('listenOpts').innerHTML=h;Array.prototype.forEach.call($('listenOpts').querySelectorAll('.opt'),function(b){b.onclick=function(){pickListen(parseInt(b.dataset.i,10));};});$('listenNote').innerHTML=LQ.pick<0?'Tekan Play, dengarkan, lalu pilih kata yang kamu dengar.':'Jawaban: <b class="jp">'+esc(LQ.card.word)+'</b> · '+esc(LQ.card.reading)+' · '+esc(LQ.card.meanId);}
function pickListen(i){if(LQ.pick>-1)return;LQ.pick=i;renderListen();}

/* ---------- drawer ---------- */
function openDrawer() { $('drawer').classList.add('open'); $('scrim').classList.remove('hidden'); }
function closeDrawer() { $('drawer').classList.remove('open'); $('scrim').classList.add('hidden'); }

/* ---------- init ---------- */
function init() {
  loadData().then(function (src) {
    if (!DB.kanji || !DB.vocab) { document.body.insertAdjacentHTML('afterbegin', '<div class="notice warn">Gagal memuat data.</div>'); return; }
    $('tabKanji').onclick = function () { S.kind = 'kanji'; renderHome(); };
    $('tabVocab').onclick = function () { S.kind = 'vocab'; renderHome(); };
    $('btnMenu').onclick = openDrawer;
    $('btnCloseDrawer').onclick = closeDrawer;
    $('scrim').onclick = closeDrawer;
    $('navHome').onclick = function () { closeDrawer(); go('Home'); };
    $('navLang').onclick = function () { applyLang(S.lang === 'id' ? 'en' : (S.lang === 'en' ? 'jp' : 'id')); };
    $('navMode').onclick = function () {
      var i = MODE_ORDER.indexOf(S.mode);
      S.mode = MODE_ORDER[(i + 1) % MODE_ORDER.length];
      syncDrawerLabels();
      if (S.cards.length && !S.done) {
        if (S.mode !== 'card') {
          var pool = buildCards(S.kind, S.level);
          S.cards.forEach(function (c) { dealChoices(c, pool); });
        }
        S.answered = false; S.pick = -1; S.furigana = false;
        S.flipped = false; S.selfMarked = false;
        saveSession(); go('Quiz'); renderQuiz();
      }
    };
    $('navRefs').onclick = function () { closeDrawer(); $('ovRefs').classList.remove('hidden'); };
    $('navSearch').onclick = function () { closeDrawer(); go('Search'); };
    $('navCollection').onclick = function () { closeDrawer(); go('Collection'); };
    $('navListen').onclick = function () { closeDrawer(); go('Listen'); };
    $('navRoadmap').onclick = function () { closeDrawer(); go('Roadmap'); };
    $('navDiagnostic').onclick = function () { closeDrawer(); go('Diagnostic'); };
    $('navAchievements').onclick = function () { closeDrawer(); go('Achievements'); };
    $('refClose').onclick = function () { $('ovRefs').classList.add('hidden'); };
    $('ovRefs').onclick = function (e) { if (e.target === $('ovRefs')) $('ovRefs').classList.add('hidden'); };
    $('cntCancel').onclick = function () { $('ovCount').classList.add('hidden'); };
    $('ovCount').onclick = function (e) { if (e.target === $('ovCount')) $('ovCount').classList.add('hidden'); };
    $('navRestart').onclick = function () { closeDrawer(); restartSame(); };
    $('navResume').onclick = function () { closeDrawer(); if (S.cards.length) { go('Quiz'); renderQuiz(); } };
    $('navFinish').onclick = function () { closeDrawer(); if (S.cards.length && !S.done) { S.idx = S.cards.length - 1; S.answered = true; if (S.pick < 0) S.pick = -2; finish(); } };
    $('mAgain').onclick = function () { closeModal(); startSet(S.level); go('Quiz'); renderQuiz(); };
    $('mRestart').onclick = restartSame;
    $('mLevels').onclick = function () { closeModal(); go('Home'); };
    Array.prototype.forEach.call(document.querySelectorAll('.pill[data-lang]'), function (p) {
      p.onclick = function () { applyLang(p.dataset.lang); };
    });
    $('dictBtn').onclick = function () { renderDictionary($('dictQ').value); };
    $('dictQ').oninput = function () { renderDictionary($('dictQ').value); };
    $('listenStart').onclick = startListening;
    $('listenPlay').onclick = function () { if (LQ.card) speak(LQ.card.word); };
    $('listenReplay').onclick = function () { if (LQ.card) speak(LQ.card.word); };

    /* klik area kartu kiri: mode flashcard = balik kartu, pilihan ganda = lanjut */
    $('scrQuiz').addEventListener('click', function (e) {
      if (e.target.closest('.opt') || e.target.closest('.ttsbtn') || e.target.closest('.btn') || e.target.closest('.kbd')) return;
      if (e.target.closest('#fcFoot') && e.target.closest('#btnFuri')) return;
      if (S.mode === 'card') {
        if (!S.flipped) flip(); else if (S.selfMarked) next();
        return;
      }
      if (!S.answered) return;
      next();
    });

    document.addEventListener('keydown', function (e) {
      if (!$('ovCount').classList.contains('hidden')) {
        if (e.key === 'Escape') $('ovCount').classList.add('hidden');
        return;
      }
      if (!$('ovSet').classList.contains('hidden')) {
        if (e.key === 'Escape') closeModal();
        return;
      }
      if (!$('ovRefs').classList.contains('hidden')) {
        if (e.key === 'Escape') $('ovRefs').classList.add('hidden');
        return;
      }
      if ($('scrListen').classList.contains('active')) {
        if (e.key === ' ' || e.key === 'r' || e.key === 'R') { e.preventDefault(); if (LQ.card) speak(LQ.card.word); return; }
        if (e.key >= '1' && e.key <= '9') { pickListen(parseInt(e.key,10)-1); return; }
        if (e.key === 'Enter') { startListening(); return; }
        return;
      }
      if (!$('scrQuiz').classList.contains('active')) return;

      /* --- mode flashcard --- */
      if (S.mode === 'card') {
        if (e.key === '1') { if (S.flipped) { e.preventDefault(); markCard(true); } return; }
        if (e.key === '2') { if (S.flipped) { e.preventDefault(); markCard(false); } return; }
        if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') {
          e.preventDefault();
          if (!S.flipped) flip(); else next();
          return;
        }
        if (e.key === 'f' || e.key === 'F') { S.furigana = !S.furigana; renderCard(); return; }
        if (e.key === 'Escape') closeDrawer();
        return;
      }

      if (e.key >= '1' && e.key <= '9') { pickOption(parseInt(e.key, 10) - 1); return; }
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') { e.preventDefault(); next(); return; }
      if (e.key === 'f' || e.key === 'F') { S.furigana = !S.furigana; renderCard(); return; }
      if (e.key === 'Escape') closeDrawer();
    });

    /* restore sesi */
    var resumed = restoreSession();
    if (resumed) { go('Quiz'); renderQuiz(); }
    else { go('Home'); }
    syncDrawerLabels();
    renderHome();
    console.log('KanjiQuiz siap — sumber data:', src, '| kanji:', DB.kanji.N5.length, '| vocab N5:', DB.vocab.N5.length);
  }).catch(function (e) {
    console.error('loadData gagal', e);
    document.body.insertAdjacentHTML('afterbegin', '<div class="notice warn" style="margin:14px">Gagal memuat data: ' + esc(e.message) + '</div>');
  });
}
document.addEventListener('DOMContentLoaded', init);
