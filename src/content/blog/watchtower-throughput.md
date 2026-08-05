---
title: 'Moving to homelab infra made things 4x slower, and I blamed the wrong thing'
description: 'I built Watchtower, a self hosted log ingestion pipeline. Moving infra off my dev machine made throughput 4x worse, and I spent way too long blaming the hardware.'
pubDate: '2026-06-28'
tags: ['Postmortem', 'Observability']
---

## What Watchtower actually does

I built Watchtower, which is a self hosted log ingestion pipeline. I built it mostly because I wanted to actually understand how observability tools work, instead of just knowing the words for an interview. While working on it I got a number I really did not expect. Moving my infrastructure off my own dev machine and onto separate "real" hardware made throughput four times worse. And for a genuinely embarrassing amount of time, I was completely convinced the problem was the hardware.

It wasn't. Let me walk you through what actually happened, and all the wrong things I blamed before I got to the right one.

Logs come in over an HTTP (Hypertext Transfer Protocol) request, get pushed onto a Redis list, get picked up and batched into ClickHouse by a worker, and get streamed live to whoever is watching the dashboard over SSE (Server-Sent Events). The producer sending the log never waits around for any of that to happen. It just gets an acknowledgement back and moves on with its life. So really there's a hot path for the live view and a cold path for persistence and search, and a Redis list sitting in between them deciding who gets what.

A few quick reasons for the stack, because I don't want to spend this whole post justifying decisions instead of telling you the story:

- I picked **ClickHouse** because logs have a pretty predictable shape (timestamp, level, service, message, environment), and you're almost always asking for a couple of those columns across a huge number of rows. A row store like Postgres has to drag the whole row off disk even if you only asked for two fields out of it. A column store just doesn't touch the columns you didn't ask for.
- I used a **Redis list plus a worker** for persistence so I could batch writes, since ClickHouse is much happier getting one big write than a thousand tiny ones.
- I went with **SSE instead of WebSockets** for the live feed because the client genuinely never sends anything back, it only listens. Paying for a whole bidirectional handshake upgrade for something that only ever flows one direction felt like complexity for no reason. SSE also reconnects on its own if the connection drops, which with WebSockets you have to build yourself.
- **Elysia on Bun** glues it together because it's fast and I like writing it. The frontend is just **React and Vite**, because that's what I'm comfortable with, nothing deeper than that.

Okay. That's the whole picture. Now here's the part that actually taught me something.

## Round 1: a ceiling that wasn't real

The first working version had everything on one machine. App server, Redis, ClickHouse, even the benchmark itself. I ran a load test and got a steady 3.5k requests per second. Honestly, for a single event loop on a single thread that felt really impressive to me at the time. I remember thinking to myself, damn, this is probably it, the only way to go faster than this is more processes or more workers.

Then I noticed something weird. When the frontend was running, throughput dropped a little bit. When I closed the frontend, it climbed right back up to 3.5k. My first thought was that the frontend code was just bad somehow. But that wasn't it at all. The frontend, the Elysia server, the worker writing to the database, the Redis publisher fanning messages out, the queue's lock and retry logic, ClickHouse itself, the Redis instance, all of it was fighting for time on one single CPU (Central Processing Unit). It was never the frontend's fault. It was collocation.

So I had this old laptop sitting around doing nothing, bad screen, dying battery, otherwise fine. I thought, perfect, let me move Redis and ClickHouse over there and keep developing on my main machine. Spread the load across two machines, throughput should go up, right?

## Round 2: it got worse, not better

It did not go up. It dropped to under 500 requests per second. Roughly four times worse, from adding more total hardware to the picture, not less.

My very first thought was hardware. The old laptop had a slower disk and could only connect over 2.4GHz instead of 5GHz. That explanation felt complete to me, and if I'm honest I think I wanted it to be true, because it meant there was nothing wrong with anything I had written.

I did have one real piece of evidence. Try pinging localhost some time, it resolves in around 0.04 milliseconds, which is basically nothing. Pinging my homelab box gave me an average of about 3 milliseconds. That's a 75x increase in round trip time. It's a real number, but it wasn't proof of anything on its own. It was just a number I had that fit the story I already wanted to believe.

So I went looking for hardware shaped problems to fix, and kept finding things that helped a little but were never the actual answer:

