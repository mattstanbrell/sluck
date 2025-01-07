"use client";

import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/components/ui/dialog";
import { getAuthenticatedSupabaseClient } from "@/lib/supabase";
import { useSession } from "next-auth/react";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

interface CreateChannelModalProps {
	isOpen: boolean;
	onClose: () => void;
	onChannelCreated?: (channelId: string) => void;
}

export default function CreateChannelModal({
	isOpen,
	onClose,
	onChannelCreated,
}: CreateChannelModalProps) {
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const { data: session } = useSession();
	const router = useRouter();

	const handleSubmit = async (e: FormEvent) => {
		e.preventDefault();
		if (!name.trim() || !session?.user?.id || isLoading) return;

		try {
			setIsLoading(true);
			const client = await getAuthenticatedSupabaseClient();

			// Create the channel
			const { data: channelData, error: channelError } = await client
				.from("channels")
				.insert({
					name: name.trim().toLowerCase().replace(/\s+/g, "-"),
					description: description.trim(),
					created_by: session.user.id,
				})
				.select()
				.single();

			if (channelError) throw channelError;

			// Add the creator as an admin member
			const { error: memberError } = await client
				.from("channel_members")
				.insert({
					channel_id: channelData.id,
					user_id: session.user.id,
					role: "admin",
				});

			if (memberError) throw memberError;

			setName("");
			setDescription("");
			onClose();
			onChannelCreated?.(channelData.id);
			router.push(`/channels/${channelData.id}`);
		} catch (error) {
			console.error("Error creating channel:", error);
			alert("Failed to create channel. Check console for details.");
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className="bg-[#F2F0E5] dark:bg-gray-800">
				<DialogHeader>
					<DialogTitle className="text-2xl">Create a channel</DialogTitle>
				</DialogHeader>
				<form onSubmit={handleSubmit}>
					<div className="space-y-4">
						<div>
							<label
								htmlFor="channel-name"
								className="block text-sm font-medium mb-1"
							>
								Channel name
							</label>
							<input
								id="channel-name"
								type="text"
								value={name}
								onChange={(e) => setName(e.target.value)}
								className="w-full p-2 rounded-md border border-transparent bg-[#FFFCF0] focus:border-[#1B1A19] dark:border-gray-700 dark:bg-gray-800 focus:outline-none"
								placeholder="e.g. team-updates"
								required
								disabled={isLoading}
							/>
						</div>
						<div>
							<label
								htmlFor="channel-description"
								className="block text-sm font-medium mb-1"
							>
								Description <span className="text-gray-500">(optional)</span>
							</label>
							<input
								id="channel-description"
								type="text"
								value={description}
								onChange={(e) => setDescription(e.target.value)}
								className="w-full p-2 rounded-md border border-transparent bg-[#FFFCF0] focus:border-[#1B1A19] dark:border-gray-700 dark:bg-gray-800 focus:outline-none"
								placeholder="What's this channel about?"
								disabled={isLoading}
							/>
						</div>
						<DialogFooter>
							<button
								type="submit"
								className="px-4 py-2 text-sm rounded-md text-[#3D7970] bg-[#E4EDEC] border border-[#59A097] hover:bg-[#D4E2E0] disabled:opacity-50 disabled:cursor-not-allowed"
								disabled={isLoading}
							>
								{isLoading ? "Creating..." : "Create"}
							</button>
						</DialogFooter>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
