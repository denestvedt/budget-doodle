export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      households: {
        Row: {
          id: string
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
        }
      }
      user_profiles: {
        Row: {
          id: string
          household_id: string | null
          email: string
          display_name: string | null
          role: 'owner' | 'member'
          created_at: string
        }
        Insert: {
          id: string
          household_id?: string | null
          email: string
          display_name?: string | null
          role?: 'owner' | 'member'
          created_at?: string
        }
        Update: {
          id?: string
          household_id?: string | null
          email?: string
          display_name?: string | null
          role?: 'owner' | 'member'
          created_at?: string
        }
      }
      accounts: {
        Row: {
          id: string
          household_id: string
          name: string
          institution: string
          type: 'CHECKING' | 'SAVINGS' | 'CREDIT' | 'INVESTMENT'
          class: 'Asset' | 'Liability'
          last_balance: number
          last_updated: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          household_id: string
          name: string
          institution: string
          type: 'CHECKING' | 'SAVINGS' | 'CREDIT' | 'INVESTMENT'
          class: 'Asset' | 'Liability'
          last_balance?: number
          last_updated?: string | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          household_id?: string
          name?: string
          institution?: string
          type?: 'CHECKING' | 'SAVINGS' | 'CREDIT' | 'INVESTMENT'
          class?: 'Asset' | 'Liability'
          last_balance?: number
          last_updated?: string | null
          is_active?: boolean
          created_at?: string
        }
      }
      categories: {
        Row: {
          id: string
          household_id: string
          name: string
          group_name: string
          type: 'Income' | 'Expense' | 'Transfer'
          is_hidden: boolean
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          household_id: string
          name: string
          group_name: string
          type: 'Income' | 'Expense' | 'Transfer'
          is_hidden?: boolean
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          household_id?: string
          name?: string
          group_name?: string
          type?: 'Income' | 'Expense' | 'Transfer'
          is_hidden?: boolean
          sort_order?: number
          created_at?: string
        }
      }
      transactions: {
        Row: {
          id: string
          household_id: string
          account_id: string
          date: string
          description: string
          full_description: string | null
          amount: number
          category_id: string | null
          category_hint: string | null
          ai_confidence: number | null
          is_transfer: boolean
          is_reviewed: boolean
          imported_at: string
          imported_by_user_id: string | null
          dedup_hash: string | null
        }
        Insert: {
          id?: string
          household_id: string
          account_id: string
          date: string
          description: string
          full_description?: string | null
          amount: number
          category_id?: string | null
          category_hint?: string | null
          ai_confidence?: number | null
          is_transfer?: boolean
          is_reviewed?: boolean
          imported_at?: string
          imported_by_user_id?: string | null
          dedup_hash?: string | null
        }
        Update: {
          id?: string
          household_id?: string
          account_id?: string
          date?: string
          description?: string
          full_description?: string | null
          amount?: number
          category_id?: string | null
          category_hint?: string | null
          ai_confidence?: number | null
          is_transfer?: boolean
          is_reviewed?: boolean
          imported_at?: string
          imported_by_user_id?: string | null
          dedup_hash?: string | null
        }
      }
      budgets: {
        Row: {
          id: string
          household_id: string
          category_id: string
          month: string
          amount: number
          created_at: string
        }
        Insert: {
          id?: string
          household_id: string
          category_id: string
          month: string
          amount: number
          created_at?: string
        }
        Update: {
          id?: string
          household_id?: string
          category_id?: string
          month?: string
          amount?: number
          created_at?: string
        }
      }
      category_rules: {
        Row: {
          id: string
          household_id: string
          merchant_pattern: string
          category_id: string
          confidence: number
          match_count: number
          created_at: string
          last_used_at: string
        }
        Insert: {
          id?: string
          household_id: string
          merchant_pattern: string
          category_id: string
          confidence?: number
          match_count?: number
          created_at?: string
          last_used_at?: string
        }
        Update: {
          id?: string
          household_id?: string
          merchant_pattern?: string
          category_id?: string
          confidence?: number
          match_count?: number
          created_at?: string
          last_used_at?: string
        }
      }
      balance_snapshots: {
        Row: {
          id: string
          household_id: string
          account_id: string
          balance: number
          snapshot_date: string
          source: 'csv_import' | 'manual'
          created_at: string
        }
        Insert: {
          id?: string
          household_id: string
          account_id: string
          balance: number
          snapshot_date: string
          source?: 'csv_import' | 'manual'
          created_at?: string
        }
        Update: {
          id?: string
          household_id?: string
          account_id?: string
          balance?: number
          snapshot_date?: string
          source?: 'csv_import' | 'manual'
          created_at?: string
        }
      }
      monthly_reviews: {
        Row: {
          id: string
          household_id: string
          month: string
          reviewed_by_user_id: string | null
          notes: string | null
          is_locked: boolean
          completed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          household_id: string
          month: string
          reviewed_by_user_id?: string | null
          notes?: string | null
          is_locked?: boolean
          completed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          household_id?: string
          month?: string
          reviewed_by_user_id?: string | null
          notes?: string | null
          is_locked?: boolean
          completed_at?: string | null
          created_at?: string
        }
      }
      notifications: {
        Row: {
          id: string
          household_id: string
          type: string
          message: string
          metadata: Json | null
          is_read: boolean
          created_at: string
          triggered_by: string | null
        }
        Insert: {
          id?: string
          household_id: string
          type: string
          message: string
          metadata?: Json | null
          is_read?: boolean
          created_at?: string
          triggered_by?: string | null
        }
        Update: {
          id?: string
          household_id?: string
          type?: string
          message?: string
          metadata?: Json | null
          is_read?: boolean
          created_at?: string
          triggered_by?: string | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_household_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      seed_default_categories: {
        Args: { p_household_id: string }
        Returns: void
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}

// Application-level types
export type Household = Database['public']['Tables']['households']['Row']
export type UserProfile = Database['public']['Tables']['user_profiles']['Row']
export type Account = Database['public']['Tables']['accounts']['Row']
export type Category = Database['public']['Tables']['categories']['Row']
export type Transaction = Database['public']['Tables']['transactions']['Row']
export type Budget = Database['public']['Tables']['budgets']['Row']
export type CategoryRule = Database['public']['Tables']['category_rules']['Row']
export type BalanceSnapshot = Database['public']['Tables']['balance_snapshots']['Row']
export type MonthlyReview = Database['public']['Tables']['monthly_reviews']['Row']
export type Notification = Database['public']['Tables']['notifications']['Row']

export type TransactionWithCategory = Transaction & {
  category: Category | null
  account: Account
}
