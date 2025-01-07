"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState, use } from "react";
import { getAuthenticatedSupabaseClient } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";
import MessageList from "@/components/MessageList";
import MessageInput from "@/components/MessageInput";

type User = Database["public"]["Tables"]["users"]["Row"];
type Conversation = Database["public"]["Tables"]["conversations"]["Row"] & {
	participants: {
		user: User;
	}[];
};

export default function DMPage({
	params,
}: {
	params: Promise<{ conversationId: string }>;
}) {
	const { conversationId } = use(params);
	const { data: session } = useSession();
	const [conversation, setConversation] = useState<Conversation | null>(null);
	const [otherUser, setOtherUser] = useState<User | null>(null);

	useEffect(() => {
		const fetchConversation = async () => {
			if (!session?.user?.id) return;

			const client = await getAuthenticatedSupabaseClient();
			const { data } = await client
				.from("conversations")
				.select(
					`
					*,
					participants:conversation_participants(
						user:users(*)
					)
				`,
				)
				.eq("id", conversationId)
				.single();

			if (data) {
				setConversation(data);
				// Find the other participant
				const other = data.participants?.find(
					(p) => p.user.id !== session.user.id,
				);
				if (other) {
					setOtherUser(other.user);
				}
			}
		};

		fetchConversation();
	}, [session?.user?.id, conversationId]);

	// Update last_read_at when viewing the conversation
	useEffect(() => {
		const updateLastRead = async () => {
			if (!session?.user?.id || !conversation) return;

			const client = await getAuthenticatedSupabaseClient();
			await client
				.from("conversation_participants")
				.update({
					last_read_at: new Date().toISOString(),
				})
				.eq("conversation_id", conversation.id)
				.eq("user_id", session.user.id);
		};

		updateLastRead();
	}, [session?.user?.id, conversation]);

	if (!session || !conversation || !otherUser) return null;

	return (
		<div className="flex flex-col h-[calc(100vh-3.5rem)] md:h-screen">
			<div className="border-b p-4 flex items-center space-x-2">
				{otherUser.avatar_url && (
					<img
						src={otherUser.avatar_url}
						alt=""
						className="w-8 h-8 rounded-full"
					/>
				)}
				<h1 className="text-lg font-semibold">{otherUser.name}</h1>
			</div>

			<div className="flex-1 overflow-y-auto">
				<MessageList conversationId={conversation.id} />
			</div>

			<MessageInput conversationId={conversation.id} />
		</div>
	);
}
