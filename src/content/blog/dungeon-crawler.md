---
title: 'Explicit errors, implicit bugs: learning modern C++ by losing to my own dungeon'
description: 'I built a dungeon crawler in C++23 to learn modern C++ — modules, std::expected, composition over inheritance. The types caught the small errors. Nothing caught my assumptions.'
pubDate: '2026-10-09'
tags: ['C++', 'Learning', 'Postmortem']
---

I wrote a dungeon crawler to learn modern C++. Not because I wanted a game — because I wanted to understand why game developers reach for C++, and why trading firms hand quant developers a C++ compiler and a prayer. A game is a surprisingly honest way to learn a language: it forces you to model state, handle failure, and make a hundred small design decisions you cannot hand-wave.

By the end I had exhaustive error enums, `-Werror`-clean builds, an acyclic module graph, and a real test suite. I also had a game loop that would not end.

That last one is the whole post. I spent the entire project making wrong *values* impossible and forgot to make sure my own *state* was ever written down. This is what modern C++ actually feels like to learn in 2026 — the parts that are genuinely great, the parts that are genuinely painful, and the bug that taught me the most.

## What it actually is

A small Command-Line Interface (CLI) dungeon crawler. Five rooms in a straight line heading east, turn-based combat that is fully deterministic (you swing first, a monster only hits back on rounds it survives), a handful of items, and a quest pendant at the end. Input is raw single keys — arrow keys to move, `a` to attack, `p` to pick up, `1`–`5` to use a slot, `q` to quit. No Enter key, no line editing, just keystrokes. The whole thing is roughly a thousand lines of C++23 plus tests.

I picked a game specifically because it cannot be faked. A CRUD app lets you dodge the hard parts. A game makes you hold state, coordinate subsystems, and decide what happens when a player tries to heal at full health or pick up an item that a live goblin is guarding.

## The first unit

When I started, I had a list of concepts and no idea where to begin: a player, a dungeon, rooms, weapons, items, monsters, a quest item. Then I broke each of those down further. A player has health, and health is two numbers — `current` and `maximum`. A player has an inventory full of items. A room has directional exits, and maybe an item, and maybe a monster. And healing a player at full health should do *nothing*, which means there is an invariant somewhere that has to catch it.

That was the realization: breaking big interfaces into small, reusable, unit-testable components is not just tidy — it is the only reason I could get started at all.

The first struct I wrote was `Health`:

```cpp
export struct Health {
  uint8_t current{100};
  uint8_t maximum{100};

  Health() = default;
  explicit Health(const uint8_t new_current) : current(new_current) {}
  Health(const uint8_t nc, const uint8_t n_max) : current(nc), maximum(n_max) {}

  auto take_damage(const uint8_t damage) noexcept -> expected<uint8_t, HealthError> {
    if (current == 0) {
      return unexpected(HealthError::AlreadyDead);
    }
    const uint8_t damage_took = std::min(damage, current);
    current -= damage_took;
    return damage_took;
  }

  auto take_heal(const uint8_t increase) noexcept -> expected<uint8_t, HealthError> {
    if (current == maximum) {
      return unexpected(HealthError::AlreadyFullyHealed);
    }
    const auto heal_taken = std::min<uint8_t>(increase, maximum - current);
    current += heal_taken;
    return heal_taken;
  }

  auto is_dead() const noexcept -> bool { return current == 0; }
  auto at_full_health() const noexcept -> bool { return current == maximum; }
};
```

My first version returned a `size_t` — the amount of damage dealt, or the amount healed. That worked. But it meant call sites looked like this:

```cpp
if (health.take_damage(67) == 0) {
  // what was 0 again? no damage? already dead? did the game crash?
}
```

That is fine while I still have the context of having written it. It is not fine when I come back in a month, and it is *definitely* not fine for a type checker or a Language Server Protocol (LSP) that is trying to autocomplete my life. So I moved to a Rust-style `std::expected` plus an error enum:

