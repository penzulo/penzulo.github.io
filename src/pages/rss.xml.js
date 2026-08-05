import { getCollection } from 'astro:content';
import rss from '@astrojs/rss';
import { SITE_DESCRIPTION, SITE_TITLE } from '../consts';
import { entryDescription } from '../lib/utils';

export async function GET(context) {
	const blog = await getCollection('blog');
	const til = (await getCollection('til')).filter((post) => post.data.published);

	const items = [
		...blog.map((post) => ({
			title: post.data.title,
			description: entryDescription(post),
			pubDate: post.data.pubDate,
			link: `/blog/${post.id}/`,
		})),
		...til.map((post) => ({
			title: post.data.title,
			description: entryDescription(post),
			pubDate: post.data.pubDate,
			link: `/til/${post.id}/`,
		})),
	].sort((a, b) => b.pubDate.valueOf() - a.pubDate.valueOf());

	return rss({
		title: SITE_TITLE,
		description: SITE_DESCRIPTION,
		site: context.site,
		items,
	});
}
