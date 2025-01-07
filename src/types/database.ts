export interface Channel {
	id: string;
	name: string;
	description: string | null;
	created_by: string;
	created_at: string;
	updated_at: string;
}

export interface Message {
	id: string;
	channel_id: string;
	user_id: string;
	content: string;
	created_at: string;
	updated_at: string;
	user?: User; // For joined queries
}

export interface User {
	id: string;
	email: string;
	name: string;
	avatar_url: string | null;
	status: string | null;
	last_seen: string | null;
}
