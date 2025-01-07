import { Button } from "@/components/ui/button";
import { signIn } from "@/auth";

export default async function SignInPage({
	searchParams,
}: {
	searchParams: { callbackUrl?: string };
}) {
	return (
		<div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
			<div className="max-w-md w-full space-y-8 p-8">
				<div className="text-center">
					<h1 className="text-3xl font-bold">Welcome to Sluck</h1>
					<p className="mt-2 text-gray-600 dark:text-gray-400">
						Sign in to continue
					</p>
				</div>
				<form
					action={async () => {
						"use server";
						await signIn("google", { redirectTo: searchParams.callbackUrl });
					}}
				>
					<Button type="submit" className="w-full">
						Sign in with Google
					</Button>
				</form>
			</div>
		</div>
	);
}
