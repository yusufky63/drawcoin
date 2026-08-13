import { File } from "node:buffer";
import { readFile } from "node:fs/promises";
import path from "node:path";

const PINATA_UPLOAD_URL = "https://api.pinata.cloud/pinning/pinFileToIPFS";
const PINATA_GATEWAY_URL = "https://gateway.pinata.cloud/ipfs";

const badgeAssets = [
  "first-stroke.svg",
  "collector.svg",
  "curator.svg",
  "creator-journey.svg",
  "ecosystem-builder.svg",
  "base-regular.svg",
];

const jwt = process.env.PINATA_JWT?.trim();
if (!jwt) {
  throw new Error("PINATA_JWT is required.");
}

const contractsDir = path.resolve(import.meta.dirname, "..");
const projectDir = path.resolve(contractsDir, "..");

async function pinDirectory(files, name) {
  const form = new FormData();

  for (const file of files) {
    form.append(
      "file",
      new File([file.contents], path.basename(file.name), { type: file.type }),
      file.name,
    );
  }

  form.append("pinataMetadata", JSON.stringify({ name }));
  form.append("pinataOptions", JSON.stringify({ cidVersion: 1, wrapWithDirectory: false }));

  const response = await fetch(PINATA_UPLOAD_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}` },
    body: form,
    signal: AbortSignal.timeout(45_000),
  });

  if (!response.ok) {
    const detail = (await response.text()).replace(/[\r\n]+/g, " ").slice(0, 300);
    throw new Error(
      `Pinata upload failed with HTTP ${response.status}${detail ? `: ${detail}` : "."}`,
    );
  }

  const payload = await response.json();
  if (typeof payload.IpfsHash !== "string" || payload.IpfsHash.length === 0) {
    throw new Error("Pinata did not return an IPFS CID.");
  }

  return payload.IpfsHash;
}

async function verifyUrl(url, expectedType) {
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) {
    throw new Error(`IPFS verification failed with HTTP ${response.status}: ${url}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes(expectedType)) {
    throw new Error(`Unexpected IPFS content type ${contentType || "unknown"}: ${url}`);
  }
}

const artworkFiles = await Promise.all(
  badgeAssets.map(async (name) => ({
    name: `assets/${name}`,
    type: "image/svg+xml",
    contents: await readFile(path.join(projectDir, "public", "badges", name)),
  })),
);

const artworkCid = await pinDirectory(artworkFiles, "DrawCoin mission badge artwork v1");

const metadataFiles = await Promise.all(
  badgeAssets.map(async (assetName, index) => {
    const tokenId = index + 1;
    const metadataPath = path.join(contractsDir, "metadata", `${tokenId}.json`);
    const metadata = JSON.parse(await readFile(metadataPath, "utf8"));
    metadata.image = `ipfs://${artworkCid}/${assetName}`;

    return {
      name: `metadata/${tokenId}.json`,
      type: "application/json",
      contents: Buffer.from(`${JSON.stringify(metadata, null, 2)}\n`),
    };
  }),
);

const metadataCid = await pinDirectory(metadataFiles, "DrawCoin mission badge metadata v1");

await Promise.all([
  verifyUrl(`${PINATA_GATEWAY_URL}/${artworkCid}/${badgeAssets[0]}`, "image/svg+xml"),
  verifyUrl(`${PINATA_GATEWAY_URL}/${metadataCid}/1.json`, "application/json"),
]);

process.stdout.write(
  `${JSON.stringify(
    {
      artworkCid,
      metadataCid,
      contractBaseUri: `ipfs://${metadataCid}/`,
      gatewayBaseUrl: `${PINATA_GATEWAY_URL}/${metadataCid}/`,
    },
    null,
    2,
  )}\n`,
);
