import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";

/** @param {string} phase */
export default function nextConfig(phase) {
  return {
    // next dev 与 next build 不再共享缓存，避免运行中构建导致开发页面持续 500。
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next",
    transpilePackages: ["@devscope/api", "@devscope/shared"],
  };
}
