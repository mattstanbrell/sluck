import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
	throw new Error("Missing Supabase environment variables");
}

// Client for public operations (with RLS)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
	auth: {
		persistSession: true,
		autoRefreshToken: true,
	},
});

let authenticatedClient: ReturnType<typeof createClient> | null = null;

// Function to get an authenticated Supabase client
export async function getAuthenticatedSupabaseClient() {
	// Return cached client if it exists
	if (authenticatedClient) {
		return authenticatedClient;
	}

	// Get the current session token from NextAuth
	const response = await fetch("/api/auth/session");
	const session = await response.json();

	if (
		!session?.supabaseAccessToken ||
		typeof session.supabaseAccessToken !== "string"
	) {
		return supabase;
	}

	// Create a new Supabase client with the service role token
	authenticatedClient = createClient(supabaseUrl, session.supabaseAccessToken, {
		auth: {
			autoRefreshToken: true,
			persistSession: true,
		},
	});

	return authenticatedClient;
}

// Create a separate admin client file for server-side operations if needed
