"use client";

import { supabase } from "@/lib/supabase";
import { Message, User } from "@/types/database";
import { useEffect, useState } from "react";

export default function MessageList({ channelId }: { channelId: string }) {
	const [messages, setMessages] = useState<(Message & { user: User })[]>([]);

	useEffect(() => {
		// Initial fetch
		const fetchMessages = async () => {
			const { data } = await supabase
				.from("messages")
				.select(`
          *,
          user:users(*)
        `)
				.eq("channel_id", channelId)
				.order("created_at", { ascending: true });

			if (data) setMessages(data as (Message & { user: User })[]);
		};

		fetchMessages();

		// Set up real-time subscription
		const subscription = supabase
			.channel(`messages:${channelId}`)
			.on(
				"postgres_changes",
				{
					event: "*",
					schema: "public",
					table: "messages",
					filter: `channel_id=eq.${channelId}`,
				},
				async (payload) => {
					if (payload.eventType === "INSERT") {
						const { data: userData } = await supabase
							.from("users")
							.select("*")
							.eq("id", payload.new.user_id)
							.single();

						setMessages((current) => [
							...current,
							{ ...payload.new, user: userData } as Message & { user: User },
						]);
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
			.subscribe();

		return () => {
			subscription.unsubscribe();
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
