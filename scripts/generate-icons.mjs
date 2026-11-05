import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { readFile, writeFile } from "node:fs/promises";

// Next.js já inclui sharp para imagens: reutilizamos essa dependência de build,
// sem adicionar um segundo renderizador nem gerar imagens durante requisições.
const require = createRequire(import.meta.resolve("next/package.json"));
const sharp = require("sharp");
const svg = await readFile(new URL("../src/app/icon.svg", import.meta.url));
for (const [size, file] of [[180, "src/app/apple-icon.png"], [192, "public/icons/icon-192.png"], [512, "public/icons/icon-512.png"]]) {
  await sharp(svg).resize(size, size).flatten({ background: "#163f2d" }).png().toFile(fileURLToPath(new URL(`../${file}`, import.meta.url)));
}

// ICO com PNGs de 16 e 32 px para navegadores que procuram /favicon.ico.
const sizes = [16, 32];
const images = await Promise.all(sizes.map((size) => sharp(svg).resize(size, size).png().toBuffer()));
const header = Buffer.alloc(6 + 16 * sizes.length);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
for (let index = 0; index < sizes.length; index++) {
  const entry = 6 + 16 * index;
  header[entry] = sizes[index];
  header[entry + 1] = sizes[index];
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(images[index].length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += images[index].length;
}
await writeFile(new URL("../src/app/favicon.ico", import.meta.url), Buffer.concat([header, ...images]));
console.info("Ícones SVG, Apple, PNG e favicon preparados.");
