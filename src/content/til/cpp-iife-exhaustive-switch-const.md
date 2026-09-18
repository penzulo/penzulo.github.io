---
title: "C++ IIFEs: initializing a `const` from an exhaustive switch"
date: 2026-09-18
published: true
tags: [cpp, lambdas, switch]
source:
---

# C++ IIFEs: initializing a `const` from an exhaustive switch

When a value is the output of branching logic, a `const` initializer feels out
of reach — until you wrap the branch in a lambda and call it immediately. An
IIFE (immediately invoked function expression) is just that: a lambda with a
trailing `()`.

```cpp
const string_view name = [&it]() {
  switch (it) {
    case ItemType::Weapon: return "Weapon";
    case ItemType::QuestItem: return "Quest Item";
    case ItemType::Consumable: return "Consumable";
  }
  std::unreachable();
}();
```

## Why the IIFE

Without it you'd have to declare the variable first and mutate it in each arm:

```cpp
string_view name;
switch (it) {
  case ItemType::Weapon: name = "Weapon"; break;
  case ItemType::QuestItem: name = "Quest Item"; break;
  case ItemType::Consumable: name = "Consumable"; break;
}
```

Two problems. `name` cannot be `const` — it starts default-constructed and gets
assigned per arm. And a forgotten `case` leaves it silently empty instead of
erroring. The IIFE solves both at once:

1. The lambda `return`s the value, so the whole `...()` call is the initializer
   and `const` just works.
2. Every `case` returns from the lambda, making the switch exhaustive by
   construction — there is no fall-through path to a wrong value.

## Reading the pieces

| Piece | Job |
|-------|-----|
| `[&it]` | captures the enum by reference |
| `() { ... }` | zero-argument lambda |
| `case ItemType::X: return "..."` | returns from the lambda, feeding the binding |
| `std::unreachable()` | `[[noreturn]]` fallback after the exhaustive switch |
| trailing `()` | immediately invokes the lambda |

## The exhaustive-switch contract

- Cover **every** enumerator with a `case`.
- Do **not** add a `default:` arm — a `default` suppresses GCC/Clang's
  `-Wswitch` warning (`enumeration value 'X' not handled in switch`) that is
  otherwise your safety net.
- Add a new `ItemType` later and the compiler flags the missing arm instead of
  letting a new value silently fall through.

## Gotchas

- `std::unreachable()` is C++23 (`#include <utility>`), and it **is** undefined
  behaviour if reached. It's only safe here because the switch is exhaustive; if
  you're on `-std=c++20` or older, fall back to `std::abort()`.
- The lambda's return type is deduced from the `return` statements (`const char*`),
  which binds implicitly to `string_view`.
- Compile with `-std=c++23` and the warning flags on; the const plus the
  compiler warning are what make the "exhaustive" guarantee hold.
- An IIFE is best for *short* initialization logic. If the mapping grows, prefer
  a named helper or a `constexpr` lookup table (when the enum values are
  contiguous).

## Related

- [rust-impl-trait-separate-generics](/til/rust-impl-trait-separate-generics/) — exhaustive matching is a language rule in Rust; in C++ you get it with `-Wswitch` and no `default`