import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// torajim.github.io에는 다른 서비스가 있으므로 프로젝트 사이트 경로(/showmethego3/)로 배포한다.
export default defineConfig({
  base: "/showmethego3/",
  plugins: [react()],
  server: { fs: { allow: [".."] } },
});
