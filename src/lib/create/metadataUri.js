/**
 * The first-party creation flow owns the metadata upload and deliberately
 * skips the SDK's network fetch. Keep that shortcut fail-closed to immutable
 * IPFS metadata URIs at the transaction boundary.
 *
 * @param {unknown} uri
 * @returns {string}
 */
export function assertIpfsMetadataURI(uri) {
  if (
    typeof uri !== "string" ||
    uri.trim() !== uri ||
    !/^ipfs:\/\/[a-zA-Z0-9]+(?:\/[^\s?#]*)?$/.test(uri)
  ) {
    throw new Error("Metadata URI must be a valid ipfs:// URI");
  }

  return uri;
}
