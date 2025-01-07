import { supabase } from "@/lib/supabase";
import { redirect } from "next/navigation";

export default async function Home() {
	// Get the first channel
	const { data: channels } = await supabase
		.from("channels")
		.select("id")
		.order("created_at")
		.limit(1);

	if (channels?.[0]) {
		redirect(`/channels/${channels[0].id}`);
	}

	return null;
}
