export function uint8ArrayToHexString(digest: Uint8Array) {
    return [...digest].reduce((p, n) => p + n.toString(16).padStart(2, "0"), "")
}

export function hexStringToArrayBuffer(hex: string): ArrayBuffer {
    return new Uint8Array(hex.match(/../g)!.map(h => parseInt(h, 16))).buffer
}