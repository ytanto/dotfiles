#!/usr/bin/env python3
"""Claude Code の会話の記録から、指示者の確認待ちで止まった場面を集計する。

使い方: python3 -I collect.py --out <出力先ディレクトリ> [--days 7]

記録の中身（ツールの結果の本文）は書き出さず、コマンド・質問・返事を短く切って出す。
記録には秘密が混じりうるため、出力は手元の scratchpad に置き、外へ貼らないこと。
"""
import argparse
import collections
import glob
import json
import os
import re
import subprocess
import time
from datetime import datetime, timedelta, timezone

PROJECTS = os.path.expanduser("~/.claude/projects")
HISTORY = os.path.expanduser("~/.claude/bottleneck-review")
PERSONAL_SETTINGS = os.path.expanduser("~/.claude/settings.json")

# 短い承認の返事。これだけを返したときは、聞かなくてよかった可能性が高い
APPROVAL = re.compile(
    r"^(ok|ｏｋ|おk|yes|y|はい|うん|いいよ|いいね|お願い|おねがい|よろしく|進めて|すすめて|go|やって|"
    r"それで|大丈夫|了解|りょ|どうぞ|オッケー|おっけー|いいです|続けて|つづけて|[0-9]|[a-d])",
    re.I,
)
ASKING = re.compile(r"(ですか|ますか|でしょうか|[?？])")
# どのリポジトリでも同じになる、確認ルールの対象になりがちな操作
GENERIC_RISKY = re.compile(
    r"(^|[;&|(]\s*|\s)(rm|git reset --hard|git clean|git checkout --|git restore|gh pr create|"
    r"gh pr close|gh issue create|yarn install|pnpm install|npm install|bundle install)(\s|$)"
)
MEMORY_HINT = re.compile(r"(承認|確認|OK を|OK をもら|聞か|いちいち)")


def parse_ts(s):
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


def clip(s, n):
    s = re.sub(r"\s+", " ", str(s or "")).strip()
    return s if len(s) <= n else s[: n - 1] + "…"


def text_of(content):
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return " ".join(b.get("text", "") for b in content if isinstance(b, dict) and b.get("type") == "text")
    return ""


def load_entries(path, since):
    with open(path, encoding="utf-8", errors="replace") as f:
        for line in f:
            try:
                d = json.loads(line)
            except ValueError:
                continue
            ts = d.get("timestamp")
            if ts and parse_ts(ts) < since:
                continue
            yield d


