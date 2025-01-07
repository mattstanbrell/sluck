"use client";

import { signOut, useSession } from "next-auth/react";
import { supabase, getAuthenticatedSupabaseClient } from "@/lib/supabase";
import Link from "next/link";
import { useEffect, useState } from "react";
import CreateChannelModal from "./CreateChannelModal";
import CreateDMModal from "./CreateDMModal";
import type { Database } from "@/lib/database.types";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type Channel = Database["public"]["Tables"]["channels"]["Row"];
type ChannelMember = Database["public"]["Tables"]["channel_members"]["Row"] & {
	channel: Channel;
};
type User = Database["public"]["Tables"]["users"]["Row"];
type Message = Database["public"]["Tables"]["messages"]["Row"];
type Conversation = Database["public"]["Tables"]["conversations"]["Row"];

interface DMConversation {
	id: string;
	otherUser: User;
	lastMessage: Message;
	unreadCount: number;
}

export default function Sidebar() {
	const { data: session } = useSession();
	const [channels, setChannels] = useState<Channel[]>([]);
	const [conversations, setConversations] = useState<DMConversation[]>([]);
	const [isChannelModalOpen, setIsChannelModalOpen] = useState(false);
	const [isDMModalOpen, setIsDMModalOpen] = useState(false);
	const pathname = usePathname();

	useEffect(() => {
		let channelSubscription: ReturnType<typeof supabase.channel> | null = null;
		let conversationSubscription: ReturnType<typeof supabase.channel> | null =
			null;

		const setupSubscriptions = async () => {
			// Initial fetch
			await Promise.all([fetchChannels(), fetchConversations()]);

			// Set up real-time subscription for channels
			const client = await getAuthenticatedSupabaseClient();
			channelSubscription = client
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

			// Set up real-time subscription for conversations
			conversationSubscription = client
				.channel("conversations")
				.on(
					"postgres_changes",
					{
						event: "*",
						schema: "public",
						table: "messages",
						filter: session?.user?.id ? `conversation_id.neq.null` : undefined,
					},
					() => {
						fetchConversations();
					},
				)
				.subscribe();
		};

		if (session?.user?.id) {
			setupSubscriptions();
		}

		return () => {
			channelSubscription?.unsubscribe();
			conversationSubscription?.unsubscribe();
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
			const channelData = (data as ChannelMember[])
				.map((item) => item.channel)
				.filter((channel): channel is Channel => channel !== null);
			setChannels(channelData);
		}
	};

	const fetchConversations = async () => {
		if (!session?.user?.id) return;
		console.log("Fetching conversations for user:", session.user.id);

		const client = await getAuthenticatedSupabaseClient();

		// Get all conversations the user is part of
		console.log("Querying conversation participants...");
		const { data: userConversations, error } = await client
			.from("conversation_participants")
			.select(`
				conversation:conversations!inner(
					id,
					type,
					last_message_at,
					participants:conversation_participants(
						user:users(*)
					),
					messages:messages!messages_conversation_id_fkey(
						id,
						content,
						created_at,
						sender:users!messages_user_id_fkey(*)
					)
				)
			`)
			.eq("user_id", session.user.id)
			.eq("conversations.type", "direct")
			.order("conversation(last_message_at)", { ascending: false });

		if (error) {
			console.error("Error fetching conversations:", error);
			return;
		}

		console.log("Raw conversation data:", userConversations);

		if (userConversations) {
			const conversationData: DMConversation[] = userConversations
				.map((conv) => {
					console.log("Processing conversation:", conv);
					const conversation = conv.conversation;
					if (!conversation) {
						console.log("No conversation data found");
						return null;
					}

					console.log("Conversation participants:", conversation.participants);
					if (!Array.isArray(conversation.participants)) {
						console.log("Participants is not an array");
						return null;
					}

					// Find the other participant
					const otherParticipant = conversation.participants.find(
						(p) => p.user?.id !== session.user.id,
					);
					console.log("Other participant:", otherParticipant);

					if (!otherParticipant?.user) {
						console.log("No other participant found");
						return null;
					}

					// Get the last message
					console.log("Messages:", conversation.messages);
					const messages = conversation.messages;
					// Sort messages by created_at to ensure we get the latest
					const sortedMessages = Array.isArray(messages)
						? [...messages].sort(
								(a, b) =>
									new Date(b.created_at).getTime() -
									new Date(a.created_at).getTime(),
							)
						: [];
					const lastMessage = sortedMessages[0];
					if (!lastMessage) {
						console.log("No messages found");
						return null;
					}

					console.log("Creating conversation entry with:", {
						id: conversation.id,
						otherUser: otherParticipant.user,
						lastMessage: {
							...lastMessage,
							user: lastMessage.sender,
						},
					});

					return {
						id: conversation.id,
						otherUser: otherParticipant.user,
						lastMessage: {
							...lastMessage,
							user: lastMessage.sender,
						},
						unreadCount: 0, // TODO: Implement unread count
					};
				})
				.filter((conv): conv is DMConversation => conv !== null);

			console.log("Final conversation list:", conversationData);
			setConversations(conversationData);
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
							onClick={() => setIsChannelModalOpen(true)}
							className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
						>
							+
						</button>
					</div>
					<ul className="space-y-1">
						{channels?.map((channel) => {
							const isActive = pathname === `/channels/${channel.id}`;
							return (
								<li key={channel.id}>
									<Link
										href={`/channels/${channel.id}`}
										className={cn(
											"block px-2 py-1 rounded transition-colors",
											isActive
												? "bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
												: "hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300",
										)}
									>
										# {channel.name}
									</Link>
								</li>
							);
						})}
					</ul>
				</div>

				<div>
					<div className="flex items-center justify-between mb-2">
						<h2 className="text-sm font-semibold text-gray-600 dark:text-gray-400">
							Direct Messages
						</h2>
						<button
							type="button"
							onClick={() => setIsDMModalOpen(true)}
							className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
						>
							+
						</button>
					</div>
					<ul className="space-y-1">
						{conversations.map((conv) => {
							const isActive = pathname === `/dm/${conv.id}`;
							return (
								<li key={conv.id}>
									<Link
										href={`/dm/${conv.id}`}
										className={cn(
											"block px-2 py-1 rounded transition-colors flex items-center space-x-2",
											isActive
												? "bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
												: "hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300",
										)}
									>
										{conv.otherUser.avatar_url && (
											<img
												src={conv.otherUser.avatar_url}
												alt=""
												className="w-6 h-6 rounded-full"
											/>
										)}
										<span>{conv.otherUser.name}</span>
										{conv.unreadCount > 0 && (
											<span className="ml-auto bg-blue-500 text-white text-xs rounded-full px-2 py-0.5">
												{conv.unreadCount}
											</span>
										)}
									</Link>
								</li>
							);
						})}
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
				isOpen={isChannelModalOpen}
				onClose={() => setIsChannelModalOpen(false)}
				onChannelCreated={fetchChannels}
			/>
			<CreateDMModal
				isOpen={isDMModalOpen}
				onClose={() => setIsDMModalOpen(false)}
			/>
		</div>
	);
}
