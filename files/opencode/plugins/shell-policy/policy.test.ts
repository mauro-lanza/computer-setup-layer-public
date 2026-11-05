import { expect, test } from "bun:test"
import { cases } from "./cases"
import { check } from "./policy"

for (const [command, expected] of cases) {
  test(`${expected.length ? "deny " : "allow"} ${JSON.stringify(command).slice(0, 80)}`, () => {
    const result = check(command)
    if (expected.length === 0) expect(result).toBeUndefined()
    else {
      expect(result).toBeDefined()
      for (const part of expected) expect(result).toContain(part)
    }
  })
}
