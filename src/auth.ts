import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { supabaseAdmin } from "./lib/supabase-admin";

export const { handlers, signIn, signOut, auth } = NextAuth({
	providers: [Google],
	callbacks: {
		async signIn({ user, account, profile }) {
			if (!user.email) return false;

			console.log("Attempting to create/update user:", user);

			// Use supabaseAdmin for user creation/update
			const { data, error } = await supabaseAdmin.from("users").upsert(
				{
					email: user.email,
					name: user.name,
					avatar_url: user.image,
					last_seen: new Date().toISOString(),
				},
				{
					onConflict: "email",
					returning: "minimal",
				},
			);

			console.log("Supabase upsert response:", { data, error });

			if (error) {
				console.error("Error syncing user to Supabase:", error);
				return false;
			}

			return true;
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
				}
			}
			return session;
		},
	},
});
