import MessageList from "@/components/MessageList";
import MessageInput from "@/components/MessageInput";
import { supabase } from "@/lib/supabase";
import { Channel } from "@/types/database";
import { notFound } from "next/navigation";

async function getChannel(channelId: string) {
	const { data: channel } = await supabase
		.from("channels")
		.select("*")
		.eq("id", channelId)
		.single();
	return channel as Channel;
}

export default async function ChannelPage({
	params: { channelId },
}: {
	params: { channelId: string };
}) {
	const channel = await getChannel(channelId);
	if (!channel) notFound();

	return (
		<div className="flex flex-col h-screen">
			<header className="border-b p-4">
				<h1 className="text-xl font-semibold">#{channel.name}</h1>
				{channel.description && (
					<p className="text-sm text-gray-500">{channel.description}</p>
				)}
			</header>

			<MessageList channelId={channelId} />
			<MessageInput channelId={channelId} />
		</div>
	);
}
