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

	const handleInvite = async () => {
		// This function should be removed
	};

	return (
		<div className="p-4 border-l border-[#E0DED2] w-64 flex flex-col">
			<h2 className="text-lg font-semibold mb-4">Members</h2>
			<div className="flex-1 overflow-y-auto">
				<ul className="space-y-2">
					{members?.map((member) => (
						<li key={member.user_id} className="flex items-center gap-2">
							<UserAvatar user={member.user} className="w-6 h-6" />
							<span className="text-sm">{member.user.name}</span>
							{member.role === "admin" && (
								<span className="text-xs text-gray-500">(Admin)</span>
							)}
						</li>
					))}
				</ul>
			</div>
		</div>
	);
}
