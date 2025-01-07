"use client";

import { getAuthenticatedSupabaseClient } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";
import { useEffect, useState } from "react";
import type {
	RealtimeChannel,
	RealtimePostgresChangesPayload,
} from "@supabase/supabase-js";

type Message = Database["public"]["Tables"]["messages"]["Row"];
type User = Database["public"]["Tables"]["users"]["Row"];

export default function MessageList({ channelId }: { channelId: string }) {
	const [messages, setMessages] = useState<(Message & { user: User })[]>([]);

	useEffect(() => {
		let subscription: RealtimeChannel | null = null;

		const setupMessaging = async () => {
			// Initial fetch from API
			const response = await fetch(`/api/messages?channelId=${channelId}`);
			if (!response.ok) return;
			const data = await response.json();
			setMessages(data);

			// Set up real-time subscription with authenticated client
			const client = await getAuthenticatedSupabaseClient();
			subscription = client
				.channel(`messages:${channelId}`)
				.on(
					"postgres_changes",
					{
						event: "*",
						schema: "public",
						table: "messages",
						filter: `channel_id=eq.${channelId}`,
					},
					async (payload: RealtimePostgresChangesPayload<Message>) => {
						console.log("Received message update:", payload);

						if (payload.eventType === "INSERT") {
							// Fetch the complete message with user data
							const { data: messageData } = await client
								.from("messages")
								.select(`
									*,
									user:users!messages_user_id_fkey(*)
								`)
								.eq("id", payload.new.id)
								.single();

							if (messageData) {
								console.log("Adding new message:", messageData);
								setMessages((current) => [...current, messageData]);
							}
						} else if (payload.eventType === "UPDATE") {
							setMessages((current) =>
								current.map((msg) =>
									msg.id === payload.new.id ? { ...msg, ...payload.new } : msg,
								),
							);
						} else if (payload.eventType === "DELETE") {
							setMessages((current) =>
								current.filter((msg) => msg.id !== payload.old.id),
							);
						}
					},
				)
				.subscribe((status) => {
					console.log("Subscription status:", status);
				});

			console.log("Subscription set up for channel:", channelId);
		};

		setupMessaging();

		return () => {
			console.log("Cleaning up subscription");
			subscription?.unsubscribe();
		};
	}, [channelId]);

	return (
		<div className="flex-1 overflow-y-auto p-4 space-y-4">
			{messages.map((message) => (
				<div key={message.id} className="flex items-start space-x-3">
					{message.user?.avatar_url && (
						<img
							src={message.user.avatar_url}
							alt=""
							className="w-10 h-10 rounded-full"
						/>
					)}
					<div>
						<div className="flex items-center space-x-2">
							<span className="font-semibold">{message.user?.name}</span>
							<span className="text-xs text-gray-500">
								{new Date(message.created_at).toLocaleTimeString()}
							</span>
						</div>
						<p className="text-gray-900 dark:text-gray-100">
							{message.content}
						</p>
					</div>
				</div>
			))}
		</div>
	);
}
