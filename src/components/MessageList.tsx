"use client";

import { getAuthenticatedSupabaseClient } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";
import { useEffect, useState, useRef, useCallback } from "react";
import type {
	RealtimeChannel,
	RealtimePostgresChangesPayload,
} from "@supabase/supabase-js";
import { useSession } from "next-auth/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import "highlight.js/styles/github-dark.css";
import UserAvatar from "./UserAvatar";

type Message = Database["public"]["Tables"]["messages"]["Row"];
type User = Database["public"]["Tables"]["users"]["Row"];

interface MessageListProps {
	channelId?: string | null;
	conversationId?: string | null;
	className?: string;
}

// Convert URLs to clickable links
const processLinks = (text: string) => {
	const urlRegex = /(https?:\/\/[^\s]+)/g;
	return text.replace(
		urlRegex,
		(url) =>
			`<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`,
	);
};

export default function MessageList({
	channelId,
	conversationId,
	className = "",
}: MessageListProps) {
	const { data: session } = useSession();
	const [messages, setMessages] = useState<(Message & { user: User })[]>([]);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const [isInitialLoad, setIsInitialLoad] = useState(true);

	const scrollToBottom = useCallback(() => {
		if (messagesEndRef.current) {
			messagesEndRef.current.scrollIntoView();
		}
	}, []);

	// Scroll to bottom when messages change
	useEffect(() => {
		if (messages.length > 0) {
			if (isInitialLoad) {
				scrollToBottom();
				setIsInitialLoad(false);
			} else {
				scrollToBottom();
			}
		}
	}, [messages, scrollToBottom, isInitialLoad]);

	// Reset initial load state when changing channels/conversations
	useEffect(() => {
		setIsInitialLoad(true);
	}, [channelId, conversationId]);

	// Process message content
	const processMessageContent = (content: string) => {
		return processLinks(content);
	};

	useEffect(() => {
		let subscription: RealtimeChannel | null = null;

		const setupMessaging = async () => {
			if (!session?.user?.id) return;

			const client = await getAuthenticatedSupabaseClient();

			// Initial fetch
			const { data } = await client
				.from("messages")
				.select(`
					*,
					user:users!messages_user_id_fkey(*)
				`)
				.eq(
					channelId ? "channel_id" : "conversation_id",
					channelId || conversationId,
				)
				.order("created_at", { ascending: true });

			if (data) {
				setMessages(data);
			}

			// Set up real-time subscription
			const channel = channelId
				? `messages:${channelId}`
				: `conversation:${conversationId}`;
			subscription = client
				.channel(channel)
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

			console.log("Subscription set up for:", channel);
		};

		setupMessaging();

		return () => {
			console.log("Cleaning up subscription");
			subscription?.unsubscribe();
		};
	}, [channelId, conversationId, session?.user?.id]);

	return (
		<div className={`flex-1 overflow-y-auto p-4 space-y-4 ${className}`}>
			{messages.map((message) => (
				<div key={message.id} className="flex items-start space-x-3">
					<UserAvatar user={message.user} className="w-10 h-10" />
					<div>
						<div className="flex items-center space-x-2">
							<span className="font-semibold">{message.user?.name}</span>
							<span className="text-xs text-gray-500">
								{new Date(message.created_at).toLocaleTimeString()}
							</span>
						</div>
						<div className="prose dark:prose-invert prose-sm max-w-none">
							<ReactMarkdown
								remarkPlugins={[remarkGfm]}
								rehypePlugins={[rehypeHighlight, rehypeRaw]}
							>
								{processMessageContent(message.content)}
							</ReactMarkdown>
						</div>
					</div>
				</div>
			))}
			<div ref={messagesEndRef} />
		</div>
	);
}
