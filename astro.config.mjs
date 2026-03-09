import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';

export default defineConfig({
  site: 'https://articles.market-watch.xyz',
  integrations: [mdx()],
  output: 'static',
  build: {
    format: 'directory',       // /daily/20260226/index.html
  },
  markdown: {
    // Shiki built-in syntax highlighting (replaces Prism.js CDN)
    shikiConfig: {
      theme: 'github-dark',
      langs: ['sql', 'python', 'go', 'hcl', 'yaml', 'json', 'jinja', 'bash', 'markdown', 'javascript', 'typescript', 'html', 'css', 'toml', 'dockerfile', 'graphql'],
      wrap: true,
    },
  },
});
