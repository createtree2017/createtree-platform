import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { type Server } from "http";

// log 함수는 Vite 의존성 없이 독립적으로 동작
export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

// Vite 관련 코드는 개발 환경에서만 동적으로 로드 (vite는 devDependency)
export async function setupVite(app: Express, server: Server) {
  // 동적 import로 vite 패키지 로드 (프로덕션에서는 이 함수가 호출되지 않음)
  // 경로를 런타임에 구성하여 esbuild가 번들에 포함하지 못하게 함
  const vitePkg = "vite";
  const viteModule = await import(/* @vite-ignore */ vitePkg);
  const createViteServer = viteModule.createServer;
  const createLogger = viteModule.createLogger;
  const configPath = path.resolve(import.meta.dirname, "..", "vite.config.ts");
  const viteConfig = (await import(/* @vite-ignore */ configPath)).default;
  const nanoidPkg = "nanoid";
  const { nanoid } = await import(/* @vite-ignore */ nanoidPkg);

  const viteLogger = createLogger();

  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg: string, options?: any) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