def ask_rules_for(cwd, cache):
    """セッションを起動した場所で効く、リポジトリ共有・個人の ask ルール。"""
    if cwd in cache:
        return cache[cwd]
    rules = []
    try:
        top = subprocess.run(
            ["git", "-C", cwd, "rev-parse", "--show-toplevel"], capture_output=True, text=True, timeout=5
        ).stdout.strip()
    except (OSError, subprocess.SubprocessError):
        top = ""
    for name in (".claude/settings.json", ".claude/settings.local.json"):
        p = os.path.join(top or cwd, name)
        try:
            for r in json.load(open(p)).get("permissions", {}).get("ask", []):
                rules.append((p, r))
        except (OSError, ValueError):
            pass
    cache[cwd] = rules
    return rules


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=float, default=7)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)
    since = datetime.now(timezone.utc) - timedelta(days=args.days)
    cutoff = time.time() - args.days * 86400

    files = [
        f
        for f in glob.glob(f"{PROJECTS}/*/*.jsonl") + glob.glob(f"{PROJECTS}/*/*/subagents/*.jsonl")
        if os.path.getmtime(f) >= cutoff
    ]

    prompts, rejects, asks, prose, risky = [], [], [], [], []
    human_turns = 0
    sessions = set()
    cwds = set()

    for f in files:
        project = f[len(PROJECTS) + 1 :].split("/")[0]
        is_sub = "/subagents/" in f
        uses = {}
        last_text = ""
        oks = []  # この会話で指示者が OK を返した時刻（二重の確認の判定に使う）
        for d in load_entries(f, since):
            t = d.get("type")
            if d.get("cwd"):
                cwds.add(d["cwd"])
            if t == "assistant":
                for b in d.get("message", {}).get("content", []) or []:
                    if not isinstance(b, dict):
                        continue
                    if b.get("type") == "tool_use":
                        uses[b["id"]] = (b["name"], b.get("input") or {}, d.get("timestamp"))
                    elif b.get("type") == "text" and b.get("text", "").strip():
                        last_text = b["text"]
                continue
            if t != "user":
                continue
            sessions.add(d.get("sessionId"))
            content = d.get("message", {}).get("content")

            # 指示者の発言（ツールの結果・メタ・他セッションからの便りを除く）
            if not is_sub and not d.get("isMeta") and not d.get("toolUseResult"):
                s = text_of(content).strip()
                if s and not s.startswith("<") and "cross-session-message" not in s:
                    human_turns += 1
                    if len(s) <= 25 and APPROVAL.match(s) and ASKING.search(last_text[-300:]):
                        prose.append(
                            dict(ts=d["timestamp"], project=project, reply=s, question=clip(last_text[-300:], 300))
                        )
                        oks.append(parse_ts(d["timestamp"]))

            pd = d.get("permissionDecision")
            if not pd or not isinstance(content, list):
                continue
            tid = next(
                (b.get("tool_use_id") for b in content if isinstance(b, dict) and b.get("type") == "tool_result"),
                None,
            )
            name, inp, use_ts = uses.get(tid, (None, {}, None))
            wait = None
            if use_ts:
                wait = (parse_ts(d["timestamp"]) - parse_ts(use_ts)).total_seconds()
            src, decision, code = pd.get("source"), pd.get("decision"), pd.get("reasonCode")
            target = inp.get("command") or inp.get("file_path") or inp.get("url") or inp.get("query") or ""

            if name == "AskUserQuestion":
                tr = d.get("toolUseResult") or {}
                answers = tr.get("answers", {}) if isinstance(tr, dict) else {}
                for q in inp.get("questions", []):
                    labels = [o.get("label", "") for o in q.get("options", [])]
                    a = answers.get(q.get("question"), "")
                    chosen = [l for l in labels if a == l or a.startswith(l)]
                    asks.append(
                        dict(
                            ts=d["timestamp"],
                            project=project,
                            wait=wait,
                            question=clip(q.get("question"), 300),
                            options=labels,
                            answer=clip(a, 200),
                            picked_recommended=any(re.search(r"Recommended|おすすめ|推奨", l) for l in chosen),
                            free_text=bool(a) and not chosen,
                        )
                    )
                if answers:
                    oks.append(parse_ts(d["timestamp"]))
                continue

            if name == "Bash" and GENERIC_RISKY.search(target):
                risky.append(dict(project=project, decision=decision, source=src, code=code, command=clip(target, 160)))

            # 承認の画面が実際に出たもの。理由コードが無い user_* は、すでにもらった許可の使い回し
            if src in ("user_temporary", "user_permanent", "user_reject", "user_abort") and code:
                now = parse_ts(d["timestamp"])
                double = any(0 < (now - o).total_seconds() < 600 for o in oks)
                prompts.append(
                    dict(
                        ts=d["timestamp"],
                        project=project,
                        subagent=is_sub,
                        tool=name,
                        source=src,
                        reason=code,
                        scope=pd.get("grantScope"),
                        wait=wait,
                        after_user_ok=double,
                        target=clip(target, 160),
                    )
                )
            elif decision == "reject" and src == "config":
                rejects.append(
                    dict(
                        project=project,
                        tool=name,
                        reason=code,
                        category=pd.get("classifierCategory"),
                        kind=d.get("toolDenialKind"),
                        target=clip(target, 160),
                    )
                )

    rule_cache = {}
    rules = collections.defaultdict(set)
    for c in cwds:
        for p, r in ask_rules_for(c, rule_cache):
            rules[p].add(r)
    try:
        for r in json.load(open(PERSONAL_SETTINGS)).get("permissions", {}).get("ask", []):
            rules[PERSONAL_SETTINGS].add(r)
    except (OSError, ValueError):
        pass

    memories = []
    for m in glob.glob(f"{PROJECTS}/*/memory/*.md"):
        if m.endswith("MEMORY.md"):
            continue
        head = open(m, encoding="utf-8", errors="replace").read(800)
        desc = re.search(r"^description:\s*(.*)$", head, re.M)
        if desc and MEMORY_HINT.search(desc.group(1)):
            memories.append(dict(path=m, description=clip(desc.group(1), 200)))

    def waits(xs):
        w = sorted(x["wait"] for x in xs if x.get("wait") is not None)
        return dict(count=len(xs), median_sec=round(w[len(w) // 2]) if w else None, max_sec=round(w[-1]) if w else None)

    metrics = dict(
        generated_at=datetime.now().isoformat(timespec="minutes"),
        days=args.days,
        sessions=len(sessions),
        human_turns=human_turns,
        harness_prompts=waits(prompts),
        harness_prompts_after_user_ok=sum(p["after_user_ok"] for p in prompts),
        harness_prompts_by_reason=collections.Counter(p["reason"] for p in prompts).most_common(),
        harness_prompts_rejected=sum(p["source"] in ("user_reject", "user_abort") for p in prompts),
        auto_mode_rejects=collections.Counter(r["kind"] or r["reason"] for r in rejects).most_common(),
        ask_questions=waits(asks),
        ask_picked_recommended=sum(a["picked_recommended"] for a in asks),
        ask_free_text=sum(a["free_text"] for a in asks),
        prose_short_approvals=len(prose),
        generic_risky_commands=collections.Counter(
            f"{r['decision']}/{r['source']}/{r['code'] or '-'}" for r in risky
        ).most_common(),
    )

    def dump(name, obj):
        with open(os.path.join(args.out, name), "w", encoding="utf-8") as f:
            json.dump(obj, f, ensure_ascii=False, indent=1, default=list)

    dump("metrics.json", metrics)
    dump("harness_prompts.json", prompts)
    dump("auto_mode_rejects.json", rejects)
    dump("ask_questions.json", asks)
    dump("prose_approvals.json", prose)
    dump("generic_risky_commands.json", risky)
    dump("ask_rules.json", {k: sorted(v) for k, v in rules.items()})
    dump("confirmation_memories.json", memories)

    # 前回と比べられるよう、数字だけを記録の外に残す（記録の本文は残さない）
    os.makedirs(HISTORY, exist_ok=True)
    prev = sorted(glob.glob(f"{HISTORY}/metrics-*.json"))
    dump_path = os.path.join(HISTORY, f"metrics-{datetime.now():%Y-%m-%d}.json")
    with open(dump_path, "w", encoding="utf-8") as f:
        json.dump(metrics, f, ensure_ascii=False, indent=1)
    prev = [p for p in prev if p != dump_path]

    print(json.dumps(metrics, ensure_ascii=False, indent=1))
    print("\nprevious:", prev[-1] if prev else "なし")
    print("out:", args.out)


if __name__ == "__main__":
    main()
