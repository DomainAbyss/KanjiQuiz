# -*- coding: utf-8 -*-
"""
Scrape detail kosakata JLPT (N5-N1) dari kanji.jepang.org/kosakata/<kata>
Sumber daftar kata: elzup/jlpt-word-list (cache/v_<level>.csv)
Output: data/vocab_raw.jsonl (resume-able)
"""
import re, json, os, sys, csv, time, random, threading, html as _h
from urllib.parse import quote
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError
from concurrent.futures import ThreadPoolExecutor, as_completed

BASE = "https://kanji.jepang.org"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DATA = os.path.join(ROOT, "data")
os.makedirs(DATA, exist_ok=True)
OUT = os.path.join(DATA, "vocab_raw.jsonl")
LEVELS = ["n5", "n4", "n3", "n2", "n1"]


def strip(s):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", s)).strip()


def unesc(s):
    return _h.unescape(s).strip() if s else ""


def get(url, tries=5, timeout=30):
    """Rate-limited fetch: situs mengembalikan 429 kalau terlalu cepat.
    Kembalikan None kalau gagal (404 = halaman memang tidak ada)."""
    last = None
    for i in range(tries):
        _throttle()
        try:
            req = Request(url, headers={"User-Agent": UA, "Accept-Language": "id,en;q=0.8"})
            with urlopen(req, timeout=timeout) as r:
                return r.read().decode("utf-8", "replace")
        except HTTPError as e:
            last = e
            if e.code == 429:
                time.sleep(8 * (i + 1) + random.random() * 3)
            elif e.code in (500, 502, 503, 504):
                time.sleep(2 * (i + 1))
            elif e.code == 404:
                break
            else:
                time.sleep(1.5 * (i + 1))
        except (URLError, TimeoutError, OSError) as e:
            last = e
            time.sleep(1.5 * (i + 1) + random.random() * 0.5)
    return None


_LOCK = threading.Lock()
_LAST = [0.0]
MIN_GAP = 0.17          # ~6 req/s, di bawah ambang 429


def _throttle():
    with _LOCK:
        wait = _LAST[0] + MIN_GAP - time.time()
        if wait > 0:
            time.sleep(wait)
        _LAST[0] = time.time()


def parse_word(h):
    d = {}
    m = re.search(r'class="ks-hero__glyph">(.*?)</span>', h, re.S)
    d["w"] = unesc(strip(m.group(1))) if m else ""
    m = re.search(r'class="ks-hero__kana">(.*?)</span>', h, re.S)
    d["r"] = unesc(strip(m.group(1))) if m else ""
    m = re.search(r'class="ks-hero__romaji">(.*?)</span>', h, re.S)
    d["romaji"] = unesc(strip(m.group(1))) if m else ""
    chips = re.findall(r'class="ks-hero__kanji-chip"[^>]*>(.*?)</a>', h, re.S)
    d["kanji"] = [unesc(strip(c)) for c in chips if unesc(strip(c))]

    # arti: batasi ke section "Arti" saja (section "Cara Baca" juga memakai kelas sama)
    i = h.find("<h2>Arti</h2>")
    j = h.find("<h2>Cara Baca</h2>")
    seg = h[i:j] if (i > 0 and j > i) else h
    idl, enl = [], []
    for m in re.finditer(r'<div class="ks-meanings__(primary|secondary)">', seg):
        kind = m.group(1)
        nxt = re.search(r'<div class="ks-meanings__(?:primary|secondary)">', seg[m.end():])
        blk = seg[m.end(): m.end() + nxt.start()] if nxt else seg[m.end():]
        items = [unesc(strip(x)) for x in re.findall(r"<li>(.*?)</li>", blk, re.S)]
        items = [x for x in items if x]
        if not items:
            continue
        head = strip(blk)[:40].lower()
        if "kana" in head or "romaji" in head:
            continue
        if kind == "primary" and ("indonesia" in head or not idl):
            idl = items
        elif "inggris" in head or "english" in head:
            enl = items
        elif not enl:
            enl = items
    d["id"] = idl
    d["en"] = enl

    # varian penulisan
    var = []
    i = h.find('ks-reading-variants__list')
    if i > 0:
        seg = h[i:h.find('</ul>', i)]
        for m in re.finditer(r'<li>(.*?)</li>', seg, re.S):
            wr = re.search(r'class="ks-reading-variant__written">(.*?)</strong>', m.group(1), re.S)
            kn = re.search(r'class="ks-reading-variant__kana">(.*?)</span>', m.group(1), re.S)
            if wr:
                var.append({"w": unesc(strip(wr.group(1))), "r": unesc(strip(kn.group(1))) if kn else ""})
    d["var"] = var
    return d


