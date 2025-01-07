import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { getAuthenticatedSupabaseClient } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";
import { useRouter } from "next/navigation";

type User = Database["public"]["Tables"]["users"]["Row"];
type ChannelMember = {
	channel?: {
		members?: {
			user: User;
		}[];
	};
};

interface CreateDMModalProps {
	isOpen: boolean;
	onClose: () => void;
}

export default function CreateDMModal({ isOpen, onClose }: CreateDMModalProps) {
	const { data: session } = useSession();
	const [availableUsers, setAvailableUsers] = useState<User[]>([]);
	const router = useRouter();

	useEffect(() => {
		if (!session?.user?.id || !isOpen) return;
		console.log("Fetching users for DM modal. Current user:", session.user.id);

		const fetchUsers = async () => {
			const client = await getAuthenticatedSupabaseClient();

			// Get all users from channels the current user is in
			console.log("Fetching channel members...");
			const { data: channelMembers, error: channelError } = await client
				.from("channel_members")
				.select(`
          channel_id,
          channel:channels(
            members:channel_members(
              user:users(*)
            )
          )
        `)
				.eq("user_id", session.user.id);

			if (channelError) {
				console.error("Error fetching channel members:", channelError);
				return;
			}
			console.log("Found channel members:", channelMembers);

			// Get existing conversations
			console.log("Fetching existing conversations...");
			const { data: existingConversations, error: convError } = await client
				.from("conversation_participants")
				.select(`
					conversation_id,
					conversation:conversations(type)
				`)
				.eq("user_id", session.user.id);

			if (convError) {
				console.error("Error fetching conversations:", convError);
				return;
			}
			console.log("Found existing conversations:", existingConversations);

			// Get all users who are already in direct conversations with the current user
			console.log("Fetching existing conversation participants...");
			const { data: existingParticipants, error: partError } = await client
				.from("conversation_participants")
				.select(`
					user_id,
					conversation:conversations!inner(type)
				`)
				.in(
					"conversation_id",
					existingConversations?.map((c) => c.conversation_id) || [],
				)
				.eq("conversations.type", "direct")
				.neq("user_id", session.user.id);

			if (partError) {
				console.error("Error fetching participants:", partError);
				return;
			}
			console.log("Found existing participants:", existingParticipants);

			// Create a set of user IDs who are already in conversations with the current user
			const existingUserIds = new Set(
				existingParticipants?.map((p) => p.user_id) || [],
			);
			console.log("Existing user IDs:", Array.from(existingUserIds));

			// Extract unique users from all channels
			const uniqueUsers = new Map<string, User>();
			if (channelMembers) {
				for (const member of channelMembers as ChannelMember[]) {
					console.log("Processing channel member:", member);
					if (member.channel?.members) {
						for (const channelMember of member.channel.members) {
							const user = channelMember.user;
							console.log("Checking user:", user?.id, user?.name);
							if (
								user &&
								user.id !== session.user.id &&
								!existingUserIds.has(user.id)
							) {
								console.log("Adding available user:", user.name);
								uniqueUsers.set(user.id, user);
							} else {
								console.log(
									"Skipping user:",
									user?.name,
									"because:",
									user?.id === session.user.id
										? "is current user"
										: "already has conversation",
								);
							}
						}
					} else {
						console.log("No members found for channel");
					}
				}
			}

			const availableUsersList = Array.from(uniqueUsers.values());
			console.log("Final available users:", availableUsersList);
			setAvailableUsers(availableUsersList);
		};

		fetchUsers();
	}, [session?.user?.id, isOpen]);

	const startDM = async (userId: string) => {
		if (!session?.user?.id) return;

		const client = await getAuthenticatedSupabaseClient();

		// Create a new conversation
		const { data: conversation } = await client
			.from("conversations")
			.insert({
				type: "direct",
			})
			.select()
			.single();

		if (!conversation) return;

		// Add both users as participants
		await client.from("conversation_participants").insert([
			{
				conversation_id: conversation.id,
				user_id: session.user.id,
			},
			{
				conversation_id: conversation.id,
				user_id: userId,
			},
		]);

		// Create initial message
		await client.from("messages").insert({
			conversation_id: conversation.id,
			user_id: session.user.id,
			content: "👋 Started a conversation",
		});

		// Navigate to the conversation
		router.push(`/dm/${conversation.id}`);
		onClose();
	};

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Start a Direct Message</DialogTitle>
				</DialogHeader>
				<div className="mt-4">
					<div className="space-y-2">
						{availableUsers.map((user) => (
							<button
								key={user.id}
								type="button"
								onClick={() => startDM(user.id)}
								className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md flex items-center space-x-2"
							>
								{user.avatar_url && (
									<img
										src={user.avatar_url}
										alt=""
										className="w-8 h-8 rounded-full"
									/>
								)}
								<span>{user.name}</span>
							</button>
						))}
						{availableUsers.length === 0 && (
							<p className="text-gray-500 dark:text-gray-400 text-center py-4">
								No available users to message
							</p>
						)}
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
