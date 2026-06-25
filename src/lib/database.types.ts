// Hand-written types mirroring the Supabase schema in supabase/schema.sql.
// If you later run `supabase gen types`, you can replace this file.

export type RouteStatus = "active" | "archived";
export type ClimbingTypeEnum = "boulder" | "toprope";
export type GradeSystemEnum = "american" | "european";
export type ThemeEnum = "dark" | "light";
export type ClimbFilterEnum = "all" | "boulder" | "toprope";
export type GymStatus = "pending" | "approved";
export type ReportReasonEnum = "wrong_gym" | "duplicate" | "inappropriate";
export type BookmarkKind = "project" | "favorite";
export type SendType = "flash" | "send";
export type ReportTargetType = "route" | "comment" | "user";
export type ContentReportReason =
  | "spam"
  | "inappropriate"
  | "harassment"
  | "wrong_info"
  | "other";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string;
          home_gym_id: string | null;
          grade_system: GradeSystemEnum;
          theme: ThemeEnum;
          default_climb_filter: ClimbFilterEnum;
          onboarded: boolean;
          notifications_seen_at: string;
          created_at: string;
        };
        Insert: {
          id: string;
          display_name: string;
          home_gym_id?: string | null;
          grade_system?: GradeSystemEnum;
          theme?: ThemeEnum;
          default_climb_filter?: ClimbFilterEnum;
          onboarded?: boolean;
          notifications_seen_at?: string;
          created_at?: string;
        };
        Update: {
          display_name?: string;
          home_gym_id?: string | null;
          grade_system?: GradeSystemEnum;
          theme?: ThemeEnum;
          default_climb_filter?: ClimbFilterEnum;
          onboarded?: boolean;
          notifications_seen_at?: string;
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
          status: RouteStatus;
          hidden: boolean;
          report_count: number;
          gone_reports: number;
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
          created_at: string;
        };
        Insert: {
          id?: string;
          route_id: string;
          user_id: string;
          send_type?: SendType;
          note?: string | null;
          created_at?: string;
        };
        Update: {
          send_type?: SendType;
          note?: string | null;
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
          created_at?: string;
        };
        Update: {
          body?: string;
          is_beta?: boolean;
          upvotes?: number;
          hidden?: boolean;
          report_count?: number;
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
    Views: Record<string, never>;
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
export type BlockRow = Database["public"]["Tables"]["blocks"]["Row"];
export type ContentReportRow =
  Database["public"]["Tables"]["content_reports"]["Row"];
