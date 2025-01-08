"use client";

import { useSession } from "next-auth/react";
import { useRef, useEffect, useState, useCallback } from "react";
import { getAuthenticatedSupabaseClient } from "@/lib/supabase";
import UserAvatar from "./UserAvatar";
import MessageContent from "./MessageContent";
import type { Database } from "@/lib/database.types";
import { Button } from "./ui/button";
import { MessageSquare } from "lucide-react";
import { useRouter } from "next/navigation";

type Message = Database["public"]["Tables"]["messages"]["Row"] & {
	sender: Database["public"]["Tables"]["users"]["Row"];
};

export default function MessageList({
	channelId,
	conversationId,
	parentId,
}: {
	channelId?: string;
	conversationId?: string;
	parentId?: string;
}) {
	const router = useRouter();
	const { data: session } = useSession();
	const [messages, setMessages] = useState<Message[]>([]);
	const [memberCount, setMemberCount] = useState(0);
	const messagesEndRef = useRef<HTMLDivElement>(null);

	// Add scrollToBottom function
	const scrollToBottom = useCallback(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, []);

	// Scroll to bottom when messages change
	useEffect(() => {
		scrollToBottom();
	}, [messages, scrollToBottom]);

	useEffect(() => {
		let isSubscribed = true;

		const setupMessaging = async () => {
			if (!session?.user?.id) return;
			if (!channelId && !conversationId) return;

			const client = await getAuthenticatedSupabaseClient();

			const fetchMessages = async () => {
				if (channelId) {
					const query = client
						.from("messages")
						.select("*, sender:users!messages_user_id_fkey(*)")
						.eq("channel_id", channelId)
						.order("created_at", { ascending: true });

					// If in thread view, only show replies
					if (parentId) {
						query.eq("parent_id", parentId);
					} else {
						// In main channel view, only show parent messages
						query.is("parent_id", null);
					}

					const { data } = await query;

					if (data && isSubscribed) {
						setMessages(data);
					}

					// Get member count
					const { count } = await client
						.from("channel_members")
						.select("*", { count: "exact", head: true })
						.eq("channel_id", channelId);
					if (isSubscribed) {
						setMemberCount(count || 0);
					}
				} else if (conversationId) {
					const { data } = await client
						.from("messages")
						.select("*, sender:users!messages_user_id_fkey(*)")
						.eq("conversation_id", conversationId)
						.order("created_at", { ascending: true });

					if (data && isSubscribed) {
						setMessages(data);
					}
				}
			};

			await fetchMessages();

			// Set up real-time subscription
			const channel = client
				.channel("messages")
				.on(
					"postgres_changes",
					{
						event: "*",
						schema: "public",
						table: "messages",
						filter: channelId
							? `channel_id=eq.${channelId}`
							: `conversation_id=eq.${conversationId}`,
					},
					() => {
						fetchMessages();
					},
				)
				.subscribe();

			return () => {
				isSubscribed = false;
				channel.unsubscribe();
			};
		};

		const cleanup = setupMessaging();
		return () => {
			cleanup.then((unsubscribe) => unsubscribe?.());
		};
	}, [channelId, conversationId, session?.user?.id, parentId]);

	if (messages.length === 0 && channelId && memberCount === 1) {
		return (
			<div className="flex-1 flex items-center justify-center p-4">
				<div className="text-center">
					<h2 className="text-lg font-semibold mb-2">
						Welcome to the channel!
					</h2>
					<p className="text-gray-600 dark:text-gray-400 mb-4">
						You're the first one here. Invite others to join the conversation.
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="flex-1 overflow-y-auto p-4">
			{messages.map((message) => (
				<div key={message.id} className="mb-4 group relative">
					<div className="flex items-start gap-2">
						<UserAvatar user={message.sender} className="w-8 h-8 mt-0.5" />
						<div className="flex-1">
							<div className="flex items-baseline gap-2">
								<span className="font-medium">
									{message.sender?.name || "Unknown User"}
								</span>
								<span className="text-xs text-gray-500">
									{new Date(message.created_at).toLocaleTimeString()}
								</span>
							</div>
							<MessageContent content={message.content} />
						</div>
						{channelId && !message.parent_id && (
							<Button
								variant="ghost"
								size="sm"
								className="opacity-0 group-hover:opacity-100 transition-opacity"
								onClick={() =>
									router.push(`/channels/${channelId}/threads/${message.id}`)
								}
							>
								<MessageSquare className="h-4 w-4" />
							</Button>
						)}
					</div>
				</div>
			))}
			<div ref={messagesEndRef} />
		</div>
	);
}
