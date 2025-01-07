"use client";

import { signOut, useSession } from "next-auth/react";
import { supabase, getAuthenticatedSupabaseClient } from "@/lib/supabase";
import Link from "next/link";
import { useEffect, useState } from "react";
import CreateChannelModal from "./CreateChannelModal";
import type { Database } from "@/lib/database.types";

type Channel = Database["public"]["Tables"]["channels"]["Row"];
type ChannelMember = Database["public"]["Tables"]["channel_members"]["Row"] & {
	channel: Channel;
};

export default function Sidebar() {
	const { data: session } = useSession();
	const [channels, setChannels] = useState<Channel[]>([]);
	const [isModalOpen, setIsModalOpen] = useState(false);

	useEffect(() => {
		let subscription: ReturnType<typeof supabase.channel> | null = null;

		const setupSubscription = async () => {
			// Initial fetch
			await fetchChannels();

			// Set up real-time subscription for channels
			const client = await getAuthenticatedSupabaseClient();
			subscription = client
				.channel("channels")
				.on(
					"postgres_changes",
					{
						event: "*",
						schema: "public",
						table: "channel_members",
						filter: session?.user?.id
							? `user_id=eq.${session.user.id}`
							: undefined,
					},
					() => {
						fetchChannels();
					},
				)
				.subscribe();
		};

		if (session?.user?.id) {
			setupSubscription();
		}

		return () => {
			subscription?.unsubscribe();
		};
	}, [session?.user?.id]);

	const fetchChannels = async () => {
		if (!session?.user?.id) return;

		const client = await getAuthenticatedSupabaseClient();
		const { data } = await client
			.from("channel_members")
			.select("*, channel:channels(*)")
			.eq("user_id", session.user.id)
			.order("joined_at");

		if (data) {
			// Extract the channel data from the joined query and ensure it's not null
			const channelData = (data as ChannelMember[])
				.map((item) => item.channel)
				.filter((channel): channel is Channel => channel !== null);
			setChannels(channelData);
		}
	};

	if (!session) return null;

	return (
		<div className="w-64 bg-gray-100 dark:bg-gray-900 p-4 flex flex-col h-screen">
			<div className="mb-8">
				<h1 className="text-xl font-bold">Sluck</h1>
			</div>

			<div className="flex-1 space-y-4">
				<div>
					<div className="flex items-center justify-between mb-2">
						<h2 className="text-sm font-semibold text-gray-600 dark:text-gray-400">
							Channels
						</h2>
						<button
							type="button"
							onClick={() => setIsModalOpen(true)}
							className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
						>
							+
						</button>
					</div>
					<ul className="space-y-1">
						{channels?.map((channel) => (
							<li key={channel.id}>
								<Link
									href={`/channels/${channel.id}`}
									className="block px-2 py-1 rounded hover:bg-gray-200 dark:hover:bg-gray-800"
								>
									# {channel.name}
								</Link>
							</li>
						))}
					</ul>
				</div>
			</div>

			{/* User profile and sign out */}
			<div className="border-t pt-4 mt-4">
				<div className="flex items-center justify-between">
					<div className="flex items-center">
						{session.user?.image && (
							<img
								src={session.user.image}
								alt=""
								className="w-8 h-8 rounded-full mr-2"
							/>
						)}
						<span className="text-sm font-medium">{session.user?.name}</span>
					</div>
					<button
						type="button"
						onClick={() => signOut()}
						className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
					>
						Sign out
					</button>
				</div>
			</div>

			<CreateChannelModal
				isOpen={isModalOpen}
				onClose={() => setIsModalOpen(false)}
				onChannelCreated={fetchChannels}
			/>
		</div>
	);
}
