// Hand-written types mirroring the Supabase schema in supabase/schema.sql.
// If you later run `supabase gen types`, you can replace this file.

export type RouteStatus = "active" | "archived";
export type ClimbingTypeEnum = "boulder" | "toprope" | "lead";
export type GradeSystemEnum = "american" | "european";
export type ThemeEnum = "dark" | "light";
export type ClimbFilterEnum = "all" | "boulder" | "toprope" | "lead";
export type LogStyleEnum = "scroll" | "steps";
export type GymStatus = "pending" | "approved";
export type GradingStyle = "classic" | "bands" | "brew_bands";
export type RouteEventKind = "created" | "grade_shift" | "archived";
export type ReportReasonEnum = "wrong_gym" | "duplicate" | "inappropriate";
export type BookmarkKind = "project" | "favorite";
export type SendType = "flash" | "send" | "topped" | "attempt";
export type RecapPeriod = "weekly" | "monthly";
export type ReportTargetType = "route" | "comment" | "user";
export type ContentReportReason =
  | "spam"
  | "inappropriate"
  | "harassment"
  | "wrong_info"
  | "other";
export type EntitlementPlan =
  | "free"
  | "pro_monthly"
  | "pro_annual"
  | "lifetime_pro";
export type EntitlementType =
  | "free"
  | "founder"
  | "manual_lifetime"
  | "subscription"
  | "trial";
export type EntitlementStatus =
  | "inactive"
  | "active"
  | "trial"
  | "grace_period"
  | "billing_retry"
  | "expired"
  | "revoked";
export type EntitlementEnvironment = "Sandbox" | "Production" | "Xcode";
export type PushEnvironment = "development" | "production";

/** Shape of the JSON stats payload computed by generate_recaps() in the DB. */
export type RecapPayload = {
  climbs: number;
  sends: number;
  flashes: number;
  attempts: number;
  sessions: number;
  flash_rate: number | null;
  top_wall: string | null;
  top_color: string | null;
  hardest_send: { boulder: number | null; toprope: number | null; lead?: number | null };
  hardest_flash: { boulder: number | null; toprope: number | null; lead?: number | null };
  /** Send counts per discipline — the "what you like to climb" mix. Optional
   *  because recaps generated before lead climbing existed won't have it. */
  type_counts?: { boulder: number; toprope: number; lead: number };
  pyramid: { type: "boulder" | "toprope" | "lead"; ordinal: number; count: number }[];
  new_grades: { type: "boulder" | "toprope" | "lead"; ordinal: number }[];
  prev: { climbs: number; sends: number };
  projects_open: number;
  oldest_project_days: number | null;
  streak: number;
};

