import { Buffer } from "node:buffer";
import { KJUR, X509 } from "npm:jsrsasign@11.1.3";

type JsonObject = Record<string, unknown>;

type AppleJwsHeader = {
  alg?: unknown;
  x5c?: unknown;
};

const APPLE_TRANSACTION_SIGNING_OID = "1.2.840.113635.100.6.11.1";
const APPLE_INTERMEDIATE_OID = "1.2.840.113635.100.6.2.1";

function decodeJsonSegment(segment: string): JsonObject {
  const decoded = JSON.parse(
    Buffer.from(segment, "base64url").toString("utf8"),
  );
  if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) {
    throw new Error("Apple returned a malformed signed payload.");
  }
  return decoded as JsonObject;
}

function certificateFromBase64(value: string): X509 {
  const certificate = new X509();
  certificate.readCertHex(Buffer.from(value, "base64").toString("hex"));
  return certificate;
}

function parseCertificateDate(value: string): number {
  // X.509 UTCTime is YYMMDDhhmmssZ and GeneralizedTime is
  // YYYYMMDDhhmmssZ. Apple certificates use one of these two UTC forms.
  const match = /^(\d{2}|\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})Z$/.exec(
    value,
  );
  if (!match) throw new Error("Apple returned an invalid certificate date.");

  const [, yearValue, month, day, hour, minute, second] = match;
  const shortYear = Number(yearValue);
  const year = yearValue.length === 2
    ? shortYear >= 50
      ? 1900 + shortYear
      : 2000 + shortYear
    : shortYear;
  const timestamp = Date.UTC(
    year,
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );
  if (!Number.isFinite(timestamp)) {
    throw new Error("Apple returned an invalid certificate date.");
  }
  return timestamp;
}

function certificateIsValidAt(certificate: X509, timestamp: number) {
  return timestamp >= parseCertificateDate(certificate.getNotBefore()) &&
    timestamp <= parseCertificateDate(certificate.getNotAfter());
}

function certificateWasSignedBy(certificate: X509, issuer: X509) {
  return certificate.getIssuerString() === issuer.getSubjectString() &&
    certificate.verifySignature(issuer.getPublicKey());
}

function verifyCertificateChain(
  certificateChain: string[],
  trustedRootCertificates: readonly string[],
  signedAt: number,
) {
  const [leafValue, intermediateValue] = certificateChain;
  const leaf = certificateFromBase64(leafValue);
  const intermediate = certificateFromBase64(intermediateValue);
  const trustedRoots = trustedRootCertificates.map(certificateFromBase64);
  const trustedRoot = trustedRoots.find((candidate) =>
    certificateWasSignedBy(intermediate, candidate)
  );

  if (!trustedRoot || !certificateWasSignedBy(leaf, intermediate)) {
    throw new Error("Apple's certificate chain is not trusted.");
  }
  if (intermediate.getExtBasicConstraints()?.cA !== true) {
    throw new Error("Apple's intermediate certificate is invalid.");
  }
  if (!leaf.getExtInfo(APPLE_TRANSACTION_SIGNING_OID)) {
    throw new Error("Apple's transaction certificate is invalid.");
  }
  if (!intermediate.getExtInfo(APPLE_INTERMEDIATE_OID)) {
    throw new Error("Apple's intermediate certificate is invalid.");
  }
  if (
    !certificateIsValidAt(leaf, signedAt) ||
    !certificateIsValidAt(intermediate, signedAt) ||
    !certificateIsValidAt(trustedRoot, signedAt)
  ) {
    throw new Error("Apple's certificate was not valid when it signed the payload.");
  }

  return leaf;
}

/**
 * Verify an Apple compact JWS without Node's X509Certificate implementation.
 *
 * Supabase Edge Runtime currently leaves X509Certificate.raw unimplemented,
 * which makes Apple's Node verifier fail before it can check a valid StoreKit
 * transaction. jsrsasign is also the ASN.1 implementation used by Apple's
 * official Node library; using it for the whole certificate path keeps the
 * same chain, Apple-extension, signed-date, and ES256 signature checks while
 * avoiding the incomplete Node compatibility shim.
 */
export function verifyAppleJws<T>(
  signedPayload: string,
  trustedRootCertificates: readonly string[],
): T {
  const segments = signedPayload.split(".");
  if (segments.length !== 3) {
    throw new Error("Apple returned a malformed signed payload.");
  }

  const header = decodeJsonSegment(segments[0]) as AppleJwsHeader;
  const payload = decodeJsonSegment(segments[1]);
  if (header.alg !== "ES256") {
    throw new Error("Apple returned an unsupported signing algorithm.");
  }
  if (
    !Array.isArray(header.x5c) ||
    header.x5c.length !== 3 ||
    !header.x5c.every((certificate) => typeof certificate === "string")
  ) {
    throw new Error("Apple returned an invalid certificate chain.");
  }

  const signedAt = payload.signedDate;
  if (typeof signedAt !== "number" || !Number.isFinite(signedAt)) {
    throw new Error("Apple returned a signed payload without a valid date.");
  }
  const leaf = verifyCertificateChain(
    header.x5c as string[],
    trustedRootCertificates,
    signedAt,
  );
  if (!KJUR.jws.JWS.verify(signedPayload, leaf.getPublicKey(), ["ES256"])) {
    throw new Error("Apple's signed payload has an invalid signature.");
  }

  return payload as T;
}
