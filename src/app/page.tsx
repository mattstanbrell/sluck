import { supabaseAdmin } from "@/lib/supabase-admin";
import { redirect } from "next/navigation";

export default async function Home() {
	// Get all channels
	const { data: channels } = await supabaseAdmin
		.from("channels")
		.select("id")
		.order("created_at");

	if (channels?.[0]) {
		redirect(`/channels/${channels[0].id}`);
	}

	return null;
}
