import { defineConfig, globalIgnores } from "eslint/config";

/** Example app: ESLint disabled — all paths ignored. */
export default defineConfig([globalIgnores(["**/*"])]);
