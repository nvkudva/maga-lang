# Code review — magalang

A static, dependency-free browser playground for "MagaLang", a toy imperative language with Kannada keywords, implemented as a token-stream walking interpreter that delegates all expression evaluation to JavaScript `eval`.

Read in full: `maga-interpreter.js`, `app.js`, `kannada-transliteration.js`, `index.html`, `README.md`, plus behavioural probes run under Node against the interpreter. Not read: `style.css` (396 lines) and `preview.png`.

## Architecture

Four files, no build step, no package manifest, loaded as plain globals from `index.html:152-154` with hand-maintained cache-busting query strings (`?v=7`, `?v=11`, `?v=21`).

- `kannada-transliteration.js` — an IIFE exposing the `KannadaTranslit` global. Holds `SYLLABLE_MAP` (a 248-line romanized-to-Kannada syllable table, lines 13-260), `transliterateWord`, `transliterateLine`, `restoreEnglishKeywords`, and `KANNADA_KEYWORDS` (line 361).
- `maga-interpreter.js` — the `MagaInterpreter` class. State lives in two instance fields, `this.variables` (a bare `{}`) and `this.output` (a string array), both reset at the top of `interpret()` (lines 76-77).
- `app.js` — a single `DOMContentLoaded` closure holding every piece of UI state (`isKannadaMode`, `suggestions`, `selectedIndex`, `suggestionBox`, `activeWord`, `lastFetchTimestamp`, lines 23-55) plus all DOM wiring, the i18n string table, the Google Input Tools client, and the editor caret logic.
- `index.html` — carries the four example programs as `data-code-en` / `data-code-kn` attributes (lines 55-143). The Kannada versions are hand-written, not generated, so they can drift from what the transliterator emits.

Data flow on Run: `app.js:351` reads `editor.innerText` → `interpret()` → `normalizeKannada()` rewrites Kannada keywords to their English forms by plain string substitution (`maga-interpreter.js:26-28`) → `tokenize()` produces a flat `string[]` → `executeStatement()` walks that array by integer index, mutating `pos` → each expression's tokens are joined with spaces and handed to `eval` in `evaluateExpression` (line 285).

There is no AST, no parser stage, and no evaluator of the language's own semantics. The pipeline is tokenizer → statement dispatcher → JavaScript `eval`. That is the single most consequential design decision in the repo, and everything below follows from it.

What the structure gets right: for a ~1,100-line toy, zero dependencies and three flat globals are a defensible choice — the whole thing opens in a browser with no toolchain. The tokenizer correctly handles Kannada codepoints in identifiers (`maga-interpreter.js:44`), and `normalizeKannada` and `restoreEnglishKeywords` both split on quoted runs so they do not rewrite keywords inside string literals. `interpret()` is genuinely re-entrant: state reset is at the top, so repeated Run clicks do not leak variables.

Where it will hurt:

- `executeStatement` (lines 108-261) is 154 lines handling print, assignment, if / else-if / else, and while in one function, with position arithmetic (`pos - 1`, `pos + 2`, `bodyEnd + 1`) threaded through by hand. The if/else branch alone duplicates its else-if detection scan twice (lines 156-173 for the condition-true path and lines 179-229 for the condition-false path), each with its own `checkPos`/`tempPos` loop. Adding a fifth statement form means touching this function again and re-deriving the offsets.
- Because `eval` supplies the semantics, the language has no type system, no operator set, and no error model of its own — it inherits JavaScript's, filtered through a tokenizer that silently drops any character it does not recognise. There is no place to add a Maga-level type error, a stack trace, or a line number, because line information is discarded at `tokenize()`.
- `evaluateExpression` substitutes variables by `JSON.stringify` into source text (line 274) rather than binding an environment. Any value that is not JSON-representable, and any variable name that collides with a JavaScript keyword or global, breaks in a way the interpreter cannot detect.
- Scoping does not exist: `this.variables` is one flat map. Blocks, functions, and recursion all require replacing this with an environment chain, which means rewriting `evaluateExpression` entirely.
- `app.js` has no seam between UI and language. The interpreter cannot be unit-tested from a test runner without the `eval`-into-globals trick used for this review, because neither file exports anything or guards for a CommonJS/ESM environment.

## Code quality

**Expression evaluation via `eval`.** `maga-interpreter.js:285`. Confirmed by probe: `helu maga eval(atob("cHduZWQ9dHJ1ZTsgMTIz"));` executes arbitrary JavaScript in the page and returns `123`. Any host object reachable from the global scope is reachable from MagaLang.

**The tokenizer silently discards characters.** `maga-interpreter.js:44`. The operator class is `[{}();+\-*/\<\>!|&%]` — it contains no `.`, `,`, `[`, `]`, `:`, or `?`. Confirmed: `helu maga 3.5 + 1;` prints the string `3 5 + 1`, because `3.5` tokenizes as `3`, `5` and the resulting `eval` throws, so the fallback at line 288 returns the raw source text as if it were a value. Floating-point literals are silently wrong, not rejected.