```cpp
export enum class HealthError : uint8_t {
  AlreadyDead,         // Can't damage more
  AlreadyFullyHealed,  // Can't heal more
};
```

An enum is just a fancy way to represent an error code — quite literally. But writing `HealthError` forced me to enumerate every way `Health` can fail *before* running the code even once. If everything goes well, the function returns the amount dealt or healed. If an invariant is caught, it returns a named error instead of a magic `0`. The signature `expected<uint8_t, HealthError>` now says both what you get and how it can go wrong, right there in the function name.

I marked these functions `noexcept` because they genuinely cannot throw — they return their failures as values. That lets the compiler reason about the call sites, and more importantly it makes the failure modes part of the type instead of a surprise at runtime. That is the theme running through the whole project: failures are values, and I want to *see* them.

This is also the first time I actually sat down with constructors — defaulted, explicit, two-argument — and understood what each one buys you.

## C++20 modules

Breaking everything into tiny pieces created the next problem: getting the pieces to see each other. `Character` is composed of `Health`, so the `character` module needs the `health` module. The C++ of my university days reached for `#include`, which works, but it pollutes scope with everything in the header and forces you to maintain a `.h` and a `.cpp` for the same interface. Since I was here to learn modern C++ anyway, I went with C++20 modules.

The pitch is genuinely nice. You get `import` and `export`:

```cpp
export module dungeon.character;
import std;
import dungeon.health;
```

`character.cppm` imports `dungeon.health`, and only the things `health.cppm` marked `export` become visible. Implementation stays hidden by default; the interface is what you choose to expose. You don't copy-paste `<vector>`'s source to use a vector, and you don't maintain a header and a source file that drift apart. Standard library access is a single `import std;`.

The catch is that modules are still, in 2026, an experimental feature in most toolchains. That is the only reason I switched from `g++` to `clang++`.

A couple of things bit me:

- **Modules don't leak `using` declarations.** Every `.cppm` declares its own. No more "it compiled because a header three includes up happened to pull in `std::size_t`."
- **`assert` is a macro**, and it was deliberately left out of `import std;`. The fix is a *global module fragment*:

```cpp
module;
#include <cassert>
export module dungeon.dungeon;
```

A plain `#include <cassert>` inside the module body fails `-Winclude-angled-in-module-purview` under `-Werror`. That one line of `module;` took longer than I would like to admit.

The **downside** of modules is cycles. If `Character` imports `Health` and `Health` imports `Character`, the compiler stops. There is no forward declaration to save you. That forced me to actually plan the dependency graph instead of discovering it through linker errors — annoying, and also exactly what I needed. The repo enforces one pacing rule to keep the graph acyclic: `dungeon.character` never imports `dungeon.room`. Anything that needs to coordinate the two — combat, which has to bridge a character and a room — lives one level up, in `dungeon.dungeon`.

And then there is CMake. Configuring modules in CMake is genuinely harder than *using* them. The `std` module does not come precompiled, so the build compiles `std.cppm` into a Precompiled Module (PCM) by hand and hands the compiler `-fmodule-file=std=<pcm>`, purely so `import std;` works and so `clangd` can resolve it too. It is ugly, but it is written down once and then you forget about it. Once it worked, modules were the least of my problems.

For context on how much this changed things: the very first commit was a 233-line `main.cpp`. By the end, `main` reads a key, calls into a game module, and prints. It is a driver, not a program.

## The game loop

Eventually every piece existed and the game needed to keep running by itself until you died, won, or quit. Each turn does the same few things: describe the world, read a key, decide what the player meant, check whether that is legal, then change the world. The part I got genuinely right was splitting the last two steps.

Every action goes through two functions:

- `can_execute` is a pure, read-only query. It answers "could the player do this right now?" and mirrors every failure mode with a query: is there an exit that way, is there a monster here, is the room's item being guarded, is the slot even occupied.
- `execute` assumes validation passed and mutates the world.

