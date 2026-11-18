// Agents and what they wait on: the question they asked, the next steps they proposed, their plan
// and the PRs that came up.

import { View, div, image, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { agents, panes, run, theme, hc, exec, home, readTextFile, watchFolder, setBadge, notify, checking, nextCommand } from "herdr";
import {
  readPending, readTaskFiles, currentPlan, prLinks, screenOptions, onReview,
  projectDir, taskDir, TAIL_ARGS, PR_PATTERN,
} from "./transcript.js";

const ORDER = { blocked: 0, done: 1, working: 2, idle: 3 };
const LABEL = { question: "質問", permission: "承認待ち", blocked: "入力待ち", done: "完了", working: "作業中", idle: "待機" };
const MAX_PRS = 5;

const tilde = (p) => (p && p.startsWith(home()) ? "~" + p.slice(home().length) : p ?? "");
const prName = (url) => url.replace(/^https:\/\/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)$/, "$1 #$2");

function icon(p, size, color) {
  if (!p?.icon) return null;
  return p.tint ? svg(p.icon).size(size).flex_none().text_color(color) : image(p.icon).w(size).h(size).flex_none();
}

export default class Inbox extends View {
  init(_props, cx) {
    if (!checking()) cx.spawn(async (cx) => { for (;;) this.command(await nextCommand(), cx); });
    // address -> { status, label, focused, kind, msg, sessionId, path, dir, question, next, logTasks,
    //              liveTasks, prs, announce, picks: { id, sel: Set[] }, sending }
    this.info = new Map();
    // folder -> { handle, stopped }
    this.watches = new Map();
    this.badge = undefined;
    this.started = false;
  }

  async close() {
    for (const w of this.watches.values()) { w.stopped = true; w.handle?.cancel(); }
    setBadge(null);
  }

  // The panel's buttons as commands, for keys.json and scripts (`herdr-app do "inbox.next:t7 0"`):
  // pick:<terminal> <question> <option>, answer:<terminal>, next:<terminal> <index>. Indexes from 0.
  command(c, cx) {
    const m = /^(pick|answer|next):(\S+)((?: \d+)*)$/.exec(c ?? "");
    const entry = m && this.info.get(m[2]);
    if (!entry) {
      notify({ title: "受信箱: 使えない命令です", body: String(c), level: "error" });
      return;
    }
    const [i, j] = m[3].trim().split(" ").map(Number);
    if (m[1] === "pick" && entry.question?.questions?.[i]?.options?.[j]) this.pick(m[2], entry, i, j, cx);
    else if (m[1] === "answer" && entry.picks) this.answer(m[2], entry, cx);
    else if (m[1] === "next" && entry.next?.[i] && entry.status !== "blocked") this.sendNext(m[2], entry, entry.next[i], cx);
    else notify({ title: "受信箱: いまは実行できません", body: String(c), level: "error" });
  }

  // Runs on every render: agents() changes are the only signal of state transitions.
  sync(list, cx) {
    const listed = new Set(list.map((a) => a.address));
    for (const a of list) {
      const known = this.info.get(a.address);
      const entry = known ?? {};
      entry.label = `${a.space_name} / ${a.tab_name}`;
      entry.focused = a.focused;
      if (known?.status === a.status) continue;
      // Herdr already announces every block; ours adds the question itself, so it waits for one.
      entry.announce = this.started && a.status === "blocked" && !a.focused;
      entry.status = a.status;
      this.info.set(a.address, entry);
      cx.spawn(async (cx) => {
        await this.locate(a.address, entry);
        await this.parse(a.address, entry);
        await this.readTasks(entry);
        this.watchFolders(cx);
        cx.notify();
      });
    }
    for (const k of [...this.info.keys()]) if (!listed.has(k)) this.info.delete(k);
    this.started = true;

    const blocked = list.filter((a) => a.status === "blocked").length;
    if (blocked !== this.badge) {
      this.badge = blocked;
      setBadge(blocked ? String(blocked) : null);
    }
    this.watchFolders(cx);
  }

