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
import { Menu } from "lucide-react";
import {
	Sheet,
	SheetContent,
	SheetTrigger,
	SheetClose,
} from "@/components/ui/sheet";
import UserAvatar from "./UserAvatar";

type Channel = Database["public"]["Tables"]["channels"]["Row"];
type ChannelMember = Database["public"]["Tables"]["channel_members"]["Row"] & {
	channel: Channel;
};
type User = Database["public"]["Tables"]["users"]["Row"];
type Message = Database["public"]["Tables"]["messages"]["Row"] & {
	sender: User;
};

interface ConversationParticipant {
	user: User;
}

interface ConversationWithDetails {
	id: string;
	type: string;
	last_message_at: string;
	participants: ConversationParticipant[];
	messages: Message[];
}

interface DMConversation {
	id: string;
	otherUser: User;
	lastMessage: Message;
	unreadCount: number;
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
	const { data: session } = useSession();
	const [channels, setChannels] = useState<Channel[]>([]);
	const [conversations, setConversations] = useState<DMConversation[]>([]);
	const [isChannelModalOpen, setIsChannelModalOpen] = useState(false);
	const [isDMModalOpen, setIsDMModalOpen] = useState(false);
	const pathname = usePathname();

	useEffect(() => {
		console.log("Sidebar useEffect triggered with session:", {
			userId: session?.user?.id,
			email: session?.user?.email,
		});

		let channelSubscription: ReturnType<typeof supabase.channel> | null = null;
		let conversationSubscription: ReturnType<typeof supabase.channel> | null =
			null;

		const setupSubscriptions = async () => {
			try {
				console.log("Setting up subscriptions for user:", session?.user?.id);

				// Initial fetch
				try {
					console.log("Starting initial data fetch...");
					await Promise.all([fetchChannels(), fetchConversations()]);
					console.log("Initial data fetch completed");
				} catch (error) {
					console.error("Error during initial data fetch:", error);
				}

				// Set up real-time subscription for channels
				try {
					const client = await getAuthenticatedSupabaseClient();
					console.log("Setting up channel subscription");

					channelSubscription = client
						?.channel(`channels-${session?.user?.id}`)
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
							(payload) => {
								console.log("Received channel update:", payload);
								fetchChannels();
							},
						)
						.subscribe((status) => {
							console.log("Channel subscription status:", status);
						});

					// Set up real-time subscription for conversations
					conversationSubscription = client
						?.channel(`conversations-${session?.user?.id}`)
						.on(
							"postgres_changes",
							{
								event: "*",
								schema: "public",
								table: "messages",
								filter: session?.user?.id
									? "conversation_id.neq.null"
									: undefined,
							},
							(payload) => {
								console.log("Received conversation update:", payload);
								fetchConversations();
							},
						)
						.subscribe((status) => {
							console.log("Conversation subscription status:", status);
						});
				} catch (error) {
					console.error("Error setting up realtime subscriptions:", error);
				}
			} catch (error) {
				console.error("Error in setupSubscriptions:", error);
			}
		};

		if (session?.user?.id) {
			console.log("User session found, calling setupSubscriptions");
			setupSubscriptions();
		} else {
			console.log("No user session found, skipping setupSubscriptions");
		}

		return () => {
			console.log("Cleaning up subscriptions");
			if (channelSubscription) {
				console.log("Unsubscribing from channel subscription");
				channelSubscription.unsubscribe();
			}
			if (conversationSubscription) {
				console.log("Unsubscribing from conversation subscription");
				conversationSubscription.unsubscribe();
			}
		};
	}, [session?.user?.id]);

	const fetchChannels = async () => {
		if (!session?.user?.id) {
			console.log("No user session, skipping channel fetch");
			return;
		}

		try {
			console.log("Fetching channels for user:", session.user.id);
			const client = await getAuthenticatedSupabaseClient();
			if (!client) {
				console.error("Failed to get authenticated client");
				return;
			}

			console.log("Executing channel query...");
			const { data, error, status, statusText } = await client
				.from("channel_members")
				.select("*, channel:channels(*)")
				.eq("user_id", session.user.id)
				.order("joined_at");

			console.log("Channel query response:", {
				status,
				statusText,
				error: error
					? {
							message: error.message,
							details: error.details,
							hint: error.hint,
							code: error.code,
						}
					: null,
			});

			if (error) {
				console.error("Error fetching channels:", {
					message: error.message,
					details: error.details,
					hint: error.hint,
					code: error.code,
				});
				return;
			}

			if (!data) {
				console.log("No channel data received");
				return;
			}

			console.log("Raw channel_members data:", JSON.stringify(data, null, 2));
			console.log("Number of channel_members records:", data.length);

			const channelData = (data as ChannelMember[])
				.map((item) => {
					if (!item.channel) {
						console.log(
							"Skipping channel member - no channel data:",
							JSON.stringify(item, null, 2),
						);
						return null;
					}
					return item.channel;
				})
				.filter((channel): channel is Channel => channel !== null);

			console.log("Processed channels:", JSON.stringify(channelData, null, 2));
			console.log("Number of valid channels:", channelData.length);
			console.log(
				"Setting channels state with:",
				JSON.stringify(channelData, null, 2),
			);
			setChannels(channelData);
			console.log("Current channels state after update:", channels);
		} catch (error) {
			console.error("Unexpected error in fetchChannels:", error);
		}
	};

	const fetchConversations = async () => {
		if (!session?.user?.id) {
			console.log("No user session, skipping conversation fetch");
			return;
		}

		try {
			console.log("Fetching conversations for user:", session.user.id);
			const client = await getAuthenticatedSupabaseClient();
			if (!client) {
				console.error("Failed to get authenticated client");
				return;
			}

			console.log("Executing conversation query...");
			const {
				data: userConversations,
				error,
				status,
				statusText,
			} = await client
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

			console.log("Conversation query response:", {
				status,
				statusText,
				error: error
					? {
							message: error.message,
							details: error.details,
							hint: error.hint,
							code: error.code,
						}
					: null,
			});

			if (error) {
				console.error("Error fetching conversations:", {
					message: error.message,
					details: error.details,
					hint: error.hint,
					code: error.code,
				});
				return;
			}

			if (!userConversations) {
				console.log("No conversation data received");
				return;
			}

			console.log(
				"Raw conversation data:",
				JSON.stringify(userConversations, null, 2),
			);
			console.log("Number of conversation records:", userConversations.length);

			const conversationData: DMConversation[] = userConversations
				.map((conv: { conversation: unknown }) => {
					const conversation = conv.conversation as ConversationWithDetails;
					if (!conversation) {
						console.log("Skipping conversation - no conversation data:", conv);
						return null;
					}

					console.log("Processing conversation:", {
						id: conversation.id,
						participants: conversation.participants,
						messageCount: conversation.messages?.length || 0,
					});

					const otherParticipant = conversation.participants?.find(
						(p) => p.user?.id !== session.user.id,
					);

					if (!otherParticipant?.user) {
						console.log(
							"Skipping conversation - no other participant found:",
							conversation.id,
						);
						return null;
					}

					const messages = conversation.messages;
					const sortedMessages = Array.isArray(messages)
						? [...messages].sort(
								(a, b) =>
									new Date(b.created_at).getTime() -
									new Date(a.created_at).getTime(),
							)
						: [];
					const lastMessage = sortedMessages[0];
					if (!lastMessage) {
						console.log(
							"Skipping conversation - no messages found:",
							conversation.id,
						);
						return null;
					}

					return {
						id: conversation.id,
						otherUser: otherParticipant.user,
						lastMessage: {
							...lastMessage,
							sender: lastMessage.sender,
						},
						unreadCount: 0,
					};
				})
				.filter((conv): conv is DMConversation => conv !== null);

			console.log("Processed conversations:", conversationData);
			console.log("Number of valid conversations:", conversationData.length);
			console.log("Setting conversations state with:", conversationData);
			setConversations(conversationData);
			console.log("Current conversations state after update:", conversations);
		} catch (error) {
			console.error("Unexpected error in fetchConversations:", error);
		}
	};

	if (!session) return null;

	return (
		<div className="w-full h-full bg-[#F2F0E5] dark:bg-gray-900 p-4 flex flex-col">
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
										onClick={onNavigate}
										className={cn(
											"block px-2 py-1 rounded transition-colors",
											isActive
												? "bg-[#E7E5DA] dark:bg-gray-800 text-gray-900 dark:text-gray-100"
												: "hover:bg-[#E7E5DA] dark:hover:bg-gray-800",
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
						{conversations?.map((conversation) => {
							const isActive = pathname === `/dm/${conversation.id}`;
							return (
								<li key={conversation.id}>
									<Link
										href={`/dm/${conversation.id}`}
										onClick={onNavigate}
										className={cn(
											"block px-2 py-1 rounded transition-colors flex items-center space-x-2",
											isActive
												? "bg-[#E7E5DA] dark:bg-gray-800 text-gray-900 dark:text-gray-100"
												: "hover:bg-[#E7E5DA] dark:hover:bg-gray-800",
										)}
									>
										<UserAvatar
											user={conversation.otherUser}
											className="w-6 h-6"
										/>
										<span className="truncate">
											{conversation.otherUser.name}
										</span>
										{conversation.unreadCount > 0 && (
											<span className="ml-auto bg-blue-500 text-white text-xs rounded-full px-2 py-0.5">
												{conversation.unreadCount}
											</span>
										)}
									</Link>
								</li>
							);
						})}
					</ul>
				</div>
			</div>

			<div className="mt-auto flex items-center gap-2">
				<UserAvatar user={session.user} className="w-8 h-8" />
				<button
					type="button"
					onClick={() => signOut()}
					className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
				>
					Sign Out
				</button>
			</div>

			<CreateChannelModal
				isOpen={isChannelModalOpen}
				onClose={() => setIsChannelModalOpen(false)}
			/>
			<CreateDMModal
				isOpen={isDMModalOpen}
				onClose={() => setIsDMModalOpen(false)}
			/>
		</div>
	);
}

export default function Sidebar() {
	const { data: session } = useSession();
	const [isOpen, setIsOpen] = useState(false);
	if (!session) return null;

	return (
		<>
			{/* Mobile Menu Button */}
			<div className="md:hidden fixed left-0 top-0 h-14 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-40 flex items-center px-4">
				<Sheet open={isOpen} onOpenChange={setIsOpen}>
					<SheetTrigger asChild>
						<button
							type="button"
							className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-md"
						>
							<Menu className="h-5 w-5" />
						</button>
					</SheetTrigger>
					<SheetContent
						side="left"
						className="p-0 w-72 bg-[#F2F0E5] dark:bg-gray-900"
					>
						<SidebarContent onNavigate={() => setIsOpen(false)} />
					</SheetContent>
				</Sheet>
				<span className="ml-3 text-lg font-semibold">Sluck</span>
			</div>

			{/* Desktop Sidebar */}
			<div className="hidden md:block w-64 h-screen border-r border-[#E0DED2]">
				<SidebarContent />
			</div>
		</>
	);
}
