"use client";

import { useEffect, useState } from "react";
import { supabase, getAuthenticatedSupabaseClient } from "@/lib/supabase";
import type { User } from "@/types/database";

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
	const [members, setMembers] = useState<Member[]>([]);

	useEffect(() => {
		let subscription: ReturnType<typeof supabase.channel> | null = null;

		const fetchMembers = async () => {
			console.log("Fetching members for channel:", channelId);
			const client = await getAuthenticatedSupabaseClient();
			const { data, error } = await client
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

			if (error) {
				console.error("Error fetching members:", error);
				return;
			}

			console.log("Raw data from Supabase:", JSON.stringify(data, null, 2));

			// Transform the data to match our Member type
			const rawData = data as unknown as QueryResponse[];
			const transformedData = rawData
				?.filter((member) => !!member?.user)
				.map(transformSupabaseResponse);

			console.log("Transformed data:", transformedData);
			setMembers(transformedData || []);
		};

		fetchMembers();

		// Subscribe to changes
		subscription = supabase
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
					console.log("Received INSERT event:", payload);
					// Fetch the complete member data including user info
					const client = await getAuthenticatedSupabaseClient();
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
						.eq("channel_id", channelId)
						.eq("user_id", payload.new.user_id)
						.single();

					console.log(
						"Fetched new member data:",
						JSON.stringify(data, null, 2),
					);

					if (data?.user) {
						const rawData = data as unknown as QueryResponse;
						const newMember = transformSupabaseResponse(rawData);
						setMembers((current) => [...current, newMember]);
					}
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
					console.log("Received DELETE event:", payload);
					setMembers((current) =>
						current.filter((member) => member.user_id !== payload.old.user_id),
					);
				},
			)
			.on(
				"postgres_changes",
				{
					event: "UPDATE",
					schema: "public",
					table: "channel_members",
					filter: `channel_id=eq.${channelId}`,
				},
				async (payload) => {
					console.log("Received UPDATE event:", payload);
					// Fetch updated member data
					const client = await getAuthenticatedSupabaseClient();
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
						.eq("channel_id", channelId)
						.eq("user_id", payload.new.user_id)
						.single();

					console.log(
						"Fetched updated member data:",
						JSON.stringify(data, null, 2),
					);

					if (data?.user) {
						const rawData = data as unknown as QueryResponse;
						const updatedMember = transformSupabaseResponse(rawData);
						setMembers((current) =>
							current.map((member) =>
								member.user_id === payload.new.user_id ? updatedMember : member,
							),
						);
					}
				},
			)
			.subscribe();

		return () => {
			subscription?.unsubscribe();
		};
	}, [channelId]);

	console.log("Current members state:", members);

	return (
		<div className="p-6 h-full overflow-y-auto">
			<h3 className="text-lg font-semibold mb-6">Channel Members</h3>
			<ul className="space-y-4">
				{members.map((member) => (
					<li key={member.user_id} className="flex items-center gap-3">
						{member.user?.avatar_url ? (
							<img
								src={member.user.avatar_url}
								alt={member.user.name}
								className="w-9 h-9 rounded-full"
							/>
						) : (
							<div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-base">
								{member.user?.name?.[0] || "?"}
							</div>
						)}
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
	);
}