  // Terminal -> Claude Code process -> session id: Claude Code records each process's session in
  // ~/.claude/sessions/<pid>.json, so a pane maps to its transcript without guessing by folder or time.
  async locate(address, entry) {
    try {
      const got = JSON.parse((await hc(["get", address, "--json"])).stdout);
      entry.kind = got.status?.kind ?? null;
      entry.msg = got.status?.msg ?? null;
      if (got.status?.app !== "claude-code") return;
      const pid = got.foreground?.pid;
      const raw = pid ? await readTextFile(`${home()}/.claude/sessions/${pid}.json`) : null;
      if (!raw) return;
      const s = JSON.parse(raw);
      if (s.sessionId === entry.sessionId && entry.path) return;
      entry.sessionId = s.sessionId;
      let path = `${projectDir(home(), s.cwd)}/${s.sessionId}.jsonl`;
      if ((await exec("test", ["-f", path])).code !== 0) {
        // Very long cwds get a shortened folder name; find the session by id instead.
        const r = await exec("sh", ["-c", 'ls "$HOME"/.claude/projects/*/"$1".jsonl 2>/dev/null | head -1', "sh", s.sessionId]);
        path = r.stdout.trim() || null;
      }
      entry.path = path;
      entry.dir = path ? path.slice(0, path.lastIndexOf("/")) : null;
    } catch (e) {
      console.log(`inbox: locate ${address}: ${e}`);
    }
  }

  async parse(address, entry) {
    if (!entry.path) return;
    try {
      const tail = await exec("tail", TAIL_ARGS(entry.path));
      if (tail.code === 0) {
        const p = readPending(tail.stdout);
        entry.question = p.question;
        entry.next = p.next;
        entry.logTasks = p.tasks;
        if (entry.picks?.id !== p.question?.id) entry.picks = null;
      }
      // PRs can come up anywhere in a session, so this reads the whole transcript (grep is fast).
      const prs = await exec("/usr/bin/grep", ["-o", "-E", PR_PATTERN, entry.path]);
      entry.prs = prLinks(prs.stdout);
    } catch (e) {
      console.log(`inbox: parse ${entry.path}: ${e}`);
    }
    this.maybeAnnounce(address, entry);
  }

  async readTasks(entry) {
    if (!entry.sessionId) return;
    try {
      const r = await exec("sh", ["-c", 'for f in "$1"/*.json; do [ -f "$f" ] && cat "$f" && printf "\\036"; done; exit 0', "sh", taskDir(home(), entry.sessionId)]);
      entry.liveTasks = readTaskFiles(r.stdout);
    } catch (e) {
      console.log(`inbox: tasks ${entry.sessionId}: ${e}`);
    }
  }

  maybeAnnounce(address, entry) {
    if (!entry.announce || entry.status !== "blocked") return;
    if (entry.kind !== "question") { entry.announce = false; return; }
    const q = entry.question?.questions?.[0];
    if (!q) return;
    entry.announce = false;
    const more = entry.question.questions.length > 1 ? ` ほか ${entry.question.questions.length - 1} 問` : "";
    notify({
      title: `質問: ${entry.label}`,
      body: `${q.question}${more}`,
      level: "warning",
      action: { name: "agent.focus", args: { terminal: address } },
    });
  }

  // Transcript folders and the task folder are watched; nothing is polled.
  watchFolders(cx) {
    if (checking()) return;
    const entries = () => [...this.info.entries()];
    const needed = new Map();
    for (const [, e] of entries()) {
      if (e.dir) needed.set(e.dir, "log");
      if (e.sessionId) needed.set(`${home()}/.claude/tasks`, "tasks");
    }
    for (const [dir, w] of this.watches) {
      if (needed.has(dir)) continue;
      w.stopped = true;
      w.handle?.cancel();
      this.watches.delete(dir);
    }
    for (const [dir, what] of needed) {
      if (this.watches.has(dir)) continue;
      const w = { handle: null, stopped: false };
      this.watches.set(dir, w);
      cx.spawn(async (cx) => {
        while (!w.stopped) {
          w.handle = watchFolder(dir);
          let changed;
          try { changed = await w.handle; } catch { break; }
          if (w.stopped) break;
          const all = changed.includes(dir);
          let hit = 0;
          for (const [address, e] of entries()) {
            if (what === "log") {
              // A working session writes constantly; its plan comes from the task folder instead.
              if (e.status === "working" || e.dir !== dir || !(all || changed.includes(e.path))) continue;
              await this.parse(address, e);
            } else {
              const mine = e.sessionId && taskDir(home(), e.sessionId);
              if (!mine || !(all || changed.some((p) => p.startsWith(mine)))) continue;
              await this.readTasks(e);
            }
            hit++;
          }
          if (hit) cx.notify();
        }
      });
    }
  }

