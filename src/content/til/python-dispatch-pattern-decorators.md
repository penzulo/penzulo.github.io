---
title: "Dispatch pattern: a decorator-registered command registry instead of if-else"
date: 2026-08-10
published: true
tags: [python, dispatch, decorators, patterns]
source: https://www.youtube.com/watch?v=elKxnxtx5IE
---

# Dispatch pattern: a decorator-registered command registry instead of if-else

When a function must branch on a command string, an `if`/`elif` tree grows one
branch at a time and the dispatcher bloats. The dispatch pattern replaces the
tree with a *registry*: a `command → handler` mapping, so `dispatch` stays a
three-line lookup and each handler lives on its own.

## The naive if-else

```python
def dispatch(command, payload):
    if command == "uppercase":
        return payload.upper()
    elif command == "reverse":
        return payload[::-1]
    elif command == "hash":
        return sha256(payload.encode()).hexdigest()
    raise ValueError(f"Unknown command: {command!r}")
```

Every new command adds another level of nesting. Reading it means scanning the
whole tree; adding one means touching the dispatcher itself.

## The registry

Same behaviour, but the branches become a dict mapping a name to a handler:

```python
from collections.abc import Callable
from hashlib import sha256


def uppercase(s: str) -> str:
    return s.upper()


def reverse(s: str) -> str:
    return s[::-1]


def hash(s: str) -> str:
    return sha256(s.encode()).hexdigest()


command_registry: dict[str, Callable[[str], str]] = {
    "uppercase": uppercase,
    "reverse": reverse,
    "hash": hash,
}


def dispatch(command: str, payload: str) -> str:
    handler = command_registry.get(command)
    if handler is None:
        raise ValueError(f"Unknown command: {command!r}")
    return handler(payload)
```

`dispatch` shrinks to a lookup plus an error. The remaining wart: the registry
lives at the bottom of the module, physically separate from the functions, so
the two can drift out of sync — add a function and forget to register it, and
dispatch silently reports "unknown command".

## The decorator-fed registry

Registration moves up next to each definition. The `command` decorator is a
factory that takes the name and returns a decorator that stashes the function
in the registry:

```python
from collections.abc import Callable
from hashlib import sha256

command_registry: dict[str, Callable[[str], str]] = {}


def command(name: str) -> Callable[[Callable[[str], str]], Callable[[str], str]]:
    def decorator(func: Callable[[str], str]) -> Callable[[str], str]:
        command_registry[name] = func
        return func
    return decorator


@command("uppercase")
def uppercase(s: str) -> str:
    return s.upper()


@command("reverse")
def reverse(s: str) -> str:
    return s[::-1]


@command("hash")
def hash(s: str) -> str:
    return sha256(s.encode()).hexdigest()


def dispatch(command: str, payload: str) -> str:
    handler = command_registry.get(command)
    if handler is None:
        raise ValueError(f"Unknown command: {command!r}")
    return handler(payload)
```

`dispatch` doesn't change at all — only the bookkeeping moved. The registry is
populated as a side effect of importing the module, and the decorator returns
`func` untouched, so the function's name and signature stay intact.

## Why it wins

- **Co-location.** A handler and its registration live on the same lines. Adding
  a command is one function plus one `@command("...")` — no central dict to edit.
- **Single source of truth.** `command_registry` is the one place names resolve.
- **Extensibility.** Modules can register themselves on import, so new commands
  can be added as plug-ins without touching the dispatcher or the original file.
- **Type-safe lookups.** The registry's type is explicit, so a handler with the
  wrong signature fails at type-check time, not at runtime.

## A generic registry

If handlers have different signatures, pin the decorator with a `TypeVar` so it
preserves each function's real type instead of `Callable[[str], str]`:

```python
from typing import TypeVar

F = TypeVar("F", bound=Callable[..., object])

def command(name: str) -> Callable[[F], F]:
    def decorator(func: F) -> F:
        command_registry[name] = func
        return func
    return decorator
```

## Gotchas

- **Registry fills at import time.** The modules that define commands must be
  imported before `dispatch` runs — the registration is a side effect, so
  importing commands purely for their handlers matters.
- **Duplicate names silently overwrite.** The last `@command("x")` wins. If that
  is a bug you want to catch, raise when the name is already present.
- **Know when the pattern pays off.** Two or three cases are fine as an `if`/`elif`
  — the registry earns its keep as the tree grows and commands multiply.

## Related

- [python-parenthesized-with-context-managers](/til/python-parenthesized-with-context-managers/) — another Python idiom worth knowing
- [cli-progress-bar-carriage-return](/til/cli-progress-bar-carriage-return/) — a small Python tool tip
