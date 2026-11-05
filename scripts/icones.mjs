// Génère app/icons/icon-192.png et icon-512.png (livre ouvert blanc sur fond indigo).
// Usage : node scripts/icones.mjs
import { writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const bloc = (type, data) => {
  const t = Buffer.from(type);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const c = Buffer.alloc(4);
  c.writeUInt32BE(crc(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, c]);
};

function icone(taille) {
  const fond = [79, 70, 229];
  const blanc = [255, 255, 255];
  const trait = [199, 196, 255];
  const lignes = [];
  for (let y = 0; y < taille; y++) {
    const ligne = [0];
    for (let x = 0; x < taille; x++) {
      const u = x / taille;
      const v = y / taille;
      let c = fond;
      // deux pages légèrement inclinées, de part et d'autre d'une reliure
      const gauche = u > 0.18 && u < 0.49 && v > 0.3 + (0.49 - u) * 0.12 && v < 0.74 - (0.49 - u) * 0.05;
      const droite = u > 0.51 && u < 0.82 && v > 0.3 + (u - 0.51) * 0.12 && v < 0.74 - (u - 0.51) * 0.05;
      if (gauche || droite) {
        c = blanc;
        // lignes de texte
        const dans = gauche ? u > 0.23 && u < 0.45 : u > 0.55 && u < 0.77;
        if (dans && [0.42, 0.5, 0.58].some((l) => Math.abs(v - l) < 0.012)) c = trait;
      }
      ligne.push(...c);
    }
    lignes.push(Buffer.from(ligne));
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(taille, 0);
  ihdr.writeUInt32BE(taille, 4);
  ihdr[8] = 8; // profondeur
  ihdr[9] = 2; // RVB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloc("IHDR", ihdr),
    bloc("IDAT", deflateSync(Buffer.concat(lignes))),
    bloc("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync(new URL("../app/icons/", import.meta.url), { recursive: true });
for (const t of [192, 512]) writeFileSync(new URL(`../app/icons/icon-${t}.png`, import.meta.url), icone(t));
console.log("Icônes générées.");
