#!/usr/bin/env node
// Renders tools/og-template.html to /og.png (1200×630) with the Puppeteer used by the other tools.
//   NODE_PATH=<dir with puppeteer> node tools/render-og.mjs
// No WebGL involved: the template is plain HTML and the tower illustration is the inline #introArt SVG lifted from
// index.html (so the share card and the intro modal always match), so the output is deterministic.
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer");
const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, "..", "og.png");
const html = fs.readFileSync(path.join(here, "..", "index.html"), "utf8");
const svg = (html.match(/<svg id="introArt"[\s\S]*?<\/svg>/) || [])[0];
if (!svg) throw new Error("index.html has no #introArt SVG");
const browser = await puppeteer.launch({ headless: true, protocolTimeout: 600000, args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
await page.goto("file://" + path.join(here, "og-template.html"), { waitUntil: "networkidle0" });
await page.evaluate(svg => { document.getElementById("art").innerHTML = svg; }, svg);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: out, type: "png", clip: { x: 0, y: 0, width: 1200, height: 630 } });
await browser.close();
console.log("wrote " + out);
