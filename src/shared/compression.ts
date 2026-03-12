import pako from 'pako';

export function compressSDP(sdp: string): string {
  const json = JSON.stringify({ sdp });
  const bytes = new TextEncoder().encode(json);
  const compressed = pako.deflate(bytes);
  return base64urlEncode(compressed);
}

export function decompressSDP(encoded: string): string {
  const compressed = base64urlDecode(encoded);
  const bytes = pako.inflate(compressed);
  const json = new TextDecoder().decode(bytes);
  const parsed = JSON.parse(json) as { sdp: string };
  return parsed.sdp;
}

function base64urlEncode(data: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function base64urlDecode(str: string): Uint8Array {
  const padded = str + '='.repeat((4 - (str.length % 4)) % 4);
  const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
