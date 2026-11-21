// Reads what a Claude Code session waits on: its transcript for plans and proposals, its screen for questions.

// Transcripts grow to tens of MB; what's pending always sits at the end, so only the tail is read.
const TAIL_BYTES = 1500000;

export const TAIL_ARGS = (path) => ["-c", String(TAIL_BYTES), path];

const PR_PATTERN = "https://github\\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/pull/[0-9]+";

// A perl filter for the rows prLinks can use. Tool results and copies of API requests can be megabytes
// each and mostly don't count, so they're dropped before the app has to parse them; only the results of
// gh pr create calls are kept, found by the call's id. Quotes inside text are escaped in JSON, so these
// bare keys match only the row's own fields.
export const PR_ROWS = [
  `if (/"role":"assistant"/ && /gh pr create/ && /"type":"tool_use","id":"([^"]+)"/) { $made{$1} = 1; print; next }`,
  `if (/"tool_use_id":"([^"]+)"/ && $made{$1}) { print; next }`,
  `print if m{${PR_PATTERN}} && /"role":"(?:user|assistant)"/ && !/"type":"(?:tool_result|api-request-blob)"/`,
].join("\n");

// Claude Code names a project folder after its cwd with every non-alphanumeric character as "-".
export const projectDir = (home, cwd) => `${home}/.claude/projects/${cwd.replace(/[^A-Za-z0-9]/g, "-")}`;

// Claude Code keeps a session's live task list in ~/.claude/tasks/session-<first 8 of its id>.
export const taskDir = (home, sessionId) => `${home}/.claude/tasks/session-${sessionId.slice(0, 8)}`;

const NEXT_BLOCK = /```next[^\S\n]*\n([\s\S]*?)\n[^\S\n]*```/g;

// A user row that starts a new turn: the person speaking, another session's message, a background task's
// report. Tool results and context injected mid-turn are user rows too but continue the turn. Claude Code
// marks turn starts with turnOrigin; rows from versions before it are told apart by isMeta.
function startsTurn(row) {
  if (row.type !== "user" || row.isSidechain) return false;
  const c = row.message?.content;
  if (Array.isArray(c) && c.some((b) => b?.type === "tool_result")) return false;
  if (row.turnOrigin) return true;
  if (row.isMeta) return false;
  return typeof c === "string" || (Array.isArray(c) && c.length > 0);
}

const RECOMMENDED = /\s*[（(]おすすめ[）)]\s*/;

// The readable form: "1. ボタンの文字（おすすめ）: 送る文" and an indented "理由: …" under it.
function parseNumberedNext(body) {
  const items = [];
  for (const line of body.split("\n")) {
    const head = /^\s*\d+[.．]\s*(.+)$/.exec(line);
    const why = /^\s+理由\s*[:：]\s*(.+)$/.exec(line);
    if (head) {
      const at = head[1].search(/:\s|：/);
      if (at < 0) continue;
      const label = head[1].slice(0, at);
      const prompt = head[1].slice(at + 1).trim();
      if (!prompt) continue;
      items.push({ label: label.replace(RECOMMENDED, "").trim(), prompt, reason: null, recommended: RECOMMENDED.test(label) });
    } else if (why && items.length) {
      items[items.length - 1].reason = why[1].trim();
    }
  }
  return items;
}

// Sessions started under the earlier rules still write a JSON array, so both forms are read.
function parseNext(text) {
  let last = null;
  for (const m of text.matchAll(NEXT_BLOCK)) last = m[1];
  if (last == null) return null;
  let items;
  try {
    const json = JSON.parse(last);
    items = Array.isArray(json) ? json.map((i) => ({ ...i, recommended: false })) : [];
  } catch {
    items = parseNumberedNext(last);
  }
  const ok = items.filter((i) => typeof i?.label === "string" && typeof i?.prompt === "string" && i.prompt.trim());
  return ok.length ? ok : null;
}

// A choice written as prose: "A：…", "- **A（おすすめ）：** …", "1. …", "B) …".
const CHOICE = /^\s*(?:[-*・]\s+)?(?:\*\*)?([A-Z]|[1-9])(?:\s*[（(]([^）)]*)[）)])?\s*(?:\*\*)?\s*[：:.)）]\s*(?:\*\*)?\s*(.+?)\s*$/;
const ASKS = /[？?]\s*(?:\*\*)?\s*$/;

