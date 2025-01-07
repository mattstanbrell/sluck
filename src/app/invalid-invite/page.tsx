import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function InvalidInvitePage() {
	return (
		<div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
			<div className="max-w-md w-full space-y-8 p-8">
				<div className="text-center">
					<h1 className="text-3xl font-bold">Invalid Invite Link</h1>
					<p className="mt-2 text-gray-600 dark:text-gray-400">
						This invite link is either expired, revoked, or invalid.
					</p>
				</div>
				<div className="flex justify-center">
					<Button asChild>
						<Link href="/">Return Home</Link>
					</Button>
				</div>
			</div>
		</div>
	);
}
