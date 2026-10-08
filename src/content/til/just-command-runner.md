---
title: "`just` — the command runner for projects without a package.json"
date: 2026-10-08
published: true
tags: [cli, tooling, build]
source: https://just.systems/
---

# `just` — the command runner for projects without a package.json

TypeScript projects get `package.json` — a place to write `npm run lint` once
and reuse it forever. Most other ecosystems get nothing: the formatting, lint,
seed, migrate, rollback, and cleanup commands you run are whatever you can dig
out of shell history, and editing them means re-editing history again. `just` is
a command runner written in Rust that fixes this with a `justfile` — a
Makefile-inspired file of named recipes you invoke like normal commands.

```make
set shell := ["bash", "-uc"]

cc    := "g++"
flags := "-std=c++23 -Wall -Wextra -O2"
db    := "portfolio"

# build <target>: compile src/<target>.cpp into bin/
build name:
    {{cc}} {{flags}} -o bin/{{name}} src/{{name}}.cpp

# compile, then run it
run name: build name
    ./bin/{{name}}

# formatting and linting, batched
fmt:
    clang-format -i src/*.cpp

lint:
    clang-tidy src/*.cpp

check: fmt lint

# database chores, parameterized
migrate direction='up':
    psql -d {{db}} -f migrations/{{direction}}.sql

seed:
    python3 scripts/seed.py

clean:
    rm -rf bin/
```

The compile command that used to be a multi-line string you'd search history for
and hand-edit every time is one word now: `just build main`.

## Reading the pieces

| Piece | Job |
|-------|-----|
| `build name:` | a recipe named `build` that takes one parameter |
| `{{name}}` | interpolates the parameter into the command |
| `run name: build name` | `run` depends on `build` — dependencies run first |
| `migrate direction='up':` | a parameter with a default, so `just migrate down` still works |
| `# comment` above a recipe | becomes its description in `just --list` |
| `set shell := [...]` | the shell every recipe line is evaluated in |
| `cc := "g++"` | a variable; reuse the command once at the top |

## Why this beats history-diving

- `just --list` prints every recipe alongside its comment — the file documents
  itself, and `just` static-checks recipes (unknown names, circular
  dependencies) before anything runs.
- Parameters make a recipe *one* command with many forms: `just build main`,
  `just build name=main`, `just migrate rollback`.
- Dependencies encode order without `&&` chains: `check: fmt lint` or
  `run name: build name` say it structurally, and a failing step stops the run.
- Every recipe line runs in a real shell, so `src/*.cpp` globs, `&&` chains, and
  pipelines behave exactly as they would typed by hand.

## Choosing a shell

The default shell is `sh -cu`, and you don't have to keep it. `set shell :=
["bash", "-uc"]` swaps in bash if you want its globbing and control flow (note
the `-c` argument — `just` hands each line to the shell via `-c`). The
`[unix]` and `[windows]` attributes let one `justfile` pick per-OS shells and
commands, which is how the same file works on Linux, macOS, and Windows:

```make
[windows]
set shell := ["powershell.exe", "-NoLogo", "-Command"]

[unix]
set shell := ["bash", "-uc"]
```

## Gotchas

- **Not Make.** Recipe lines use spaces, not tabs — no `missing separator`
  error. It *looks* like a Makefile but has none of Make's pitfalls, and it's
  not locked to `make` semantics.
- **Recipes stop on failure.** Each line's exit status is checked; a failing
  line aborts the recipe. Prefix a line with `-` to let it fail and continue,
  or `@` to stop echo-ing it to stderr. If a dependency fails, the depending
  recipe never runs.
- **`sh -cu` needs a POSIX shell.** Running `just` with a `nushell`-only PATH
  breaks recipe execution — that's a real failure mode if you've switched
  shells. Either install `sh` or set an explicit `set shell`.
- **Interpolation is not the environment.** `{{cc}}` splices text into the
  command; if a subprocess needs an env var, `export MY_VAR := value` in the
  justfile rather than relying on `{{...}}`.
- **Defaults.** Running `just` with no arguments runs the recipe marked
  `[default]`, or the first recipe in the file.

Install it with `cargo install just`, or via your package manager (`apt`, `brew`
— it's everywhere, one binary, no dependencies).