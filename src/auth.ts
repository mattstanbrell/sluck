import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { supabaseAdmin } from "./lib/supabase-admin";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
	throw new Error("Missing Supabase environment variables");
}

export const { handlers, signIn, signOut, auth } = NextAuth({
	providers: [Google],
	callbacks: {
		async signIn({ user, account, profile }) {
			if (!user.email) return false;

			try {
				console.log("Attempting to create/update user:", user);

				// First try to find the user
				const { data: existingUser } = await supabaseAdmin
					.from("users")
					.select("*")
					.eq("email", user.email)
					.single();

				if (existingUser) {
					// Update existing user
					const { error: updateError } = await supabaseAdmin
						.from("users")
						.update({
							name: user.name,
							avatar_url: user.image,
							last_seen: new Date().toISOString(),
						})
						.eq("email", user.email);

					if (updateError) throw updateError;
				} else {
					// Insert new user
					const { error: insertError } = await supabaseAdmin
						.from("users")
						.insert({
							email: user.email,
							name: user.name,
							avatar_url: user.image,
							last_seen: new Date().toISOString(),
						});

					if (insertError) throw insertError;
				}

				return true;
			} catch (error) {
				console.error("Error syncing user to Supabase:", error);
				return true; // Still allow sign in even if sync fails
			}
		},
		async session({ session, token }) {
			if (session?.user?.email) {
				const { data: userData } = await supabaseAdmin
					.from("users")
					.select("*")
					.eq("email", session.user.email)
					.single();

				if (userData) {
					session.user.id = userData.id;
					session.user.status = userData.status;

					// Use service role client directly
					const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
						auth: {
							autoRefreshToken: false,
							persistSession: false,
						},
					});

					session.supabaseAccessToken = supabaseServiceKey;
				}
			}
			return session;
		},
	},
});
