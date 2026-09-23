# -*- coding: utf-8 -*-
"""
Scrape daftar kanji JLPT N5-N1 + detail (bacaan, arti ID/EN, kombinasi kosakata)
dari kanji.jepang.org. Output: data/kanji_raw.json
"""
import re, json, os, sys, time, random, threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError

BASE = "https://kanji.jepang.org"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "data")
CACHE = os.path.join(HERE, "..", "cache")
os.makedirs(OUT, exist_ok=True)
os.makedirs(CACHE, exist_ok=True)

LEVELS = ["n5", "n4", "n3", "n2", "n1"]


def get(url, tries=6, timeout=30):
    """Rate-limited fetch. Situs ini mengembalikan 429 kalau terlalu cepat —
    pakai jeda minimum global + backoff panjang, dan JANGAN abort seluruh run."""
    last = None
    for i in range(tries):
        _throttle()
        try:
            req = Request(url, headers={"User-Agent": UA, "Accept-Language": "id,en;q=0.8",
                                        "Accept": "text/html,application/xhtml+xml"})
            with urlopen(req, timeout=timeout) as r:
                return r.read().decode("utf-8", "replace")
        except HTTPError as e:
            last = e
            if e.code == 429:
                time.sleep(8 * (i + 1) + random.random() * 3)   # 8,16,24,32,40s
            elif e.code in (500, 502, 503, 504):
                time.sleep(2 * (i + 1))
            elif e.code == 404:
                break                                            # tidak akan berubah
            else:
                time.sleep(1.5 * (i + 1))
        except (URLError, TimeoutError, OSError) as e:
            last = e
            time.sleep(1.5 * (i + 1) + random.random() * 0.5)
    return None


# --- throttle global (dipakai semua thread) ---
_LOCK = threading.Lock()
_LAST = [0.0]
MIN_GAP = 0.16          # ~6 req/s maksimum, di bawah ambang 429


def _throttle():
    with _LOCK:
        now = time.time()
        wait = _LAST[0] + MIN_GAP - now
        if wait > 0:
            time.sleep(wait)
        _LAST[0] = time.time()


def cache_path(kind, key):
    """PENTING: key bisa karakter CJK — jangan sanitize jadi '_' (semua kanji akan
    menabrak satu file yang sama). Pakai hex dari UTF-8."""
    safe = key.encode("utf-8").hex()
    return os.path.join(CACHE, f"{kind}_{safe}.html")


def get_cached(kind, key, url):
    p = cache_path(kind, key)
    if os.path.exists(p) and os.path.getsize(p) > 2000:
        with open(p, encoding="utf-8") as f:
            return f.read()
    h = get(url)
    if h is None:
        return None
    with open(p, "w", encoding="utf-8") as f:
        f.write(h)
    return h


# ---------- parsing ----------

def strip(s):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", s)).strip()


def unesc(s):
    if s is None:
        return None
    import html as _h
    return _h.unescape(s).strip()


def parse_list_page(h):
    """Ambil kartu kanji: glyph, reading(katakana pertama), arti ID, kelas."""
    out = []
    for m in re.finditer(r'<a class="kanji-card__link" href="/kanji/([^"]+)">(.*?)</a>', h, re.S):
        glyph = m.group(1)
        blk = m.group(2)
        rd = re.search(r'class="kanji-card__reading">(.*?)</p>', blk, re.S)
        mn = re.search(r'class="kanji-card__meaning-main">(.*?)</span>', blk, re.S)
        meta = re.search(r'class="kanji-card__meta">(.*?)</p>', blk, re.S)
        out.append({
            "kanji": unesc(glyph),
            "reading_list": unesc(strip(rd.group(1))) if rd else "",
            "meaning_id_list": unesc(strip(mn.group(1))) if mn else "",
            "meta": unesc(strip(meta.group(1))) if meta else "",
        })
    return out