export interface Database {
  public: {
    Tables: {
      push_tokens: {
        Row: {
          id: string;
          user_id: string;
          token: string;
          platform: "ios";
          environment: PushEnvironment;
          timezone: string;
          enabled: boolean;
          created_at: string;
          updated_at: string;
          last_seen_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          token: string;
          platform?: "ios";
          environment?: PushEnvironment;
          timezone?: string;
          enabled?: boolean;
          created_at?: string;
          updated_at?: string;
          last_seen_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["push_tokens"]["Insert"]>;
        Relationships: [];
      };
      notification_preferences: {
        Row: {
          user_id: string;
          friend_requests: boolean;
          friend_accepts: boolean;
          weekly_recaps: boolean;
          streak_risk: boolean;
          inactivity: boolean;
          inactivity_days: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          friend_requests?: boolean;
          friend_accepts?: boolean;
          weekly_recaps?: boolean;
          streak_risk?: boolean;
          inactivity?: boolean;
          inactivity_days?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["notification_preferences"]["Insert"]
        >;
        Relationships: [];
      };
      user_entitlements: {
        Row: {
          user_id: string;
          plan: EntitlementPlan;
          entitlement_type: EntitlementType;
          entitlement_status: EntitlementStatus;
          is_lifetime_pro: boolean;
          founder_granted_at: string | null;
          manual_granted_at: string | null;
          subscription_product_id: string | null;
          original_transaction_id: string | null;
          subscription_started_at: string | null;
          trial_ends_at: string | null;
          current_period_ends_at: string | null;
          expiration_date: string | null;
          last_verified_at: string | null;
          environment: EntitlementEnvironment | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          plan?: EntitlementPlan;
          entitlement_type?: EntitlementType;
          entitlement_status?: EntitlementStatus;
          is_lifetime_pro?: boolean;
          founder_granted_at?: string | null;
          manual_granted_at?: string | null;
          subscription_product_id?: string | null;
          original_transaction_id?: string | null;
          subscription_started_at?: string | null;
          trial_ends_at?: string | null;
          current_period_ends_at?: string | null;
          expiration_date?: string | null;
          last_verified_at?: string | null;
          environment?: EntitlementEnvironment | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_entitlements"]["Insert"]>;
        Relationships: [];
      };
      profile_badges: {
        Row: {
          user_id: string;
          badge_key: "slab_king";
          label: string;
          awarded_at: string;
        };
        Insert: {
          user_id: string;
          badge_key: "slab_king";
          label: string;
          awarded_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      climb_videos: {
        Row: {
          id: string;
          user_id: string;
          route_id: string;
          storage_path: string;
          caption: string | null;
          visibility: "public" | "private";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          route_id: string;
          storage_path: string;
          caption?: string | null;
          visibility?: "public" | "private";
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["climb_videos"]["Insert"]>;
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          display_name: string;
          username: string | null;
          avatar_url: string | null;
          bio: string | null;
          home_gym_id: string | null;
          visiting_gym_id: string | null;
          sends_public: boolean;
          projects_public: boolean;
          notes_public: boolean;
          friends_public: boolean;
          grade_system: GradeSystemEnum;
          theme: ThemeEnum;
          default_climb_filter: ClimbFilterEnum;
          log_style: LogStyleEnum;
          route_names_enabled: boolean;
          onboarded: boolean;
          seen_intro: boolean;
          notifications_seen_at: string;
          notifications_cleared_at: string | null;
          pro_intro_seen_at: string | null;
          /** Non-null => the user chose off-grid mode; value is the gym name
           *  they're waiting on. Lets a gym-less user into the app. */
          offgrid_gym_label: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          display_name: string;
          username?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          home_gym_id?: string | null;
          visiting_gym_id?: string | null;
          sends_public?: boolean;
          projects_public?: boolean;
          notes_public?: boolean;
          friends_public?: boolean;
          grade_system?: GradeSystemEnum;
          theme?: ThemeEnum;
          default_climb_filter?: ClimbFilterEnum;
          log_style?: LogStyleEnum;
          route_names_enabled?: boolean;
          onboarded?: boolean;
          seen_intro?: boolean;
          notifications_seen_at?: string;
          notifications_cleared_at?: string | null;
          pro_intro_seen_at?: string | null;
          offgrid_gym_label?: string | null;
          created_at?: string;
        };
        Update: {
          display_name?: string;
          username?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          home_gym_id?: string | null;
          visiting_gym_id?: string | null;
          sends_public?: boolean;
          projects_public?: boolean;
          notes_public?: boolean;
          friends_public?: boolean;
          grade_system?: GradeSystemEnum;
          theme?: ThemeEnum;
          default_climb_filter?: ClimbFilterEnum;
          log_style?: LogStyleEnum;
          route_names_enabled?: boolean;
          onboarded?: boolean;
          seen_intro?: boolean;
          notifications_seen_at?: string;
          notifications_cleared_at?: string | null;
          pro_intro_seen_at?: string | null;
          offgrid_gym_label?: string | null;
        };
        Relationships: [];
      };
      friendships: {
        Row: {
          id: string;
          requester_id: string;
          addressee_id: string;
          status: "pending" | "accepted";
          created_at: string;
        };
        Insert: {
          id?: string;
          requester_id: string;
          addressee_id: string;
          status?: "pending" | "accepted";
          created_at?: string;
        };
        Update: {
          status?: "pending" | "accepted";
        };
        Relationships: [];
      };
      gym_unlocks: {
        Row: {
          user_id: string;
          gym_id: string;
          unlocked_at: string;
        };
        Insert: {
          user_id: string;
          gym_id: string;
          unlocked_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      activity_reactions: {
        Row: {
          id: string;
          activity_kind: "send" | "project";
          activity_id: string;
          route_id: string;
          activity_owner_id: string;
          reactor_id: string;
          reaction: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          activity_kind: "send" | "project";
          activity_id: string;
          route_id: string;
          activity_owner_id: string;
          reactor_id: string;
          reaction: string;
          created_at?: string;
        };
        Update: {
          reaction?: string;
        };
        Relationships: [];
      };
      gyms: {
        Row: {
          id: string;
          name: string;
          address: string | null;
          city: string | null;
          state: string | null;
          brand: string | null;
          latitude: number | null;
          longitude: number | null;
          status: GymStatus;
          grading_style: GradingStyle;
          country: string | null;
          cc: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          address?: string | null;
          city?: string | null;
          state?: string | null;
          brand?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          status?: GymStatus;
          grading_style?: GradingStyle;
          country?: string | null;
          cc?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          name?: string;
          address?: string | null;
          city?: string | null;
          state?: string | null;
          brand?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          status?: GymStatus;
          grading_style?: GradingStyle;
          country?: string | null;
          cc?: string | null;
        };
        Relationships: [];
      };
      logbook_preferences: {
        Row: {
          user_id: string;
          show_photo: boolean;
          show_video: boolean;
          show_hold_color: boolean;
          show_gym_grade: boolean;
          show_felt_grade: boolean;
          show_quality: boolean;
          show_route_name: boolean;
          show_note: boolean;
          show_profile_visibility: boolean;
          default_profile_visible: boolean;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          show_photo?: boolean;
          show_video?: boolean;
          show_hold_color?: boolean;
          show_gym_grade?: boolean;
          show_felt_grade?: boolean;
          show_quality?: boolean;
          show_route_name?: boolean;
          show_note?: boolean;
          show_profile_visibility?: boolean;
          default_profile_visible?: boolean;
          updated_at?: string;
        };
        Update: {
          show_photo?: boolean;
          show_video?: boolean;
          show_hold_color?: boolean;
          show_gym_grade?: boolean;
          show_felt_grade?: boolean;
          show_quality?: boolean;
          show_route_name?: boolean;
          show_note?: boolean;
          show_profile_visibility?: boolean;
          default_profile_visible?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      routes: {
        Row: {
          id: string;
          gym_id: string;
          photo_url: string;
          video_url: string | null;
          hold_color: string;
          wall_section: string | null;
          climbing_type: ClimbingTypeEnum;
          description: string | null;
          gym_grade: number | null;
          name: string | null;
          status: RouteStatus;
          hidden: boolean;
          report_count: number;
          gone_reports: number;
          community_grade_cached: number | null;
          created_by: string | null;
          created_at: string;
          archived_at: string | null;
        };
        Insert: {
          id?: string;
          gym_id: string;
          photo_url: string;
          video_url?: string | null;
          hold_color: string;
          wall_section?: string | null;
          climbing_type?: ClimbingTypeEnum;
          description?: string | null;
          gym_grade?: number | null;
          name?: string | null;
          status?: RouteStatus;
          hidden?: boolean;
          report_count?: number;
          gone_reports?: number;
          created_by?: string | null;
          created_at?: string;
          archived_at?: string | null;
        };
        Update: {
          photo_url?: string;
          video_url?: string | null;
          hold_color?: string;
          wall_section?: string | null;
          climbing_type?: ClimbingTypeEnum;
          description?: string | null;
          gym_grade?: number | null;
          name?: string | null;
          status?: RouteStatus;
          hidden?: boolean;
          report_count?: number;
          gone_reports?: number;
          archived_at?: string | null;
        };
        Relationships: [];
      };
      grades: {
        Row: {
          id: string;
          route_id: string;
          user_id: string;
          grade: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          route_id: string;
          user_id: string;
          grade: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          grade?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      sends: {
        Row: {
          id: string;
          route_id: string;
          user_id: string;
          send_type: SendType;
          note: string | null;
          attempts: number | null;
          photo_url: string | null;
          profile_visible: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          route_id: string;
          user_id: string;
          send_type?: SendType;
          note?: string | null;
          attempts?: number | null;
          photo_url?: string | null;
          profile_visible?: boolean;
          created_at?: string;
        };
        Update: {
          send_type?: SendType;
          note?: string | null;
          attempts?: number | null;
          photo_url?: string | null;
          profile_visible?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      comments: {
        Row: {
          id: string;
          route_id: string;
          user_id: string;
          body: string;
          is_beta: boolean;
          upvotes: number;
          hidden: boolean;
          report_count: number;
          parent_id: string | null;
          edited_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          route_id: string;
          user_id: string;
          body: string;
          is_beta?: boolean;
          upvotes?: number;
          hidden?: boolean;
          report_count?: number;
          parent_id?: string | null;
          created_at?: string;
        };
        Update: {
          body?: string;
          is_beta?: boolean;
          upvotes?: number;
          hidden?: boolean;
          report_count?: number;
          edited_at?: string | null;
        };
        Relationships: [];
      };
      gone_reports: {
        Row: {
          id: string;
          route_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          route_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          created_at?: string;
        };
        Relationships: [];
      };
      route_reports: {
        Row: {
          id: string;
          route_id: string;
          user_id: string;
          reason: ReportReasonEnum;
          created_at: string;
        };
        Insert: {
          id?: string;
          route_id: string;
          user_id: string;
          reason: ReportReasonEnum;
          created_at?: string;
        };
        Update: {
          reason?: ReportReasonEnum;
        };
        Relationships: [];
      };
      bookmarks: {
        Row: {
          id: string;
          user_id: string;
          route_id: string;
          kind: BookmarkKind;
          profile_visible: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          route_id: string;
          kind: BookmarkKind;
          profile_visible?: boolean;
          created_at?: string;
        };
        Update: {
          kind?: BookmarkKind;
          profile_visible?: boolean;
        };
        Relationships: [];
      };
      climb_shares: {
        Row: {
          id: string;
          route_id: string;
          from_user: string;
          to_user: string;
          message: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          route_id: string;
          from_user: string;
          to_user: string;
          message?: string | null;
          created_at?: string;
        };
        Update: {
          message?: string | null;
        };
        Relationships: [];
      };
      blocks: {
        Row: {
          id: string;
          blocker_id: string;
          blocked_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          blocker_id: string;
          blocked_id: string;
          created_at?: string;
        };
        Update: {
          created_at?: string;
        };
        Relationships: [];
      };
      route_ratings: {
        Row: {
          id: string;
          route_id: string;
          user_id: string;
          stars: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          route_id: string;
          user_id: string;
          stars: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          stars?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      comment_likes: {
        Row: {
          id: string;
          comment_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          comment_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      route_events: {
        Row: {
          id: string;
          route_id: string;
          kind: RouteEventKind;
          detail: {
            from?: number;
            to?: number;
            gym_grade?: number | null;
            climbing_type?: ClimbingTypeEnum;
          };
          created_at: string;
        };
        Insert: {
          id?: string;
          route_id: string;
          kind: RouteEventKind;
          detail?: Record<string, unknown>;
          created_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      project_notes: {
        Row: {
          id: string;
          user_id: string;
          route_id: string;
          body: string;
          updated_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          route_id: string;
          body?: string;
          updated_at?: string;
          created_at?: string;
        };
        Update: {
          body?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      personal_logs: {
        Row: {
          id: string;
          user_id: string;
          /** Free-text gym name the climber typed (what they're waiting on). */
          gym_label: string | null;
          /** Set if they suggested the gym and it's pending approval. */
          pending_gym_id: string | null;
          climbing_type: ClimbingTypeEnum;
          hold_color: string;
          route_name: string | null;
          gym_grade: number | null;
          felt_grade: number | null;
          outcome: "flash" | "send" | "project";
          stars: number | null;
          note: string | null;
          photo_url: string | null;
          profile_visible: boolean;
          created_at: string;
          /** Set once the climb is moved into a real gym. */
          transferred_at: string | null;
          transferred_route_id: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          gym_label?: string | null;
          pending_gym_id?: string | null;
          climbing_type: ClimbingTypeEnum;
          hold_color: string;
          route_name?: string | null;
          gym_grade?: number | null;
          felt_grade?: number | null;
          outcome: "flash" | "send" | "project";
          stars?: number | null;
          note?: string | null;
          photo_url?: string | null;
          profile_visible?: boolean;
          created_at?: string;
          transferred_at?: string | null;
          transferred_route_id?: string | null;
        };
        Update: {
          gym_label?: string | null;
          pending_gym_id?: string | null;
          profile_visible?: boolean;
          transferred_at?: string | null;
          transferred_route_id?: string | null;
        };
        Relationships: [];
      };
      recaps: {
        Row: {
          id: string;
          user_id: string;
          period: RecapPeriod;
          period_start: string;
          payload: RecapPayload;
          generated_at: string;
          seen_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          period: RecapPeriod;
          period_start: string;
          payload: RecapPayload;
          generated_at?: string;
          seen_at?: string | null;
        };
        Update: {
          seen_at?: string | null;
        };
        Relationships: [];
      };
      content_reports: {
        Row: {
          id: string;
          reporter_id: string;
          target_type: ReportTargetType;
          target_id: string;
          reason: ContentReportReason;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          reporter_id: string;
          target_type: ReportTargetType;
          target_id: string;
          reason: ContentReportReason;
          note?: string | null;
          created_at?: string;
        };
        Update: {
          reason?: ContentReportReason;
          note?: string | null;
        };
        Relationships: [];
      };
      climb_video_reports: {
        Row: {
          id: string;
          video_id: string;
          reporter_id: string;
          reason: ContentReportReason;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          video_id: string;
          reporter_id: string;
          reason: ContentReportReason;
          note?: string | null;
          created_at?: string;
        };
        Update: {
          reason?: ContentReportReason;
          note?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      route_stats: {
        Row: {
          route_id: string;
          grade_values: number[];
          send_count: number;
          climbers: number;
          avg_attempts: number | null;
          fun_avg: number | null;
          fun_count: number;
          recent_activity: number;
        };
        Relationships: [];
      };
    };
    Functions: {
      accept_current_legal_terms: {
        Args: {
          p_terms_version: string;
          p_privacy_version: string;
          p_age_13_confirmed: boolean;
        };
        Returns: undefined;
      };
      log_climb: {
        Args: {
          p_gym_id: string;
          p_photo_url: string;
          p_hold_color: string;
          p_climbing_type: string;
          p_gym_grade: number | null;
          p_felt_grade: number | null;
          p_stars: number | null;
          p_outcome: string;
          p_note: string;
          p_name?: string | null;
          p_profile_visible?: boolean;
        };
        Returns: string;
      };
      get_friend_activity: {
        Args: { p_limit_per_friend?: number };
        Returns: {
          activity_kind: "send" | "project";
          activity_id: string;
          activity_owner_id: string;
          route_id: string;
          send_type: SendType | null;
          created_at: string;
        }[];
      };
      get_mutual_friend_counts: {
        Args: { p_other_ids: string[] };
        Returns: { profile_id: string; mutual_count: number }[];
      };
      get_mutual_friends: {
        Args: { p_other_id: string };
        Returns: {
          id: string;
          display_name: string;
          username: string | null;
          avatar_url: string | null;
        }[];
      };
      get_profile_friends: {
        Args: { p_profile_id: string };
        Returns: {
          id: string;
          display_name: string;
          username: string | null;
          avatar_url: string | null;
        }[];
      };
      get_pro_badges: {
        Args: { p_user_ids: string[] };
        Returns: {
          user_id: string;
          is_pro: boolean;
        }[];
      };
      report_route_gone: {
        Args: { p_route_id: string };
        Returns: number;
      };
      report_route: {
        Args: { p_route_id: string; p_reason: string };
        Returns: number;
      };
      report_content: {
        Args: {
          p_target_type: string;
          p_target_id: string;
          p_reason: string;
          p_note?: string | null;
        };
        Returns: number;
      };
      report_climb_video: {
        Args: {
          p_video_id: string;
          p_reason: string;
          p_note?: string | null;
        };
        Returns: number;
      };
      delete_route: {
        Args: { p_route_id: string };
        Returns: undefined;
      };
      set_gym_grade: {
        Args: { p_route_id: string; p_grade: number };
        Returns: undefined;
      };
      transfer_personal_log: {
        Args: { p_personal_log_id: string; p_gym_id: string };
        Returns: string;
      };
      delete_account: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      register_push_token: {
        Args: {
          p_token: string;
          p_timezone?: string;
          p_environment?: PushEnvironment;
        };
        Returns: Database["public"]["Tables"]["push_tokens"]["Row"];
      };
      disable_push_token: {
        Args: { p_token: string };
        Returns: undefined;
      };
      disable_all_push_tokens: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      record_entitlement_event: {
        Args: {
          p_event_name: string;
          p_properties?: Record<string, string | number | boolean>;
        };
        Returns: undefined;
      };
    };
    Enums: {
      route_status: RouteStatus;
      climbing_type: ClimbingTypeEnum;
    };
    CompositeTypes: Record<string, never>;
  };
}

// Convenience row aliases
export type UserRow = Database["public"]["Tables"]["profiles"]["Row"];
export type GymRow = Database["public"]["Tables"]["gyms"]["Row"];
export type RouteRow = Database["public"]["Tables"]["routes"]["Row"];
export type GradeRow = Database["public"]["Tables"]["grades"]["Row"];
export type SendRow = Database["public"]["Tables"]["sends"]["Row"];
export type CommentRow = Database["public"]["Tables"]["comments"]["Row"];
export type BookmarkRow = Database["public"]["Tables"]["bookmarks"]["Row"];
export type RouteRatingRow = Database["public"]["Tables"]["route_ratings"]["Row"];
export type BlockRow = Database["public"]["Tables"]["blocks"]["Row"];
export type ContentReportRow =
  Database["public"]["Tables"]["content_reports"]["Row"];
export type RouteEventRow = Database["public"]["Tables"]["route_events"]["Row"];
export type PersonalLogRow =
  Database["public"]["Tables"]["personal_logs"]["Row"];
