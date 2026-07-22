export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

/** A single script/talent text block attached to a cue (stored in cues.scripts). */
export interface ScriptBlock {
  id: string
  content: string
  collapsed: boolean
}

/** An uploaded file/image attached to a cell, independent of its content (stored in cells.attachments). */
export interface CellAttachment {
  url: string
  name: string
  type: string
}

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          team_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          team_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          team_id?: string | null
          updated_at?: string
        }
      }
      teams: {
        Row: {
          id: string
          name: string
          owner_id: string
          logo_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          owner_id: string
          logo_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          logo_url?: string | null
          updated_at?: string
        }
      }
      events: {
        Row: {
          id: string
          team_id: string
          name: string
          logo_url: string | null
          event_date: string | null
          location: string | null
          archived: boolean
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          team_id: string
          name: string
          logo_url?: string | null
          event_date?: string | null
          location?: string | null
          archived?: boolean
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          logo_url?: string | null
          event_date?: string | null
          location?: string | null
          archived?: boolean
          updated_at?: string
        }
      }
      rundowns: {
        Row: {
          id: string
          team_id: string
          event_id: string | null
          name: string
          show_date: string | null
          timezone: string
          status: 'draft' | 'awaiting_data' | 'approved' | 'finalized' | 'rejected'
          created_by: string
          is_template: boolean
          deleted_at: string | null
          created_at: string
          updated_at: string
          time_display: 'auto' | '24h' | '12h' | '12h_no_ampm'
          cue_number_prefix: string
          cue_number_start: number
          cue_number_digits: number
        }
        Insert: {
          id?: string
          team_id: string
          event_id?: string | null
          name: string
          show_date?: string | null
          timezone?: string
          status?: 'draft' | 'awaiting_data' | 'approved' | 'finalized' | 'rejected'
          created_by: string
          is_template?: boolean
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
          time_display?: 'auto' | '24h' | '12h' | '12h_no_ampm'
          cue_number_prefix?: string
          cue_number_start?: number
          cue_number_digits?: number
        }
        Update: {
          id?: string
          event_id?: string | null
          name?: string
          show_date?: string | null
          timezone?: string
          status?: 'draft' | 'awaiting_data' | 'approved' | 'finalized' | 'rejected'
          is_template?: boolean
          deleted_at?: string | null
          updated_at?: string
          time_display?: 'auto' | '24h' | '12h' | '12h_no_ampm'
          cue_number_prefix?: string
          cue_number_start?: number
          cue_number_digits?: number
        }
      }
      columns: {
        Row: {
          id: string
          rundown_id: string
          name: string
          col_type: 'richtext' | 'dropdown'
          position: number
          width: number
          options: string[] | null
          option_colors: Record<string, string> | null
          created_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          rundown_id: string
          name: string
          col_type?: 'richtext' | 'dropdown'
          position?: number
          width?: number
          options?: string[] | null
          option_colors?: Record<string, string> | null
          created_at?: string
          deleted_at?: string | null
        }
        Update: {
          name?: string
          col_type?: 'richtext' | 'dropdown'
          position?: number
          width?: number
          options?: string[] | null
          option_colors?: Record<string, string> | null
          deleted_at?: string | null
        }
      }
      cues: {
        Row: {
          id: string
          rundown_id: string
          position: number
          cue_number: string
          cue_type: 'cue' | 'heading'
          group_id: string | null
          title: string
          subtitle: string | null
          start_type: 'soft' | 'hard'
          start_time_override: string | null
          auto_start: boolean
          duration_ms: number
          duration_mode: 'manual' | 'auto'
          scripts: ScriptBlock[]
          background_color: string | null
          locked: boolean
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          rundown_id: string
          position?: number
          cue_number?: string
          cue_type?: 'cue' | 'heading'
          group_id?: string | null
          title?: string
          subtitle?: string | null
          start_type?: 'soft' | 'hard'
          start_time_override?: string | null
          auto_start?: boolean
          duration_ms?: number
          duration_mode?: 'manual' | 'auto'
          scripts?: ScriptBlock[]
          background_color?: string | null
          locked?: boolean
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          position?: number
          cue_number?: string
          cue_type?: 'cue' | 'heading'
          group_id?: string | null
          title?: string
          subtitle?: string | null
          start_type?: 'soft' | 'hard'
          start_time_override?: string | null
          auto_start?: boolean
          duration_ms?: number
          duration_mode?: 'manual' | 'auto'
          scripts?: ScriptBlock[]
          background_color?: string | null
          locked?: boolean
          updated_at?: string
          deleted_at?: string | null
        }
      }
      cells: {
        Row: {
          id: string
          cue_id: string
          column_id: string
          content: string | null
          attachments: CellAttachment[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          cue_id: string
          column_id: string
          content?: string | null
          attachments?: CellAttachment[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          content?: string | null
          attachments?: CellAttachment[]
          updated_at?: string
        }
      }
      mentions: {
        Row: {
          id: string
          rundown_id: string
          name: string
          description: string | null
          color: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          rundown_id: string
          name: string
          description?: string | null
          color?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          description?: string | null
          color?: string | null
          updated_at?: string
        }
      }
      variables: {
        Row: {
          id: string
          rundown_id: string
          key: string
          value: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          rundown_id: string
          key: string
          value?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          key?: string
          value?: string
          updated_at?: string
        }
      }
      private_notes: {
        Row: {
          id: string
          cue_id: string
          user_id: string
          content: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          cue_id: string
          user_id: string
          content?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          content?: string | null
          updated_at?: string
        }
      }
      rundown_shares: {
        Row: {
          id: string
          rundown_id: string
          token: string
          mode: 'view' | 'edit'
          label: string | null
          visible_columns: string[] | null
          created_at: string
        }
        Insert: {
          id?: string
          rundown_id: string
          token: string
          mode?: 'view' | 'edit'
          label?: string | null
          visible_columns?: string[] | null
          created_at?: string
        }
        Update: {
          label?: string | null
          visible_columns?: string[] | null
        }
      }
    }
    Views: Record<string, unknown>
    Functions: Record<string, unknown>
    Enums: Record<string, unknown>
  }
}

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Team = Database['public']['Tables']['teams']['Row']
export type Event = Database['public']['Tables']['events']['Row']
export type Rundown = Database['public']['Tables']['rundowns']['Row']
export type Column = Database['public']['Tables']['columns']['Row']
export type Cue = Database['public']['Tables']['cues']['Row']
export type Cell = Database['public']['Tables']['cells']['Row']
export type Mention = Database['public']['Tables']['mentions']['Row']
export type Variable = Database['public']['Tables']['variables']['Row']
export type PrivateNote = Database['public']['Tables']['private_notes']['Row']
export type RundownShare = Database['public']['Tables']['rundown_shares']['Row']