- I was sending one log per HTTP request, which meant one write job per log too. For 5000 logs that's 5000 individual database writes. So I built a batcher. It collects up to `MAX_LOGS` records or waits 500ms, whichever happens first, then fires off one bulk write. ClickHouse docs literally recommend this. It did help some, but the numbers were jumping around a lot, and it saturated at only 500 to 700 requests per second once I got past 20 concurrent connections. Not the fix.
- The queue was allowed up to 6000 concurrent jobs at once, which made no sense given my `MAX_LOGS` setting, so I tuned it down. Didn't really change anything.
- ClickHouse's connection config had no explicit concurrency options set, so I added some: more max open connections, keep alive enabled with a longer socket TTL (Time To Live) so connections would get reused instead of getting torn down between jobs. Made sense on paper. Throughput didn't move.

By this point I was basically fully convinced it was the hardware. Bad disk, bad NIC (Network Interface Card), that's just what you get with an old laptop. Then I SSHed (Secure Shell) into the homelab box and pulled up `htop` while running the benchmark again.

CPU usage sat below 9 percent the entire time. Memory ticked up a little during the run and went right back down after. If the machine wasn't even close to its own limits, how was this a hardware problem? It's kind of like the moment a flat earther actually looks at the horizon and has to deal with what they're seeing.

## So what was it actually

I sat down and traced one single log all the way from the HTTP POST request through validation to wherever it goes next, and found this:

```js
await Promise.all([publishLog(record), enqueueLog(record)]).catch((err) =>
  console.error("[Redis] Failed to ingest log:", err),
)
```

The await. That one word was the whole four times slowdown.

The actual plan had always been fire and forget. Accept the log, kick off the publish and the enqueue, send back a 202 immediately, and let those two things finish whenever they finish. Instead the handler was suspending the response until both of those promises resolved. So every single request was blocked on whichever one of the two was slower. On localhost, with basically zero latency everywhere, this costs you nothing. You genuinely cannot see it happening. The second there's a real network hop between the app and Redis, that same await turns a fire and forget write into a blocking one, on every request, and a few milliseconds of round trip time becomes your entire bottleneck. The queue's lock and retry mechanism made it even worse on top of that: locks dying, jobs getting shoved into a delayed state, retries piling up under the extra latency. None of that was ever hardware. It was one keyword, sitting there invisible the entire time, because of how I'd been testing it.

I removed the await and ran the benchmark again.

```text
PHASE 3 — SUSTAINED PEAK (320 workers, 15s)
throughput  : 7,251 req/s
error rate  : 0.00%
latency     : p50=42ms  p95=60ms  p99=76ms  p99.9=188ms
✓ No saturation detected up to concurrency = 512
```

Peak across the whole run hit 8,595 requests per second, sustained load settled around 7.2k, zero errors the entire time. The hardware theory was completely dead. Honestly the 9 percent CPU number had already told me that. I just wasn't ready to believe it yet.

## A trade I made on purpose

Riding that high, I made what I'd genuinely call a teenage decision. I dropped ioredis and the queue library entirely and went with bun:redis instead, using plain Redis lists with a worker that drains them itself. bun:redis claims something like 7.9x the throughput and 2.1x less memory than ioredis, and I want to be clear that's as claimed, not as something I went and independently verified myself.

What I gave up doing this is the queue's retry guarantees and durability. If the worker dies in the middle of a batch now, those logs are just gone, they don't get requeued anywhere. For a personal project where the absolute worst case is me losing a few logs during a crash I'd notice immediately anyway, that's a trade I'd happily make again. I would not make that same call for anything involving billing, or anything where "we silently lost your data" is a sentence someone has to actually say out loud to a customer. Performance over safety is a perfectly fine default for a side project, and a genuinely bad one anywhere correctness has a dollar amount attached to it.

So that's the throughput story. The hardware was never actually the problem. Believing it without any real proof, and going and fixing more comfortable things instead of looking hard at the one line I'd written first and trusted the most, that was the problem.

## Open source

Watchtower is open source, you can find it at [github.com/penzulo/watchtower](https://github.com/penzulo/watchtower). The README covers the rest of the decisions I made, including a whole separate story about frontend memory usage and a ClickHouse ordering bug that taught me a pretty similar lesson about not trusting my own assumptions.
