import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase-admin";
import MessageList from "@/components/MessageList";
import MessageInput from "@/components/MessageInput";
import MessageContent from "@/components/MessageContent";
import MessageTimestamp from "@/components/MessageTimestamp";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import UserAvatar from "@/components/UserAvatar";

async function getParentMessage(messageId: string) {
	const { data: message } = await supabaseAdmin
		.from("messages")
		.select("*, sender:users!messages_user_id_fkey(*)")
		.eq("id", messageId)
		.single();

	return message;
}

interface PageProps {
	params: Promise<{
		channelId: string;
		messageId: string;
	}>;
}

export default async function ThreadPage({ params }: PageProps) {
	// Await the params object to get the channelId and messageId
	const { channelId, messageId } = await params;
	const parentMessage = await getParentMessage(messageId);

	if (!parentMessage || parentMessage.channel_id !== channelId) {
		notFound();
	}

	return (
		<div className="flex h-[calc(100vh-3.5rem)] md:h-screen">
			<div className="flex-1 flex flex-col">
				<header className="border-b border-b-[#E0DED2] p-4">
					<div className="flex items-center gap-4">
						<Link
							href={`/channels/${channelId}`}
							className="hover:bg-[#E7E5DA] p-1 rounded transition-colors"
						>
							<ArrowLeft className="h-5 w-5" />
						</Link>
						<h1 className="text-lg font-semibold">Thread</h1>
					</div>
				</header>

				<div className="flex-1 overflow-y-auto">
					{/* Parent Message */}
					<div className="border-b border-b-[#E0DED2] p-4">
						<div className="flex items-start gap-2">
							<UserAvatar user={parentMessage.sender} className="w-10 h-10" />
							<div className="flex-1">
								<div className="flex items-baseline gap-2 mb-1">
									<span className="font-medium">
										{parentMessage.sender.name}
									</span>
									<MessageTimestamp timestamp={parentMessage.created_at} />
								</div>
								<MessageContent content={parentMessage.content} />
							</div>
						</div>
					</div>

					{/* Thread Replies */}
					<MessageList channelId={channelId} parentId={messageId} />
				</div>

				{/* Message Input for Thread */}
				<MessageInput channelId={channelId} parentId={messageId} />
			</div>
		</div>
	);
}
