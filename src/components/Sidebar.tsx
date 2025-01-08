"use client";

import { signOut, useSession } from "next-auth/react";
import { getAuthenticatedSupabaseClient } from "@/lib/supabase";
import type { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import CreateChannelModal from "./CreateChannelModal";
import CreateDMModal from "./CreateDMModal";
import type { Database } from "@/lib/database.types";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Menu, Settings, X } from "lucide-react";
import {
	Sheet,
	SheetContent,
	SheetTrigger,
	SheetClose,
} from "@/components/ui/sheet";
import UserAvatar from "./UserAvatar";
import WorkspaceSettingsModal from "./WorkspaceSettingsModal";
import JoinChannelDialog from "./JoinChannelDialog";

type Channel = Database["public"]["Tables"]["channels"]["Row"] & {
	is_member?: boolean;
};
type ChannelMember = Database["public"]["Tables"]["channel_members"]["Row"] & {
	channel: Channel;
};
type User = Database["public"]["Tables"]["users"]["Row"];
type Message = Database["public"]["Tables"]["messages"]["Row"] & {
	sender: User;
};
type Workspace = Database["public"]["Tables"]["workspaces"]["Row"];
type WorkspaceMember =
	Database["public"]["Tables"]["workspace_members"]["Row"] & {
		workspace: Workspace;
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

function SidebarContent({
	onNavigate,
	onWorkspaceChange,
}: { onNavigate?: () => void; onWorkspaceChange?: (name: string) => void }) {
	const { data: session } = useSession();
	const [channels, setChannels] = useState<Channel[]>([]);
	const [conversations, setConversations] = useState<DMConversation[]>([]);
	const [workspace, setWorkspace] = useState<Workspace | null>(null);
	const [isChannelModalOpen, setIsChannelModalOpen] = useState(false);
	const [isDMModalOpen, setIsDMModalOpen] = useState(false);
	const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
	const [selectedChannel, setSelectedChannel] = useState<{
		id: string;
		name: string;
	} | null>(null);
	const pathname = usePathname();
	const router = useRouter();

	const handleChannelClick = (channel: Channel, e: React.MouseEvent) => {
		if (!channel.is_member) {
			e.preventDefault();
			setSelectedChannel({ id: channel.id, name: channel.name });
		} else if (onNavigate) {
			onNavigate();
		}
	};

	const fetchChannels = useCallback(async () => {
		if (!session?.user?.id || !workspace?.id) return;

		const client = await getAuthenticatedSupabaseClient();

		// First, get all channels in the workspace
		const { data: allChannels } = await client
			.from("channels")
			.select("*")
			.eq("workspace_id", workspace.id)
			.order("created_at");

		if (!allChannels) return;

		// Then, get the user's channel memberships
		const { data: memberships } = await client
			.from("channel_members")
			.select("channel_id")
			.eq("user_id", session.user.id);

		const memberChannelIds = new Set(
			memberships?.map((m) => m.channel_id) || [],
		);

		// Combine the data
		const channelsWithMembership = allChannels.map((channel) => ({
			...channel,
			is_member: memberChannelIds.has(channel.id),
		}));

		setChannels(channelsWithMembership);
	}, [session?.user?.id, workspace?.id]);

	useEffect(() => {
		let channelSubscription: ReturnType<typeof supabase.channel> | null = null;
		let conversationSubscription: ReturnType<typeof supabase.channel> | null =
			null;
		let userPresenceSubscription: ReturnType<typeof supabase.channel> | null =
			null;
		let workspaceSubscription: ReturnType<typeof supabase.channel> | null =
			null;
		let workspaceMemberSubscription: ReturnType<
			typeof supabase.channel
		> | null = null;
		let statusPollInterval: NodeJS.Timeout;

		const setupSubscriptions = async () => {
			if (!session?.user?.id) return;

			const client = await getAuthenticatedSupabaseClient();

			// Initial fetch
			await Promise.all([
				fetchWorkspace(),
				fetchChannels(),
				fetchConversations(),
			]);

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

			// Set up real-time subscription for workspace
			workspaceSubscription = client
				.channel("workspace")
				.on(
					"postgres_changes",
					{
						event: "*",
						schema: "public",
						table: "workspaces",
					},
					() => {
						fetchWorkspace();
					},
				)
				.subscribe();

			// Set up real-time subscription for workspace members
			workspaceMemberSubscription = client
				.channel("workspace-members")
				.on(
					"postgres_changes",
					{
						event: "*",
						schema: "public",
						table: "workspace_members",
						filter: `user_id=eq.${session.user.id}`,
					},
					() => {
						fetchWorkspace();
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
			if (workspaceSubscription) workspaceSubscription.unsubscribe();
			if (workspaceMemberSubscription)
				workspaceMemberSubscription.unsubscribe();
		};
	}, [session?.user?.id, fetchChannels]);

	const fetchWorkspace = async () => {
		if (!session?.user?.id) return;

		const client = await getAuthenticatedSupabaseClient();
		const { data } = await client
			.from("workspace_members")
			.select("*, workspace:workspaces(*)")
			.eq("user_id", session.user.id)
			.order("joined_at")
			.limit(1)
			.single();

		if (data?.workspace) {
			setWorkspace(data.workspace);
			onWorkspaceChange?.(data.workspace.name);
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

	// Refetch channels when workspace changes
	useEffect(() => {
		if (workspace?.id) {
			fetchChannels();
		} else {
			setChannels([]);
		}
	}, [workspace?.id, fetchChannels]);

	if (!session) return null;

	return (
		<div className="flex flex-col h-full">
			<div className="p-4 flex-1">
				{workspace ? (
					<>
						<h1 className="sr-only">Sluck Menu</h1>
						<div className="mb-8 pb-4 border-b border-[#E0DED2] dark:border-gray-800">
							<div className="flex items-center justify-between">
								<h2 className="text-xl font-bold">{workspace.name}</h2>
								<button
									type="button"
									onClick={() => setIsSettingsModalOpen(true)}
									className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-[#E7E5DA] dark:hover:bg-gray-800 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
								>
									<Settings className="h-5 w-5" />
								</button>
							</div>
							{workspace.description && (
								<p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
									{workspace.description}
								</p>
							)}
						</div>

						<div className="space-y-12">
							<div className="mt-12">
								<div className="flex items-center justify-between mb-2">
									<h2 className="text-sm font-semibold text-gray-600 dark:text-gray-400">
										Channels
									</h2>
									<button
										type="button"
										onClick={() => setIsChannelModalOpen(true)}
										className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-[#E7E5DA] dark:hover:bg-gray-800 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
									>
										<span className="text-lg">+</span>
									</button>
								</div>
								<ul className="space-y-1">
									{channels?.map((channel) => {
										const isActive = pathname === `/channels/${channel.id}`;
										return (
											<li key={channel.id}>
												<Link
													href={`/channels/${channel.id}`}
													onClick={(e) => handleChannelClick(channel, e)}
													className={cn(
														"block px-2 py-1 rounded transition-colors flex items-center",
														isActive
															? "bg-[#E7E5DA] dark:bg-gray-800 text-gray-900 dark:text-gray-100"
															: channel.is_member
																? "hover:bg-[#E7E5DA] dark:hover:bg-gray-800"
																: "text-gray-500 dark:text-gray-500 hover:bg-[#E7E5DA] dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-400",
													)}
												>
													<span className="flex-1"># {channel.name}</span>
													{!channel.is_member && (
														<span className="text-xs text-gray-500 dark:text-gray-500">
															Click to join
														</span>
													)}
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
										<span className="text-lg">+</span>
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

						<CreateChannelModal
							isOpen={isChannelModalOpen}
							onClose={() => setIsChannelModalOpen(false)}
						/>
						<CreateDMModal
							isOpen={isDMModalOpen}
							onClose={() => setIsDMModalOpen(false)}
						/>
						<WorkspaceSettingsModal
							isOpen={isSettingsModalOpen}
							onClose={() => setIsSettingsModalOpen(false)}
							workspace={workspace}
						/>
						<JoinChannelDialog
							isOpen={!!selectedChannel}
							onClose={() => setSelectedChannel(null)}
							channelId={selectedChannel?.id || ""}
							channelName={selectedChannel?.name || ""}
						/>
					</>
				) : (
					<div className="flex-1" />
				)}
			</div>

			<div className="p-4">
				<div className="border-b border-[#E0DED2] dark:border-gray-800 mb-4" />
				<div className="flex items-center gap-3">
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
			</div>
		</div>
	);
}

export default function Sidebar() {
	const { data: session } = useSession();
	const [isOpen, setIsOpen] = useState(false);
	const [workspaceName, setWorkspaceName] = useState<string>("");

	const handleWorkspaceChange = (name: string) => {
		setWorkspaceName(name);
	};

	if (!session) return null;

	return (
		<>
			{/* Mobile Menu Button */}
			<div className="md:hidden fixed left-0 top-0 h-14 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-40 flex items-center px-4">
				<div className="flex items-center justify-between w-full">
					<Sheet open={isOpen} onOpenChange={setIsOpen}>
						<SheetTrigger asChild>
							<button
								type="button"
								className="p-2 hover:bg-[#E7E5DA] dark:hover:bg-gray-800 rounded-md"
							>
								<Menu className="h-5 w-5" />
							</button>
						</SheetTrigger>
						<SheetContent
							side="left"
							className="p-0 w-72 bg-[#F2F0E5] dark:bg-gray-900 [&>button]:hidden"
						>
							<div className="h-full flex flex-col">
								<div className="flex-1 overflow-y-auto">
									<SidebarContent
										onNavigate={() => setIsOpen(false)}
										onWorkspaceChange={handleWorkspaceChange}
									/>
								</div>
							</div>
						</SheetContent>
					</Sheet>
					<span className="absolute left-1/2 -translate-x-1/2 text-lg font-semibold">
						{workspaceName || "Sluck"}
					</span>
					<div className="w-9" /> {/* Spacer to balance the menu button */}
				</div>
			</div>

			{/* Desktop Sidebar */}
			<div className="hidden md:block w-64 h-screen border-r border-[#E0DED2] bg-[#F2F0E5] dark:bg-gray-900">
				<SidebarContent onWorkspaceChange={handleWorkspaceChange} />
			</div>
		</>
	);
}
