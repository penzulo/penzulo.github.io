---
title: Every `impl Trait` argument is its own anonymous type parameter
date: 2026-08-21
published: true
tags: [rust, generics, traits]
source:
---

# Every `impl Trait` argument is its own anonymous type parameter

From a Rustlings traits exercise: two `impl Trait` arguments look like they share
one bound, but each occurrence is a *separate* generic parameter.

```rust
fn compare_license_types(
    software1: impl Licensed,
    software2: impl Licensed,
) -> bool
```

is conceptually:

```rust
fn compare_license_types<T: Licensed, U: Licensed>(
    software1: T,
    software2: U,
) -> bool
```

So `compare_license_types(SomeSoftware, OtherSoftware)` compiles fine — `T` and
`U` resolve independently, and the function compares them through the shared
`Licensed` bound.

## The trap: one named parameter

```rust
fn compare_license_types<T: Licensed>(software1: T, software2: T) -> bool
```

One parameter means **one** concrete type for both arguments:

```text
error: expected `SomeSoftware`, found `OtherSoftware`
```

Same call site, completely different contract.

## And `Box<dyn Licensed>` is a third thing

```rust
fn compare_license_types(
    software1: Box<dyn Licensed>,
    software2: Box<dyn Licensed>,
) -> bool
```

Trait objects *can* hold different concrete types at runtime — but the caller
must construct them explicitly:

```rust
compare_license_types(Box::new(SomeSoftware), Box::new(OtherSoftware))
```

Rust never implicitly heap-allocates to coerce a value into a trait object, so
this is not a drop-in signature swap when the call sites are fixed.

## Side by side

| Signature | Args can differ? | Dispatch |
|-----------|------------------|----------|
| `a: impl Licensed, b: impl Licensed` | Yes — two anonymous params | static (monomorphized) |
| `<T: Licensed>(a: T, b: T)` | No — one param fixes one type | static |
| `a: Box<dyn Licensed>, b: Box<dyn Licensed>` | Yes — erased at runtime | dynamic (vtable) |

## The takeaway

`impl Trait` does not mean trait object. `x: impl Licensed` says *"there is a
concrete type here that implements `Licensed`; compiler, figure out which."*
`x: Box<dyn Licensed>` says *"forget the concrete type entirely; hand me an
erased object."* Different caller-side representation, different dispatch
semantics — which is why `Box<dyn Licensed>` isn't a substitute for
`impl Licensed`.

## Gotchas

- **Every occurrence counts.** Each `impl Trait` in argument position gets its
  own parameter — `&impl Licensed` behaves the same way, and passing owned values
  to it fails because a reference is simply a different type.
- **Monomorphization has a cost.** Static dispatch means the compiler generates
  a copy of the function per concrete type — faster at runtime, heavier binaries.
- **Reach for `dyn` deliberately.** Use trait objects when you genuinely need
  runtime polymorphism (heterogeneous collections, plugin-style APIs), not to
  dodge a signature mismatch.

## Related

- [python-dispatch-pattern-decorators](/til/python-dispatch-pattern-decorators/) — dynamic dispatch by hand: a command registry is `dyn` semantics in Python
