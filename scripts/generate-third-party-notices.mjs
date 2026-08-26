import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const lock = JSON.parse(readFileSync(join(root, "package-lock.json"), "utf8"));
const groups = new Map();
const withoutText = [];

for (const [packagePath, locked] of Object.entries(lock.packages ?? {})) {
  if (!packagePath.includes("node_modules/")) continue;
  const directory = join(root, packagePath);
  const manifestPath = join(directory, "package.json");
  if (!existsSync(manifestPath)) continue;

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const name = manifest.name ?? packagePath.split("node_modules/").at(-1);
  const version = manifest.version ?? locked.version ?? "unknown";
  const license = manifest.license ?? locked.license ?? "Not declared";
  const repository =
    typeof manifest.repository === "string"
      ? manifest.repository
      : manifest.repository?.url ?? manifest.homepage ?? "";
  const files = readdirSync(directory).filter((file) =>
    /^(licen[cs]e|copying|notice)(\..*)?$/i.test(file),
  );
  const text = files
    .map((file) => readFileSync(join(directory, file), "utf8").trim())
    .filter(Boolean)
    .join("\n\n");
  const entry = { name, version, license, repository };

  if (!text) {
    withoutText.push(entry);
    continue;
  }
  const key = createHash("sha256").update(text).digest("hex");
  const group = groups.get(key) ?? { text, packages: [] };
  group.packages.push(entry);
  groups.set(key, group);
}

const formatPackage = ({ name, version, license, repository }) =>
  `${name}@${version} — ${license}${repository ? ` — ${repository}` : ""}`;

const output = [
  "KLIMB THIRD-PARTY SOFTWARE NOTICES",
  "==================================",
  "",
  "Klimb includes third-party software. These notices are provided to satisfy",
  "the applicable attribution and license-notice requirements. Klimb does not",
  "claim ownership of the third-party components listed below.",
  "",
  ...[...groups.values()]
    .sort((a, b) => a.packages[0].name.localeCompare(b.packages[0].name))
    .flatMap((group) => [
      "------------------------------------------------------------------------",
      ...group.packages.sort((a, b) => a.name.localeCompare(b.name)).map(formatPackage),
      "------------------------------------------------------------------------",
      group.text,
      "",
    ]),
  ...(withoutText.length
    ? [
        "PACKAGES WHOSE INSTALLED DISTRIBUTION DID NOT INCLUDE A LICENSE FILE",
        "------------------------------------------------------------------------",
        ...withoutText.sort((a, b) => a.name.localeCompare(b.name)).map(formatPackage),
        "",
      ]
    : []),
].join("\n");

writeFileSync(join(root, "public", "third-party-notices.txt"), output);
console.log(`Generated notices for ${[...groups.values()].reduce((n, g) => n + g.packages.length, 0) + withoutText.length} installed packages.`);
