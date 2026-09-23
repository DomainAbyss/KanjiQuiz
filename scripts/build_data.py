# -*- coding: utf-8 -*-
"""
Gabungkan hasil scrape -> data/kanji.json & data/vocab.json (kompak, siap embed).
"""
import json, os, sys, re

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DATA = os.path.join(ROOT, "data")

MAX_WORDS = 8          # kombinasi kata per kanji (flashcard back)
MAX_MEAN_ID = 3        # arti per kata
MAX_MEAN_EN = 3
LEVELS = ["N5", "N4", "N3", "N2", "N1"]

# Koreksi manual untuk entri yang dari sumber masih jatuh ke English / arti kurang natural.
# Simpan di build script supaya rebuild data tidak mengembalikan bug lama.
ID_OVERRIDES = {
    "御飯": ["nasi", "makanan"],
    "飯": ["nasi", "makanan"],
    "食べ物": ["makanan"],
    "食事": ["makan", "makanan", "jam makan"],
    "食料品": ["bahan makanan", "sembako", "barang pangan"],
    "食品": ["makanan", "produk makanan"],
    "食料": ["bahan makanan", "pangan"],
    "食物": ["makanan", "bahan makanan"],
    "食糧": ["pangan", "persediaan makanan"],
    "餌": ["pakan", "makanan hewan", "umpan"],
    "お弁当": ["bekal", "bento", "nasi kotak Jepang"],
    "片仮名": ["katakana"],
    "右": ["kanan", "sebelah kanan"],
    "話": ["cerita", "pembicaraan", "topik"],
    "話す": ["berbicara", "bercakap-cakap", "mengobrol"],
    "妻": ["istri"],
    "博物館": ["museum"],
    "器官": ["organ", "alat tubuh"],
    "缶": ["kaleng"],
    "堀": ["parit", "selokan", "kanal"],
}


def kana_romaji(s):
    """Romaji sederhana untuk kata kana (fallback kalau scrape tidak dapat romaji)."""
    s = (s or "").strip()
    if not s:
        return ""
    table = [("kya", "きゃ"), ("kyu", "きゅ"), ("kyo", "きょ"), ("sha", "しゃ"), ("shu", "しゅ"),
             ("sho", "しょ"), ("cha", "ちゃ"), ("chu", "ちゅ"), ("cho", "ちょ"), ("nya", "にゃ"),
             ("nyu", "にゅ"), ("nyo", "にょ"), ("hya", "ひゃ"), ("hyu", "ひゅ"), ("hyo", "ひょ"),
             ("mya", "みゃ"), ("myu", "みゅ"), ("myo", "みょ"), ("rya", "りゃ"), ("ryu", "りゅ"),
             ("ryo", "りょ"), ("gya", "ぎゃ"), ("gyu", "ぎゅ"), ("gyo", "ぎょ"), ("bya", "びゃ"),
             ("byu", "びゅ"), ("byo", "びょ"), ("pya", "ぴゃ"), ("pyu", "ぴゅ"), ("pyo", "ぴょ"),
             ("ja", "じゃ"), ("ju", "じゅ"), ("jo", "じょ"), ("shi", "し"), ("chi", "ち"),
             ("tsu", "つ"), ("fu", "ふ"), ("ji", "じ")]
    single = {"あ": "a", "い": "i", "う": "u", "え": "e", "お": "o", "か": "ka", "き": "ki", "く": "ku",
              "け": "ke", "こ": "ko", "さ": "sa", "す": "su", "せ": "se", "そ": "so", "た": "ta",
              "て": "te", "と": "to", "な": "na", "に": "ni", "ぬ": "nu", "ね": "ne", "の": "no",
              "は": "ha", "ひ": "hi", "へ": "he", "ほ": "ho", "ま": "ma", "み": "mi", "む": "mu",
              "め": "me", "も": "mo", "や": "ya", "ゆ": "yu", "よ": "yo", "ら": "ra", "り": "ri",
              "る": "ru", "れ": "re", "ろ": "ro", "わ": "wa", "を": "o", "ん": "n", "が": "ga",
              "ぎ": "gi", "ぐ": "gu", "げ": "ge", "ご": "go", "ざ": "za", "ず": "zu", "ぜ": "ze",
              "ぞ": "zo", "だ": "da", "で": "de", "ど": "do", "ば": "ba", "び": "bi", "ぶ": "bu",
              "べ": "be", "ぼ": "bo", "ぱ": "pa", "ぴ": "pi", "ぷ": "pu", "ぺ": "pe", "ぽ": "po",
              "し": "shi", "ち": "chi", "つ": "tsu", "ふ": "fu", "じ": "ji",
              "ぁ": "a", "ぃ": "i", "ぅ": "u", "ぇ": "e", "ぉ": "o", "ゃ": "ya", "ゅ": "yu", "ょ": "yo",
              "ー": ""}
    out, i = [], 0
    while i < len(s):
        two, one = s[i:i + 2], s[i]
        if one == "っ" and i + 1 < len(s):
            nx = s[i + 1:i + 3]
            r = dict(table).get(nx) or single.get(s[i + 1], "")
            out.append((r[:1] or "") + r)
            i += 2
            continue
        hit = None
        for ro, kk in table:
            if two == kk:
                hit = ro
                break
        if hit:
            out.append(hit); i += 2; continue
        out.append(single.get(one, one)); i += 1
    return "".join(out)