def parse_detail(h):
    d = {}
    m = re.search(r'class="kanji-detail-hero__meaning-id"[^>]*>(.*?)</p>', h, re.S)
    d["meaning_id"] = unesc(strip(m.group(1))) if m else ""
    m = re.search(r'class="kanji-detail-hero__meaning-full[^"]*--english[^"]*"[^>]*>(.*?)</p>', h, re.S)
    d["meaning_en"] = unesc(strip(m.group(1))) if m else ""
    if not d["meaning_en"]:
        m = re.search(r'class="kanji-detail-hero__meaning-full[^"]*"[^>]*>(.*?)</p>', h, re.S)
        d["meaning_en"] = unesc(strip(m.group(1))) if m else ""

    # bacaan: split per baris <div class="kanji-readings__row">
    ony, kuny, nano = [], [], []
    i = h.find('class="kanji-readings__list"')
    if i > 0:
        seg = h[i:h.find("</dl>", i)]
        parts = seg.split('<div class="kanji-readings__row">')[1:]
        for r in parts:
            pills = [unesc(strip(x)) for x in re.findall(r'class="reading-pill[^"]*">(.*?)</span>', r, re.S)]
            pills = [p for p in pills if p]
            head = strip(r)[:40]
            if "Onyomi" in head or "音読み" in head:
                ony = pills
            elif "Kunyomi" in head or "訓読み" in head:
                kuny = pills
            elif "Nanori" in head or "名乗り" in head:
                nano = pills
    d["onyomi"], d["kunyomi"], d["nanori"] = ony, kuny, nano

    # stats: setiap kartu <div class="kanji-stat-card"><dt>Label</dt><dd>nilai</dd>
    stats = {}
    for m in re.finditer(r'<div class="kanji-stat-card">(.*?)</div>', h, re.S):
        blk = m.group(1)
        dt = re.search(r"<dt>(.*?)</dt>", blk, re.S)
        dd = re.search(r"<dd>(.*?)</dd>", blk, re.S)
        if dt and dd:
            stats[unesc(strip(dt.group(1)))] = unesc(strip(dd.group(1)))
    d["stats"] = stats
    d["joyo"] = stats.get("Jōyō", stats.get("Joyo", ""))
    d["jlpt"] = stats.get("JLPT", "")
    d["radical"] = stats.get("Radikal", "")
    d["strokes"] = stats.get("Jumlah goresan", stats.get("Jumlah Goresan", ""))
    d["freq"] = stats.get("Frekuensi", "")

    # kombinasi kosakata (word-card)
    words = []
    for m in re.finditer(r'<article[^>]*class="word-card"[^>]*>(.*?)</article>', h, re.S):
        blk = m.group(0)
        def a(k):
            x = re.search(k + r'="([^"]*)"', blk)
            return unesc(x.group(1)) if x else ""
        rd = re.search(r'class="word-card__reading">(.*?)</p>', blk, re.S)
        mn = re.search(r'class="word-card__meaning">(.*?)</p>', blk, re.S)
        en = re.search(r'class="word-card__anchor"[^>]*>(.*?)</p>', blk, re.S)
        w = a("data-tts-written")
        if not w:
            continue
        words.append({
            "w": w,
            "r": a("data-tts-reading") or (unesc(strip(rd.group(1))) if rd else ""),
            "id": (unesc(strip(mn.group(1))) if mn else a("data-tts-meaning")),
            "en": (unesc(strip(en.group(1))) if en else ""),
        })
    # buang duplikat
    seen, uniq = set(), []
    for w in words:
        if w["w"] in seen:
            continue
        seen.add(w["w"])
        uniq.append(w)
    d["words"] = uniq
    return d


# ---------- main ----------

def main():
    only = sys.argv[1:] or LEVELS
    levels = {}
    for lv in only:
        pages, seen_glyphs, order = [], set(), []
        page = 1
        while page <= 25:
            h = get_cached("list", f"{lv}_p{page}", f"{BASE}/jlpt/{lv}?page={page}")
            cards = parse_list_page(h)
            if not cards:
                break
            new = 0
            for c in cards:
                if c["kanji"] in seen_glyphs:
                    continue
                seen_glyphs.add(c["kanji"])
                order.append(c)
                new += 1
            print(f"  {lv} page {page}: {len(cards)} kartu, +{new} baru (total {len(order)})", flush=True)
            if new == 0:
                break
            page += 1
        levels[lv] = order
        print(f"[{lv}] TOTAL {len(order)} kanji", flush=True)

    all_k = []
    for lv in only:
        all_k += [c["kanji"] for c in levels[lv]]
    all_k = list(dict.fromkeys(all_k))
    print(f"\nScrape detail {len(all_k)} kanji ...", flush=True)

    details = {}
    done = 0
    fails = []

    def work(g):
        from urllib.parse import quote
        url = f"{BASE}/kanji/{quote(g)}"
        h = get_cached("detail", g, url)
        if h is None:
            raise RuntimeError("fetch gagal setelah retry")
        return g, parse_detail(h)

    with ThreadPoolExecutor(max_workers=4) as ex:
        futs = {ex.submit(work, g): g for g in all_k}
        for f in as_completed(futs):
            g = futs[f]
            try:
                gg, d = f.result()
                details[gg] = d
            except Exception as e:
                fails.append((g, str(e)))
            done += 1
            if done % 25 == 0 or done == len(all_k):
                print(f"  {done}/{len(all_k)} selesai ({len(fails)} gagal)", flush=True)
            if done % 200 == 0:      # simpan berkala supaya tidak hilang kalau mati
                json.dump({"levels": levels, "details": details,
                           "counts": {lv: len(levels[lv]) for lv in only}},
                          open(os.path.join(OUT, "kanji_raw.partial.json"), "w", encoding="utf-8"),
                          ensure_ascii=False)

    # pass kedua untuk yang gagal (cache-nya belum ada)
    if fails:
        retry = [g for g, _ in fails]
        print(f"\nPercobaan kedua untuk {len(retry)} kanji gagal ...", flush=True)
        fails2 = []
        with ThreadPoolExecutor(max_workers=2) as ex:
            futs = {ex.submit(work, g): g for g in retry}
            for f in as_completed(futs):
                g = futs[f]
                try:
                    gg, d = f.result()
                    details[gg] = d
                except Exception as e:
                    fails2.append((g, str(e)))
        fails = fails2
        print(f"sisa gagal: {len(fails)}", flush=True)

    print(f"\nGagal: {len(fails)}")
    for g, e in fails[:20]:
        print("  ", g, e[:120])

    payload = {"levels": levels, "details": details,
               "counts": {lv: len(levels[lv]) for lv in only}}
    with open(os.path.join(OUT, "kanji_raw.json"), "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=1)
    print("OK -> data/kanji_raw.json", {lv: len(levels[lv]) for lv in only},
          "detail:", len(details))


if __name__ == "__main__":
    main()
