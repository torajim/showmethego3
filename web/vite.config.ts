import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// torajim.github.io에는 다른 서비스가 있으므로 프로젝트 사이트 경로(/showmethego3/)로 배포한다.
export default defineConfig({
  base: "/showmethego3/",
  plugins: [react()],
  server: { fs: { allow: [".."] } },
  // 학교 데이터(schools.json)는 학교 탭을 열 때만 따로 불러오는 큰 조각이라 경고 기준을 올린다.
  build: { chunkSizeWarningLimit: 1200 },
});