  // Reads the screen until it shows what `ready` wants, so keys go only to the dialog they're meant for.
  async screenWhen(cx, address, ready) {
    for (let i = 0; i < 15; i++) {
      const screen = (await hc(["read", address, "--lines", "0"])).stdout;
      const got = ready(screen);
      if (got) return got;
      await cx.sleep(200);
    }
    return null;
  }

  // Claude Code's question dialog: a digit picks option N (and moves on); with several to pick, digits
  // toggle and Tab moves on. With more than one question or a multi-select one, a review page follows
  // and "1" submits. Every key goes only after the screen shows the expected question and options.
  answer(address, entry, cx) {
    if (entry.sending) return;
    entry.sending = true;
    cx.spawn(async (cx) => {
      const fail = (why) => {
        notify({ title: "回答を送りませんでした", body: why, level: "error", action: { name: "agent.focus", args: { terminal: address } } });
      };
      try {
        const got = JSON.parse((await hc(["get", address, "--json"])).stdout);
        if (got.status?.state !== "blocked" || got.status?.kind !== "question") return fail("質問の画面ではなくなっています");
        const qs = entry.question.questions;
        const sel = entry.picks.sel;
        for (const [i, q] of qs.entries()) {
          const shown = await this.screenWhen(cx, address, (s) => {
            const o = screenOptions(s, q.question);
            return o && q.options.every((opt, k) => o.get(k + 1)?.label === opt.label) ? o : null;
          });
          if (!shown) return fail(`画面の「${q.question}」の選択肢が会話記録と一致しません`);
          const picked = [...sel[i]].sort((x, y) => x - y);
          if (!q.multiSelect) {
            await hc(["keys", address, String(picked[0] + 1)]);
            continue;
          }
          if (q.options.some((_o, k) => shown.get(k + 1).checked)) return fail(`「${q.question}」にすでに印が付いています`);
          for (const k of picked) await hc(["keys", address, String(k + 1)]);
          const marked = await this.screenWhen(cx, address, (s) => {
            const o = screenOptions(s, q.question);
            return o && q.options.every((_o, k) => o.get(k + 1)?.checked === sel[i].has(k));
          });
          if (!marked) return fail(`「${q.question}」の印が思ったとおりに付きませんでした`);
          await hc(["keys", address, "tab"]);
        }
        const single = qs.length === 1 && !qs[0].multiSelect;
        if (!single) {
          if (!(await this.screenWhen(cx, address, onReview))) return fail("確認の画面が出ませんでした");
          await hc(["keys", address, "1"]);
        }
      } catch (e) {
        return fail(String(e));
      } finally {
        entry.sending = false;
        cx.notify();
      }
    });
  }

  pick(address, entry, qi, oi, cx) {
    const qs = entry.question.questions;
    if (entry.picks?.id !== entry.question.id) entry.picks = { id: entry.question.id, sel: qs.map(() => new Set()) };
    const set = entry.picks.sel[qi];
    if (qs[qi].multiSelect) {
      if (set.has(oi)) set.delete(oi); else set.add(oi);
    } else {
      set.clear();
      set.add(oi);
    }
    // One question with one answer needs no confirming: the pick is the answer.
    if (qs.length === 1 && !qs[0].multiSelect) this.answer(address, entry, cx);
    cx.notify();
  }

  sendNext(address, entry, item, cx) {
    cx.spawn(async (cx) => {
      // hc send refuses a blocked agent, so a permission prompt can't swallow the text.
      const r = await hc(["send", address, item.prompt]);
      if (r.code !== 0) {
        notify({ title: "送れませんでした", body: r.stderr.trim(), level: "error" });
        return;
      }
      entry.next = null;
      cx.notify();
    });
  }

