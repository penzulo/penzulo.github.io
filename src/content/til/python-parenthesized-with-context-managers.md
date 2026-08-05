---
title: Parenthesized `with` — multiple context managers in one clean block
date: 2026-08-05
published: true
tags: [python, context-manager, syntax]
source:
---

# Parenthesized `with` — multiple context managers in one clean block

Since Python 3.10 you can wrap the context managers of a `with` statement in
parentheses, so several resources share one block instead of nested `with`
blocks. Same cleanup semantics, flatter code.

## The pattern

From a real fixture that hands out a Playwright page and cleans it up on exit:

```python
with (
    sync_playwright() as p,
    p.chromium.launch(headless=True) as browser,
    browser.new_context(viewport={"width": 1280, "height": 720}) as context,
    context.new_page() as page,
):
    page.set_default_timeout(settings.DEFAULT_TIMEOUT)
    yield page
```

Every context manager enters in order (`p` → `browser` → `context` → `page`) and
exits in reverse on the way out — the browser is torn down even if the body
raises. Same guarantee as nesting, none of the indentation.

## Why it matters

The old way forces one level of nesting per resource:

```python
with sync_playwright() as p:
    with p.chromium.launch(headless=True) as browser:
        with browser.new_context(viewport={"width": 1280, "height": 720}) as context:
            with context.new_page() as page:
                page.set_default_timeout(settings.DEFAULT_TIMEOUT)
                yield page
```

The parenthesized form is semantically identical to the comma-separated single
line `with A() as a, B() as b:`, just readable across lines. Resources that
depend on earlier ones (like `page` depending on `context`) read as a pipeline
instead of a pyramid.

## Gotchas

- Requires **Python 3.10+** (the PEG parser from PEP 617). On older versions the
  parentheses are a syntax error.
- Cleanup order is always last-in, first-out — the resources exit in reverse of
  creation, regardless of the indentation you write.
- A trailing comma after the last manager is allowed and keeps diffs clean.
- It is one `with` block: anything indented inside it is inside *all* the
  managers. You can't split the body between managers.

## Related

- [fastapi-pydantic-annotated-metadata](/til/fastapi-pydantic-annotated-metadata/) — another Python idiom from this vault
