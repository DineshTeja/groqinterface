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
      chat_histories: {
        Row: {
          id: string
          title: string
          messages: Json
          mode: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          messages: Json
          mode: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          messages?: Json
          mode?: string
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
} 