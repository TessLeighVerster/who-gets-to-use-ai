// Tiny static file server for the Puppeteer tools (no dependencies). ES modules cannot load over file://,
// so the tools serve the repo root over HTTP the way GitHub Pages does.
// Usage as a CLI: node tools/serve.js [root] [port]   ·  as a module: const { serve } = require("./serve"); const { url, close } = await serve(root);
const http = require("http"), fs = require("fs"), path = require("path");
const TYPES = { ".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".mjs":"text/javascript; charset=utf-8", ".css":"text/css; charset=utf-8", ".json":"application/json", ".png":"image/png", ".svg":"image/svg+xml", ".webp":"image/webp", ".webmanifest":"application/manifest+json", ".txt":"text/plain; charset=utf-8", ".csv":"text/csv; charset=utf-8", ".md":"text/markdown; charset=utf-8" };
function serve(root, port = 0){
  root = path.resolve(root || ".");
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p.endsWith("/")) p += "index.html";
    const file = path.join(root, p);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()){ res.writeHead(404); res.end("not found"); return; }
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream", "cache-control": "no-store" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(resolve => server.listen(port, "127.0.0.1", () => resolve({ url: `http://127.0.0.1:${server.address().port}`, close: () => server.close() })));
}
module.exports = { serve };
if (require.main === module) serve(process.argv[2], +(process.argv[3] || 8787)).then(s => console.log("serving at " + s.url));
