---
title: Postgres LISTEN/NOTIFY for lightweight worker queues
date: 2026-08-02
published: true
tags: [postgres, sql, worker, queue, redis]
source:
---

# Postgres LISTEN/NOTIFY for lightweight worker queues

Redis is the usual answer for job queues, but Postgres has a built-in pub/sub
mechanism — `LISTEN`/`NOTIFY` — that covers simple worker patterns without adding
another piece of infrastructure.

## The pattern

A worker subscribes to a channel; producers signal it when there's work.

```sql
-- worker session
LISTEN jobs_channel;

-- producer, after inserting a job row
NOTIFY jobs_channel, 'job-42';
```

The worker's connection wakes up with the payload, picks up job-42, processes it,
and updates the jobs row. The `jobs` table holds the durable state; the
notification is just the wake-up signal.

## When it fits

- Low-to-moderate throughput worker patterns where you already run Postgres.
- You want enqueue + signal atomic in one transaction.
- Avoiding a separate Redis instance to run and monitor.

## The trade-offs vs Redis queues

| | Postgres `LISTEN`/`NOTIFY` | Redis queue (`LPUSH`/`BRPOP`) |
|---|---|---|
| Persistence | Notifications are **not** persisted | List data survives restarts |
| Delivery | Lost if no listener is connected | Work stays in the list until popped |
| Retry / at-least-once | None natively — build it in the jobs table | Patterns like `RPOPLPUSH`/`BRPOPLPUSH` give this |
| Payload | Plain string only | Any serialized value |
| Infra | Zero extra (uses existing Postgres) | One more service to run |

`NOTIFY` is fire-and-forget: if nobody is listening, the event disappears. Treat
it as a *wake-up signal* over a durable `jobs` table, not as the queue itself.

## Gotchas

- Always keep the durable state in a table; use `NOTIFY` only to trigger processing.
- A job inserted while no worker listens is silently never picked up — add a
  periodic `WHERE status = 'pending'` polling sweep as a safety net.
- One notification per `NOTIFY`; for bulk inserts, notify once per batch, not per row.
