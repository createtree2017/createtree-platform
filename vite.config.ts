import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";
// import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal"; remove this line

// 빌드 시 sw.js의 __SW_BUILD_VERSION__을 현재 날짜시간으로 교체
function swVersionPlugin(): Plugin {
  return {
    name: 'sw-version-inject',
    writeBundle() {
      const swPath = path.resolve(import.meta.dirname, 'dist/public/sw.js');
      if (fs.existsSync(swPath)) {
        let content = fs.readFileSync(swPath, 'utf-8');
        const now = new Date();
        const version = `v${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
        content = content.replace(/__SW_BUILD_VERSION__/g, version);
        fs.writeFileSync(swPath, content);
        console.log(`\n✅ [SW Version] ${version} 주입 완료\n`);
      }
    }
  };
}

export default defineConfig({
  plugins: [
    react(),
    swVersionPlugin(),
    ...(process.env.REPL_ID
      ? [
        await import("@replit/vite-plugin-runtime-error-modal").then((m) =>
          m.default(),
        ),
        await import("@replit/vite-plugin-cartographer").then((m) =>
          m.cartographer(),
        ),
      ]
      : []),
  ],
  resolve: {
    alias: {
      "@db": path.resolve(import.meta.dirname, "db"),
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
});
