import { Plugin } from "@opencode/plugin"
import { check } from "./policy"

export default Plugin.define({
  id: "shell-policy",
  async setup(ctx) {
    await ctx.tool.hook("execute.before", (event) => {
      if (event.tool !== "shell") return
      const command = (event.input as { command?: unknown }).command
      const denial = typeof command === "string" ? check(command) : undefined
      if (denial) throw new Error(denial)
    })
  },
})
