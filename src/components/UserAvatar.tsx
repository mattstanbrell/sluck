"use client";

import Image from "next/image";
import { useState } from "react";

interface UserAvatarProps {
	user: {
		avatar_url?: string | null;
		name?: string | null;
	};
	className?: string;
}

function FallbackAvatar({
	name,
	className,
}: { name?: string | null; className: string }) {
	return (
		<div
			className={`${className} rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center`}
		>
			<span className="text-lg font-medium">
				{name?.[0]?.toUpperCase() || "?"}
			</span>
		</div>
	);
}

export default function UserAvatar({ user, className = "" }: UserAvatarProps) {
	const [imageError, setImageError] = useState(false);

	if (!user.avatar_url || imageError) {
		return <FallbackAvatar name={user.name} className={className} />;
	}

	return (
		<div className={`flex-shrink-0 relative ${className}`}>
			<Image
				src={user.avatar_url}
				alt={`${user.name || "User"}'s avatar`}
				className="rounded-full object-cover"
				fill
				sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
				onError={() => setImageError(true)}
			/>
		</div>
	);
}
