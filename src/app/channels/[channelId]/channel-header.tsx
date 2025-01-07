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
		<header className="border-b p-4 flex items-center justify-between">
			<div>
				<h1 className="text-xl font-semibold">#{channel.name}</h1>
				{channel.description && (
					<p className="text-sm text-gray-500">{channel.description}</p>
				)}
			</div>
			<Sheet open={isOpen} onOpenChange={setIsOpen}>
				<SheetTrigger asChild>
					<Button variant="ghost" size="icon">
						<Info className="h-5 w-5" />
					</Button>
				</SheetTrigger>
				<SheetContent side="right" className="p-0 w-80">
					<SheetHeader className="px-6 py-4 border-b">
						<SheetTitle>Channel Details</SheetTitle>
					</SheetHeader>
					<ChannelMembers channelId={channel.id} />
				</SheetContent>
			</Sheet>
		</header>
	);
}
