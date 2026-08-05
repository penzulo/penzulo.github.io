# Bhargav Deshpande - Personal Portfolio

This is the source code for my personal portfolio website, hosted at [penzulo.dev](https://penzulo.dev).

## About the Site

Built with **Astro** (static output) and **content collections** for the blog and Today I Learned
sections. The build emits plain semantic HTML with **zero client-side JS**, keeping the site friendly
to browsers, screen readers, web crawlers, lynx, and LLMs alike.

- **Static by default**: `pnpm build` produces a `dist/` folder of plain HTML files, no runtime JS.
- **Content collections**: posts live as Markdown/MDX files with typed, Zod-validated frontmatter
  (`src/content/blog/`, `src/content/til/`). The build fails on malformed frontmatter.
- **SEO/LLM niceties**: per-page meta + Open Graph tags generated from frontmatter, `sitemap.xml`,
  `robots.txt`, and an RSS feed that includes both blog posts and TILs (`/rss.xml`).
- **Clean URLs**: directory-format output, so posts live at `/blog/watchtower-throughput/` and TILs
  at `/til/<slug>/` (no `.html` suffix).

## Adding a post

Drop a Markdown file into the relevant collection:

- Blog post: `src/content/blog/my-post.md`
- TIL: `src/content/til/my-til.md`

Blog post frontmatter:

```markdown
---
title: 'My post title'
description: 'One or two sentence summary, shown on listings and in the RSS feed.'
pubDate: '2026-08-01'
tags: ['Backend', 'PostgreSQL']   # optional, first tag shows as a badge
---

Your Markdown content here. Images can go in `public/assets/images/`.
```

TIL frontmatter (`description` is optional — a summary is derived from the first
paragraph of the body when missing):

```markdown
---
title: 'My TIL title'
date: '2026-08-01'
published: true        # set false to keep it as a hidden draft
tags: ['Nushell', 'Docker']
source:                # optional, can be left empty
---

Your Markdown content here.
```

Posts can also be `.mdx` if you ever want to embed Astro components inside them.
Code blocks get syntax highlighting at build time (Shiki, github-light theme) —
the output is still static HTML with inline colors, no JS.

## Development

Requires Node.js 22.12+ and pnpm.

```bash
pnpm install        # install dependencies
pnpm dev            # local dev server with hot reload
pnpm check          # type-check .astro files and validate content schemas
pnpm build          # build into dist/
pnpm preview        # serve the built dist/ locally
```

Note: Astro caches the content layer in `node_modules/.astro/data-store.json`. If a deleted post
keeps showing up in builds, remove that file and rebuild.

## Project Structure

```text
.
├── .github/workflows/deploy.yml  # GitHub Actions -> GitHub Pages
├── public/
│   ├── assets/                   # css + images, copied verbatim into dist/
│   └── CNAME                     # custom domain, must live in the deployed root
├── src/
│   ├── components/               # BaseHead, Header, Footer
│   ├── content/
│   │   ├── blog/                 # blog posts (Markdown/MDX)
│   │   └── til/                  # today I learned posts (Markdown/MDX)
│   ├── content.config.ts         # collection schemas (Zod)
│   ├── layouts/                  # BaseLayout, PostLayout
│   ├── pages/                    # /, /blog, /til, 404, rss.xml, robots.txt
│   └── styles/global.css
├── resume.tex
├── astro.config.mjs
└── package.json
```

## Hosting

Deployed to **GitHub Pages** via GitHub Actions (`.github/workflows/deploy.yml`). On every push to
`main`, the workflow installs deps, runs `pnpm build`, and publishes `dist/`. The Pages source must
be set to **GitHub Actions** in the repo settings, and the custom domain is served from
`public/CNAME` (copied into the deployed root by Astro).

## License

This project is open-source. Feel free to scrape the content or use the structure as inspiration for your own site.
