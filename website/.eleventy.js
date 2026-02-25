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
  eleventyConfig.addPassthroughCopy("assets");
  eleventyConfig.addPassthroughCopy("images");
  eleventyConfig.addPassthroughCopy("downloads");
  eleventyConfig.addPassthroughCopy("netlify");
  eleventyConfig.addPassthroughCopy("resources/*.js");
  eleventyConfig.addPassthroughCopy("resources/*.css");
  eleventyConfig.addPassthroughCopy("resources/*.png");

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
