import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { getSupabaseServerClient } from "@/lib/supabase-admin";

export async function GET(request: Request) {
	const session = await getServerSession(authOptions);
	if (!session?.user?.id) {
		return new NextResponse("Unauthorized", { status: 401 });
	}

	const { searchParams } = new URL(request.url);
	const channelId = searchParams.get("channelId");
	const recipientId = searchParams.get("recipientId");

	if (!channelId && !recipientId) {
		return new NextResponse("Missing channelId or recipientId", {
			status: 400,
		});
	}

	const client = getSupabaseServerClient();

	const { data, error } = await client
		.from("messages")
		.select(`
			*,
			user:users!messages_user_id_fkey(*)
		`)
		.or(
			channelId
				? `channel_id.eq.${channelId}`
				: `and(user_id.eq.${session.user.id},recipient_id.eq.${recipientId}),and(user_id.eq.${recipientId},recipient_id.eq.${session.user.id})`,
		)
		.order("created_at", { ascending: true });

	if (error) {
		console.error("Error fetching messages:", error);
		return new NextResponse("Internal Server Error", { status: 500 });
	}

	return NextResponse.json(data);
}
