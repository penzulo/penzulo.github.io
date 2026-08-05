import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";

// https://astro.build/config
export default defineConfig({
	site: "https://penzulo.dev",
	build: {
		// Clean URLs: /blog/watchtower-throughput/ instead of /blog/watchtower-throughput.html
		format: "directory",
	},
	markdown: {
		shikiConfig: {
			// Light theme to match the site; spans carry inline colors, so the
			// markup stays plain HTML (no JS) and lynx still reads the text.
			theme: "dark-plus",
			wrap: false,
		},
	},
	integrations: [mdx(), sitemap()],
});
