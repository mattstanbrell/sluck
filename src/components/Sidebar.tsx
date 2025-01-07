"use client";

import { signOut, useSession } from "next-auth/react";
import { getAuthenticatedSupabaseClient } from "@/lib/supabase";
import type { supabase } from "@/lib/supabase";
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
	isOnline: boolean;
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
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
		let userPresenceSubscription: ReturnType<typeof supabase.channel> | null =
			null;
		let statusPollInterval: NodeJS.Timeout;

		const setupSubscriptions = async () => {
			if (!session?.user?.id) return;

			const client = await getAuthenticatedSupabaseClient();

			// Initial fetch
			await Promise.all([fetchChannels(), fetchConversations()]);

			// Set up polling for user statuses (to detect inactive users)
			statusPollInterval = setInterval(() => {
				console.log("Polling for user statuses...");
				fetchConversations();
			}, 60000); // Poll every minute

			// Set up real-time subscription for channels
			channelSubscription = client
				.channel("channels")
				.on(
					"postgres_changes",
					{
						event: "*",
						schema: "public",
						table: "channel_members",
						filter: `user_id=eq.${session.user.id}`,
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
						filter: "conversation_id.neq.null",
					},
					() => {
						fetchConversations();
					},
				)
				.subscribe();

			// Set up real-time subscription for user presence (to detect active users immediately)
			userPresenceSubscription = client
				.channel("user-presence")
				.on(
					"postgres_changes",
					{
						event: "UPDATE",
						schema: "public",
						table: "users",
					},
					(payload) => {
						console.log("Received user presence update:", payload);
						if (
							payload.new.id !== session.user.id &&
							payload.new.last_seen &&
							(!payload.old.last_seen ||
								new Date(payload.new.last_seen).getTime() >
									new Date(payload.old.last_seen).getTime())
						) {
							console.log("User became active:", payload.new.id);
							fetchConversations(); // Refetch to update online status
						}
					},
				)
				.subscribe();
		};

		setupSubscriptions().catch(console.error);

		return () => {
			clearInterval(statusPollInterval);
			if (channelSubscription) channelSubscription.unsubscribe();
			if (conversationSubscription) conversationSubscription.unsubscribe();
			if (userPresenceSubscription) userPresenceSubscription.unsubscribe();
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

		const client = await getAuthenticatedSupabaseClient();
		const { data: userConversations } = await client
			.from("conversation_participants")
			.select(`
				conversation:conversations!inner(
					id,
					type,
					last_message_at,
					participants:conversation_participants(
						user:users(
							*,
							last_seen
						)
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

		console.log("Fetched conversations:", userConversations);

		if (userConversations) {
			const conversationData = userConversations
				.map((conv: { conversation: unknown }) => {
					const conversation = conv.conversation as ConversationWithDetails;
					if (!conversation) return null;

					const otherParticipant = conversation.participants?.find(
						(p) => p.user?.id !== session.user.id,
					);

					if (!otherParticipant?.user) return null;

					const messages = conversation.messages;
					const sortedMessages = Array.isArray(messages)
						? [...messages].sort(
								(a, b) =>
									new Date(b.created_at).getTime() -
									new Date(a.created_at).getTime(),
							)
						: [];
					const lastMessage = sortedMessages[0];
					if (!lastMessage) return null;

					const lastSeen = otherParticipant.user.last_seen;
					const isOnline = lastSeen
						? new Date().getTime() - new Date(lastSeen).getTime() < 60000 // less than 1 minute
						: false;

					console.log(
						`User ${otherParticipant.user.name} online status:`,
						isOnline,
						"last seen:",
						lastSeen,
					);

					return {
						id: conversation.id,
						otherUser: otherParticipant.user,
						lastMessage: {
							...lastMessage,
							sender: lastMessage.sender,
						},
						unreadCount: 0,
						isOnline,
					} as DMConversation;
				})
				.filter((conv): conv is DMConversation => conv !== null);

			setConversations(conversationData);
		}
	};

	if (!session) return null;

	return (
		<div className="w-full h-full bg-[#F2F0E5] dark:bg-gray-900 p-4 flex flex-col">
			<h1 className="sr-only">Sluck Menu</h1>
			<div className="mb-8">
				<h2 className="text-xl font-bold">Sluck</h2>
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
							className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-[#E7E5DA] dark:hover:bg-gray-800 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
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
							className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-[#E7E5DA] dark:hover:bg-gray-800 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
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
										<div className="relative">
											<UserAvatar
												user={conversation.otherUser}
												className="w-5 h-5"
											/>
											<div
												className={cn(
													"absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-white dark:border-gray-900",
													conversation.isOnline
														? "bg-teal-500"
														: "bg-gray-300 dark:bg-gray-600",
												)}
											/>
										</div>
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
				<UserAvatar
					user={{
						avatar_url: session.user.image,
						name: session.user.name,
					}}
					className="w-8 h-8"
				/>
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
					<SheetContent side="left" className="p-0 w-72">
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