// Choices the agent listed in prose instead of asking with AskUserQuestion: [{key, text, recommended}]
// or null. Ordinary numbered lists (steps, findings) are far more common, so this only accepts the last
// list of the reply, lettered or numbered from A or 1 without gaps, at the very end of the reply, with
// a question right before or after it.
export function parseChoices(text) {
  const lines = text.replace(/```[\s\S]*?```/g, "").split("\n");
  let start = -1;
  let end = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (CHOICE.test(lines[i])) {
      end = i;
      start = i;
      // Extend upward through the block, skipping indented continuation lines.
      for (let j = i - 1; j >= 0; j--) {
        if (CHOICE.test(lines[j])) start = j;
        else if (!/^\s{2,}\S/.test(lines[j])) break;
      }
      break;
    }
  }
  if (start < 0) return null;
  const choices = lines.slice(start, end + 1).map((l) => CHOICE.exec(l)).filter(Boolean)
    .map((m) => ({ key: m[1], text: m[3].replace(/\*\*/g, ""), recommended: /おすすめ|推奨|recommended/i.test(m[2] ?? "") }));
  const keys = choices.map((c) => c.key);
  const first = /[A-Z]/.test(keys[0]) ? "A" : "1";
  const sequential = keys.every((k, i) => k === String.fromCharCode(first.charCodeAt(0) + i));
  if (choices.length < 2 || !sequential) return null;
  const after = lines.slice(end + 1).filter((l) => l.trim() && !/^\s{2,}\S/.test(l));
  if (after.length > 2) return null;
  const before = lines.slice(0, start).filter((l) => l.trim()).slice(-3);
  const asks = [...before, ...after].filter((l) => ASKS.test(l));
  if (!asks.length) return null;
  // A numbered list before "進めてよいですか？" is a plan to approve, not alternatives to pick from.
  const picking = first === "A" || choices.some((c) => c.recommended) || asks.some((l) => /どれ|どちら|どの|どう|選/.test(l));
  return picking ? choices : null;
}

// Whether something written at `at` (ms) has waited more than one business day by `now`. Weekends
// don't count, so Friday evening's stays fresh until Monday evening. Holidays count as working days:
// leaving them out would need a calendar kept up to date.
export function pastBusinessDay(at, now) {
  const due = new Date(at);
  do due.setDate(due.getDate() + 1); while (due.getDay() === 0 || due.getDay() === 6);
  return now > due.getTime();
}

// Japanese questions are often closed with "。": "残しておきましょうか。".
const QUESTION = /(?:[？?]|(?:ます|です|ましょう|でしょう)か。)$/;

// A question asked in prose at the very end of the reply, outside code blocks, or null.
export function parseAsked(text) {
  const line = text.replace(/```[\s\S]*?```/g, "").split("\n").map((l) => l.trim()).filter(Boolean).pop();
  if (!line) return null;
  const plain = line.replace(/\*\*/g, "").replace(/^(?:[-*・>]\s+)+/, "").trim();
  const sentence = plain.split(/(?<=[。！？!?])/).map((s) => s.trim()).filter(Boolean).pop() ?? "";
  return QUESTION.test(sentence) ? sentence : null;
}

const taskOf = (t) => ({
  id: String(t.id),
  subject: t.subject ?? "",
  activeForm: t.activeForm ?? null,
  status: t.status ?? "pending",
  goal: t.metadata?.goal ?? null,
});

// The task list as the transcript last left it. Only calls that succeeded count: an update is
// applied when its result says so, a create once its result hands back the new id.
function replayTasks(row, calls, tasks) {
  const content = row.message?.content;
  if (!Array.isArray(content)) return;
  for (const b of content) {
    if (row.type === "assistant" && b?.type === "tool_use" && (b.name === "TaskCreate" || b.name === "TaskUpdate")) {
      calls.set(b.id, { name: b.name, input: b.input ?? {} });
    }
    if (row.type !== "user" || b?.type !== "tool_result" || !calls.has(b.tool_use_id)) continue;
    const call = calls.get(b.tool_use_id);
    calls.delete(b.tool_use_id);
    const result = row.toolUseResult;
    if (call.name === "TaskCreate" && result?.task?.id != null) {
      tasks.set(String(result.task.id), taskOf({ ...call.input, id: result.task.id }));
    }
    if (call.name === "TaskUpdate" && result?.success) {
      const id = String(call.input.taskId);
      const known = tasks.get(id);
      if (!known) continue;
      if (call.input.status === "deleted") { tasks.delete(id); continue; }
      tasks.set(id, taskOf({ ...known, ...call.input, metadata: { goal: call.input.metadata?.goal ?? known.goal }, id }));
    }
  }
}

