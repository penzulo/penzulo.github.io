type Entry = { data: { description?: string }; body?: string };

// Listings, meta tags, and the RSS feed all want a description. TIL posts
// don't always author one, so fall back to the first paragraph of the body.
export function entryDescription(entry: Entry): string {
	const explicit = entry.data.description;
	if (explicit) return explicit;

	const body = (entry.body ?? '')
		.replace(/^\s*#\s.*$/m, '') // drop the leading H1 title
		.trim();

	const paragraph = body
		.split(/\n{2,}/)[0]
		.replace(/[\`*_#>|]/g, '') // crude markdown strip
		.replace(/\s+/g, ' ')
		.trim();

	if (!paragraph) return 'A note from my Today I Learned log.';
	return paragraph.length > 200 ? `${paragraph.slice(0, 200).trimEnd()}…` : paragraph;
}
