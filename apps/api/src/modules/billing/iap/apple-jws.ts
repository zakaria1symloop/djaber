// App Store signed payloads (JWS, ES256) carry their certificate chain in the `x5c` header: leaf → intermediate → root.
// A payload is trusted when every certificate is signed by the next one, the root is "Apple Root CA - G3" (pinned by its
// SHA-256 fingerprint, APPLE_ROOT_CA_SHA256), each certificate is valid at the signing date, and the JWS verifies with the
// leaf key. 05-integrations §5 ("verify the signed transaction (x5c chain)").
import { X509Certificate, createPublicKey } from 'node:crypto';
import { compactVerify, decodeProtectedHeader } from 'jose';

const pemOf = (b64der: string) => `-----BEGIN CERTIFICATE-----\n${b64der.replace(/(.{64})/g, '$1\n')}\n-----END CERTIFICATE-----\n`;
const fp = (s: string) => s.replace(/[^0-9a-f]/gi, '').toUpperCase();

/** Verified payload, or null (any failure: malformed, wrong chain, wrong root, expired cert, bad signature). */
export const verifyAppleJws = async (jws: string, rootSha256: string, at: Date = new Date()): Promise<Record<string, unknown> | null> => {
  try {
    const header = decodeProtectedHeader(jws);
    if (header.alg !== 'ES256' || !Array.isArray(header.x5c) || header.x5c.length < 2) return null;
    const chain = header.x5c.map((c) => new X509Certificate(pemOf(c)));
    for (let i = 0; i < chain.length; i++) {
      const cert = chain[i]!;
      if (new Date(cert.validFrom) > at || new Date(cert.validTo) < at) return null;
      const issuer = chain[i + 1] ?? cert; // the root is self-signed
      if (!cert.verify(issuer.publicKey)) return null;
      if (i + 1 < chain.length && !cert.checkIssued(issuer)) return null;
    }
    if (fp(chain[chain.length - 1]!.fingerprint256) !== fp(rootSha256)) return null;
    const key = createPublicKey(chain[0]!.publicKey.export({ type: 'spki', format: 'pem' }));
    const { payload } = await compactVerify(jws, key);
    return JSON.parse(new TextDecoder().decode(payload)) as Record<string, unknown>;
  } catch {
    return null;
  }
};

/** Payload of a JWS without any check (logging / routing only, never for a decision). */
export const peekJws = (jws: string): Record<string, unknown> | null => {
  try {
    const part = jws.split('.')[1];
    return part ? (JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as Record<string, unknown>) : null;
  } catch {
    return null;
  }
};
