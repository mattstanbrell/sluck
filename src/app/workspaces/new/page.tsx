"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { getAuthenticatedSupabaseClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export default function NewWorkspacePage() {
	const { data: session } = useSession();
	const router = useRouter();
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		if (!session?.user?.id) return;

		setIsLoading(true);
		setError(null);

		const formData = new FormData(e.currentTarget);
		const name = formData.get("name") as string;
		const description = formData.get("description") as string;
		const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

		try {
			const client = await getAuthenticatedSupabaseClient();

			// Create workspace
			const { data: workspace, error: workspaceError } = await client
				.from("workspaces")
				.insert({
					name,
					description,
					slug,
					created_by: session.user.id,
				})
				.select()
				.single();

			if (workspaceError) throw workspaceError;

			// Add creator as workspace owner
			const { error: memberError } = await client
				.from("workspace_members")
				.insert({
					workspace_id: workspace.id,
					user_id: session.user.id,
					role: "owner",
				});

			if (memberError) throw memberError;

			// Create general channel
			const { data: channel, error: channelError } = await client
				.from("channels")
				.insert({
					workspace_id: workspace.id,
					name: "general",
					description: "General discussion",
					created_by: session.user.id,
				})
				.select()
				.single();

			if (channelError) throw channelError;

			// Add creator as channel admin
			const { error: channelMemberError } = await client
				.from("channel_members")
				.insert({
					channel_id: channel.id,
					user_id: session.user.id,
					role: "admin",
				});

			if (channelMemberError) throw channelMemberError;

			router.push(`/channels/${channel.id}`);
		} catch (err) {
			console.error("Error creating workspace:", err);
			setError("Failed to create workspace. Please try again.");
		} finally {
			setIsLoading(false);
		}
	};

	if (!session) return null;

	return (
		<div className="min-h-screen bg-[#F2F0E5] dark:bg-gray-900 flex items-center justify-center p-4">
			<div className="w-full max-w-md space-y-8">
				<div className="text-center">
					<h1 className="text-2xl font-bold">Create a New Workspace</h1>
					<p className="text-gray-600 dark:text-gray-400 mt-2">
						A workspace is where your team communicates.
					</p>
				</div>

				<form onSubmit={handleSubmit} className="space-y-6">
					<div className="space-y-2">
						<Label htmlFor="name">Workspace Name</Label>
						<Input
							id="name"
							name="name"
							type="text"
							required
							placeholder="Acme Corp"
							minLength={1}
							maxLength={50}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="description">Description (Optional)</Label>
						<Textarea
							id="description"
							name="description"
							placeholder="What's this workspace about?"
							maxLength={200}
						/>
					</div>

					{error && (
						<p className="text-sm text-red-600 dark:text-red-500">{error}</p>
					)}

					<Button type="submit" className="w-full" disabled={isLoading}>
						{isLoading ? "Creating..." : "Create Workspace"}
					</Button>
				</form>
			</div>
		</div>
	);
}
