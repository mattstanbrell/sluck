"use client";

import { useSession } from "next-auth/react";
import { useRef, useEffect, useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import hljs from "highlight.js";
import { getAuthenticatedSupabaseClient } from "@/lib/supabase";
import UserAvatar from "./UserAvatar";
import type { Database } from "@/lib/database.types";

type Message = Database["public"]["Tables"]["messages"]["Row"] & {
	sender: Database["public"]["Tables"]["users"]["Row"];
};

export default function MessageList({
	channelId,
	conversationId,
}: {
	channelId?: string;
	conversationId?: string;
}) {
	const { data: session } = useSession();
	const [messages, setMessages] = useState<Message[]>([]);
	const [memberCount, setMemberCount] = useState(0);
	const messagesEndRef = useRef<HTMLDivElement>(null);

	// Initialize highlight.js
	useEffect(() => {
		hljs.configure({
			languages: [
				"javascript",
				"typescript",
				"python",
				"bash",
				"sql",
				"json",
				"html",
				"css",
			],
		});
	}, []);

	const highlightCode = useCallback((code: string, language: string) => {
		try {
			return hljs.highlight(code, {
				language: language || "plaintext",
				ignoreIllegals: true,
			}).value;
		} catch {
			return hljs.highlight(code, {
				language: "plaintext",
				ignoreIllegals: true,
			}).value;
		}
	}, []);

	useEffect(() => {
		let isSubscribed = true;

		const setupMessaging = async () => {
			if (!session?.user?.id) return;
			if (!channelId && !conversationId) return;

			const client = await getAuthenticatedSupabaseClient();

			const fetchMessages = async () => {
				if (channelId) {
					const { data } = await client
						.from("messages")
						.select("*, sender:users!messages_user_id_fkey(*)")
						.eq("channel_id", channelId)
						.order("created_at", { ascending: true });

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
	}, [channelId, conversationId, session?.user?.id]);

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
				<div key={message.id} className="mb-4">
					<div className="flex items-start gap-2">
						<UserAvatar user={message.sender} className="w-8 h-8 mt-0.5" />
						<div>
							<div className="flex items-baseline gap-2">
								<span className="font-medium">
									{message.sender?.name || "Unknown User"}
								</span>
								<span className="text-xs text-gray-500">
									{new Date(message.created_at).toLocaleTimeString()}
								</span>
							</div>
							<div className="prose dark:prose-invert max-w-none">
								<ReactMarkdown
									components={{
										code(props) {
											const { children = "", className = "" } = props;
											const content = String(children).replace(/\n$/, "");

											// Check if this is a code block (has language class or contains newlines)
											const isCodeBlock =
												className?.includes("language-") ||
												content.includes("\n");

											if (!isCodeBlock) {
												return <code>{content}</code>;
											}

											const language =
												/language-(\w+)/.exec(className)?.[1] || "";
											const highlighted = highlightCode(content, language);

											return (
												<pre>
													<code
														className={`hljs ${language ? `language-${language}` : ""}`}
														dangerouslySetInnerHTML={{ __html: highlighted }}
													/>
												</pre>
											);
										},
									}}
								>
									{message.content}
								</ReactMarkdown>
							</div>
						</div>
					</div>
				</div>
			))}
			<div ref={messagesEndRef} />
		</div>
	);
}
