export type Json =
	| string
	| number
	| boolean
	| null
	| { [key: string]: Json | undefined }
	| Json[];

export interface Database {
	public: {
		Tables: {
			channel_invites: {
				Row: {
					id: string;
					channel_id: string;
					created_by: string;
					code: string;
					created_at: string;
					expires_at: string;
					is_revoked: boolean;
				};
				Insert: {
					id?: string;
					channel_id: string;
					created_by: string;
					code: string;
					created_at?: string;
					expires_at: string;
					is_revoked?: boolean;
				};
				Update: {
					id?: string;
					channel_id?: string;
					created_by?: string;
					code?: string;
					created_at?: string;
					expires_at?: string;
					is_revoked?: boolean;
				};
			};
			channel_members: {
				Row: {
					channel_id: string;
					user_id: string;
					role: string;
					joined_at: string;
				};
				Insert: {
					channel_id: string;
					user_id: string;
					role?: string;
					joined_at?: string;
				};
				Update: {
					channel_id?: string;
					user_id?: string;
					role?: string;
					joined_at?: string;
				};
			};
			channels: {
				Row: {
					id: string;
					name: string;
					description: string | null;
					created_by: string | null;
					created_at: string;
					updated_at: string;
					invite_policy: string;
				};
				Insert: {
					id?: string;
					name: string;
					description?: string | null;
					created_by?: string | null;
					created_at?: string;
					updated_at?: string;
					invite_policy?: string;
				};
				Update: {
					id?: string;
					name?: string;
					description?: string | null;
					created_by?: string | null;
					created_at?: string;
					updated_at?: string;
					invite_policy?: string;
				};
			};
			messages: {
				Row: {
					id: string;
					channel_id: string | null;
					user_id: string;
					recipient_id: string | null;
					content: string;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					channel_id?: string | null;
					user_id: string;
					recipient_id?: string | null;
					content: string;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: string;
					channel_id?: string | null;
					user_id?: string;
					recipient_id?: string | null;
					content?: string;
					created_at?: string;
					updated_at?: string;
				};
			};
			users: {
				Row: {
					id: string;
					created_at: string;
					email: string;
					name: string;
					avatar_url: string | null;
					status: string | null;
					last_seen: string | null;
				};
				Insert: {
					id?: string;
					created_at?: string;
					email: string;
					name: string;
					avatar_url?: string | null;
					status?: string | null;
					last_seen?: string | null;
				};
				Update: {
					id?: string;
					created_at?: string;
					email?: string;
					name?: string;
					avatar_url?: string | null;
					status?: string | null;
					last_seen?: string | null;
				};
			};
		};
		Views: {
			[_ in never]: never;
		};
		Functions: {
			[_ in never]: never;
		};
		Enums: {
			[_ in never]: never;
		};
	};
}
