import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const folder = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFile(resolve(folder, name), "utf8");
const styles = await Promise.all(
  [
    "mockup.css",
    "lucian-tokens.css",
    "lucian-039.css",
    "lucian-070.css",
    "lucian-273.css",
    "lucian-adapter.css",
    "operations.css",
  ].map(read),
);
const ports = await Promise.all(
  ["lucian-039.js", "lucian-070.js", "lucian-273.js"].map(read),
);
const main = await read("mockup.js");
const html =
  '<!doctype html>\n<html lang="ko" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="robots" content="noindex,nofollow"><title>LG전자 K-뉴딜 아카데미 · Lucian 화면 목업</title><style>' +
  styles.join("\n") +
  '</style></head><body><div id="app"></div><div id="modal-root"></div><script>' +
  ports.join("\n") +
  "</script><script>" +
  main +
  "</script></body></html>";
// index-original.html은 기존 레이아웃 비교용 보존 파일이다.
console.log("자체 포함 목업 HTML 생성 완료");

const mint = html
  .replace('data-theme="light"', 'data-theme="light" data-visual="reference"')
  .replace(
    "</style>",
    "\n" +
      (await read("mint-reference.css")) +
      "\n" +
      (await read("layout.css")) + "\n" + (await read("reference-portal.css")) +
      "</style>",
  );
await writeFile(resolve(folder, "index-mint.html"), mint);
await writeFile(resolve(folder, "index.html"), mint);
console.log("참고 이미지 반영 비교 목업 생성 완료");
