---
title: Make URL search params the source of truth with TanStack Router and Query
date: 2026-08-02
published: true
tags: [frontend, react, tanstack, typescript]
source:
---

# Make URL search params the source of truth with TanStack Router and Query

Stop duplicating state between the URL and component state. With TanStack Router
+ TanStack Query, the URL search params *are* the state, and the router turns any
change into a data reload.

## The pieces

| Piece | Role |
|-------|------|
| `validateSearch` | Declares the search-param schema, so params are typed and validated |
| `loaderDeps` | Returns a value derived from the search params that the loader depends on |
| `ensureQueryData` | In the loader: return cached data if fresh, otherwise fetch and wait |
| `navigate()` | The only way to change params — call it with a new search object |
| Nested routes | A modal/sheet rendered as a child route inside the parent's `<Outlet />` |

## How it flows

1. State lives in the URL: `?q=foo&page=2`.
2. The loader's `loaderDeps` derive from those params. When the deps change, the
   loader reruns automatically.
3. The loader calls `queryClient.ensureQueryData(...)` — the route only renders
   once the data for the current params actually exists in the cache.
4. Changing the params is just `navigate({ search: (prev) => ({ ...prev, page: 2 }) })`.
   The router reruns the loader; nothing else needs to know.
5. Modals and sheets become nested child routes. "Open" = `navigate()` to the
   child; "close" = `navigate()` back to the parent. No `useState` modal flags.

## Why it wins

- URLs are shareable: send a link and the recipient lands on the exact filtered state.
- Back/forward and refresh just work — the browser's history is the state.
- No state gymnastics: no modal booleans, no two sources of truth drifting apart.
- Types flow end to end: search params and `loaderDeps` are typed.

## Gotchas

- `ensureQueryData` returns *cached* data when fresh and only fetches when stale
  — it does not force a refetch. Use `invalidateQueries`/`prefetchQuery` when you
  want guaranteed freshness.
- Keep `loaderDeps` serializable and derived purely from search params, or loaders
  rerun for the wrong reasons.

## Related

- [fastapi-pydantic-annotated-metadata](/til/fastapi-pydantic-annotated-metadata/) — the API contract feeding these queries
