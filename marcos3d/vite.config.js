import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// os GLB publicados (dashboard/marcos) ficam servidos na raiz, para a prévia comparar com fonte=glb
export default defineConfig({
  plugins: [react()],
  publicDir: "../dashboard/marcos",
  server: { strictPort: true },
});