`can_execute` is the early exit that guards the mutation. It catches every invariant up front, so `execute` can focus on the outcome instead of re-checking the world. In a game this is safe in a way it often isn't elsewhere: it is single-threaded and turn-based, so there is no window between validation and execution for anything to change underneath you. No Time-Of-Check-To-Time-Of-Use (TOCTOU) bug, because nothing else is running.

This is also where `std::expected` paid off, because the two layers chain:

```cpp
return combat_round(hero, room)
    .transform_error([](const auto) { return GameError::NothingToFight; })
    .transform([&](const CombatResult& res) {
      return TurnResult{hero.is_dead() ? GameState::Dead : GameState::Playing,
                        narrate(res)};
    });
```

`transform` maps the success value forward; `transform_error` maps a failure into the game's own error vocabulary (`narrate` is a small lambda that assembles the fight text). If you haven't met Railway Oriented Programming before, the metaphor is literal: two rails, success and failure, and these functions switch tracks without a pile of `if` statements. It is the closest C++ has ever felt to Rust, and I mean that as a compliment to both.

`std::optional` shows up in the same spirit for values that can simply be absent — an equipped weapon, a room's item, the first free inventory slot. Where `expected` carries a typed reason for failure, `optional` says "there's nothing here," represented by `std::nullopt`. That is the same idea as Rust's `Option<T>` or Python's `T | None`. Under the hood both are a value plus a discriminator boolean; the difference is whether absence is a failure worth naming. Knowing which one to reach for turned out to be most of the design.

When I need a `const` value that depends on a `switch`, I use an Immediately Invoked Function Expression (IIFE):

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

I have a whole separate post's worth of love for `std::unreachable()`. Notice there is no `default` in that switch. If someone adds a fourth `ItemType`, every `switch` without a `default` becomes a compile error at the exact places that need updating. The compiler is the checklist.

That is also the whole argument for **composition over inheritance** here. `Character` does not inherit from some `Entity` base class — it *contains* a `Health`, an `Inventory`, and an `Equipment`. There are no virtual functions anywhere in this codebase. This is, not coincidentally, why Rust prefers structs plus traits over inheritance and vtables: it keeps data and behavior next to each other and makes the cost of indirection explicit. Composition won so thoroughly that I never once wished for a base class.

The only genuinely fiddly part was the narration. A single turn's text is assembled from several outcomes — you hit, it hit back, it died, you died — and I rewrote that string-building logic more than anything else in the project. Making the individual units is the easy part; making them read well together is the work.

### A design decision I'd defend

Rounds are driven by a `UserIntent { CommandType command; optional<uint8_t> slot; }`. The obvious alternative was to delete the struct and add `UseSlot0` through `UseSlot4` to `CommandType`. I am glad I didn't:

- The slot range would have had **two sources of truth** — the `inventory_capacity` constant I actually check, and a fixed list of enumerators that nothing forces to agree with it.
- The number-row keys would have **leaked the keyboard layout into the game domain**. Rebinding `Attack` to a different key would mean editing the enum instead of one translation line.
- Recovering the slot would mean **enum arithmetic** (`cmd - UseSlot0`), and `NoSuchSlot` would have to disappear even though "use slot N" is a legitimate game concept.

Instead, `optional<uint8_t>` honestly says "Use carries an argument; nothing else does." The input layer only ever fills `slot` for the digit keys, and `can_execute` traps a stray slot on any other command with `std::unreachable()` — that is a programming error, not something the player can trigger.

One more small joy: I wrote `std::formatter` specializations for `ItemType` and `Inventory`, so printing a room's contents is just `println("{}", player.inventory)` and the items format themselves. That is a feature I did not know I wanted until I had it.

## Reading one key from a terminal

For a CLI game to feel like a game, you cannot wait for the user to press Enter after every move. You need the terminal in "raw" mode, where keystrokes arrive the instant they are pressed and Ctrl+C doesn't kill the process.