// { next: [{label, prompt, reason, recommended}] | null, nextAt: number | null,
//   choices: [{key, text, recommended}] | null, asked: string | null, tasks: [...] }.
// All three come from the last reply only: a new turn makes earlier ones stale. A pending question
// isn't here: Claude Code writes a tool call to the transcript only once it has a result, so questions
// come from the screen.
export function readPending(tail) {
  const calls = new Map();
  const tasks = new Map();
  let texts = [];
  let nextAt = null;
  for (const line of tail.split("\n")) {
    if (!line.startsWith("{")) continue;
    let row;
    try { row = JSON.parse(line); } catch { continue; }
    if (row.isSidechain) continue;
    replayTasks(row, calls, tasks);
    if (startsTurn(row)) {
      texts = [];
      nextAt = null;
      continue;
    }
    const content = row.message?.content;
    if (row.type !== "assistant" || !Array.isArray(content)) continue;
    for (const b of content) {
      if (b?.type !== "text" || typeof b.text !== "string") continue;
      texts.push(b.text);
      if (b.text.includes("```next")) nextAt = Date.parse(row.timestamp) || null;
    }
  }
  const next = parseNext(texts.join("\n"));
  // Only the reply's last text: earlier ones in the turn are progress notes.
  const last = texts.length ? texts[texts.length - 1] : "";
  const choices = last ? parseChoices(last) : null;
  return {
    next,
    // When the reply with the proposals was written (ms), for telling an abandoned one from a fresh one.
    nextAt: next ? nextAt : null,
    choices,
    // A proposal or a list of choices already says what is asked.
    asked: next || choices || !last ? null : parseAsked(last),
    tasks: [...tasks.values()].sort((x, y) => Number(x.id) - Number(y.id)),
  };
}

// The task files Claude Code writes while a list is active, joined by \x1e.
export function readTaskFiles(joined) {
  return joined
    .split("\x1e")
    .map((s) => { try { return taskOf(JSON.parse(s)); } catch { return null; } })
    .filter((t) => t && t.status !== "deleted")
    .sort((x, y) => Number(x.id) - Number(y.id));
}

// The steps toward the newest goal: re-registering with a new goal replaces what's shown.
export function currentPlan(tasks) {
  if (!tasks?.length) return null;
  const goal = tasks[tasks.length - 1].goal;
  const steps = tasks.filter((t) => t.goal === goal);
  return { goal, steps, done: steps.filter((t) => t.status === "completed").length };
}

// User rows that start with these come from the app or another session, not from the person.
const NOT_SPOKEN = /^\s*<(?:hc|task-notification|system-reminder|local-command-(?:caveat|stdout|stderr)|bash-(?:stdout|stderr))[\s>]/;

// What Claude wrote and what the person said. A PR that only showed up in a tool's output (another
// session's screen, a gh listing, a skill's example) isn't one this session took up.
function spokenTexts(row) {
  if (row.isMeta || row.isSidechain || row.isCompactSummary) return [];
  const c = row.message?.content;
  const texts = (blocks) => blocks.filter((b) => b?.type === "text" && typeof b.text === "string").map((b) => b.text);
  if (row.type === "assistant") return Array.isArray(c) ? texts(c) : [];
  if (row.type !== "user") return [];
  if (typeof c === "string") return NOT_SPOKEN.test(c) ? [] : [c];
  if (!Array.isArray(c) || c.some((b) => b?.type === "tool_result")) return [];
  return texts(c).filter((s) => !NOT_SPOKEN.test(s));
}

const urlsIn = (s) => s.match(new RegExp(PR_PATTERN, "g")) ?? [];
const resultText = (c) => (typeof c === "string" ? c : Array.isArray(c) ? c.map((b) => b?.text ?? "").join("\n") : "");

