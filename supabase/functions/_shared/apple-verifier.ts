import { Buffer } from "node:buffer";
import {
  type JWSRenewalInfoDecodedPayload,
  type JWSTransactionDecodedPayload,
  type ResponseBodyV2DecodedPayload,
} from "npm:@apple/app-store-server-library@3.1.0";
import { APPLE_ROOT_CERTIFICATES_BASE64 } from "./apple-root-certificates.ts";
import { verifyAppleJws } from "./apple-jws-verifier.ts";

const bundleId = Deno.env.get("APPLE_BUNDLE_ID") ?? "com.nickyocom.klimb";
const appAppleId = Number(Deno.env.get("APPLE_APP_ID") ?? "6792880012");

function verificationFailureDetails(error: unknown) {
  return {
    type: error instanceof Error ? error.name : "UnknownError",
    message: error instanceof Error ? error.message.slice(0, 240) : undefined,
  };
}

function unverifiedTransactionContext(signedTransaction: string) {
  try {
    const [encodedHeader, encodedPayload] = signedTransaction.split(".");
    const header = JSON.parse(Buffer.from(encodedHeader, "base64url").toString());
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString());
    return {
      segments: signedTransaction.split(".").length,
      certificateChainLength: Array.isArray(header.x5c) ? header.x5c.length : 0,
      algorithm: typeof header.alg === "string" ? header.alg : undefined,
      bundleId: typeof payload.bundleId === "string" ? payload.bundleId : undefined,
      environment: typeof payload.environment === "string"
        ? payload.environment
        : undefined,
      productId: typeof payload.productId === "string" ? payload.productId : undefined,
    };
  } catch {
    return { malformedCompactJws: true };
  }
}

export async function verifyTransaction(
  signedTransaction: string,
): Promise<JWSTransactionDecodedPayload> {
  try {
    const transaction = verifyAppleJws<JWSTransactionDecodedPayload>(
      signedTransaction,
      APPLE_ROOT_CERTIFICATES_BASE64,
    );
    if (transaction.bundleId !== bundleId) {
      throw new Error("The transaction is for a different app.");
    }
    if (transaction.environment !== "Sandbox" && transaction.environment !== "Production") {
      throw new Error("The transaction has an invalid App Store environment.");
    }
    return transaction;
  } catch (error) {
    console.error("Apple JWS verification failed", {
      failure: verificationFailureDetails(error),
      transaction: unverifiedTransactionContext(signedTransaction),
    });
    throw new Error("Apple could not verify this transaction.");
  }
}

export async function verifyNotification(
  signedPayload: string,
): Promise<ResponseBodyV2DecodedPayload> {
  try {
    const notification = verifyAppleJws<ResponseBodyV2DecodedPayload>(
      signedPayload,
      APPLE_ROOT_CERTIFICATES_BASE64,
    );
    const appData = (notification.data ?? notification.summary ??
      notification.externalPurchaseToken ?? notification.appData) as
      | {
        appAppleId?: number;
        bundleId?: string;
        environment?: string;
      }
      | undefined;
    const environment = notification.externalPurchaseToken
      ?.externalPurchaseId?.startsWith("SANDBOX")
      ? "Sandbox"
      : appData?.environment;
    if (!appData || appData.bundleId !== bundleId) {
      throw new Error("The notification is for a different app.");
    }
    if (environment !== "Sandbox" && environment !== "Production") {
      throw new Error("The notification has an invalid App Store environment.");
    }
    if (environment === "Production" && appData.appAppleId !== appAppleId) {
      throw new Error("The notification has an invalid Apple app identifier.");
    }
    return notification;
  } catch (error) {
    console.error("Apple notification verification failed", {
      failure: verificationFailureDetails(error),
    });
    throw new Error("Apple could not verify this notification.");
  }
}

export async function verifyRenewalInfo(
  signedRenewalInfo: string,
): Promise<JWSRenewalInfoDecodedPayload> {
  try {
    const renewal = verifyAppleJws<JWSRenewalInfoDecodedPayload>(
      signedRenewalInfo,
      APPLE_ROOT_CERTIFICATES_BASE64,
    );
    if (renewal.environment !== "Sandbox" && renewal.environment !== "Production") {
      throw new Error("The renewal has an invalid App Store environment.");
    }
    return renewal;
  } catch (error) {
    console.error("Apple renewal verification failed", {
      failure: verificationFailureDetails(error),
    });
    throw new Error("Apple could not verify this renewal.");
  }
}

export function millisecondsToIso(value?: number | null): string | null {
  return typeof value === "number" ? new Date(value).toISOString() : null;
}
