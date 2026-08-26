/**
 * One registry for every future paywall decision.
 *
 * Nothing else in the app should compare plan strings. Move a key between
 * `freeFeatures` and `proFeatures`, or change a numeric limit here, when the
 * final Free/Pro packaging is decided.
 */
export const ENTITLEMENT_FEATURES = {
  freeFeatures: [
    "log_klimb",
    "view_logbook",
    "basic_stats",
    "friends",
    "weekly_recap",
  ],
  proFeatures: [
    // Live Pro gates.
    "advanced_stats",
    "unlimited_recap_history",
    // Ready for the next packaging pass.
    "premium_share_cards",
    "project_insights",
    "customize_logbook",
    "video_library_upload",
    "monthly_yearly_recaps",
  ],
  usageLimits: {
    // `null` means unlimited. These placeholders make later packaging a config
    // change instead of a rewrite of purchase logic.
    freeMonthlyKlimbs: null as number | null,
    freeActiveProjects: null as number | null,
    proMonthlyKlimbs: null as number | null,
    proActiveProjects: null as number | null,
  },
  upgradePrompts: {
    advanced_stats: "Unlock personal bests, pyramids, and eight-week trends.",
    unlimited_recap_history: "Rewatch every weekly recap in your Pro archive.",
    premium_share_cards: "Share your week with premium recap layouts.",
    project_insights: "See more detail across your open projects.",
    customize_logbook: "Choose exactly which questions appear when you log.",
    video_library_upload: "Attach videos while logging and keep a personal technique library.",
    monthly_yearly_recaps: "Unlock monthly, yearly, and complete recap history.",
  },
} as const;

export type FreeFeature = (typeof ENTITLEMENT_FEATURES.freeFeatures)[number];
export type ProFeature = (typeof ENTITLEMENT_FEATURES.proFeatures)[number];
export type EntitlementFeature = FreeFeature | ProFeature;

export const STOREKIT_CONFIG = {
  monthlyProductId:
    import.meta.env.VITE_STOREKIT_MONTHLY_PRODUCT_ID ||
    "com.nickyocom.klimb.pro.monthly",
  annualProductId:
    import.meta.env.VITE_STOREKIT_ANNUAL_PRODUCT_ID ||
    "com.nickyocom.klimb.pro.annual",
  monthlyFallbackPrice: "$3.99",
  annualFallbackPrice: "$34.99",
  privacyUrl: "https://klimb-privacy.vercel.app/",
  termsUrl:
    "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/",
} as const;
