import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  ...nextVitals,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "node_modules/**",
    "generated/**",
    "launcher-build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // Next 16 düz yapılandırmasının yeni kuralları mevcut effect kodunu işaretler.
      // Bu sürüm o davranışı değiştirmez.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
    },
  },
]);
