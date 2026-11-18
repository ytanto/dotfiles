// Agents and what they wait on: the question they asked, the next steps they proposed, their plan
// and the PRs that came up.

import { View, div, image, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { agents, panes, spaces, run, theme, hc, exec, home, readTextFile, watchFolder, setBadge, notify, checking, nextCommand } from "herdr";
import {
  readPending, readTaskFiles, currentPlan, prLinks, parseDialog, samePage,
  projectDir, taskDir, TAIL_ARGS, PR_ROWS,
} from "./transcript.js";

const ORDER = { blocked: 0, done: 1, working: 2, idle: 3 };
const LABEL = { question: "質問", permission: "承認待ち", blocked: "入力待ち", done: "完了", working: "作業中", idle: "待機" };
const MAX_PRS = 5;

const tilde = (p) => (p && p.startsWith(home()) ? "~" + p.slice(home().length) : p ?? "");
// An unnamed tab goes by its position, which shifts when a tab before it closes; the terminal's own
// title (a session started with a name sets it) stays with the session. Without a name the title is
// just the program's, which tells sessions apart no better than the position.
function place(a) {
  const tab = spaces().find((s) => s.id === a.space)?.tabs.find((x) => x.id === a.tab);
  const title = a.title?.trim();
  const own = title && title !== a.program?.name;
  return `${a.space_name} / ${tab && !tab.named && own ? title : a.tab_name}`;
}

const prName = (url) => url.replace(/^https:\/\/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)$/, "$1 #$2");

function icon(p, size, color) {
  if (!p?.icon) return null;
  return p.tint ? svg(p.icon).size(size).flex_none().text_color(color) : image(p.icon).w(size).h(size).flex_none();
}

