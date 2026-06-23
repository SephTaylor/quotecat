module.exports = function(eleventyConfig) {
  // Ignore node_modules and other non-content files
  eleventyConfig.ignores.add("node_modules/**");
  eleventyConfig.ignores.add("index-compressed.html");

  // Copy static assets directly to output
  eleventyConfig.addPassthroughCopy("*.png");
  eleventyConfig.addPassthroughCopy("*.ico");
  eleventyConfig.addPassthroughCopy("*.jpg");
  eleventyConfig.addPassthroughCopy("*.jpeg");
  eleventyConfig.addPassthroughCopy("*.svg");
  eleventyConfig.addPassthroughCopy("*.pdf");
  eleventyConfig.addPassthroughCopy("*.css");
  eleventyConfig.addPassthroughCopy("*.js");
  // Discovery files (robots.txt, llms.txt, sitemap.xml). Without these
  // passthrough rules Eleventy never copies the files into _site/, which
  // means Netlify serves 404 for /robots.txt /sitemap.xml /llms.txt even
  // though the source files exist in the repo. Discovered 2026-06-23
  // when crawler-side audits reported missing discovery files we thought
  // were live for weeks. AI crawlers depend on llms.txt and sitemap.xml
  // for discoverability — this is high-leverage.
  eleventyConfig.addPassthroughCopy("*.txt");
  eleventyConfig.addPassthroughCopy("*.xml");
  eleventyConfig.addPassthroughCopy("assets");
  eleventyConfig.addPassthroughCopy("images");
  eleventyConfig.addPassthroughCopy("downloads");
  eleventyConfig.addPassthroughCopy("netlify");
  eleventyConfig.addPassthroughCopy("resources/*.js");
  eleventyConfig.addPassthroughCopy("resources/*.css");
  eleventyConfig.addPassthroughCopy("resources/*.png");
  eleventyConfig.addPassthroughCopy(".well-known");
  eleventyConfig.addPassthroughCopy("_headers");

  return {
    dir: {
      input: ".",
      output: "_site",
      includes: "_includes"
    },
    // Process HTML files with Liquid templating
    htmlTemplateEngine: "liquid"
  };
};
