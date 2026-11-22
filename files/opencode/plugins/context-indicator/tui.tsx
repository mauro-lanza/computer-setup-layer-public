/** @jsxImportSource @opentui/solid */
import { Plugin } from "@opencode/plugin/tui"
import { createMemo, Show } from "solid-js"
import { contextState, contextTokens, parseThresholds, type State } from "./indicator"

// Wider than any sidebar; the height-1 box clips it to the sidebar width.
const LINE = "─".repeat(200)

export default Plugin.define({
  id: "context-indicator",
  setup(context) {
    const thresholds = parseThresholds(context.options)
    const theme = context.theme
    const color = (state: State) =>
      state === "alert" ? theme.text.feedback.error.base : state === "warn" ? theme.text.feedback.warning.base : theme.text.muted

    context.ui.slot({
      prepend: "sidebar.content",
      render: (props) => {
        const state = createMemo<State>(() => {
          // Session data is OpenCode's internal API: if an update changes it, show the neutral line, never break the sidebar.
          try {
            const revert = context.data.session.get(props.sessionID)?.revert?.messageID
            return contextState(contextTokens(context.data.session.message.list(props.sessionID), revert), thresholds)
          } catch {
            return "normal"
          }
        })
        return (
          <box>
            <box height={1} overflow="hidden">
              <text fg={color(state())} wrapMode="none">
                {LINE}
              </text>
            </box>
            <Show when={state() !== "normal"}>
              <text fg={color(state())} onMouseUp={() => context.keymap.dispatch("session.compact")}>
                [Compact]
              </text>
            </Show>
          </box>
        )
      },
    })
  },
})
