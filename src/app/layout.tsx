import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import { auth } from "@/auth";
import { headers } from "next/headers";
import AuthProvider from "@/components/AuthProvider";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "Sluck",
	description: "A Slack clone",
};

export default async function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const session = await auth();

	return (
		<html lang="en">
			<body
				className={`${geistSans.variable} ${geistMono.variable} antialiased`}
			>
				<AuthProvider session={session}>
					<div className="flex h-screen">
						<Sidebar />
						<main className="flex-1 overflow-hidden">{children}</main>
					</div>
				</AuthProvider>
			</body>
		</html>
	);
}
