"use client";

import { useEffect, useState } from "react";
import { supabase, getAuthenticatedSupabaseClient } from "@/lib/supabase";
import type { User } from "@/types/database";
import { useSession } from "next-auth/react";
import { Button } from "./ui/button";
import { Copy, Plus } from "lucide-react";
import UserAvatar from "./UserAvatar";
import { DialogTitle } from "./ui/dialog";

type Member = {
	user_id: string;
	role: string;
	user: User;
};

// Raw response from Supabase query
type RawUser = {
	id: string;
	email: string;
	name: string;
	avatar_url: string | null;
	status: string | null;
	last_seen: string | null;
};

type QueryResponse = {
	user_id: string;
	role: string;
	user: RawUser;
};

function transformUser(rawUser: RawUser): User {
	return {
		id: rawUser.id,
		email: rawUser.email,
		name: rawUser.name,
		avatar_url: rawUser.avatar_url,
		status: rawUser.status,
		last_seen: rawUser.last_seen,
	};
}

function transformSupabaseResponse(data: QueryResponse): Member {
	return {
		user_id: data.user_id,
		role: data.role,
		user: transformUser(data.user),
	};
}

export default function ChannelMembers({ channelId }: { channelId: string }) {
	const { data: session } = useSession();
	const [members, setMembers] = useState<Member[]>([]);
	const [inviteLink, setInviteLink] = useState<string | null>(null);

	useEffect(() => {
		const fetchData = async () => {
			if (!channelId || !session?.user?.id) return;

			const client = await getAuthenticatedSupabaseClient();

			// Fetch members
			const { data } = await client
				.from("channel_members")
				.select(`
					user_id,
					role,
					user:users (
						id,
						email,
						name,
						avatar_url,
						status,
						last_seen
					)
				`)
				.eq("channel_id", channelId);

			if (data) {
				const rawData = data as unknown as QueryResponse[];
				const transformedData = rawData.map(transformSupabaseResponse);
				setMembers(transformedData);
			}

			// Check if user is admin
			const isUserAdmin = data?.some(
				(member) =>
					member.user_id === session.user.id && member.role === "admin",
			);

			if (isUserAdmin) {
				// Generate invite link if admin
				const code = Math.random().toString(36).substring(2, 15);
				const expiresAt = new Date();
				expiresAt.setDate(expiresAt.getDate() + 7);

				const { error } = await client.from("channel_invites").insert({
					channel_id: channelId,
					created_by: session.user.id,
					code,
					expires_at: expiresAt.toISOString(),
				});

				if (!error) {
					setInviteLink(`${window.location.origin}/invite/${code}`);
				}
			}
		};

		fetchData();

		// Set up realtime subscription
		const client = getAuthenticatedSupabaseClient();
		const subscription = client.then((supabase) =>
			supabase
				.channel(`channel-members-${channelId}`)
				.on(
					"postgres_changes",
					{
						event: "INSERT",
						schema: "public",
						table: "channel_members",
						filter: `channel_id=eq.${channelId}`,
					},
					async (payload) => {
						// ... existing subscription code ...
					},
				)
				.on(
					"postgres_changes",
					{
						event: "DELETE",
						schema: "public",
						table: "channel_members",
						filter: `channel_id=eq.${channelId}`,
					},
					(payload) => {
						// ... existing subscription code ...
					},
				)
				.subscribe(),
		);

		return () => {
			subscription.then((sub) => sub.unsubscribe());
		};
	}, [channelId, session?.user?.id]);

	const copyInviteLink = async () => {
		if (!inviteLink) return;
		try {
			await navigator.clipboard.writeText(inviteLink);
			alert("Invite link copied to clipboard!");
		} catch (error) {
			console.error("Error copying to clipboard:", error);
			alert("Failed to copy invite link. Please try again.");
		}
	};

	const isAdmin = members.some(
		(member) => member.user_id === session?.user?.id && member.role === "admin",
	);

	return (
		<div className="p-6 h-full overflow-y-auto">
			<DialogTitle className="sr-only">Channel Info</DialogTitle>
			<div className="mt-8">
				{isAdmin && inviteLink && (
					<div className="mb-8">
						<h3 className="text-lg font-semibold mb-4">Invite Link</h3>
						<div className="flex items-center gap-2 p-2 bg-[#F2F0E5] dark:bg-gray-800 rounded-md">
							<div className="flex-1 truncate text-sm">{inviteLink}</div>
							<Button
								variant="ghost"
								size="sm"
								onClick={copyInviteLink}
								className="shrink-0"
							>
								<Copy className="h-4 w-4" />
							</Button>
						</div>
					</div>
				)}

				<div>
					<h3 className="text-lg font-semibold mb-6">Channel Members</h3>
					<ul className="space-y-4">
						{members.map((member) => (
							<li key={member.user_id} className="flex items-center gap-3">
								<UserAvatar user={member.user} className="w-9 h-9" />
								<div>
									<div className="font-medium">
										{member.user?.name || "Unknown User"}
									</div>
									<div className="text-xs text-gray-500 capitalize">
										{member.role}
									</div>
								</div>
							</li>
						))}
					</ul>
				</div>
			</div>
		</div>
	);
}