**The `catch` in `evaluateExpression` converts every error into a plausible-looking string.** `maga-interpreter.js:286-289`. Confirmed: an undefined variable (`helu maga zzz + 1;`) prints `zzz + 1`; a syntax error (`helu maga 1 +;`) prints `1 +`. A learner gets no signal that anything went wrong. This is the worst property for a language aimed at beginners.

**There is no comment syntax, and comments execute.** `README.md:21` documents `// Your code here` inside a program, but `tokenize` has no comment rule. Confirmed: `// a = 99;` on its own line assigns `99` to `a`, because `executeStatement` reaches the assignment branch at line 125 (`tokens[pos + 1] === "="`) and never knows it is inside a comment. The documented example is a live footgun.

**Unbounded token scan on a missing semicolon.** `maga-interpreter.js:115-118` and `129-132` loop `while (tokens[pos] !== ";")` with no bounds check. Past the end of the array this pushes `undefined` until the engine throws `Invalid array length`, which is surfaced to the user verbatim.

**No loop bound.** `maga-interpreter.js:249-254`. `repeat madu maga 1 == 1 { ... }` spins forever on the main thread; `app.js:354` runs `interpret` in a bare `setTimeout`, so the tab freezes with no way to cancel.

**Documented keyword mappings contradict the code.** `kannada-transliteration.js:351-359` claims verified outputs (`helu → ಹೆಲು`, `adre → ಅದ್ರೆ`, `madu → ಮದು`, `illandre → ಇಲ್ಲನ್ದ್ರೆ`). The actual `KANNADA_KEYWORDS` table at lines 363-370 uses different glyphs (`ಹೇಳು`, `ಆದ್ರೆ`, `ಮಾಡು`, `ಇಲ್ಲಾಂದ್ರೆ`). Confirmed: `transliterateWord("helu")` returns `ಹೆಲು`, and `normalizeKannada("ಹೆಲು")` leaves it unchanged — the interpreter does not recognise it.

**The consequence: the offline transliteration fallback produces unrunnable code.** `app.js:85-87` falls back to `KannadaTranslit.transliterateWord(text)` when the Google request fails. That function's output uses the syllable table, whose glyphs are not the ones `KANNADA_KEYWORDS` accepts. Users who lose network get suggestions that will not run.

**`SYLLABLE_MAP` is nearly dead code with real defects.** Lines 13-260 — 60% of the file — are reachable only through `transliterateWord`, whose only caller is that broken fallback. `transliterateLine` (line 324) ignores the table entirely and passes non-keyword words through verbatim. The table also has no concept of vowel signs versus independent vowels, and covers no aspirates or retroflexes. Confirmed outputs: `shri → ಶ್ರಇ`, `ca → ಚ್ಅ`, `kha → ಕ್ಹ`, `zebra → zಎಬ್ರ`.

**`innerHTML` with third-party response data.** `app.js:118` interpolates `s` — a string from `inputtools.google.com` — into markup. `renderSuggestions` is the only place remote data reaches the DOM, and it is the one place that does not use `textContent`.

**No debounce on the suggestion request.** `app.js:217-236` calls `fetchSuggestions` on every input event, so one HTTPS request per keystroke to a third party, carrying the identifier the user is typing. `lastFetchTimestamp` (line 78) discards stale responses but does not prevent the requests.

**Quote-splitting regexes do not pair quote characters.** `maga-interpreter.js:21` and `kannada-transliteration.js:386` both use `["'] ... ["']`, so `"it's fine"` is mis-segmented. The transliteration copy additionally uses `.*?`, which does not cross newlines, so a multi-line region is split differently there than in the interpreter.

**Prototype key reaches a bare object.** `maga-interpreter.js:133` writes `this.variables[varName]` with no key filtering, and `varName` may be `__proto__` (the identifier regex allows underscores). Scoped to one throwaway object, so low impact, but `Object.create(null)` costs nothing.

**Dependency and config hygiene.** No `package.json`, no lockfile, no linter, no test file, no CI, and no `LICENSE` — the README asks for contributions (`README.md:74-75`) with no licence terms stated. `.gitignore` is sensible. No secrets in the tree; the only external calls are the Google Fonts stylesheet (`index.html:9`) and the Input Tools endpoint (`app.js:74`), neither of which carries a key.

**Test coverage is zero.** For an interpreter with four statement forms and a Kannada/English round trip, a dozen assertions would have caught the float bug, the comment bug, and the keyword-table mismatch.

Genuinely good: `interpret()`'s state reset, the Kannada-aware identifier regex, the stale-response guard in `fetchSuggestions`, and the decision to keep string literals out of keyword substitution.

## Risks

