"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface WorkspaceSettingsModalProps {
	isOpen: boolean;
	onClose: () => void;
	workspace: {
		id: string;
		name: string;
		invite_code: string | null;
		invite_expires_at: string | null;
	};
}

export default function WorkspaceSettingsModal({
	isOpen,
	onClose,
	workspace,
}: WorkspaceSettingsModalProps) {
	const { data: session } = useSession();
	const [isGenerating, setIsGenerating] = useState(false);
	const [isCopied, setIsCopied] = useState(false);

	const generateInviteLink = async () => {
		if (!session?.user?.id) return;
		setIsGenerating(true);

		try {
			const response = await fetch(`/api/workspaces/${workspace.id}/invite`, {
				method: "POST",
			});

			if (!response.ok) throw new Error("Failed to generate invite link");

			const { code } = await response.json();
			// Force a refresh of the workspace data
			window.location.reload();
		} catch (err) {
			console.error("Error generating invite:", err);
		} finally {
			setIsGenerating(false);
		}
	};

	const copyInviteLink = async () => {
		if (!workspace.invite_code) return;

		const inviteLink = `${window.location.origin}/workspaces/invite/${workspace.invite_code}`;
		await navigator.clipboard.writeText(inviteLink);
		setIsCopied(true);
		setTimeout(() => setIsCopied(false), 2000);
	};

	const isExpired =
		workspace.invite_expires_at &&
		new Date(workspace.invite_expires_at) < new Date();

	const inviteLink = workspace.invite_code
		? `${window.location.origin}/workspaces/invite/${workspace.invite_code}`
		: "";

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className="sm:max-w-[425px]">
				<DialogHeader>
					<DialogTitle>Workspace Settings</DialogTitle>
				</DialogHeader>

				<div className="space-y-6 py-4">
					<div className="space-y-2">
						<h3 className="text-sm font-medium">Invite Link</h3>
						<div className="space-y-2">
							{workspace.invite_code ? (
								<>
									<div className="flex gap-2">
										<Input
											value={inviteLink}
											readOnly
											className={cn(
												isExpired && "text-gray-400 dark:text-gray-600",
											)}
										/>
										<Button
											size="icon"
											variant="outline"
											onClick={copyInviteLink}
											disabled={isExpired || false}
											title={isExpired ? "Link expired" : "Copy link"}
										>
											<Copy className="h-4 w-4" />
										</Button>
									</div>
									{isExpired ? (
										<p className="text-sm text-red-600 dark:text-red-500">
											This invite link has expired
										</p>
									) : workspace.invite_expires_at ? (
										<p className="text-sm text-gray-600 dark:text-gray-400">
											Expires{" "}
											{new Date(
												workspace.invite_expires_at,
											).toLocaleDateString()}
										</p>
									) : null}
									{isCopied && (
										<p className="text-sm text-green-600 dark:text-green-500">
											Copied to clipboard!
										</p>
									)}
								</>
							) : (
								<p className="text-sm text-gray-600 dark:text-gray-400">
									No active invite link
								</p>
							)}
							<Button
								onClick={generateInviteLink}
								disabled={isGenerating}
								className="w-full"
							>
								<RefreshCw
									className={cn("mr-2 h-4 w-4", isGenerating && "animate-spin")}
								/>
								{workspace.invite_code
									? "Generate New Link"
									: "Generate Invite Link"}
							</Button>
						</div>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