export default class Inbox extends View {
  init(_props, cx) {
    if (!checking()) cx.spawn(async (cx) => { for (;;) this.command(await nextCommand(), cx); });
    // address -> { status, label, focused, kind, msg, sessionId, path, dir, dialog, next, logTasks,
    //              liveTasks, prs, picks: Set (for the shown multi-select page), sending }
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
  // pick:<terminal> <option> (an option of the question shown now), answer:<terminal> (send the
  // multi-select picks, or submit on the review page), next:<terminal> <index>, choose:<terminal> <index>
  // (a choice listed in prose). Indexes from 0.
  command(c, cx) {
    const m = /^(pick|answer|next|choose):(\S+)(?: (\d+))?$/.exec(c ?? "");
    const entry = m && this.info.get(m[2]);
    if (!entry) {
      notify({ title: "受信箱: 使えない命令です", body: String(c), level: "error" });
      return;
    }
    const i = Number(m[3]);
    const page = entry.dialog;
    if (m[1] === "pick" && page?.kind === "question" && page.options[i]) this.pick(m[2], entry, i, cx);
    else if (m[1] === "answer" && page) this.answer(m[2], entry, cx);
    else if (m[1] === "next" && entry.next?.[i] && entry.status !== "blocked") this.send(m[2], entry, entry.next[i].prompt, cx);
    else if (m[1] === "choose" && entry.choices?.[i] && entry.status !== "blocked") this.send(m[2], entry, `${entry.choices[i].key} で進めて`, cx);
    else notify({ title: "受信箱: いまは実行できません", body: String(c), level: "error" });
  }

  // Runs on every render: agents() changes are the only signal of state transitions.
  sync(list, cx) {
    const listed = new Set(list.map((a) => a.address));
    for (const a of list) {
      const known = this.info.get(a.address);
      const entry = known ?? {};
      entry.label = place(a);
      entry.focused = a.focused;
      if (known?.status === a.status) continue;
      const announce = this.started && a.status === "blocked" && !a.focused;
      entry.status = a.status;
      this.info.set(a.address, entry);
      cx.spawn(async (cx) => {
        await this.locate(a.address, entry);
        await this.readDialog(cx, a.address, entry);
        if (announce) this.announce(a.address, entry);
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
        entry.next = p.next;
        entry.choices = p.choices;
        entry.logTasks = p.tasks;
      }
      // PRs can come up anywhere in a session, so this reads the whole transcript (perl is fast).
      const prs = await exec("/usr/bin/perl", ["-ne", PR_ROWS, entry.path]);
      entry.prs = prLinks(prs.stdout);
    } catch (e) {
      console.log(`inbox: parse ${entry.path}: ${e}`);
    }
  }

  // The question dialog as the screen shows it now. It may appear a moment after the status turns.
  async readDialog(cx, address, entry) {
    try {
      const asking = entry.status === "blocked" && entry.kind === "question";
      const page = asking ? await this.screenWhen(cx, address, parseDialog) : null;
      if (!samePage(page, entry.dialog)) entry.picks = new Set();
      entry.dialog = page;
    } catch (e) {
      console.log(`inbox: dialog ${address}: ${e}`);
    }
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

  // Herdr already announces every block; ours adds the question itself, so only questions get one.
  announce(address, entry) {
    if (entry.kind !== "question") return;
    const tabs = entry.dialog?.tabs?.length ?? 0;
    const body = entry.dialog?.question ?? (entry.msg ?? "").replace(/^answer:\s*/, "");
    notify({
      title: `質問: ${entry.label}`,
      body: tabs > 1 ? `${body} ほか ${tabs - 1} 問` : body,
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
        // The next watch is always registered before reading, so no write falls between two watches.
        // Writes before the first one (a new session's question lands right then) are covered by
        // reading everything under it once.
        w.handle = watchFolder(dir);
        let changed = [dir];
        while (!w.stopped) {
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
          try { changed = await w.handle; } catch { break; }
          if (w.stopped) break;
          w.handle = watchFolder(dir);
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

  // Claude Code's question dialog, one page at a time: a digit picks option N and moves on; on a
  // multi-select page digits toggle and Tab moves on; the review page submits with "1". A digit is also
  // an answer to a permission prompt, so before every key the screen must still show the page the
  // person picked from and the agent must still be waiting on a question. (hc keys has no conditional
  // form, so the gap of one call between that check and the key remains.)
  answer(address, entry, cx, choice = null) {
    const page = entry.dialog;
    if (entry.sending || !page) return;
    entry.sending = true;
    cx.spawn(async (cx) => {
      const fail = (why) => {
        notify({ title: "回答を送りませんでした", body: why, level: "error", action: { name: "agent.focus", args: { terminal: address } } });
      };
      const press = async (key, ready) => {
        if (!(await this.screenWhen(cx, address, (s) => ready(parseDialog(s))))) throw new Error("画面の質問がパネルの表示と一致しません");
        const got = JSON.parse((await hc(["get", address, "--json"])).stdout);
        if (got.status?.state !== "blocked" || got.status?.kind !== "question") throw new Error("質問の画面ではなくなっています");
        await hc(["keys", address, key]);
      };
      const onPage = (d) => samePage(d, page);
      try {
        if (page.kind === "review") {
          await press("1", onPage);
        } else if (!page.multiSelect) {
          await press(String(page.options[choice].n), onPage);
        } else {
          const picked = [...entry.picks].sort((x, y) => x - y);
          if (!picked.length) return fail("選んでいません");
          await press(String(page.options[picked[0]].n), (d) => onPage(d) && d.options.every((o) => !o.checked));
          for (const k of picked.slice(1)) await press(String(page.options[k].n), onPage);
          await press("tab", (d) => onPage(d) && d.options.every((o, k) => o.checked === entry.picks.has(k)));
        }
        // Show the next page (or nothing once it's answered) as soon as the screen moves on.
        entry.dialog = (await this.screenWhen(cx, address, (s) => {
          const d = parseDialog(s);
          return onPage(d) ? null : { d };
        }))?.d ?? null;
        entry.picks = new Set();
      } catch (e) {
        fail(e instanceof Error ? e.message : String(e));
        // The person may have moved the dialog on by hand; show what the screen has now.
        entry.dialog = parseDialog((await hc(["read", address, "--lines", "0"])).stdout);
        entry.picks = new Set();
      } finally {
        entry.sending = false;
        cx.notify();
      }
    });
  }

  pick(address, entry, i, cx) {
    if (!entry.dialog.multiSelect) return this.answer(address, entry, cx, i);
    if (entry.picks.has(i)) entry.picks.delete(i); else entry.picks.add(i);
    cx.notify();
  }

  // A proposal answered once is gone from the panel; the transcript's next human turn makes it stale too.
  send(address, entry, text, cx) {
    cx.spawn(async (cx) => {
      // hc send refuses a blocked agent, so a permission prompt can't swallow the text.
      const r = await hc(["send", address, text]);
      if (r.code !== 0) {
        notify({ title: "送れませんでした", body: r.stderr.trim(), level: "error" });
        return;
      }
      entry.next = null;
      entry.choices = null;
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

  // The page of the question dialog the screen shows. Free text ("Type something") and "Chat about
  // this" aren't offered: they're answered on screen.
  dialogView(address, entry, t) {
    const page = entry.dialog;
    const busy = entry.sending;
    const tabs = page.tabs.length > 1
      ? h_flex().gap(4).flex_wrap().children(page.tabs.map((tab) => div().px(5).rounded(4).bg(t.raised).text_size(11)
        .text_color(tab.done ? t.done : t.muted).child(`${tab.done ? "☒" : "☐"} ${tab.label}`)))
      : null;
    const box = v_flex().gap(6).p(8).rounded(6).bg(t.surface).border(1).border_color(t.border).when(Boolean(tabs), (el) => el.child(tabs));
    if (page.kind === "review") {
      return box
        .child(div().text_size(12.5).text_color(t.foreground).child("回答の確認"))
        .children(page.answers.map((x) => v_flex()
          .child(div().text_size(12).text_color(t.muted).child(x.question))
          .child(div().pl(8).text_size(12.5).text_color(t.foreground).child(`→ ${x.answer}`))))
        .child(h_flex().child(this.button(`answer-${address}`, busy ? "送信中…" : "回答を送る", t, (_e, cx) => this.answer(address, entry, cx), { primary: true, disabled: busy })));
    }
    return box
      .when(page.multiSelect, (el) => el.child(div().text_size(11).text_color(t.dim).child("複数選択")))
      .child(div().text_size(13).text_color(t.foreground).child(page.question))
      .children(page.options.map((o, i) => {
        const on = entry.picks?.has(i);
        const mark = page.multiSelect ? (on ? "☑" : "☐") : `${o.n}.`;
        // Sessions under this panel's rules start the recommended option's description with "おすすめ".
        const recommended = o.description.startsWith("おすすめ");
        const row = h_flex().id(`opt-${address}-${i}`).px(6).py(3).rounded(5).gap(6)
          .child(v_flex().flex_1().min_w(0)
            .child(div().text_size(12.5).text_color(recommended ? t.accent : t.foreground).child(`${mark} ${o.label}`))
            .when(Boolean(o.description), (el) => el.child(div().w_full().whitespace_normal().text_size(11.5).text_color(t.dim).child(o.description))))
          .when(Boolean(on), (el) => el.border(1).border_color(t.accent));
        return busy ? row : row.cursor_pointer().bg(t.raised).hover((s) => s.bg(t.hover)).on_click((_e, cx) => this.pick(address, entry, i, cx));
      }))
      .when(page.multiSelect, (el) => el.child(h_flex().gap(8).items_center()
        .child(this.button(`answer-${address}`, busy ? "送信中…" : "次へ", t, (_e, cx) => this.answer(address, entry, cx),
          { primary: true, disabled: busy || !entry.picks?.size }))));
  }

  // Choices the agent listed in prose ("A：…／B：…") rather than asking with AskUserQuestion.
  choicesView(address, entry, t) {
    return v_flex().gap(4).p(8).rounded(6).bg(t.surface).border(1).border_color(t.border)
      .child(div().text_size(11).text_color(t.dim).child("文章で聞かれている選択肢"))
      .children(entry.choices.map((c, i) => h_flex().id(`choice-${address}-${i}`).px(6).py(3).rounded(5).gap(6)
        .cursor_pointer().bg(t.raised).hover((s) => s.bg(t.hover))
        .on_click((_e, cx) => this.send(address, entry, `${c.key} で進めて`, cx))
        .child(div().flex_none().text_size(12.5).font_semibold().text_color(c.recommended ? t.accent : t.foreground).child(c.key))
        .child(div().flex_1().min_w(0).w_full().whitespace_normal().text_size(12).text_color(t.foreground).child(c.recommended ? `（おすすめ）${c.text}` : c.text))));
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
    const answerable = a.status === "done" || a.status === "idle";
    const showNext = answerable && entry.next?.length;
    const showChoices = answerable && entry.choices?.length;
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
        .child(div().flex_1().min_w(0).truncate().text_size(13).font_semibold().text_color(t.foreground).child(place(a)))
        .child(this.button(`go-${a.address}`, "移動", t, () => run("agent.focus", { terminal: a.address }))))
      .child(div().truncate().text_size(11.5).text_color(t.dim).child(tilde(pane?.cwd) || a.title))
      .when(Boolean(plan), (el) => el.child(this.planView(plan, t)))
      .when(a.status === "blocked" && entry.kind === "permission" && Boolean(entry.msg), (el) =>
        el.child(div().text_size(12).text_color(t.muted).child(`${entry.msg}（画面で承認してください）`)))
      .when(Boolean(entry.dialog) && a.status === "blocked", (el) => el.child(this.dialogView(a.address, entry, t)))
      .when(Boolean(showChoices), (el) => el.child(this.choicesView(a.address, entry, t)))
      .when(Boolean(showNext), (el) => el.child(v_flex().gap(4)
        .child(div().text_size(11).text_color(t.dim).child("次の一手"))
        .children(entry.next.map((n, i) => v_flex()
          .gap(2)
          // The earlier JSON form had no mark: its first item was the recommended one.
          .child(h_flex().gap(6).items_center()
            .child(this.button(`next-${a.address}-${i}`, `${i + 1}. ${n.label}`, t, (_e, cx) => this.send(a.address, entry, n.prompt, cx),
              { primary: entry.next.some((x) => x.recommended) ? n.recommended : i === 0 }))
            .when(Boolean(n.recommended), (el) => el.child(div().text_size(11).text_color(t.accent).child("おすすめ"))))
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