- **Arbitrary JavaScript execution in the page origin.** `maga-interpreter.js:285`. Today the only input path is the user's own keyboard, so this is self-XSS on a static site. It becomes a real vulnerability the moment code arrives from somewhere else — a share link, a URL fragment, a saved-snippet feature, or an embed — and the interpreter offers no seam at which to add a sandbox later.
- **DOM injection from a third-party response.** `app.js:118`. Trust in `inputtools.google.com` is doing security work here; a compromised or proxied response injects markup into the page.
- **Denial of service on the user's own tab.** Unbounded `repeat` loops (`maga-interpreter.js:249`) and unbounded token scans (lines 115, 129) both run on the main thread with no iteration cap and no worker.
- **Silent wrong answers.** The `catch`-and-return-source behaviour at `maga-interpreter.js:288` means a beginner cannot distinguish a working program from a broken one. For a teaching tool this is the highest-cost defect in the repo.
- **No licence.** `README.md` solicits contributions with no terms; the repo is legally all-rights-reserved by default, which blocks reuse and forks.

## Action items

| Priority | Item | File | Why |
|---|---|---|---|
| P0 | Replace `eval` with a real expression evaluator over the token stream (precedence climbing is ~80 lines) | `maga-interpreter.js:285` | `eval(atob(...))` in MagaLang executes arbitrary JS in the page origin; confirmed by probe |
| P0 | Stop returning the raw source string when evaluation throws; raise a MagaLang error the user can read | `maga-interpreter.js:286-289` | Undefined variables and syntax errors currently print as if they were values |
| P0 | Add a comment rule (`//` to end of line) to the tokenizer, or remove comments from the README | `maga-interpreter.js:44`, `README.md:21` | `// a = 99;` currently executes the assignment; the documented example is a footgun |
| P0 | Add `.` to the number rule so float literals tokenize | `maga-interpreter.js:44` | `3.5 + 1` silently prints the string `3 5 + 1` |
| P1 | Cap `repeat` iterations and run `interpret` in a Web Worker or with a step budget | `maga-interpreter.js:249-254`, `app.js:354` | An infinite loop freezes the tab with no way to cancel |
| P1 | Bound the `while (tokens[pos] !== ";")` scans and throw "missing ';'" at end of input | `maga-interpreter.js:115`, `129` | A missing semicolon grows an array until the engine throws `Invalid array length` |
| P1 | Reconcile the keyword docblock with `KANNADA_KEYWORDS`, and make `transliterateWord` emit the same glyphs the interpreter accepts | `kannada-transliteration.js:351-371` | `transliterateWord("helu")` yields `ಹೆಲು`, which `normalizeKannada` does not recognise |
| P1 | Fix the offline fallback so it produces runnable code, or drop it and show an explicit "suggestions unavailable" state | `app.js:85-87` | The fallback currently hands the user code the interpreter will not accept |
| P1 | Build suggestion rows with `textContent` / `createElement` instead of `innerHTML` | `app.js:118` | Remote strings from a third-party endpoint reach the DOM as markup |
| P1 | Add a test file with assertions for each example program plus float, comment, undefined-variable and Kannada round-trip cases | new file, covering `maga-interpreter.js` | Zero tests today; every confirmed defect above is a one-line assertion |
| P1 | Add a `LICENSE` file and reference it from the README | `README.md:74-78` | The README solicits contributions with no stated terms |
| P2 | Extract the if/else and while handlers out of `executeStatement` and remove the duplicated else-if detection scans | `maga-interpreter.js:108-261` | 154 lines, hand-threaded offsets, and the same `checkPos`/`tempPos` scan written twice |
| P2 | Debounce `fetchSuggestions` (150-250ms) and gate it behind an explicit opt-in | `app.js:217-236`, `app.js:74` | One request per keystroke to a third party, carrying the user's identifiers |
| P2 | Delete `SYLLABLE_MAP` and `transliterateWord`, or fix vowel-sign handling and cover aspirates and retroflexes | `kannada-transliteration.js:13-289` | 248 lines reachable only from the broken fallback; produces `shri → ಶ್ರಇ`, `ca → ಚ್ಅ` |
| P2 | Make the quote-splitting regexes pair their quote characters and match across newlines | `maga-interpreter.js:21`, `kannada-transliteration.js:386` | `"it's fine"` is mis-segmented; the two files disagree on multi-line handling |
| P2 | Track line numbers in `tokenize` and report them in errors | `maga-interpreter.js:40-50` | Errors currently carry no position, so the playground cannot point at the failing line |
| P2 | Use `Object.create(null)` for `this.variables` | `maga-interpreter.js:8`, `133` | `__proto__ = 1;` is a writable identifier that reaches a bare object literal |
| P2 | Add a `package.json` with a test script and a linter, and generate the Kannada example code rather than hand-writing it | `index.html:55-143` | Hand-written `data-code-kn` attributes can drift from the keyword table with nothing to catch it |
