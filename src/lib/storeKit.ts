import {
  Capacitor,
  registerPlugin,
  type PluginListenerHandle,
} from "@capacitor/core";

export type StoreKitPeriod = {
  value: number;
  unit: "day" | "week" | "month" | "year" | "period";
};

export type StoreKitProduct = {
  id: string;
  displayName: string;
  description: string;
  displayPrice: string;
  period?: StoreKitPeriod;
  isEligibleForIntroOffer?: boolean;
  introductoryOffer?: {
    displayPrice: string;
    paymentMode: "freeTrial" | "payAsYouGo" | "payUpFront" | "unknown";
    period: StoreKitPeriod;
  };
};

export type StoreKitTransaction = {
  transactionId: string;
  signedTransaction: string;
};

type PurchaseResult =
  | ({ state: "purchased" } & StoreKitTransaction)
  | { state: "pending" }
  | { state: "canceled" };

type KlimbStoreKitPlugin = {
  loadProducts(options: {
    productIds: string[];
  }): Promise<{ products: StoreKitProduct[] }>;
  purchase(options: {
    productId: string;
    appAccountToken: string;
  }): Promise<PurchaseResult>;
  currentEntitlements(): Promise<{ transactions: StoreKitTransaction[] }>;
  restorePurchases(): Promise<{ transactions: StoreKitTransaction[] }>;
  finishTransaction(options: { transactionId: string }): Promise<void>;
  manageSubscriptions(): Promise<void>;
  addListener(
    eventName: "transactionUpdated",
    listener: (transaction: StoreKitTransaction) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: "transactionVerificationFailed",
    listener: (event: { message: string }) => void,
  ): Promise<PluginListenerHandle>;
};

export const KlimbStoreKit =
  registerPlugin<KlimbStoreKitPlugin>("KlimbStoreKit");

export function canUseStoreKit() {
  return Capacitor.getPlatform() === "ios";
}
