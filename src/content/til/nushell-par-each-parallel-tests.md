---
title: Run self-contained test files in parallel with Nu's `par-each`
date: 2026-08-10
published: true
tags: [nushell, parallel, testing, uv]
source:
---

# Run self-contained test files in parallel with Nu's `par-each`

In my LeetCode grind each solution file is self-contained: the function, its
`unittest` cases, and an `if __name__ == "__main__"` block that runs the tests —
so `uv run solution.py` runs that file's suite. With a folder full of them, I ran
them one at a time in a loop:

```nu
for $file in (glob *.py) { uv run $file }
```

That works, but every iteration waits for the previous one. `par-each` is the
parallel variant of `each` — it runs the closure across threads and auto-detects
how many cores your machine has:

```nu
glob *.py | par-each { |file| uv run $file } | ignore
```

On five files the speedup was nearly 2×:

| Mode | Time |
|------|------|
| `for` loop | 565ms 209µs 861ns |
| `par-each` (all cores) | 299ms 616µs 317ns |

## Why it's faster

`for` is strictly sequential: process 1 finishes before process 2 starts, so the
total time is the sum of all the individual runs. `par-each` fans the closures
out over your CPU cores, so the five independent processes run at the same time
and the wall time collapses toward the slowest single run. The `| ignore` at the
end discards the returned results — each `uv run` still prints its test output
to stdout directly.

## Gotchas

- **Order is not preserved.** `par-each` hands work out in parallel, so output
  comes back in completion order, not file order. Keep `each` when sequence
  matters.
- **Only for independent work.** These files share nothing — no ports, no shared
  state — so parallel is safe. If the scripts contended for one resource, the
  speedup would turn into flakiness.
- **Cap the fan-out.** `par-each` defaults to one thread per core; use
  `par-each --threads N` to limit concurrency.
- **The win is process overlap, not parallelism of a single computation.** The
  speedup comes from overlapping interpreter startup and test runs across files.

## Related

- [nushell-splat-docker-stop](/til/nushell-splat-docker-stop/) — another nushell pipeline trick, batching instead of looping
