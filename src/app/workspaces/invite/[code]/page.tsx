"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getAuthenticatedSupabaseClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";

export default function WorkspaceInvitePage({
	params,
}: {
	params: { code: string };
}) {
	const { data: session } = useSession();
	const router = useRouter();
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [workspaceName, setWorkspaceName] = useState<string | null>(null);

	useEffect(() => {
		const checkInvite = async () => {
			if (!session?.user?.id) return;

			try {
				const client = await getAuthenticatedSupabaseClient();

				// Check if invite exists and is valid
				const { data: workspace, error: workspaceError } = await client
					.from("workspaces")
					.select("id, name")
					.eq("invite_code", params.code)
					.single();

				if (workspaceError || !workspace) {
					setError("Invalid invite link");
					setIsLoading(false);
					return;
				}

				// Check if invite is expired or revoked
				const { data: invite } = await client
					.from("workspaces")
					.select("invite_expires_at, invite_is_revoked")
					.eq("id", workspace.id)
					.single();

				if (!invite) {
					setError("Invalid invite link");
					setIsLoading(false);
					return;
				}

				if (invite.invite_is_revoked) {
					setError("This invite link has been revoked");
					setIsLoading(false);
					return;
				}

				if (
					invite.invite_expires_at &&
					new Date(invite.invite_expires_at) < new Date()
				) {
					setError("This invite link has expired");
					setIsLoading(false);
					return;
				}

				// Check if user is already a member
				const { data: existingMember } = await client
					.from("workspace_members")
					.select("*")
					.eq("workspace_id", workspace.id)
					.eq("user_id", session.user.id)
					.single();

				if (existingMember) {
					router.push(`/channels/${workspace.id}`);
					return;
				}

				setWorkspaceName(workspace.name);
				setIsLoading(false);
			} catch (err) {
				console.error("Error checking invite:", err);
				setError("Failed to validate invite");
				setIsLoading(false);
			}
		};

		checkInvite();
	}, [session?.user?.id, params.code, router]);

	const handleJoin = async () => {
		if (!session?.user?.id) return;
		setIsLoading(true);
		setError(null);

		try {
			const client = await getAuthenticatedSupabaseClient();

			// Get workspace ID from invite code
			const { data: workspace } = await client
				.from("workspaces")
				.select("id")
				.eq("invite_code", params.code)
				.single();

			if (!workspace) {
				setError("Invalid invite link");
				setIsLoading(false);
				return;
			}

			// Add user to workspace
			const { error: memberError } = await client
				.from("workspace_members")
				.insert({
					workspace_id: workspace.id,
					user_id: session.user.id,
					role: "member",
				});

			if (memberError) throw memberError;

			// Get first channel in workspace
			const { data: channels } = await client
				.from("channels")
				.select("id")
				.eq("workspace_id", workspace.id)
				.order("created_at")
				.limit(1);

			if (channels?.[0]) {
				// Add user to the channel
				const { error: channelMemberError } = await client
					.from("channel_members")
					.insert({
						channel_id: channels[0].id,
						user_id: session.user.id,
						role: "member",
					});

				if (channelMemberError) throw channelMemberError;
			}

			// Update workspace_members table to trigger real-time update
			await client
				.from("workspace_members")
				.update({ joined_at: new Date().toISOString() })
				.eq("workspace_id", workspace.id)
				.eq("user_id", session.user.id);

			if (channels?.[0]) {
				router.push(`/channels/${channels[0].id}`);
			} else {
				router.push("/");
			}
		} catch (err) {
			console.error("Error joining workspace:", err);
			setError("Failed to join workspace");
			setIsLoading(false);
		}
	};

	if (!session) return null;

	return (
		<div className="min-h-screen bg-[#F2F0E5] dark:bg-gray-900 flex items-center justify-center p-4">
			<div className="w-full max-w-md space-y-8 text-center">
				{isLoading ? (
					<p>Loading...</p>
				) : error ? (
					<div className="space-y-4">
						<p className="text-red-600 dark:text-red-500">{error}</p>
						<Button onClick={() => router.push("/")}>Go Home</Button>
					</div>
				) : (
					<div className="space-y-4">
						<h1 className="text-2xl font-bold">Join {workspaceName}</h1>
						<p className="text-gray-600 dark:text-gray-400">
							You've been invited to join this workspace.
						</p>
						<Button onClick={handleJoin} disabled={isLoading}>
							{isLoading ? "Joining..." : "Join Workspace"}
						</Button>
					</div>
				)}
			</div>
		</div>
	);
}
