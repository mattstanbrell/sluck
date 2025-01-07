"use client";

import { useSession } from "next-auth/react";
import { getAuthenticatedSupabaseClient } from "@/lib/supabase";
import { FormEvent, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Bold, Italic, List, Code, Link2, Terminal } from "lucide-react";

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
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	const insertMarkdown = (prefix: string, suffix: string = prefix) => {
		const textarea = textareaRef.current;
		if (!textarea) return;

		const start = textarea.selectionStart;
		const end = textarea.selectionEnd;
		const text = textarea.value;
		const before = text.substring(0, start);
		const selection = text.substring(start, end);
		const after = text.substring(end);

		const newText = before + prefix + selection + suffix + after;
		setMessage(newText);

		// Force React to update the textarea value
		setTimeout(() => {
			textarea.focus();
			textarea.setSelectionRange(start + prefix.length, end + prefix.length);
		}, 0);
	};

	const insertCodeBlock = () => {
		const textarea = textareaRef.current;
		if (!textarea) return;

		const start = textarea.selectionStart;
		const end = textarea.selectionEnd;
		const text = textarea.value;
		const before = text.substring(0, start);
		const selection = text.substring(start, end);
		const after = text.substring(end);

		// Only add newlines if we're in the middle of text
		const needsNewlineBefore = before.length > 0 && !before.endsWith("\n");
		const needsNewlineAfter = after.length > 0 && !after.startsWith("\n");

		const prefix = needsNewlineBefore ? "\n```\n" : "```\n";
		const suffix = needsNewlineAfter ? "\n```\n" : "\n```";

		const newText = before + prefix + selection + suffix + after;
		setMessage(newText);

		// Force React to update the textarea value
		setTimeout(() => {
			textarea.focus();
			const newCursorPos = start + prefix.length;
			textarea.setSelectionRange(newCursorPos, newCursorPos + selection.length);
		}, 0);
	};

	const insertLink = () => {
		insertMarkdown("[", "](url)");
	};

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

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			sendMessage(e);
		}
	};

	return (
		<form onSubmit={sendMessage} className="p-4 border-t space-y-2">
			<div className="flex gap-1 mb-2">
				<Button
					type="button"
					variant="ghost"
					size="sm"
					onClick={() => insertMarkdown("**")}
					title="Bold"
				>
					<Bold className="h-4 w-4" />
				</Button>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					onClick={() => insertMarkdown("*")}
					title="Italic"
				>
					<Italic className="h-4 w-4" />
				</Button>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					onClick={() => insertMarkdown("\n- ")}
					title="List"
				>
					<List className="h-4 w-4" />
				</Button>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					onClick={() => insertMarkdown("`", "`")}
					title="Inline Code"
				>
					<Code className="h-4 w-4" />
				</Button>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					onClick={insertCodeBlock}
					title="Code Block"
				>
					<Terminal className="h-4 w-4" />
				</Button>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					onClick={insertLink}
					title="Link"
				>
					<Link2 className="h-4 w-4" />
				</Button>
			</div>
			<textarea
				ref={textareaRef}
				value={message}
				onChange={(e) => setMessage(e.target.value)}
				onKeyDown={handleKeyDown}
				placeholder="Type a message... (Markdown supported)"
				className="w-full p-2 rounded-md border bg-background hover:border-input focus:border-input dark:border-gray-700 dark:bg-gray-800 min-h-[80px] resize-none focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
				disabled={isLoading}
			/>
		</form>
	);
}
