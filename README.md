# Bhargav Deshpande - Personal Portfolio

This is the source code for my personal portfolio website, hosted at [penzulo.dev](https://penzulo.dev).

## About the Site

This website is built with a focus on simplicity, performance, and accessibility. It deliberately avoids heavy front-end frameworks and relies instead on:

- **Plain, semantic HTML**: Friendly to browsers, screen readers, web crawlers, and LLMs alike.
- **Vanilla CSS**: Kept minimal for fast load times and straightforward styling.
- **No JavaScript**: The site relies entirely on HTML and CSS, ensuring maximum compatibility and security without any client-side execution overhead.

## Project Structure

```text
.
├── CNAME                   # Custom domain configuration for GitHub Pages
├── index.html              # The main document
├── README.md               # This file
└── assets/
    ├── css/
    │   └── style.css       # Main stylesheet
    └── images/
        ├── favicon.svg     # Scalable vector favicon
        ├── og.png          # OpenGraph image for link previews
        └── og.svg          # Vector source/alternative for the OG image
```

## Hosting

The site is statically hosted on **GitHub Pages**. Any changes pushed to the default branch are automatically deployed.

## Local Development

Since this is a static site without a build step, you can serve it locally using any static file server:

```bash
# Using Python
python3 -m http.server

# Or using Node.js (if `serve` is installed)
npx serve .
```

Then visit `http://localhost:8000` (or the port specified by your server) in your browser.

## License

This project is open-source. Feel free to scrape the content or use the structure as inspiration for your own site.
