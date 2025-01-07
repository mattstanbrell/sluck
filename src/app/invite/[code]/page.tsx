import { supabaseAdmin } from "@/lib/supabase-admin";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

interface PageProps {
	params: Promise<{
		code: string;
	}>;
}

export default async function InvitePage({ params }: PageProps) {
	const { code } = await params;
	const session = await auth();

	if (!session?.user) {
		// Store the invite code in the URL when redirecting to sign in
		redirect(`/api/auth/signin?callbackUrl=/invite/${code}`);
	}

	// Get the invite details
	const { data: invite } = await supabaseAdmin
		.from("channel_invites")
		.select("*, channel:channels(*)")
		.eq("code", code)
		.single();

	// Check if invite exists and is valid
	if (
		!invite ||
		invite.is_revoked ||
		new Date(invite.expires_at) < new Date() ||
		!invite.channel
	) {
		redirect("/invalid-invite");
	}

	// Check if user is already a member
	const { data: existingMember } = await supabaseAdmin
		.from("channel_members")
		.select("*")
		.eq("channel_id", invite.channel_id)
		.eq("user_id", session.user.id)
		.single();

	if (existingMember) {
		redirect(`/channels/${invite.channel_id}`);
	}

	// Add user to channel
	await supabaseAdmin.from("channel_members").insert({
		channel_id: invite.channel_id,
		user_id: session.user.id,
		role: "member",
	});

	// Redirect to the channel
	redirect(`/channels/${invite.channel_id}`);
}
