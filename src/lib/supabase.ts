import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
	console.error("Missing NEXT_PUBLIC_SUPABASE_URL");
	throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
}

if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
	console.error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");
	throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

// Create a single instance of the Supabase client
export const supabase = createClient<Database>(
	process.env.NEXT_PUBLIC_SUPABASE_URL,
	process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
	{
		realtime: {
			params: {
				eventsPerSecond: 10,
			},
		},
		auth: {
			persistSession: true,
			autoRefreshToken: true,
			detectSessionInUrl: true,
		},
		db: {
			schema: "public",
		},
	},
);

// Cache the authenticated client with timestamp
let authenticatedClient: {
	client: ReturnType<typeof createClient<Database>>;
	timestamp: number;
} | null = null;

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

export async function getAuthenticatedSupabaseClient() {
	try {
		const now = Date.now();

		// Return cached client if it exists and is not expired
		if (
			authenticatedClient &&
			now - authenticatedClient.timestamp < CACHE_DURATION
		) {
			console.log(
				"Using cached authenticated client, age:",
				(now - authenticatedClient.timestamp) / 1000,
				"seconds",
			);
			return authenticatedClient.client;
		}

		// Clear existing client if it exists
		if (authenticatedClient) {
			console.log("Cache expired, creating new client");
			try {
				await authenticatedClient.client.removeAllChannels();
				console.log("Removed all realtime channels from old client");
			} catch (error) {
				console.error("Error cleaning up old client:", error);
			}
			authenticatedClient = null;
		} else {
			console.log("No cached client exists, creating new one");
		}

		if (
			!process.env.NEXT_PUBLIC_SUPABASE_URL ||
			!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
		) {
			console.error("Missing Supabase environment variables");
			return null;
		}

		console.log("Creating new Supabase client");
		console.log("Supabase URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);

		// Create a new client instance
		const newClient = createClient<Database>(
			process.env.NEXT_PUBLIC_SUPABASE_URL,
			process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
			{
				realtime: {
					params: {
						eventsPerSecond: 10,
					},
				},
				auth: {
					persistSession: true,
					autoRefreshToken: true,
					detectSessionInUrl: true,
				},
				db: {
					schema: "public",
				},
			},
		);

		console.log("Testing new client connection...");
		const { data, error, status, statusText } = await newClient
			.from("users")
			.select("count")
			.limit(1);

		console.log("Test query response:", {
			status,
			statusText,
			data,
			error: error
				? {
						message: error.message,
						details: error.details,
						hint: error.hint,
						code: error.code,
					}
				: null,
		});

		if (error) {
			console.error("Error connecting to Supabase:", {
				message: error.message,
				details: error.details,
				hint: error.hint,
				code: error.code,
			});
			return null;
		}

		if (!data) {
			console.error("No data received from test query");
			return null;
		}

		console.log("New client connection successful, test query returned:", data);
		authenticatedClient = {
			client: newClient,
			timestamp: now,
		};

		return newClient;
	} catch (error) {
		console.error("Error in getAuthenticatedSupabaseClient:", error);
		authenticatedClient = null;
		return null;
	}
}

// Create a separate admin client file for server-side operations if needed