def load_wordlist():
    rows = []
    for lv in LEVELS:
        p = os.path.join(ROOT, "cache", f"v_{lv}.csv")
        if not os.path.exists(p):
            print("!! missing", p); continue
        for r in csv.DictReader(open(p, encoding="utf-8")):
            expr = (r.get("expression") or "").strip()
            if not expr:
                continue
            # buang bentuk alternatif "足; 脚" -> ambil yang pertama
            main = re.split(r"[;；,、]", expr)[0].strip()
            rows.append({"lv": lv.upper(), "expr": main, "reading": (r.get("reading") or "").strip(),
                         "en_src": (r.get("meaning") or "").strip()})
    # dedupe by expr
    seen, uniq = set(), []
    for r in rows:
        if r["expr"] in seen:
            continue
        seen.add(r["expr"])
        uniq.append(r)
    return uniq


def main():
    words = load_wordlist()
    print(f"daftar kata: {len(words)}", flush=True)
    done, done_ok = set(), set()
    if os.path.exists(OUT):
        for line in open(OUT, encoding="utf-8"):
            try:
                r = json.loads(line)
            except Exception:
                continue
            done.add(r["expr"])
            if not r.get("error"):
                done_ok.add(r["expr"])
    print(f"sudah diproses: {len(done)} (berhasil {len(done_ok)})", flush=True)
    # ulangi yang sebelumnya gagal (429/503), lewati yang 404 (halaman tidak ada)
    todo = []
    for w in words:
        if w["expr"] not in done:
            todo.append(w)
    if os.path.exists(OUT):
        for line in open(OUT, encoding="utf-8"):
            try:
                r = json.loads(line)
            except Exception:
                continue
            e = r.get("error") or ""
            if e and "404" not in e and r["expr"] not in done_ok:
                todo.append({k: r[k] for k in ("lv", "expr", "reading", "en_src") if k in r})
    print(f"perlu diambil: {len(todo)}", flush=True)

    f = open(OUT, "a", encoding="utf-8")
    lock = threading.Lock()
    ok = fail = 0

    def work(rec):
        url = f"{BASE}/kosakata/{quote(rec['expr'])}"
        h = get(url)
        if h is None:
            return None
        return {**rec, **parse_word(h)}

    with ThreadPoolExecutor(max_workers=6) as ex:
        futs = {ex.submit(work, w): w for w in todo}
        for n, fut in enumerate(as_completed(futs), 1):
            w = futs[fut]
            try:
                rec = fut.result()
                if rec is None:
                    raise RuntimeError("fetch gagal / 404")
                with lock:
                    f.write(json.dumps(rec, ensure_ascii=False) + "\n")
                    f.flush()
                ok += 1
            except Exception as e:
                fail += 1
                with lock:
                    f.write(json.dumps({**w, "error": str(e)[:160]}, ensure_ascii=False) + "\n")
                    f.flush()
            if n % 100 == 0:
                print(f"  {n}/{len(todo)} ok={ok} fail={fail}", flush=True)
    f.close()
    print(f"SELESAI ok={ok} fail={fail} -> {OUT}", flush=True)


if __name__ == "__main__":
    main()
