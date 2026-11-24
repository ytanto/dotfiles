#!/usr/bin/env python3
"""下書きの HTML が参照する画像を base64 で埋め込み、1 ファイルの HTML にする。

使い方: python3 inline_images.py <draft.html> <出力.html>

src は下書きのあるディレクトリからの相対パスで解決する。
見つからない画像が 1 つでもあれば、何も書き出さずに止まる（壊れた資料を渡さないため）。
"""
import base64
import mimetypes
import re
import sys
from pathlib import Path

MIME = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml"}


def main() -> None:
    if len(sys.argv) != 3:
        sys.exit("使い方: inline_images.py <draft.html> <出力.html>")
    draft = Path(sys.argv[1])
    out = Path(sys.argv[2]).expanduser()
    html = draft.read_text(encoding="utf-8")
    base = draft.parent
    missing = []
    count = 0

    def repl(m: re.Match) -> str:
        nonlocal count
        src = m.group(2)
        if src.startswith(("data:", "http:", "https:")):
            return m.group(0)
        path = (base / src).resolve()
        if not path.is_file():
            missing.append(src)
            return m.group(0)
        mime = MIME.get(path.suffix.lower()) or mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        count += 1
        return f'{m.group(1)}data:{mime};base64,{base64.b64encode(path.read_bytes()).decode()}{m.group(3)}'

    html = re.sub(r'(<img\b[^>]*?\bsrc=")([^"]+)(")', repl, html)
    if missing:
        sys.exit("画像が見つからない: " + ", ".join(missing))
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding="utf-8")
    size_mb = out.stat().st_size / 1024 / 1024
    print(f"{count} 枚を埋め込みました: {out}（{size_mb:.1f} MB）")
    if size_mb > 3:
        print("3 MB を超えています。画像を縮めるか枚数を減らしてください", file=sys.stderr)


if __name__ == "__main__":
    main()
