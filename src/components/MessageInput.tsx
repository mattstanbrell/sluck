"use client";

import { useSession } from "next-auth/react";
import { getAuthenticatedSupabaseClient } from "@/lib/supabase";
import { FormEvent, useState } from "react";

interface MessageInputProps {
	channelId?: string | null;
	conversationId?: string | null;
}

export default function MessageInput({
	channelId,
	conversationId,
}: MessageInputProps) {
	const { data: session } = useSession();
	const [message, setMessage] = useState("");
	const [isLoading, setIsLoading] = useState(false);

	const sendMessage = async (e: FormEvent) => {
		e.preventDefault();
		if (!message.trim() || !session?.user?.id || isLoading) return;

		try {
			setIsLoading(true);
			const client = await getAuthenticatedSupabaseClient();

			// Insert the message
			await client.from("messages").insert({
				content: message.trim(),
				channel_id: channelId,
				conversation_id: conversationId,
				user_id: session.user.id,
			});

			// Update the conversation's last_message_at
			if (conversationId) {
				await client
					.from("conversations")
					.update({
						last_message_at: new Date().toISOString(),
					})
					.eq("id", conversationId);
			}

			setMessage("");
		} catch (error) {
			console.error("Error sending message:", error);
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<form onSubmit={sendMessage} className="p-4 border-t">
			<input
				type="text"
				value={message}
				onChange={(e) => setMessage(e.target.value)}
				placeholder="Type a message..."
				className="w-full p-2 rounded-md border dark:border-gray-700 dark:bg-gray-800"
				disabled={isLoading}
			/>
		</form>
	);
}
