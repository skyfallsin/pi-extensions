import assert from "node:assert/strict"
import { test } from "node:test"
import extension from "./index.ts"

type AutocompleteItem = { value: string; label: string }
type AutocompleteProvider = {
  getSuggestions(
    lines: string[],
    cursorLine: number,
    cursorCol: number,
    options: { signal: AbortSignal },
  ): Promise<{ items: AutocompleteItem[]; prefix: string } | null>
}

test("merged slash autocomplete keeps the slash prefix for built-in commands", async () => {
  const handlers = new Map<string, (...args: unknown[]) => unknown>()
  let provider: AutocompleteProvider | undefined

  const pi = {
    getCommands: () => [
      {
        name: "skill:review",
        source: "skill",
        sourceInfo: {
          path: "/tmp/SKILL.md",
          source: "local",
          scope: "project",
        },
      },
      {
        name: "quit",
        source: "builtin",
        sourceInfo: { path: "", source: "", scope: "project" },
      },
    ],
    registerMessageRenderer() {},
    registerCommand() {},
    on(event: string, handler: (...args: unknown[]) => unknown) {
      handlers.set(event, handler)
    },
    appendEntry() {},
  }

  extension(pi as never)

  const sessionStart = handlers.get("session_start")
  assert.ok(sessionStart)
  await sessionStart(
    {},
    {
      sessionManager: { getBranch: () => [] },
      ui: {
        addAutocompleteProvider: (factory: (current: unknown) => unknown) => {
          provider = factory({
            getSuggestions: async () => ({
              prefix: "/q",
              items: [{ value: "/quit", label: "quit" }],
            }),
            applyCompletion: (
              lines: string[],
              cursorLine: number,
              cursorCol: number,
            ) => ({
              lines,
              cursorLine,
              cursorCol,
            }),
          }) as AutocompleteProvider
        },
      },
    },
  )

  assert.ok(provider)
  const suggestions = await provider.getSuggestions(["/q"], 0, 2, {
    signal: new AbortController().signal,
  })

  assert.equal(suggestions?.prefix, "/q")
  assert.ok(suggestions?.prefix.startsWith("/"))
  assert.ok(suggestions?.items.some((item) => item.value === "/quit"))
})
