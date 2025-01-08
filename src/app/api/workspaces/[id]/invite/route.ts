import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { nanoid } from "nanoid";
import { NextResponse } from "next/server";

export async function POST(
	request: Request,
	{ params }: { params: { id: string } },
) {
	const session = await auth();
	if (!session?.user?.id) {
		return new NextResponse("Unauthorized", { status: 401 });
	}

	// Check if user is workspace admin/owner
	const { data: member } = await supabaseAdmin
		.from("workspace_members")
		.select("role")
		.eq("workspace_id", params.id)
		.eq("user_id", session.user.id)
		.single();

	if (!member || !["owner", "admin"].includes(member.role)) {
		return new NextResponse("Forbidden", { status: 403 });
	}

	// Generate invite code
	const code = nanoid(10);
	const expiresAt = new Date();
	expiresAt.setDate(expiresAt.getDate() + 7); // Expires in 7 days

	// Update workspace with new invite code
	const { error } = await supabaseAdmin
		.from("workspaces")
		.update({
			invite_code: code,
			invite_expires_at: expiresAt.toISOString(),
			invite_is_revoked: false,
		})
		.eq("id", params.id);

	if (error) {
		console.error("Error creating invite:", error);
		return new NextResponse("Internal Server Error", { status: 500 });
	}

	return NextResponse.json({ code });
}
