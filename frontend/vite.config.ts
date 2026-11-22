import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import react from "@vitejs/plugin-react";
import { defineConfig, Plugin } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Plugin de desarrollo para persistir el mapa 3D directamente en disco al editar en tiempo real.
 */
function devMapSavePlugin(): Plugin {
  return {
    name: "vite-plugin-dev-map-save",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.method === "POST" && req.url === "/__dev/save-map") {
          let body = "";
          req.on("data", (chunk: Buffer) => {
            body += chunk.toString();
          });
          req.on("end", () => {
            try {
              const data = JSON.parse(body);
              const mapDir = path.resolve(__dirname, "./public/maps");
              if (!fs.existsSync(mapDir)) {
                fs.mkdirSync(mapDir, { recursive: true });
              }
              const mapPath = path.resolve(mapDir, "pantano-map.json");
              fs.writeFileSync(mapPath, JSON.stringify(data, null, 2), "utf8");
              console.log("[INFO] Archivo de mapa actualizado en disco: pantano-map.json");

              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ success: true, message: "Mapa guardado correctamente" }));
            } catch (err: unknown) {
              const errorMsg = err instanceof Error ? err.message : "Error desconocido";
              console.error("[ERROR] Error al guardar mapa en disco:", errorMsg);
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ success: false, error: errorMsg }));
            }
          });
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    command === "serve" ? devMapSavePlugin() : null,
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
}));
