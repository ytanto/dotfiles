// How notifications look, as the shipped toast, except Herdr's own "<agent> needs you" and
// "<agent> finished" toasts: the inbox panel already shows who waits, so those close unseen.
// Their sounds are played separately and stay.

import { View, div, image } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { props, closeOverlay, run, theme, agents } from "herdr";

const DOT = { error: "blocked", warning: "working", success: "done", info: "accent" };

// Herdr's attention toast carries nothing but its wording to tell it apart: { title: "Claude Code
// needs you" | "Claude Code finished", body: "<space> / <tab>", action: agent.focus {terminal} }.
// Only an exact match on the agent's own program name and place counts, so other notify() calls
// (the inbox's questions, errors) still show even when they point at an agent.
function herdrAttention(p) {
  const terminal = p.action?.name === "agent.focus" ? p.action.args?.terminal : null;
  const m = /^(.+) (needs you|finished)$/.exec(p.title ?? "");
  if (!terminal || !m) return false;
  const a = agents().find((x) => x.address === terminal);
  // The agent can be gone by the time the toast shows; its wording alone has to do then.
  if (!a) return / \/ /.test(p.body ?? "");
  return m[1] === a.program?.name && p.body === `${a.space_name} / ${a.tab_name}`;
}

export default class Toast extends View {
  init() {
    const p = props() ?? {};
    this.hidden = herdrAttention(p);
    if (this.hidden) closeOverlay(p.overlay);
  }

  render(cx) {
    if (this.hidden) return div();
    const t = theme();
    const p = props() ?? {};
    const login = /^([a-z0-9][a-z0-9_.-]{0,31}) needs login; run hc machine login \1$/.exec(p.body ?? "");
    const command = login ? `hc machine login ${login[1]}` : null;
    return h_flex()
      .id("toast")
      .size_full()
      .px(18)
      .gap(12)
      .items_center()
      .bg(t.popover)
      .cursor_pointer()
      .hover((s) => s.bg(t.hover))
      .on_click(() => {
        if (p.action?.name) run(p.action.name, p.action.args ?? {});
        closeOverlay(p.overlay);
      })
      .child(p.icon ? image(p.icon).w(18).h(18).flex_none() : div().size(8).rounded(4).flex_none().bg(t[DOT[p.level] ?? "accent"]))
      .child(
        v_flex()
          .flex_1()
          .overflow_hidden()
          .child(div().truncate().font_semibold().text_size(13).text_color(t.foreground).child(login ? `${login[1]} needs a login: run` : p.title ?? ""))
          .when(!login && Boolean(p.body), (el) => el.child(div().truncate().text_size(12).text_color(t.muted).child(p.body ?? "")))
          .when(Boolean(login), (el) => el.child(h_flex().gap(8).items_center()
            .child(div().flex_1().min_w(0).truncate().tooltip(command).text_size(12).text_color(t.muted).child(command))
            .child(div().id("toast-login-copy").flex_none().px(6).py(3).rounded(4).bg(t.raised)
              .text_size(12).text_color(t.foreground).cursor_pointer().hover(s => s.bg(t.hover))
              .on_click((_e, cx) => { cx.stop_propagation(); cx.write_to_clipboard(command); this.copied = true; cx.notify(); })
              .child(this.copied ? "Copied" : "Copy")))),
      );
  }
}
