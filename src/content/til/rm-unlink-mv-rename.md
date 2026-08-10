---
title: "`rm` and `mv` touch the index, not the data — why `node_modules` takes forever"
date: 2026-08-08
published: true
tags: [linux, filesystem, inode, shell]
source:
---

# `rm` and `mv` touch the index, not the data — why `node_modules` takes forever

`rm` does not erase your file from disk. Neither does `mv` "move" your file. Both
work on the filesystem's *index* — the metadata that says "this name points at
this data" — which is why deleting a folder with hundreds of thousands of files
is slow while these commands feel instant for a single file.

## What `rm` really does

A file name is a directory entry pointing to an *inode*: the record holding the
file's metadata and the pointers to its data blocks. `rm` doesn't touch that
data. It calls the `unlink()` syscall, which:

1. removes the directory entry, and
2. decrements the inode's link count; when it hits zero, the blocks are marked
   free.

The bytes stay physically on disk. A forensic lab with the right equipment can
recover the file if nothing has overwritten those blocks since — this is exactly
how deleted files get recovered.

## What `mv` really does

- **Same filesystem:** `mv` is just `rename()`, which rewrites the directory
  entry to point at the new path. No data moves — that's why same-disk moves are
  blazingly fast regardless of file size.
- **Across filesystems** (different disks/partitions, e.g. `/` → `/mnt/usb`):
  there's no single entry to rewrite, so `mv` falls back to *copy the data to the
  destination, then unlink the original*. That's why cross-disk moves are slow
  and why `mv` can run out of space on the target.

## The `node_modules` problem

`rm -rf node_modules` isn't slow because of the data size — it's slow because the
kernel must walk the tree and issue one `unlink()` syscall per file (plus
`rmdir()` per directory). `node_modules` routinely has 100k+ individual entries,
so "one command" is secretly hundreds of thousands of metadata operations.

The same applies to `mv node_modules` across disks: every one of those files gets
copied and then unlinked one by one.

## Gotchas

- The freed data is recoverable only until its blocks get overwritten — and on
  SSDs, TRIM may tell the drive the blocks are unused, making recovery
  unreliable.
- If a process still holds a deleted file open, its blocks stay allocated until
  that handle closes — the space isn't freed by `rm` alone.
- Because it's metadata-bound, `rm -rf` speed is limited by filesystem metadata
  throughput, not disk transfer speed. Fewer, bigger files always beat many small
  ones.

## Related

- [nushell-splat-docker-stop](/til/nushell-splat-docker-stop/) — batching shell operations to avoid per-item overhead
