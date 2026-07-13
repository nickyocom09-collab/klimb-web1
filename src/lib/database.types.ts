// Hand-written types mirroring the Supabase schema in supabase/schema.sql.
// If you later run `supabase gen types`, you can replace this file.

export type RouteStatus = "active" | "archived";
export type ClimbingTypeEnum = "boulder" | "toprope";
export type GradeSystemEnum = "american" | "european";
export type ThemeEnum = "dark" | "light";
export type ClimbFilterEnum = "all" | "boulder" | "toprope";
export type GymStatus = "pending" | "approved";
export type GradingStyle = "classic" | "bands";
export type RouteEventKind = "created" | "grade_shift" | "archived";
export type ReportReasonEnum = "wrong_gym" | "duplicate" | "inappropriate";
export type BookmarkKind = "project" | "favorite";
export type SendType = "flash" | "send" | "attempt";
export type RecapPeriod = "weekly" | "monthly";
export type ReportTargetType = "route" | "comment" | "user";
export type ContentReportReason =
  | "spam"
  | "inappropriate"
  | "harassment"
  | "wrong_info"
  | "other";

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
  hardest_send: { boulder: number | null; toprope: number | null };
  hardest_flash: { boulder: number | null; toprope: number | null };
  pyramid: { type: "boulder" | "toprope"; ordinal: number; count: number }[];
  new_grades: { type: "boulder" | "toprope"; ordinal: number }[];
  prev: { climbs: number; sends: number };
  projects_open: number;
  oldest_project_days: number | null;
  streak: number;
};

export interface Database {
  public: {
    Tables: {
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
          grade_system: GradeSystemEnum;
          theme: ThemeEnum;
          default_climb_filter: ClimbFilterEnum;
          onboarded: boolean;
          seen_intro: boolean;
          notifications_seen_at: string;
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
          grade_system?: GradeSystemEnum;
          theme?: ThemeEnum;
          default_climb_filter?: ClimbFilterEnum;
          onboarded?: boolean;
          seen_intro?: boolean;
          notifications_seen_at?: string;
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
          grade_system?: GradeSystemEnum;
          theme?: ThemeEnum;
          default_climb_filter?: ClimbFilterEnum;
          onboarded?: boolean;
          seen_intro?: boolean;
          notifications_seen_at?: string;
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
      gyms: {
        Row: {
          id: string;
          name: string;
          city: string | null;
          state: string | null;
          brand: string | null;
          latitude: number | null;
          longitude: number | null;
          status: GymStatus;
          grading_style: GradingStyle;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          city?: string | null;
          state?: string | null;
          brand?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          status?: GymStatus;
          grading_style?: GradingStyle;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          name?: string;
          city?: string | null;
          state?: string | null;
          brand?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          status?: GymStatus;
          grading_style?: GradingStyle;
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
          wall_section: string;
          climbing_type: ClimbingTypeEnum;
          description: string | null;
          gym_grade: number | null;
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
          wall_section: string;
          climbing_type?: ClimbingTypeEnum;
          description?: string | null;
          gym_grade?: number | null;
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
          wall_section?: string;
          climbing_type?: ClimbingTypeEnum;
          description?: string | null;
          gym_grade?: number | null;
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
          created_at?: string;
        };
        Update: {
          send_type?: SendType;
          note?: string | null;
          attempts?: number | null;
          photo_url?: string | null;
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
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          route_id: string;
          kind: BookmarkKind;
          created_at?: string;
        };
        Update: {
          kind?: BookmarkKind;
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
      delete_route: {
        Args: { p_route_id: string };
        Returns: undefined;
      };
      set_gym_grade: {
        Args: { p_route_id: string; p_grade: number };
        Returns: undefined;
      };
      delete_account: {
        Args: Record<string, never>;
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