That means `termios`, one of those Portable Operating System Interface (POSIX) interfaces that happily predates me. I flip the terminal into cbreak mode — `ICANON` and `ECHO` off so keys arrive immediately and aren't echoed, `ISIG` off so Ctrl+C and Ctrl+Z come through as ordinary bytes and the only way to quit is `q`, and `IXON` off so Ctrl+S doesn't freeze the terminal. Then I have to *guarantee* putting it back, because a game that leaves your terminal in raw mode the next time you open a shell is genuinely awful. That is what the RAII (Resource Acquisition Is Initialization) guard is for:

```cpp
class RawTerminal {
  termios saved{};
  bool active{false};
 public:
  RawTerminal() { /* save settings, enter cbreak */ }
  ~RawTerminal() {
    if (active) {
      ::tcsetattr(STDIN_FILENO, TCSANOW, &saved);  // restore on the way out
    }
  }
};
```

The fun problem is arrow keys. They aren't single bytes; they are escape sequences: `\x1b[A` is Up, `\x1b[D` is Left, and so on. But `\x1b` (Escape) is also a perfectly valid key the player might press on its own. So when I see an ESC byte I cannot block waiting for a sequence that might never arrive — I poll with `select()` for a 20-millisecond window. If more bytes show up, it is an arrow; if not, the player pressed Escape.

The reason this belongs in a post about types is the shape of the code. The *meaning* of the bytes lives in pure functions — `decode_char` and `decode_sequence` — that take input and return a `Key`. The messy syscall code that actually reads from the file descriptor is a thin shell around them. I did not plan that; I noticed it. It is the same shape as `can_execute`/`execute`, and the same shape as save/load below.

## The bug that ate an evening

Here is the one I actually want to talk about.

My `Game` owns a `GameState`: `Playing`, `Dead`, `Won`, or `Quit`. The main loop is roughly:

```cpp
while (game.state == GameState::Playing) {
  // read a key, run a turn
}
```

`next_state` was supposed to run one turn and report the state that came out of it. It returned a `TurnResult { GameState state; string narration; }` — the new state and the text to print. Correct values, every single time.

The problem was that `next_state` computed that state and *returned it*, but never assigned it back to `Game::state`. So quitting didn't quit, dying didn't stop the loop, and grabbing the quest item didn't end the game. The state machine returned the truth and threw it away.

The reason it took so long to notice is embarrassing: my smoke tests piped input in with `printf`, and when the pipe closed, `std::cin` hit end-of-file (EOF) and the loop broke anyway. The tests passed because of the *failure* they were supposed to catch. The game looked fine until I actually sat down and played it interactively and realized `q` did nothing.

The fix is two lines — wrap the turn body so that on the success path it syncs `state = result->state`, and deliberately leaves state untouched when a turn fails, because a failed turn is not a transition. But the lesson is the whole reason I am writing this. I had spent the entire project making invalid *values* unrepresentable: exhaustive enums, `expected` everywhere, `std::unreachable()` guards, a compiler that refuses to build if I forget a case. And the bug that mattered was invalid *state* — a field I simply forgot to write. No type caught it, because the type was perfectly legal. It was just never updated.

I added a regression test asserting `game.state == result->state` on the success path and that a failed turn leaves state alone. It is now the first thing that runs.

## Save and load

You can save a run with `s` and load one by passing a filename at startup. The interesting part is the same pattern showing up a third time.

Persistence is split into four functions, and the split is the point:

- `serialize(const Game&) -> string` is pure — game in, text out.
- `deserialize(string_view) -> expected<Game, SaveError>` is pure — text in, game or a typed error out.
- `save_to_disk` and `load_from_disk` are the only functions that touch a file.

The pure/impure line is the same one as `can_execute`/`execute`, and the same one as `decode_*`/`read_key`. Once I had written it three times I stopped thinking of it as a pattern and started thinking of it as the default: keep the logic pure and testable, and confine the Operating System to the smallest shell you can.

