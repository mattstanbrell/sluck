import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
	const isLoggedIn = !!req.auth;
	const isAuthPage = req.nextUrl.pathname === "/signin";

	if (!isLoggedIn && !isAuthPage) {
		const callbackUrl = encodeURIComponent(req.nextUrl.pathname);
		return Response.redirect(
			new URL(`/signin?callbackUrl=${callbackUrl}`, req.url),
		);
	}

	if (isLoggedIn && isAuthPage) {
		return Response.redirect(new URL("/", req.url));
	}

	return NextResponse.next();
});

// Optionally, don't invoke Middleware on some paths
export const config = {
	matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
