import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// Infra de teste (issue #8). Reaproveita o alias "@" do tsconfig via
// vite-tsconfig-paths (já dependência do projeto). Rodar: `npm test`.
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
