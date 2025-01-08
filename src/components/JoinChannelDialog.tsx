import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getAuthenticatedSupabaseClient } from "@/lib/supabase";

interface Props {
	isOpen: boolean;
	onClose: () => void;
	channelName: string;
	channelId: string;
}

export default function JoinChannelDialog({
	isOpen,
	onClose,
	channelName,
	channelId,
}: Props) {
	const { data: session } = useSession();
	const router = useRouter();
	const [isLoading, setIsLoading] = useState(false);

	const handleJoin = async () => {
		if (!session?.user?.id) return;
		setIsLoading(true);

		try {
			const client = await getAuthenticatedSupabaseClient();

			// Add user to channel
			const { error: channelMemberError } = await client
				.from("channel_members")
				.insert({
					channel_id: channelId,
					user_id: session.user.id,
					role: "member",
				});

			if (channelMemberError) throw channelMemberError;

			router.push(`/channels/${channelId}`);
			onClose();
		} catch (err) {
			console.error("Error joining channel:", err);
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Join #{channelName}</DialogTitle>
					<DialogDescription>
						Would you like to join this channel? You'll be able to see all
						messages and participate in discussions.
					</DialogDescription>
				</DialogHeader>
				<div className="flex justify-end space-x-2">
					<Button variant="outline" onClick={onClose} disabled={isLoading}>
						Cancel
					</Button>
					<Button onClick={handleJoin} disabled={isLoading}>
						{isLoading ? "Joining..." : "Join Channel"}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
