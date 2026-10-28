import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const viPath = path.resolve(__dirname, "../src/i18n/locales/vi.json");
const enPath = path.resolve(__dirname, "../src/i18n/locales/en.json");

const vi = JSON.parse(fs.readFileSync(viPath, "utf-8"));
const en = JSON.parse(fs.readFileSync(enPath, "utf-8"));

function getKeys(obj, prefix = "") {
  let keys = [];
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      keys = keys.concat(getKeys(v, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

const viKeys = new Set(getKeys(vi));
const enKeys = new Set(getKeys(en));

const missingInEn = [...viKeys].filter((k) => !enKeys.has(k));
const missingInVi = [...enKeys].filter((k) => !viKeys.has(k));

let hasError = false;

if (missingInEn.length > 0) {
  console.error("❌ Keys present in vi.json but missing in en.json:");
  missingInEn.forEach((k) => console.error(`  - ${k}`));
  hasError = true;
}

if (missingInVi.length > 0) {
  console.error("❌ Keys present in en.json but missing in vi.json:");
  missingInVi.forEach((k) => console.error(`  - ${k}`));
  hasError = true;
}

if (hasError) {
  process.exit(1);
} else {
  console.log(`✅ i18n key parity check passed! Total keys matched: ${viKeys.size}`);
}
