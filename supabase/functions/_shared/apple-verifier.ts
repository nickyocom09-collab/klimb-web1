import { Buffer } from "node:buffer";
import {
  Environment,
  SignedDataVerifier,
  type JWSRenewalInfoDecodedPayload,
  type JWSTransactionDecodedPayload,
  type ResponseBodyV2DecodedPayload,
} from "npm:@apple/app-store-server-library@2.0.0";
import { APPLE_ROOT_CERTIFICATES_BASE64 } from "./apple-root-certificates.ts";

const bundleId = Deno.env.get("APPLE_BUNDLE_ID") ?? "com.nickyocom.klimb";
const appAppleId = Number(Deno.env.get("APPLE_APP_ID") ?? "6792880012");

function decodeCertificate(value: string): Buffer {
  const normalized = value
    .replace(/-----BEGIN CERTIFICATE-----/g, "")
    .replace(/-----END CERTIFICATE-----/g, "")
    .replace(/\s/g, "");
  return Buffer.from(normalized, "base64");
}

function rootCertificates(): Buffer[] {
  return APPLE_ROOT_CERTIFICATES_BASE64.map(decodeCertificate);
}

function verifier(environment: Environment) {
  return new SignedDataVerifier(
    rootCertificates(),
    true,
    environment,
    bundleId,
    environment === Environment.PRODUCTION ? appAppleId : undefined,
  );
}

export async function verifyTransaction(
  signedTransaction: string,
): Promise<JWSTransactionDecodedPayload> {
  let sandboxError: unknown;
  try {
    return await verifier(Environment.SANDBOX).verifyAndDecodeTransaction(
      signedTransaction,
    );
  } catch (error) {
    sandboxError = error;
  }

  try {
    return await verifier(Environment.PRODUCTION).verifyAndDecodeTransaction(
      signedTransaction,
    );
  } catch (productionError) {
    console.error("Apple JWS verification failed", {
      sandboxError: String(sandboxError),
      productionError: String(productionError),
    });
    throw new Error("Apple could not verify this transaction.");
  }
}

export async function verifyNotification(
  signedPayload: string,
): Promise<ResponseBodyV2DecodedPayload> {
  let sandboxError: unknown;
  try {
    return await verifier(Environment.SANDBOX).verifyAndDecodeNotification(
      signedPayload,
    );
  } catch (error) {
    sandboxError = error;
  }

  try {
    return await verifier(Environment.PRODUCTION).verifyAndDecodeNotification(
      signedPayload,
    );
  } catch (productionError) {
    console.error("Apple notification verification failed", {
      sandboxError: String(sandboxError),
      productionError: String(productionError),
    });
    throw new Error("Apple could not verify this notification.");
  }
}

export async function verifyRenewalInfo(
  signedRenewalInfo: string,
): Promise<JWSRenewalInfoDecodedPayload> {
  let sandboxError: unknown;
  try {
    return await verifier(Environment.SANDBOX).verifyAndDecodeRenewalInfo(
      signedRenewalInfo,
    );
  } catch (error) {
    sandboxError = error;
  }

  try {
    return await verifier(Environment.PRODUCTION).verifyAndDecodeRenewalInfo(
      signedRenewalInfo,
    );
  } catch (productionError) {
    console.error("Apple renewal verification failed", {
      sandboxError: String(sandboxError),
      productionError: String(productionError),
    });
    throw new Error("Apple could not verify this renewal.");
  }
}

export function millisecondsToIso(value?: number | null): string | null {
  return typeof value === "number" ? new Date(value).toISOString() : null;
}
