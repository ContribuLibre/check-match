// Static file server for local preview. The app itself needs no server:
// everything under www/ is plain static files served as-is.
const root = new URL("../www/", import.meta.url);
const port = Number(process.env.PORT) || 8080;

const types = {
	html: "text/html; charset=utf-8",
	js: "text/javascript; charset=utf-8",
	css: "text/css; charset=utf-8",
	json: "application/json; charset=utf-8",
	svg: "image/svg+xml",
};

Bun.serve({
	port,
	async fetch(request) {
		let path = new URL(request.url).pathname;
		if (path.endsWith("/")) path += "index.html";
		// Keep the resolution inside www/ whatever the request looks like.
		const target = new URL("." + path, root);
		if (!target.href.startsWith(root.href)) return new Response("Forbidden", {status: 403});

		const file = Bun.file(target);
		if (!(await file.exists())) return new Response("Not found", {status: 404});
		const extension = target.pathname.split(".").pop();
		return new Response(file, {headers: {"content-type": types[extension] || file.type}});
	},
});

console.log(`check-match served on http://localhost:${port}/`);
