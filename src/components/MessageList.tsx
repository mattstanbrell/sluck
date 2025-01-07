"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { getAuthenticatedSupabaseClient } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";

type Message = Database["public"]["Tables"]["messages"]["Row"] & {
	sender: Database["public"]["Tables"]["users"]["Row"];
};

interface MessageListProps {
	channelId?: string;
	conversationId?: string;
}

export default function MessageList({ channelId, conversationId }: MessageListProps) {
	const [messages, setMessages] = useState<Message[]>([]);
	const [memberCount, setMemberCount] = useState(0);
	const [inviteLink, setInviteLink] = useState<string | null>(null);
	const { data: session } = useSession();

	useEffect(() => {
		const fetchMessages = async () => {
			if (!channelId && !conversationId) return;
			const client = await getAuthenticatedSupabaseClient();

			// Get messages
			const { data } = await client
				.from("messages")
				.select(
					`
					*,
					sender:user_id(
						id,
						name,
						email,
						avatar_url
					)
				`,
				)
				.eq(channelId ? "channel_id" : "conversation_id", channelId || conversationId)
				.order("created_at", { ascending: true });

			if (data) {
				setMessages(data as Message[]);
			}

			// If it's a channel, get member count
			if (channelId) {
				const { count } = await client
					.from("channel_members")
					.select("*", { count: "exact", head: true })
					.eq("channel_id", channelId);
				setMemberCount(count || 0);

				// If there's only one member, generate an invite link
				if (count === 1 && session?.user?.id) {
					// Generate a random code
					const code = Math.random().toString(36).substring(2, 15);

					// Set expiry to 7 days from now
					const expiresAt = new Date();
					expiresAt.setDate(expiresAt.getDate() + 7);

					// Create the invite
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
			}
		};

		fetchMessages();

		// Set up realtime subscription
		const client = getAuthenticatedSupabaseClient();
		const channel = client.then((supabase) => 
			supabase
				.channel(`messages-${channelId || conversationId}`)
				.on(
					"postgres_changes",
					{
						event: "INSERT",
						schema: "public",
						table: "messages",
						filter: channelId
							? `channel_id=eq.${channelId}`
							: `conversation_id=eq.${conversationId}`,
					},
					async (payload) => {
						const client = await getAuthenticatedSupabaseClient();
						const { data } = await client
							.from("messages")
							.select(
								`
								*,
								sender:user_id(
									id,
									name,
									email,
									avatar_url
								)
							`,
							)
							.eq("id", payload.new.id)
							.single();

						if (data) {
							setMessages((current) => [...current, data as Message]);
						}
					},
				)
				.subscribe()
		);

		return () => {
			channel.then((subscription) => subscription.unsubscribe());
		};
	}, [channelId, conversationId, session?.user?.id]);

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

	if (messages.length === 0 && channelId && memberCount === 1) {
		return (
			<div className="flex-1 flex items-center justify-center">
				<div className="text-center max-w-md mx-auto p-6">
					<h3 className="text-xl font-semibold mb-2">Welcome to the channel!</h3>
					<p className="text-gray-600 dark:text-gray-400 mb-6">
						You're the first one here. Invite your teammates to start the conversation.
					</p>
					<div className="flex items-center justify-center gap-2 p-3 bg-gray-100 dark:bg-gray-800 rounded-md">
						<div className="text-sm truncate max-w-[300px]">{inviteLink}</div>
						<Button variant="ghost" size="sm" onClick={copyInviteLink}>
							<Copy className="h-4 w-4" />
						</Button>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="flex-1 p-4 space-y-4">
			{messages.map((message) => (
				<div key={message.id} className="flex items-start gap-3">
					{message.sender?.avatar_url && (
						<img
							src={message.sender.avatar_url}
							alt=""
							className="w-8 h-8 rounded-full"
						/>
					)}
					<div>
						<div className="flex items-baseline gap-2">
							<span className="font-medium">
								{message.sender?.name || "Unknown User"}
							</span>
							<span className="text-xs text-gray-500">
								{new Date(message.created_at).toLocaleTimeString()}
							</span>
						</div>
						<div className="mt-1 text-gray-700 dark:text-gray-300">
							{message.content}
						</div>
					</div>
				</div>
			))}
		</div>
	);
}