  button(id, label, t, onClick, { primary = false, disabled = false } = {}) {
    return div()
      .id(id)
      .px(8)
      .py(4)
      .rounded(6)
      .text_size(12)
      .bg(primary && !disabled ? t.solid : t.raised)
      .text_color(disabled ? t.dim : primary ? t.solid_foreground : t.foreground)
      .when(!disabled, (el) => el.cursor_pointer().hover((s) => s.bg(primary ? t.accent : t.hover)).on_click(onClick))
      .child(label);
  }

  questionView(address, entry, t) {
    const qs = entry.question.questions;
    // Free text ("Type something") isn't offered: it's answered on screen.
    const answerable = entry.status === "blocked" && entry.kind === "question";
    const single = qs.length === 1 && !qs[0].multiSelect;
    const sel = entry.picks?.id === entry.question.id ? entry.picks.sel : qs.map(() => new Set());
    const ready = sel.every((s) => s.size > 0);
    return v_flex()
      .gap(8)
      .p(8)
      .rounded(6)
      .bg(t.surface)
      .border(1)
      .border_color(t.border)
      .children(qs.map((q, qi) => v_flex()
        .gap(4)
        .child(h_flex().gap(6).items_center()
          .when(Boolean(q.header), (el) => el.child(div().px(5).rounded(4).bg(t.raised).text_size(11).text_color(t.muted).child(q.header)))
          .when(Boolean(q.multiSelect), (el) => el.child(div().text_size(11).text_color(t.dim).child("複数選択"))))
        .child(div().text_size(13).text_color(t.foreground).child(q.question))
        .children((q.options ?? []).map((o, oi) => {
          const on = sel[qi]?.has(oi);
          const mark = single ? `${oi + 1}.` : q.multiSelect ? (on ? "☑" : "☐") : (on ? "◉" : "○");
          const body = v_flex().flex_1()
            .child(div().text_size(12.5).text_color(t.foreground).child(`${mark} ${o.label}`))
            .when(Boolean(o.description), (el) => el.child(div().text_size(11.5).text_color(t.dim).child(o.description)));
          const row = h_flex().id(`opt-${address}-${qi}-${oi}`).px(6).py(3).rounded(5).gap(6).child(body)
            .when(on && !single, (el) => el.border(1).border_color(t.accent));
          return answerable && !entry.sending
            ? row.cursor_pointer().bg(t.raised).hover((s) => s.bg(t.hover)).on_click((_e, cx) => this.pick(address, entry, qi, oi, cx))
            : row;
        }))))
      .when(answerable && !single, (el) => el.child(h_flex().gap(8).items_center()
        .child(this.button(`answer-${address}`, entry.sending ? "送信中…" : "回答を送る", t, (_e, cx) => this.answer(address, entry, cx),
          { primary: true, disabled: !ready || entry.sending }))
        .when(!ready, (el) => el.child(div().text_size(11).text_color(t.dim).child("すべての質問で選んでください")))))
      .when(!answerable, (el) => el.child(div().text_size(11).text_color(t.dim).child("この質問は画面で答えてください")));
  }

  planView(plan, t) {
    return v_flex()
      .gap(3)
      .child(h_flex().gap(6).items_center()
        .child(div().flex_1().min_w(0).text_size(12.5).font_semibold().text_color(t.foreground).child(plan.goal ?? "段取り"))
        .child(div().flex_none().text_size(11).text_color(t.muted).child(`${plan.done}/${plan.steps.length}`)))
      .child(h_flex().h(3).rounded(2).bg(t.raised)
        .child(div().h_full().rounded(2).bg(t.done).w(`${Math.round((plan.done / plan.steps.length) * 100)}%`)))
      .children(plan.steps.map((s) => {
        const now = s.status === "in_progress";
        const mark = s.status === "completed" ? "✓" : now ? "●" : "○";
        return h_flex().gap(6)
          .child(div().w(12).flex_none().text_size(11.5).text_color(now ? t.working : s.status === "completed" ? t.done : t.dim).child(mark))
          .child(div().flex_1().text_size(11.5).text_color(now ? t.foreground : t.muted).child(now && s.activeForm ? s.activeForm : s.subject));
      }));
  }