The format itself is a small **delta** over the static dungeon layout. The rooms, exits, monster types and floor items are all rebuilt from `make_dungeon()`; the save file only records what changed — where the player is, their health and inventory, which monsters are dead, which items are gone. Fewer bytes, and it cannot accidentally disagree with the layout, because it is not storing the layout.

On disk, saving writes a `.tmp` file, flushes it, and only then atomically renames it over the real save. If the process dies mid-write you are left with a stale `.tmp`, never a half-written save. Loading validates everything against the static layout, so a hand-edited file with a monster at 999 HP comes back as a typed `SaveError::FileCorrupted` instead of undefined behavior.

Notice that `SaveError` is its own enum, deliberately *not* a `GameError`. Save and load failures never flow through the turn pipeline. The `expected<TurnResult, GameError>` contract stays exactly as it was; disk problems are a different concern with a different type. Keeping error domains separate is the same instinct as keeping modules acyclic.

## Making the numbers add up

Because combat is deterministic, the damage math is exact, which makes it a useful test surface. I originally had the item placement slightly off-balance, so I shuffled the sword in front of the hardest early fight, tuned a couple of health values, and — the part I am actually proud of — wrote a **greedy auto-bot** that plays the entire dungeon from a fresh start and asserts it reaches `GameState::Won`. If a future tuning pass makes the game unwinnable, the test suite says so immediately instead of a player finding out twenty minutes in.

That test exists because the whole suite exists. I used `boost.ut`, and the reason testing was pleasant is the same reason everything else was: `Game` plus a `UserIntent` is a clean seam. The tests are module consumers, not mocks. I hand the game an intent and check the state that comes back. No test doubles, no dependency-injection framework, just the actual object. `can_execute`/`execute` gave me that seam for free, which is the kind of thing that only looks obvious in hindsight.

The suite ended up at 30 tests across 8 suites, covering everything from the input decoder's contract to the win path. In a project whose entire point was learning, having the tests catch a real regression — and having a balance bug be *provable* — was worth more than any feature.

## What I'd do differently

- **Modules are still experimental, and the toolchain lock-in is real.** This only builds on `clang++` with `libc++`, on Linux, because of `termios`. That is fine for a learning project and a hard no for anything I would ship to other people.
- **CMake's module support is the tax.** Once it works you forget it, but the initial setup is genuinely unpleasant, and the `std` module precompile is a hack I would rather not maintain.
- **`-Wconversion` and `uint8_t` fight constantly.** Every time I do arithmetic on health I get promotions to `int` and then a warning to put it back. The strictness caught real bugs, but the ergonomics of small integer types in C++ are still rough.
- **`std::expected<void, E>` doesn't compose cleanly with `optional`.** There is a comment in the movement code noting that `optional` cannot be used with `expected<T>`, and you end up doing a little dance to convert between the two failure styles.

There is plenty left on the table, too: ANSI colors, a fixed-screen Text User Interface (TUI) with redraw-in-place so the screen stops scrolling, and per-turn logging to a file. Those are the fun ones. The core learning was already done.

## The point of all of it

I set out to learn modern C++ and got `std::expected`, modules, composition, and a real test suite out of it. I got sharper at planning, at breaking a problem down until it is nearly trivial, and at thinking about all the ways something can go wrong — which is exactly what exhaustive enums and `expected` force you to do.

But the thing I will actually remember is that `next_state` returned the right answer and I ignored it. The types caught every small error I could name. Nothing caught the assumption I never named. Explicit errors are easy; implicit bugs are the ones you don't know to look for.

The dungeon crawler is on GitHub at [github.com/penzulo/dungeon-crawler](https://github.com/penzulo/dungeon-crawler). Clone it, run `just dev`, and try to finish it without dying. The README has the rest of the decisions, including a few things I glossed over here.

---

*Post-note: Yes, `all the em-dashes are intentionally written by me. Really.`*
