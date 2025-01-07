"use client";

import { signOut, useSession } from "next-auth/react";
import { supabase, getAuthenticatedSupabaseClient } from "@/lib/supabase";
import type { Channel } from "@/types/database";
import Link from "next/link";
import { useEffect, useState } from "react";
import CreateChannelModal from "./CreateChannelModal";

export default function Sidebar() {
	const { data: session } = useSession();
	const [channels, setChannels] = useState<Channel[]>([]);
	const [isModalOpen, setIsModalOpen] = useState(false);

	useEffect(() => {
		// Initial fetch
		fetchChannels();

		// Set up real-time subscription for channels
		const subscription = supabase
			.channel("channels")
			.on(
				"postgres_changes",
				{
					event: "*",
					schema: "public",
					table: "channels",
				},
				() => {
					fetchChannels();
				},
			)
			.subscribe();

		return () => {
			subscription.unsubscribe();
		};
	}, []);

	const fetchChannels = async () => {
		const client = await getAuthenticatedSupabaseClient();
		const { data } = await client
			.from("channels")
			.select("*")
			.order("created_at");
		if (data) setChannels(data);
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
			/>
		</div>
	);
}
