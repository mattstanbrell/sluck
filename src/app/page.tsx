import { supabaseAdmin } from "@/lib/supabase-admin";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

export default async function Home() {
	const session = await auth();
	if (!session?.user?.id) {
		redirect("/signin");
	}

	// Get the user's most recently active channel
	const { data: lastMessage } = await supabaseAdmin
		.from("messages")
		.select("channel_id")
		.eq("user_id", session.user.id)
		.is("conversation_id", null) // Only get channel messages
		.order("created_at", { ascending: false })
		.limit(1);

	// If user has a last active channel, redirect to it
	if (lastMessage?.[0]?.channel_id) {
		redirect(`/channels/${lastMessage[0].channel_id}`);
	}

	// Fallback: Get all channels the user is a member of
	const { data: channels } = await supabaseAdmin
		.from("channel_members")
		.select("channel_id")
		.eq("user_id", session.user.id)
		.order("joined_at");

	// If user is a member of any channel, redirect to the first one
	if (channels?.[0]?.channel_id) {
		redirect(`/channels/${channels[0].channel_id}`);
	}

	return null;
}
