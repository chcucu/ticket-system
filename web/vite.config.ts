import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// 开发代理：前端 5173 把 /api 和 /uploads 转发到后端 3000
export default defineConfig({
  plugins: [vue()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      "/uploads": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
