import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { auth } from "@/auth";

export async function GET(request: Request) {
	try {
		const session = await auth();
		if (!session) {
			return new NextResponse("Unauthorized", { status: 401 });
		}

		const { searchParams } = new URL(request.url);
		const channelId = searchParams.get("channelId");

		if (!channelId) {
			return new NextResponse("Missing channelId", { status: 400 });
		}

		console.log("Fetching messages for channel:", channelId);
		console.log("User session:", session);

		const { data, error } = await supabaseAdmin
			.from("messages")
			.select(`
				*,
				user:users!messages_user_id_fkey(*)
			`)
			.eq("channel_id", channelId)
			.order("created_at", { ascending: true });

		if (error) {
			console.error("Supabase error:", error);
			return new NextResponse(error.message, { status: 500 });
		}

		if (!data) {
			console.log("No messages found");
			return NextResponse.json([]);
		}

		console.log(`Found ${data.length} messages`);
		return NextResponse.json(data);
	} catch (error) {
		console.error("Unexpected error:", error);
		return new NextResponse(
			error instanceof Error ? error.message : "Internal Server Error",
			{ status: 500 },
		);
	}
}
