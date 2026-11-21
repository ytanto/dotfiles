#!/usr/bin/env python3
"""Stop hook: 最後の返答が英語の文章なら、日本語で書き直させる。

language の設定と CLAUDE.md の決まりがあっても、英語のコマンドの出力を続けて読んだあとの
返答が英語になることがあるため、返答を終える時点で確かめる。
"""
import json
import re
import sys

MIN_ENGLISH_WORDS = 12
# かな・漢字が英単語の数のこの割合より少なければ英語の返答とみなす。
# 日本語の返答は、識別子やコマンド名が多くても、かな・漢字が英単語の数を大きく上回る。
JAPANESE_PER_WORD = 0.5

CODE_BLOCK = re.compile(r"```.*?(```|\Z)", re.S)
INLINE_CODE = re.compile(r"`[^`\n]*`")
URL = re.compile(r"https?://\S+")
PATH = re.compile(r"(?:~|\.{0,2})?/[\w.@~+-]+(?:/[\w.@~+-]+)*")
JAPANESE = re.compile(r"[぀-ヿ㐀-鿿]")
ENGLISH_WORD = re.compile(r"[A-Za-z]{2,}")


def is_english(text: str) -> bool:
    for pattern in (CODE_BLOCK, INLINE_CODE, URL, PATH):
        text = pattern.sub(" ", text)
    words = len(ENGLISH_WORD.findall(text))
    if words < MIN_ENGLISH_WORDS:
        return False
    return len(JAPANESE.findall(text)) < words * JAPANESE_PER_WORD


def last_reply(transcript_path: str) -> str:
    """最後のツールの結果より後に書いた文（指示者に見える最後の返答）をつなげて返す。"""
    texts: list[str] = []
    with open(transcript_path, encoding="utf-8", errors="ignore") as f:
        for line in f:
            try:
                entry = json.loads(line)
            except ValueError:
                continue
            if entry.get("isSidechain"):
                continue
            content = entry.get("message", {}).get("content")
            if entry.get("type") == "user":
                texts = []
            elif entry.get("type") == "assistant" and isinstance(content, list):
                for block in content:
                    if block.get("type") == "text":
                        texts.append(block.get("text", ""))
                    elif block.get("type") == "tool_use":
                        texts = []
    return "\n".join(texts)


def main() -> None:
    data = json.load(sys.stdin)
    if data.get("stop_hook_active"):
        return
    text = data.get("last_assistant_message")
    if not isinstance(text, str):
        path = data.get("transcript_path")
        if not path:
            return
        try:
            text = last_reply(path)
        except OSError:
            return
    if is_english(text):
        print(json.dumps({
            "decision": "block",
            "reason": "直前の返答が英語でした。同じ内容を日本語で書き直してください"
                      "（コード・コマンド・ログ・識別子・ファイル名は英語のままでよい）。"
                      "書き直しの前置きやお詫びは要りません。",
        }, ensure_ascii=False))


if __name__ == "__main__":
    main()
