---
title: Generate a résumé in LaTeX with an AI agent and render it on Overleaf
date: 2026-08-02
published: true
tags: [latex, career, ai]
source:
---

# Generate a résumé in LaTeX with an AI agent and render it on Overleaf

The best résumé workflow I've found: give an AI agent your raw material and let
it write the LaTeX. You paste the result into Overleaf, it compiles to PDF, and
you download it. No word processor involved.

## The workflow

1. Hand the agent your best raw content: work history, responsibilities,
   quantified achievements, skills, education, links. Better source material in
   means a better résumé out.
2. Ask it for a clean LaTeX résumé (a compact custom class or something like
   `moderncv`).
3. Paste the `.tex` into [Overleaf](https://www.overleaf.com) — it auto-compiles.
   Tweak nothing or a little, then download the PDF.

## Why this beats Word / Google Docs

- **Plain text source.** A résumé is a `.tex` file, not a binary `.docx`. It
  diffs, merges, and version-controls cleanly — you can keep it in git.
- **No corruption.** No docx binary that silently breaks when the file grows or
  moves between apps.
- **Precise layout.** LaTeX handles typography, spacing, and pagination exactly;
  you never fight the cursor or the ruler.
- **Template-driven.** Regenerate with a different template in seconds, no retyping.
- **Live preview.** Overleaf compiles server-side, so package installation "just works".

The trade-off: a steeper learning curve, and overkill for a one-off casual document.

## Tip

Keep the raw source content in this vault (e.g. a `6-Areas/Career` note). Then
"re-generate my résumé for role X" becomes a ten-minute agent task instead of an
afternoon of formatting.
