import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

export default defineConfig({
  plugins: [react(), serveReactPublicAssets(), copyReactPublicAssets()],
  publicDir: false,
  server: {
    host: "127.0.0.1",
    port: 4173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:4180",
        changeOrigin: true,
      },
      "/auth/callback/google": {
        target: "http://127.0.0.1:4180",
        changeOrigin: true,
      },
      "/auth/callback/discord": {
        target: "http://127.0.0.1:4180",
        changeOrigin: true,
      },
      "/auth/callback/facebook": {
        target: "http://127.0.0.1:4180",
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});

function serveReactPublicAssets() {
  return {
    name: "serve-react-public-assets",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const pathname = decodeURIComponent(new URL(request.url || "/", "http://localhost").pathname);
        if (pathname === "/app-data.json") {
          return serveFile(response, "web/app-data.json");
        }
        if (pathname.startsWith("/assets/")) {
          return serveFile(response, path.join("web", pathname));
        }
        return next();
      });
    },
  };
}

function copyReactPublicAssets() {
  return {
    name: "copy-react-public-assets",
    apply: "build",
    async closeBundle() {
      await fs.mkdir("dist", { recursive: true });
      await copyIfExists("web/app-data.json", "dist/app-data.json");
      await copyDirectoryIfExists("web/assets", "dist/assets");
      await copyIfExists("worker/index.js", "dist/server/index.js");
    },
  };
}

async function copyIfExists(from, to) {
  try {
    await fs.mkdir(path.dirname(to), { recursive: true });
    await fs.copyFile(from, to);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
}

async function copyDirectoryIfExists(from, to) {
  try {
    await fs.mkdir(path.dirname(to), { recursive: true });
    await fs.cp(from, to, { recursive: true, force: true });
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
}

async function serveFile(response, relativePath) {
  const root = process.cwd();
  const absolutePath = path.resolve(root, relativePath);
  const webRoot = path.resolve(root, "web");
  if (!absolutePath.startsWith(webRoot) || !fsSync.existsSync(absolutePath) || !fsSync.statSync(absolutePath).isFile()) {
    response.statusCode = 404;
    response.end("Not found");
    return;
  }
  response.setHeader("Content-Type", contentType(absolutePath));
  response.end(await fs.readFile(absolutePath));
}

function contentType(filePath) {
  if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
  if (filePath.endsWith(".webp")) return "image/webp";
  if (filePath.endsWith(".png")) return "image/png";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) return "image/jpeg";
  return "application/octet-stream";
}
