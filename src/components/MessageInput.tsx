"use client";

import { useSession } from "next-auth/react";
import { supabase } from "@/lib/supabase";
import { FormEvent, useState } from "react";

export default function MessageInput({ channelId }: { channelId: string }) {
	const { data: session } = useSession();
	const [message, setMessage] = useState("");

	const sendMessage = async (e: FormEvent) => {
		e.preventDefault();
		if (!message.trim() || !session?.user?.id) return;

		await supabase.from("messages").insert({
			content: message,
			channel_id: channelId,
			user_id: session.user.id,
		});

		setMessage("");
	};

	return (
		<form onSubmit={sendMessage} className="p-4 border-t">
			<input
				type="text"
				value={message}
				onChange={(e) => setMessage(e.target.value)}
				placeholder="Type a message..."
				className="w-full p-2 rounded-md border dark:border-gray-700 dark:bg-gray-800"
			/>
		</form>
	);
}
