const target = '/blog/watchtower-throughput/';

const html = `<!doctype html>
<html lang="en">
	<head>
		<meta charset="utf-8" />
		<meta http-equiv="refresh" content="0; url=${target}" />
		<link rel="canonical" href="https://penzulo.dev${target}" />
		<title>Redirecting…</title>
	</head>
	<body>
		<p>This post has moved to <a href="${target}">${target}</a>.</p>
	</body>
</html>`;

export function GET() {
	return new Response(html, {
		headers: { 'content-type': 'text/html; charset=utf-8' },
	});
}
