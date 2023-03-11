const fs = require("fs-extra");
const HTMLMinifier = require("html-minifier");
const { join } = require("path");

const basePath = join(__dirname, "..", "build", "frontend");
const htmlFile = fs.readFileSync(join(basePath, "src", "frontend", "index.html"), "utf-8");
fs.rm(join(basePath, "src"), { recursive: true });

const unminifiedCorrected = htmlFile
  .replace(
    `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src http://localhost:*; connect-src ws://localhost:*">`,
    `<meta http-equiv="Content-Security-Policy" content="default-src 'self'">`
  )
  .replaceAll("../../", "./");

unminifiedCorrected;

const minifierOptions = {
  preserveLineBreaks: false,
  collapseWhitespace: true,
  collapseInlineTagWhitespace: true,
  minifyURLs: true,
  minifyJS: true,
  minifyCSS: true,
  removeComments: true,
  removeAttributeQuotes: true,
  removeEmptyAttributes: true,
  removeEmptyElements: true,
  removeRedundantAttributes: true,
  removeScriptTypeAttributes: true,
  removeStyleLinkTypeAttributes: true,
  useShortDoctype: true,
  quoteCharacter: "'",
};

const minified = HTMLMinifier.minify(unminifiedCorrected, minifierOptions);
fs.writeFileSync(join(basePath, "index.html"), minified);
