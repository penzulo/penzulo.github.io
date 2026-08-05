---
title: Get the machine's IP address with Nu's sys net
date: 2026-08-02
published: true
tags: [nushell, networking, ip]
source:
---

# Get the machine's IP address with Nu's sys net

Nushell's `sys` command exposes system info as structured data, so you can query
it with filter syntax instead of scraping text out of `ip addr` or `ifconfig`
with `awk`/`grep`.

```nu
sys net | where name == "wlan0" | get ip.0 | where protocol == "ipv4"
```

## Stage by stage

| Stage | What it does |
|-------|--------------|
| `sys net` | Dumps network interfaces as a table with columns `name`, `mac`, `ip`, `sent`, `recv` |
| `where name == "wlan0"` | Keeps only the row for the wireless interface |
| `get ip.0` | Pulls the `ip` column and descends one level into the nested address table |
| `where protocol == "ipv4"` | Keeps only the IPv4 address entry |

Append `| get address` to get the bare IP string:

```nu
sys net | where name == "wlan0" | get ip.0 | where protocol == "ipv4" | get address
# 192.168.1.9
```

## The output shape

Each row of the inner `ip` table has four columns:

- `address` — the IP string
- `protocol` — `ipv4`, `ipv6`, or `ipv46` for dual-stack addresses
- `loop` — whether this is the loopback address
- `multicast` — whether multicast is enabled on the address

## The gotcha: why `.0` matters

The `ip` column is nested one level deeper than it looks. `sys net` gives you a
list containing the address table, not the table itself:

```text
ip = [ [ ...address records... ] ]     # a list wrapping one table
```

So the naive version silently returns **0 rows**:

```nu
sys net | where name == "wlan0" | get ip | where protocol == "ipv4"   # empty!
```

The `.0` in `get ip.0` descends into the inner table *before* the filter runs.
Without it the command fails with no error at all — the worst kind of failure,
because nothing tells you the filter just matched nothing.

## Related

- [nushell-splat-docker-stop](/til/nushell-splat-docker-stop/) — another nushell pipeline trick, same filter syntax
