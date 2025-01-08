"use client";

import { Button } from "@/components/ui/button";
import {
	Sheet,
	SheetContent,
	SheetTrigger,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { Info } from "lucide-react";
import { useState } from "react";
import type { Channel } from "@/types/database";
import ChannelMembers from "@/components/ChannelMembers";

interface ChannelHeaderProps {
	channel: Channel;
}

export default function ChannelHeader({ channel }: ChannelHeaderProps) {
	const [isOpen, setIsOpen] = useState(false);

	return (
		<header className="border-b border-b-[#E0DED2]">
			<div className="flex items-center justify-between py-3 px-4">
				<h1 className="text-xl font-semibold"># {channel.name}</h1>
				<Sheet open={isOpen} onOpenChange={setIsOpen}>
					<SheetTrigger asChild>
						<Button variant="ghost" size="icon">
							<Info className="h-5 w-5" />
						</Button>
					</SheetTrigger>
					<SheetContent side="right" className="p-0 w-80 [&>button]:hidden">
						<ChannelMembers channelId={channel.id} channel={channel} />
					</SheetContent>
				</Sheet>
			</div>
		</header>
	);
}