def clean_reading(s):
    """ひと.つ -> ひとつ ; ひと- -> ひと (okurigana marker dibuang)"""
    if not s:
        return ""
    return s.replace(".", "").replace("-", "").strip()


def main():
    raw = json.load(open(os.path.join(DATA, "kanji_raw.json"), encoding="utf-8"))
    details = raw["details"]

    kanji = {lv: [] for lv in LEVELS}
    for lv in LEVELS:
        for card in raw["levels"][lv.lower()]:
            g = card["kanji"]
            d = details.get(g)
            if not d:
                continue
            words = []
            for w in d.get("words", [])[:MAX_WORDS]:
                words.append([w.get("w", ""), w.get("r", ""), w.get("id", ""), w.get("en", "")])
            kanji[lv].append({
                "k": g,
                "id": d.get("meaning_id", ""),
                "en": d.get("meaning_en", ""),
                "on": [clean_reading(x) for x in d.get("onyomi", []) if x],
                "kun": [clean_reading(x) for x in d.get("kunyomi", []) if x],
                "rad": d.get("radical", ""),
                "str": d.get("strokes", ""),
                "joyo": d.get("joyo", ""),
                "freq": d.get("freq", ""),
                "w": words,
            })

    # ---- vocab ----
    vocab = {lv: [] for lv in LEVELS}
    seen = {lv: set() for lv in LEVELS}
    vp = os.path.join(DATA, "vocab_raw.jsonl")
    n_err = 0
    if os.path.exists(vp):
        for line in open(vp, encoding="utf-8"):
            line = line.strip()
            if not line:
                continue
            try:
                r = json.loads(line)
            except Exception:
                continue
            if r.get("error"):
                n_err += 1
                continue
            lv = r.get("lv", "").upper()
            if lv not in vocab:
                continue
            w = r.get("w") or r.get("expr") or ""
            if not w or w in seen[lv]:
                continue
            seen[lv].add(w)
            reading = r.get("r") or r.get("reading") or ""
            idl = [x for x in (r.get("id") or []) if x][:MAX_MEAN_ID]
            enl = [x for x in (r.get("en") or []) if x][:MAX_MEAN_EN]
            # kata kana murni / tidak ada halaman detail -> fallback arti EN dari elzup
            if not idl and not enl:
                src = r.get("en_src") or ""
                if src:
                    enl = [x.strip() for x in src.split(",") if x.strip()][:MAX_MEAN_EN]
            if w in ID_OVERRIDES:
                idl = ID_OVERRIDES[w][:MAX_MEAN_ID]
            romaji = r.get("romaji", "")
            if not romaji and reading:
                romaji = kana_romaji(reading)
            if not idl:
                idl = list(enl)          # jangan biarkan arti kosong di mode Indonesia
            vocab[lv].append({
                "w": w,
                "r": reading,
                "ro": romaji,
                "id": idl,
                "en": enl,
                "kj": [k for k in (r.get("kanji") or []) if k],
                "src": "elzup" if (not r.get("w") and r.get("en_src")) else "",
            })

    payload_k = {"meta": {"source": "kanji.jepang.org", "type": "kanji"},
                 "counts": {lv: len(kanji[lv]) for lv in LEVELS}, "levels": kanji}
    payload_v = {"meta": {"source": "kanji.jepang.org + elzup/jlpt-word-list", "type": "vocab"},
                 "counts": {lv: len(vocab[lv]) for lv in LEVELS}, "levels": vocab}

    pk = os.path.join(DATA, "kanji.json")
    pv = os.path.join(DATA, "vocab.json")
    json.dump(payload_k, open(pk, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    json.dump(payload_v, open(pv, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))

    print("kanji.json:", round(os.path.getsize(pk) / 1024), "KB", payload_k["counts"])
    print("vocab.json:", round(os.path.getsize(pv) / 1024), "KB", payload_v["counts"],
          "| error dilewati:", n_err)

    # sanity: ada yang arti kosong?
    bad_k = sum(1 for lv in LEVELS for x in kanji[lv] if not x["id"])
    bad_v = sum(1 for lv in LEVELS for x in vocab[lv] if not x["id"] and not x["en"])
    print("kanji tanpa arti ID:", bad_k, "| vocab tanpa arti:", bad_v)


if __name__ == "__main__":
    main()
