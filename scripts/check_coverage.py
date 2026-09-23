# -*- coding: utf-8 -*-
"""Cek coverage kosakata elzup vs hasil scrape kanji.jepang.org"""
import json, csv, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
raw = json.load(open(os.path.join(ROOT, "data", "kanji_raw.json"), encoding="utf-8"))

# lookup kata -> arti id/en dari detail kanji
wordmap = {}
for g, d in raw["details"].items():
    for w in d.get("words", []):
        k = w["w"]
        if k not in wordmap or (not wordmap[k].get("id") and w.get("id")):
            wordmap[k] = {"r": w.get("r", ""), "id": w.get("id", ""), "en": w.get("en", "")}
print("kata unik dari detail kanji:", len(wordmap))

tot = 0
have_id = have_en = 0
per = {}
for lv in ["n5", "n4", "n3", "n2", "n1"]:
    p = os.path.join(ROOT, "cache", f"v_{lv}.csv")
    if not os.path.exists(p):
        print("skip", lv)
        continue
    rows = list(csv.DictReader(open(p, encoding="utf-8")))
    n = hi = he = 0
    for r in rows:
        expr = (r.get("expression") or "").strip()
        if not expr:
            continue
        n += 1
        m = wordmap.get(expr)
        if m and m.get("id"):
            hi += 1
        if m and m.get("en"):
            he += 1
    per[lv] = (n, hi, he)
    tot += n; have_id += hi; have_en += he
    print(f"{lv}: {n} kata | arti-ID cocok: {hi} ({hi*100//max(n,1)}%) | arti-EN cocok: {he}")
print(f"TOTAL {tot} | id {have_id} ({have_id*100//tot}%) | en {have_en} ({have_en*100//tot}%)")

# contoh yang tidak ketemu
miss = []
for lv in ["n5", "n4"]:
    p = os.path.join(ROOT, "cache", f"v_{lv}.csv")
    if not os.path.exists(p):
        continue
    for r in csv.DictReader(open(p, encoding="utf-8")):
        e = (r.get("expression") or "").strip()
        if e and e not in wordmap:
            miss.append((lv, e, r.get("reading"), r.get("meaning")))
print("\ncontoh tidak ketemu (20):")
for m in miss[:20]:
    print("  ", m)
