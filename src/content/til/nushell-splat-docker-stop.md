---
title: Stop every running Docker container with Nu's splat operator
date: 2026-08-02
published: true
tags: [nushell, docker]
source:
---

# Stop every running Docker container with Nu's splat operator

Stop all running containers in one command using nushell's splat operator:

```nu
docker stop ...(docker ps -q | lines)
```

## Stage by stage

| Stage | What it does |
|-------|--------------|
| `docker ps -q` | Prints only the container IDs, one per line (quiet mode, no headers) |
| `\| lines` | Splits that text into a nushell list of IDs |
| `...(...)` | The splat operator expands the list into separate positional arguments |
| `docker stop ...` | Stops every container in a single invocation |

It effectively expands to:

```sh
docker stop <id-1> <id-2> <id-3>
```

## Why splat is the trick

`docker ps -q` returns text, while `docker stop` wants individual arguments.
`lines` turns the text into a list, and `...` (splat) flips that list back into
separate arguments — no `for` loop, no `xargs`.

## Gotchas

- `docker ps -q` lists only **running** containers; stopped ones are not included.
- `docker stop` is graceful: it sends SIGTERM first, then SIGKILL after the stop timeout.
- If nothing is running, the splat expands to zero arguments and `docker stop`
  errors out. Guard the count first if you want to stay clean:
  `docker ps -q | lines | length`
- To stop *and* remove in one go, use `docker rm -f ...(docker ps -aq | lines)`
  — the `-a` flag includes stopped containers too.

## Related

- [nushell-sys-net-ip](/til/nushell-sys-net-ip/) — same `where`/`get` filter syntax on structured data
