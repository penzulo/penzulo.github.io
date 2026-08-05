---
title: Drive the whole OpenAPI contract with Annotated metadata in FastAPI and Pydantic
date: 2026-08-02
published: true
tags: [python, fastapi, pydantic, api]
source:
---

# Drive the whole OpenAPI contract with Annotated metadata in FastAPI and Pydantic

FastAPI and Pydantic both read `Annotated` metadata, merge it into the OpenAPI
spec, and Orval turns that spec into a complete typed client. Write the contract
once; get validation on the backend *and* a full client on the frontend for free.

## Where metadata lives

Query/path params and body fields all accept `Annotated` metadata:

```python
from typing import Annotated
from fastapi import Query

@router.get("/items")
def list_items(
    page: Annotated[int, Query(ge=1, le=100)] = 1,
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
):
    ...
```

Pydantic model fields use the same trick:

```python
from typing import Annotated
from pydantic import BaseModel, Field

class Item(BaseModel):
    name: Annotated[str, Field(min_length=1, max_length=120)]
    price: Annotated[float, Field(gt=0)]
```

## Why it matters

Both frameworks pick up that metadata and emit it into the OpenAPI schema. Orval
consumes the spec and generates a client that carries:

- typed request/response models and classes
- the data constraints (min/max, required) surfaced as client-side validation
- all error paths and status codes, with the right default status
- operation IDs and documentation from the spec

The contract lives in one place (your Python code). The frontend client, its
validation, and the docs all derive from it, so they can't drift.

## Gotchas

- Constraints belong in the type/`Annotated` layer, not in hand-written frontend
  checks. Keep Orval regenerating from the real spec.
- Name routes deliberately — `operation_id` becomes function/hook names in the
  generated client. Ugly operation IDs leak into your code.

## Related

- [tanstack-search-params-source-of-truth](/til/tanstack-search-params-source-of-truth/) — a frontend pattern that consumes these clients
