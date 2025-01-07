"use client";

interface UserAvatarProps {
	user: {
		avatar_url?: string | null;
		name?: string | null;
	};
	className?: string;
}

export default function UserAvatar({ user, className = "" }: UserAvatarProps) {
	return (
		<div className={`flex-shrink-0 ${className}`}>
			{user.avatar_url ? (
				<img
					src={user.avatar_url}
					alt=""
					className="w-full h-full rounded-full"
					onError={(e) => {
						const target = e.target as HTMLImageElement;
						target.style.display = "none";
						const fallback = document.createElement("div");
						fallback.className =
							"w-full h-full rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center";
						fallback.innerHTML = `<span class="text-lg font-medium">${user.name?.[0]?.toUpperCase() || "?"}</span>`;
						target.parentElement?.appendChild(fallback);
					}}
				/>
			) : (
				<div className="w-full h-full rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center">
					<span className="text-lg font-medium">
						{user.name?.[0]?.toUpperCase() || "?"}
					</span>
				</div>
			)}
		</div>
	);
}