  prView(address, prs, t) {
    return h_flex().gap(4).flex_wrap().items_center()
      .child(div().text_size(11).text_color(t.dim).child("PR"))
      .children(prs.slice(0, MAX_PRS).map((url, i) => div()
        .id(`pr-${address}-${i}`)
        .px(6).py(2).rounded(4).bg(t.raised).text_size(11.5).text_color(t.accent)
        .cursor_pointer().hover((s) => s.bg(t.hover))
        .tooltip(url)
        .on_click(() => { exec("open", [url]); })
        .child(prName(url))))
      .when(prs.length > MAX_PRS, (el) => el.child(div().text_size(11).text_color(t.dim).child(`ほか ${prs.length - MAX_PRS}`)));
  }

  row(a, t) {
    const entry = this.info.get(a.address) ?? {};
    const pane = panes().find((p) => p.terminal === a.address);
    const kindLabel = a.status === "blocked" ? LABEL[entry.kind] ?? LABEL.blocked : LABEL[a.status];
    const showNext = a.status !== "blocked" && a.status !== "working" && entry.next?.length;
    // The task folder empties once every step is done; the transcript still has the finished plan.
    const plan = currentPlan(entry.liveTasks?.length ? entry.liveTasks : entry.logTasks);
    return v_flex()
      .id(`row-${a.address}`)
      .gap(6)
      .p(10)
      .rounded(8)
      .bg(a.focused ? t.selected : t.chrome)
      .border(1)
      .border_color(a.status === "blocked" ? t.blocked : t.border)
      .child(h_flex().gap(6).items_center()
        .child(div().size(8).rounded(4).flex_none().bg(t[a.status] ?? t.unknown))
        .child(div().text_size(11.5).text_color(t[a.status] ?? t.muted).flex_none().child(kindLabel))
        .child(icon(a.program, 13, t.muted))
        .child(div().flex_1().min_w(0).truncate().text_size(13).font_semibold().text_color(t.foreground).child(`${a.space_name} / ${a.tab_name}`))
        .child(this.button(`go-${a.address}`, "移動", t, () => run("agent.focus", { terminal: a.address }))))
      .child(div().truncate().text_size(11.5).text_color(t.dim).child(tilde(pane?.cwd) || a.title))
      .when(Boolean(plan), (el) => el.child(this.planView(plan, t)))
      .when(a.status === "blocked" && entry.kind === "permission" && Boolean(entry.msg), (el) =>
        el.child(div().text_size(12).text_color(t.muted).child(`${entry.msg}（画面で承認してください）`)))
      .when(Boolean(entry.question), (el) => el.child(this.questionView(a.address, entry, t)))
      .when(Boolean(showNext), (el) => el.child(v_flex().gap(4)
        .child(div().text_size(11).text_color(t.dim).child("次の一手"))
        .children(entry.next.map((n, i) => v_flex()
          .gap(2)
          .child(h_flex().child(this.button(`next-${a.address}-${i}`, n.label, t, (_e, cx) => this.sendNext(a.address, entry, n, cx), { primary: i === 0 })))
          .when(Boolean(n.reason), (el) => el.child(div().pl(2).text_size(11).text_color(t.dim).child(n.reason)))))))
      .when(Boolean(entry.prs?.length), (el) => el.child(this.prView(a.address, entry.prs, t)));
  }

  render(cx) {
    const t = theme();
    const list = agents()
      .filter((a) => a.status in ORDER)
      .sort((x, y) => ORDER[x.status] - ORDER[y.status] || y.seq - x.seq);
    this.sync(list, cx);
    const count = (s) => list.filter((a) => a.status === s).length;
    return v_flex()
      .id("root")
      .size_full()
      .bg(t.chrome)
      .text_color(t.foreground)
      .child(h_flex().px(12).h(40).flex_none().gap(8).items_center().border_b(1).border_color(t.border)
        .child(div().text_size(13).font_semibold().child("受信箱"))
        .child(div().text_size(11.5).text_color(t.muted).child(`入力待ち ${count("blocked")} · 完了 ${count("done")} · 作業中 ${count("working")}`)))
      .child(v_flex().id("list").flex_1().min_h(0).overflow_y_scrollbar().p(8).gap(8)
        .when(list.length === 0, (el) => el.child(div().p(12).text_size(12.5).text_color(t.dim).child("エージェントはいません")))
        .children(list.map((a) => this.row(a, t))));
  }
}