// Unique PR URLs from transcript rows: the ones the session made first, then the ones that came up in
// the conversation, each newest first. A session that talks about many PRs would bury its own otherwise.
// Made means named by the result of its own gh pr create; PRs its sub-agents made can't be told apart
// from ones they merely mention, so they count as mentioned.
export function prLinks(rows) {
  const creating = new Set();
  const made = [];
  const spoken = [];
  for (const line of rows.split("\n")) {
    if (!line.startsWith("{")) continue;
    let row;
    try { row = JSON.parse(line); } catch { continue; }
    const c = row.message?.content;
    if (Array.isArray(c) && !row.isSidechain) {
      for (const b of c) {
        if (row.type === "assistant" && b?.type === "tool_use" && b.name === "Bash" && /\bgh pr create\b/.test(b.input?.command ?? "")) creating.add(b.id);
        if (row.type === "user" && b?.type === "tool_result" && creating.has(b.tool_use_id)) made.push(...urlsIn(resultText(b.content)));
      }
    }
    for (const s of spokenTexts(row)) spoken.push(...urlsIn(s));
  }
  return [...new Set([...made.reverse(), ...spoken.reverse()])];
}

// Claude Code's question dialog, read from the bottom of the screen. Text further up is conversation,
// which can quote a question or a numbered list and must never be read as the dialog.
const DIALOG_LINES = 40;
const OPTION = /^\s*(?:❯\s*)?(\d+)\.\s+(?:\[(.)\]\s*)?(.*?)\s*$/;
const RULE = /^\s*─{8,}\s*$/;
// The tab strip: "☐ 果物" alone, or "←  ☒ 飲み物  ☐ 麺  ✔ Submit  →" with several questions.
const TAB = /([☐☒])\s+(.+?)(?=\s{2,}|\s*[☐☒✔→]|\s*$)/g;

// { kind: "question", tabs, question, multiSelect, options: [{n, label, description, checked}] }
// | { kind: "review", tabs, answers: [{question, answer}] } | null when no dialog is up.
// Options stop before "Type something": free text and "Chat about this" are answered on screen.
export function parseDialog(screen) {
  const lines = screen.split("\n");
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  const area = lines.slice(-DIALOG_LINES);
  const foot = area.findLastIndex((l) => /Enter to select/.test(l));
  const strip = area.findLastIndex((l, i) => (foot < 0 || i < foot) && /^\s*(←\s+)?[☐☒]\s+\S/.test(l));
  if (strip < 0) return null;
  const tabs = [...area[strip].matchAll(TAB)].map((m) => ({ label: m[2].trim(), done: m[1] === "☒" }));
  const body = area.slice(strip + 1, foot < 0 ? undefined : foot);

  const review = body.findIndex((l) => l.trim() === "Review your answers");
  if (review >= 0) {
    const answers = [];
    for (const l of body.slice(review + 1)) {
      const q = /^\s*●\s+(.*)$/.exec(l);
      const a = /^\s*→\s+(.*)$/.exec(l);
      if (q) answers.push({ question: q[1].trim(), answer: "" });
      else if (a && answers.length) answers[answers.length - 1].answer = a[1].trim();
    }
    const opts = body.slice(review + 1).map((l) => OPTION.exec(l)).filter(Boolean);
    const ok = opts.length >= 2 && opts[0][1] === "1" && opts[0][3] === "Submit answers" && opts[1][1] === "2" && opts[1][3] === "Cancel";
    return ok ? { kind: "review", tabs, answers } : null;
  }

  const first = body.findIndex((l) => OPTION.test(l));
  if (first < 0) return null;
  const question = body.slice(0, first).map((l) => l.trim()).filter((l) => l && !RULE.test(l)).join("");
  const options = [];
  for (const l of body.slice(first)) {
    const m = OPTION.exec(l);
    if (m) {
      if (/^Type something\.?$/.test(m[3])) break;
      if (Number(m[1]) !== options.length + 1) return null;
      options.push({ n: Number(m[1]), label: m[3], description: "", checked: m[2] != null && m[2] !== " ", marked: m[2] != null });
    } else if (l.trim() && !RULE.test(l) && options.length) {
      const o = options[options.length - 1];
      o.description = (o.description + l.trim()).trim();
    }
  }
  if (!question || !options.length) return null;
  return { kind: "question", tabs, question, multiSelect: options.some((o) => o.marked), options };
}

// Same page of the dialog: the keys meant for one page must never land on another.
export function samePage(a, b) {
  if (!a || !b) return !a && !b;
  if (a.kind !== b.kind) return false;
  if (a.kind === "review") return true;
  return a.question === b.question && a.options.length === b.options.length && a.options.every((o, i) => o.label === b.options[i].label);
}
