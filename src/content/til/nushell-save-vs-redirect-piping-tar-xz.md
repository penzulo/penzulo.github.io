---
title: "`save` not `>`: piping tar into a tuned xz compression in nushell"
date: 2026-09-01
published: true
tags: [nushell, posix, shells, pipes, compression]
source:
---

# `save` not `>`: piping tar into a tuned xz compression in nushell

To compress a folder you first bundle it into a single file (`tar`), then
compress that file (`xz`) — which naively means juggling three artifacts: the
folder, the intermediate `.tar`, and the final `.tar.xz`. In a POSIX shell the
byte-stream pipe gets you from three files to one:

```sh
tar -cf - folder_name/ | xz -9 -T0 > folder_name.tar.xz
```

In nushell the same pipeline shape works — but the way you write the output out
is the gotcha.

## The nushell version

```nu
tar -cf - folder_name/ | xz -9 -T0 | save folder_name.tar.xz
```

Two things to unpack.

**External-to-external pipes stay raw bytes.** Nushell's docs are explicit here:
data piped between two external commands flows the same way it would in Bash, so
`tar`'s raw archive bytes reach `xz` untouched. The UTF-8 re-interpretation
that nushell applies between internal commands never kicks in.

**`save`, not `>`, is how you write pipeline output to a file.** In a POSIX
shell `>` opens (or truncates) the file and bytes stream straight in. Nushell's
`>` does not behave that way — the data-model-correct command is `save`:

```nu
tar -cf - folder_name/ | xz -9 -T0 | save folder_name.tar.xz
#                                    ^^^^ writes the stream to the file
```

For bytes, `save --raw folder_name.tar.xz` is the explicit form.

## Why pipe to `xz` at all, instead of `tar -J`?

`tar` can compress in one shot with its built-in filters:

```sh
tar -cJf folder_name.tar.xz folder_name/
```

but that invokes `xz` with a fixed configuration you can't tune. Piping to `xz`
directly hands over the flags:

- `-9` — maximum compression level (default is `-6`).
- `-T0` — use all available CPU cores in parallel.

That control is the real payoff of the pipe: same three-line shape, but the
compressor runs exactly how you want it to.

## Side by side

| Aspect | POSIX shell | Nushell |
|--------|-------------|---------|
| Pipe model | raw byte stream by default | structured data internally; raw bytes external-to-external |
| tar → xz pipe | `tar -cf - d/ \| xz -9 -T0` | `tar -cf - d/ \| xz -9 -T0` |
| Write output | `> file` | `save file` (or `save --raw`) |
| Tune compression | pass flags to `xz` | pass flags to `xz` |
| `tar -J` shortcut | fixed `xz`, no `-T0` tuning | same limitation |

## Gotchas

- **`>` silently does something different in nushell.** Reach for `save`
  (and `save --raw` for binary). This is the single most common "my POSIX pipe
  broke" moment when moving to nushell.
- **`xz -9 -T0` can eat your RAM.** One thread per core at max level spikes
  memory; on a constrained machine this can OOM and break the pipe. Use
  `-T <n>` below your core count or back off to `-6`.
- **The `-` in `tar -cf -` is what enables the stream** — it tells tar to write
  the archive to stdout instead of a file. Forget it and there's nothing to pipe.
- **`tar -J` is fine when tuning doesn't matter**; reach for the explicit pipe
  only when you actually want `-T0`/`-9`-style control.

## Related

- [nushell-splat-docker-stop](/til/nushell-splat-docker-stop/) — another nushell pipe trick
- [nushell-par-each-parallel-tests](/til/nushell-par-each-parallel-tests/) — parallelizing across cores with `par-each`
