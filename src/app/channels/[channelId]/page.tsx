import MessageList from "@/components/MessageList";
import MessageInput from "@/components/MessageInput";
import ChannelMembers from "@/components/ChannelMembers";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { Channel } from "@/types/database";
import { notFound } from "next/navigation";
import ChannelHeader from "./channel-header";

async function getChannel(channelId: string) {
	const { data: channel } = await supabaseAdmin
		.from("channels")
		.select("*")
		.eq("id", channelId)
		.single();
	return channel as Channel;
}

interface PageProps {
	params: Promise<{
		channelId: string;
	}>;
	searchParams: { [key: string]: string | string[] | undefined };
}

export default async function ChannelPage({ params }: PageProps) {
	// Await the params object to get the channelId
	const { channelId } = await params;
	const channel = await getChannel(channelId);
	if (!channel) notFound();

	return (
		<div className="flex h-[calc(100vh-3.5rem)] md:h-screen">
			<div className="flex-1 flex flex-col">
				<ChannelHeader channel={channel} />
				<div className="flex-1 overflow-y-auto">
					<MessageList channelId={channel.id} />
				</div>
				<MessageInput channelId={channel.id} />
			</div>
		</div>
	);
}
