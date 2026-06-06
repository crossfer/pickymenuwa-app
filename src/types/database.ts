// Auto-generated Supabase database types
// Run: supabase gen types typescript --local > src/types/database.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      restaurants: {
        Row: {
          id: string
          name: string
          slug: string
          kapso_webhook_secret: string | null
          kapso_phone_number_id: string | null
          timezone: string
          webchat_webhook_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          kapso_webhook_secret?: string | null
          kapso_phone_number_id?: string | null
          timezone?: string
          webchat_webhook_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          kapso_webhook_secret?: string | null
          kapso_phone_number_id?: string | null
          timezone?: string
          webchat_webhook_url?: string | null
          created_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          restaurant_id: string | null
          role: 'superadmin' | 'admin' | 'staff'
          full_name: string | null
          created_at: string
        }
        Insert: {
          id: string
          restaurant_id?: string | null
          role: 'superadmin' | 'admin' | 'staff'
          full_name?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          restaurant_id?: string | null
          role?: 'superadmin' | 'admin' | 'staff'
          full_name?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'profiles_restaurant_id_fkey'
            columns: ['restaurant_id']
            isOneToOne: false
            referencedRelation: 'restaurants'
            referencedColumns: ['id']
          }
        ]
      }
      categories: {
        Row: {
          id: string
          restaurant_id: string
          name: string
          sort_order: number
          active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          restaurant_id: string
          name: string
          sort_order?: number
          active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          restaurant_id?: string
          name?: string
          sort_order?: number
          active?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'categories_restaurant_id_fkey'
            columns: ['restaurant_id']
            isOneToOne: false
            referencedRelation: 'restaurants'
            referencedColumns: ['id']
          }
        ]
      }
      menu_items: {
        Row: {
          id: string
          restaurant_id: string
          category_id: string | null
          name: string
          description: string | null
          price: number | null
          image_url: string | null
          available: boolean
          chef_recommendation: boolean
          chef_note: string | null
          pairing_notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          restaurant_id: string
          category_id?: string | null
          name: string
          description?: string | null
          price?: number | null
          image_url?: string | null
          available?: boolean
          chef_recommendation?: boolean
          chef_note?: string | null
          pairing_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          restaurant_id?: string
          category_id?: string | null
          name?: string
          description?: string | null
          price?: number | null
          image_url?: string | null
          available?: boolean
          chef_recommendation?: boolean
          chef_note?: string | null
          pairing_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'menu_items_restaurant_id_fkey'
            columns: ['restaurant_id']
            isOneToOne: false
            referencedRelation: 'restaurants'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'menu_items_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'categories'
            referencedColumns: ['id']
          }
        ]
      }
      item_schedules: {
        Row: {
          id: string
          item_id: string
          day_of_week: number[]
          time_start: string
          time_end: string
        }
        Insert: {
          id?: string
          item_id: string
          day_of_week?: number[]
          time_start: string
          time_end: string
        }
        Update: {
          id?: string
          item_id?: string
          day_of_week?: number[]
          time_start?: string
          time_end?: string
        }
        Relationships: [
          {
            foreignKeyName: 'item_schedules_item_id_fkey'
            columns: ['item_id']
            isOneToOne: false
            referencedRelation: 'menu_items'
            referencedColumns: ['id']
          }
        ]
      }
      conversations: {
        Row: {
          id: string
          restaurant_id: string
          whatsapp_number: string
          started_at: string
          last_message_at: string | null
        }
        Insert: {
          id?: string
          restaurant_id: string
          whatsapp_number: string
          started_at?: string
          last_message_at?: string | null
        }
        Update: {
          id?: string
          restaurant_id?: string
          whatsapp_number?: string
          started_at?: string
          last_message_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'conversations_restaurant_id_fkey'
            columns: ['restaurant_id']
            isOneToOne: false
            referencedRelation: 'restaurants'
            referencedColumns: ['id']
          }
        ]
      }
      messages: {
        Row: {
          id: string
          conversation_id: string
          role: 'user' | 'assistant'
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          role: 'user' | 'assistant'
          content: string
          created_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          role?: 'user' | 'assistant'
          content?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'messages_conversation_id_fkey'
            columns: ['conversation_id']
            isOneToOne: false
            referencedRelation: 'conversations'
            referencedColumns: ['id']
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      my_restaurant_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      my_role: {
        Args: Record<PropertyKey, never>
        Returns: 'superadmin' | 'admin' | 'staff'
      }
    }
    Enums: {
      user_role: 'superadmin' | 'admin' | 'staff'
      message_role: 'user' | 'assistant'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Convenience row types
export type Restaurant = Database['public']['Tables']['restaurants']['Row']
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Category = Database['public']['Tables']['categories']['Row']
export type MenuItem = Database['public']['Tables']['menu_items']['Row']
export type ItemSchedule = Database['public']['Tables']['item_schedules']['Row']
export type Conversation = Database['public']['Tables']['conversations']['Row']
export type Message = Database['public']['Tables']['messages']['Row']

export type UserRole = 'superadmin' | 'admin' | 'staff'

export type MenuItemWithSchedules = MenuItem & {
  item_schedules: ItemSchedule[]
}

export type CategoryWithItems = Category & {
  menu_items: MenuItem[]
}
