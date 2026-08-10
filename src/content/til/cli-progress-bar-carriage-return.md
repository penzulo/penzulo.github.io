---
title: CLI progress bars are just `\r` rewriting one line
date: 2026-08-08
published: true
tags: [cli, python, terminal, shell]
source:
---

# CLI progress bars are just `\r` rewriting one line

A progress bar doesn't draw a new line per tick — it rewrites the *same* line
over and over. The trick is the `\r` escape sequence: a carriage return that
resets the cursor to the start of the current line. Everything printed after it
overwrites that line in place.

```python
import time
import sys

for i in range(1, 101):
    # \r resets cursor, end="" prevents newline
    print(f"\rProgress: [{i}%]", end="", flush=True)
    time.sleep(0.05)
```

## Why each piece matters

| Piece | Job |
|-------|-----|
| `\r` | Carriage return — moves the cursor to column 0 of the current line |
| `f"\rProgress: [{i}%]"` | The new text replaces the old text on that line |
| `end=""` | Suppresses the default `\n`, so the cursor stays on the same line |
| `flush=True` | Forces stdout to write now; otherwise Python buffers it |
| `time.sleep(0.05)` | Slows it down so you can actually see it animate |

Without `\r`, each `print` would push a new line — a scrolling wall of text
instead of a bar. With `\n` instead of `\r`, the same thing happens. `\r` is the
entire trick: line feeds advance to the *next* line, carriage returns go back to
the *start of the current* one.

## The buffering gotcha

`print` writes to stdout, which is line-buffered when connected to a terminal
but block-buffered when piped to a file. Without `flush=True`, the partial line
(with no `\n` to trigger a flush) can sit in the buffer — the bar never animates
or appears at all until the program exits. That's also why `flush=True` is
mandatory here.

## Beyond plain text

The same idea scales up. Real tools like `tqdm` do exactly this under the hood:
`\r` back to column 0, overwrite with the new frame, sometimes clearing with
spaces or the ANSI escape `\x1b[2K`, then re-draw.

## Gotchas

- When output is piped (not a TTY), `\r` has no "line" to go back to — you either
  get literal control characters in the log or a huge one-line file. Progress
  bars should check for a terminal (e.g. `sys.stdout.isatty()`) and degrade to
  plain logging when piped.
- If the new text is *shorter* than the old, leftover characters remain at the
  end of the line. Overwrite with spaces or clear the line first.
- `\r` only returns to the start of the *current* line — combining it with the
  ANSI escape `\x1b[A` is how multi-line animated UIs are built.

## Related

- [python-parenthesized-with-context-managers](/til/python-parenthesized-with-context-managers/) — another small Python idiom
