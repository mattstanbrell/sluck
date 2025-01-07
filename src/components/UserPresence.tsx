"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { getAuthenticatedSupabaseClient } from "@/lib/supabase";

export default function UserPresence() {
	const { data: session } = useSession();

	useEffect(() => {
		if (!session?.user?.id) return;

		let updateInterval: NodeJS.Timeout;

		const updateLastSeen = async (isActive: boolean) => {
			const client = await getAuthenticatedSupabaseClient();
			await client
				.from("users")
				.update({
					last_seen: isActive ? new Date().toISOString() : null,
				})
				.eq("id", session.user.id);
		};

		const handleVisibilityChange = () => {
			if (document.visibilityState === "visible") {
				// Update immediately when tab becomes visible
				updateLastSeen(true);
				// Start interval updates
				updateInterval = setInterval(() => updateLastSeen(true), 30000); // 30 seconds
			} else {
				// Clear interval when tab is not visible
				clearInterval(updateInterval);
				// Set last_seen to null when inactive
				updateLastSeen(false);
			}
		};

		// Initial update and interval if page is visible
		if (document.visibilityState === "visible") {
			updateLastSeen(true);
			updateInterval = setInterval(() => updateLastSeen(true), 30000);
		} else {
			// Make sure we're marked as inactive if starting with hidden tab
			updateLastSeen(false);
		}

		// Listen for visibility changes
		document.addEventListener("visibilitychange", handleVisibilityChange);

		return () => {
			clearInterval(updateInterval);
			document.removeEventListener("visibilitychange", handleVisibilityChange);
			// Set to inactive when component unmounts
			updateLastSeen(false);
		};
	}, [session?.user?.id]);

	return null;
}
