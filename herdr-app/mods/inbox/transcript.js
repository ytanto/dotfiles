// Reads what a Claude Code session is waiting on from its JSONL transcript and screen.

// Transcripts grow to tens of MB; what's pending always sits at the end, so only the tail is read.
const TAIL_BYTES = 1500000;

export const TAIL_ARGS = (path) => ["-c", String(TAIL_BYTES), path];

export const PR_PATTERN = "https://github\\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/pull/[0-9]+";

// Claude Code names a project folder after its cwd with every non-alphanumeric character as "-".
export const projectDir = (home, cwd) => `${home}/.claude/projects/${cwd.replace(/[^A-Za-z0-9]/g, "-")}`;

// Claude Code keeps a session's live task list in ~/.claude/tasks/session-<first 8 of its id>.
export const taskDir = (home, sessionId) => `${home}/.claude/tasks/session-${sessionId.slice(0, 8)}`;

const NEXT_BLOCK = /```next[^\S\n]*\n([\s\S]*?)\n[^\S\n]*```/g;

// Tool results and injected context also arrive as "user" rows; only these are the person speaking.
function isHumanTurn(row) {
  if (row.type !== "user" || row.isMeta || row.isSidechain) return false;
  const c = row.message?.content;
  // Background tasks report back as user rows too.
  if (typeof c === "string") return !c.startsWith("<task-notification>");
  return Array.isArray(c) && c.length > 0 && !c.some((b) => b?.type === "tool_result");
}

function parseNext(text) {
  let last = null;
  for (const m of text.matchAll(NEXT_BLOCK)) last = m[1];
  if (last == null) return null;
  try {
    const items = JSON.parse(last);
    if (!Array.isArray(items)) return null;
    const ok = items.filter((i) => typeof i?.label === "string" && typeof i?.prompt === "string" && i.prompt.trim());
    return ok.length ? ok : null;
  } catch {
    return null;
  }
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

// { question: {id, questions} | null, next: [{label, prompt, reason}] | null, tasks: [...] }
export function readPending(tail) {
  const asks = new Map();
  const calls = new Map();
  const tasks = new Map();
  let texts = [];
  for (const line of tail.split("\n")) {
    if (!line.startsWith("{")) continue;
    let row;
    try { row = JSON.parse(line); } catch { continue; }
    if (row.isSidechain) continue;
    replayTasks(row, calls, tasks);
    if (isHumanTurn(row)) {
      // Whatever the assistant proposed before this is stale now.
      texts = [];
      continue;
    }
    const content = row.message?.content;
    if (!Array.isArray(content)) continue;
    for (const b of content) {
      if (row.type === "assistant" && b?.type === "text" && typeof b.text === "string") texts.push(b.text);
      if (row.type === "assistant" && b?.type === "tool_use" && b.name === "AskUserQuestion" && Array.isArray(b.input?.questions)) {
        asks.set(b.id, { id: b.id, questions: b.input.questions });
      }
      if (row.type === "user" && b?.type === "tool_result") asks.delete(b.tool_use_id);
    }
  }
  const pending = [...asks.values()];
  return {
    question: pending.length ? pending[pending.length - 1] : null,
    next: parseNext(texts.join("\n")),
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

// Unique PR URLs from grep -o output, newest mention first.
export function prLinks(grepOutput) {
  const seen = [];
  for (const url of grepOutput.split("\n").map((s) => s.trim()).filter(Boolean).reverse()) {
    if (!seen.includes(url)) seen.push(url);
  }
  return seen;
}

// Claude Code's question dialog numbers its options "1. label" ("1. [✔] label" when several can be
// picked), the cursor's line prefixed with "❯". Only lines below the question count: numbered lists in
// the conversation above would otherwise match. Null when the question isn't on screen.
export function screenOptions(screen, question) {
  const lines = screen.split("\n");
  const q = question.trim();
  // A long question wraps, so its first screen line is a prefix of it.
  const at = lines.findLastIndex((l) => {
    const s = l.trim();
    return s.length >= Math.min(q.length, 8) && q.startsWith(s);
  });
  if (at < 0) return null;
  const found = new Map();
  for (const line of lines.slice(at + 1)) {
    const m = /^\s*(?:❯\s*)?(\d+)\.\s+(?:\[(.)\]\s*)?(.*?)\s*$/.exec(line);
    if (m && !found.has(Number(m[1]))) found.set(Number(m[1]), { label: m[3], checked: m[2] != null && m[2] !== " " });
  }
  return found;
}

// The dialog's last page, shown after every question has an answer.
export function onReview(screen) {
  return /Review your answers/.test(screen) && /^\s*(?:❯\s*)?1\.\s+Submit answers\s*$/m.test(screen);
}
