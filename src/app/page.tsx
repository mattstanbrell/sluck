import { supabaseAdmin } from "@/lib/supabase-admin";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

export default async function Home() {
	const session = await auth();
	if (!session?.user?.id) {
		redirect("/signin");
	}

	// Get user's workspace
	const { data: workspaceMember } = await supabaseAdmin
		.from("workspace_members")
		.select("workspace_id")
		.eq("user_id", session.user.id)
		.order("joined_at")
		.limit(1)
		.single();

	if (!workspaceMember?.workspace_id) {
		redirect("/workspaces/new");
	}

	// Get first channel in workspace
	const { data: channels } = await supabaseAdmin
		.from("channels")
		.select("id")
		.eq("workspace_id", workspaceMember.workspace_id)
		.order("created_at");

	if (channels?.[0]) {
		redirect(`/channels/${channels[0].id}`);
	}

	return <div>No channels found. Create one to get started.</div>;
}
