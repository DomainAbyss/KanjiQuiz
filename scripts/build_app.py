# -*- coding: utf-8 -*-
"""
Build index.html dari src/ + data/.
Urutan: 01-head.html  02-body.html  <embedded json>  <script> 03-engine.js 04-ui.js </script>  tail
"""
import json, os, sys, io

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(ROOT, "src")
DATA = os.path.join(ROOT, "data")
OUT = os.path.join(ROOT, "index.html")

PARTS = ["01-head.html", "02-body.html"]


def read(p):
    with io.open(p, encoding="utf-8") as f:
        return f.read()


def main():
    kanji = json.load(open(os.path.join(DATA, "kanji.json"), encoding="utf-8"))
    vocab = json.load(open(os.path.join(DATA, "vocab.json"), encoding="utf-8"))
    payload = {
        "meta": {"built": "KanjiQuiz", "src": "kanji.jepang.org"},
        "kanji": kanji["levels"],
        "vocab": vocab["levels"],
    }
    blob = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))

    buf = []
    for p in PARTS:
        buf.append(read(os.path.join(SRC, p)))
    buf.append('\n<script type="application/json" id="embedded-data">')
    buf.append(blob)
    buf.append('</script>\n<script>\n')
    for p in ["03-engine.js", "04-ui.js"]:
        buf.append(read(os.path.join(SRC, p)))
        buf.append("\n")
    buf.append("</script>\n</body>\n</html>\n")

    html = "".join(buf)
    with io.open(OUT, "w", encoding="utf-8", newline="\n") as f:
        f.write(html)

    print("index.html:", round(len(html.encode("utf-8")) / 1024), "KB",
          "| embed:", round(len(blob.encode("utf-8")) / 1024), "KB")
    print("kanji:", kanji["counts"], "\nvocab:", vocab["counts"])


if __name__ == "__main__":
    main()
