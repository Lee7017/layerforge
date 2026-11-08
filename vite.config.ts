import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Actions 为项目页自动传入 /<repository>/，本地开发仍使用 /。
export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_PAGES_BASE || '/',
});
