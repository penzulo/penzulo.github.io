import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const blog = defineCollection({
	// Load Markdown and MDX files in the `src/content/blog/` directory.
	loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
	// Type-check frontmatter using a schema
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			description: z.string(),
			// Transform string to Date object
			pubDate: z.coerce.date(),
			updatedDate: z.coerce.date().optional(),
			heroImage: z.optional(image()),
			tags: z.array(z.string()).default([]),
		}),
});

const til = defineCollection({
	// Load Markdown and MDX files in the `src/content/til/` directory.
	loader: glob({ base: './src/content/til', pattern: '**/*.{md,mdx}' }),
	// Type-check frontmatter using a schema
	schema: z
		.object({
			title: z.string(),
			description: z.string().optional(),
			// Accept both `date` and `pubDate`; `date` is the preferred form.
			date: z.coerce.date(),
			pubDate: z.coerce.date().optional(),
			updatedDate: z.coerce.date().optional(),
			// Drafts are hidden from listings, the home page, and the RSS feed.
			published: z.boolean().default(true),
			// Optional image, e.g. a screenshot. Relative to /assets/images/.
			image: z.string().optional(),
			tags: z.array(z.string()).default([]),
			source: z.string().nullable().optional(),
		})
		.transform(({ date, pubDate, ...rest }) => ({
			...rest,
			pubDate: pubDate ?? date,
		})),
});

export const collections = { blog, til };
