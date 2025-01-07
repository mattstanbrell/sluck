import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
	const isLoggedIn = !!req.auth;
	const isAuthPage = req.nextUrl.pathname.startsWith("/api/auth");

	if (!isLoggedIn && !isAuthPage) {
		return Response.redirect(new URL("/api/auth/signin", req.url));
	}

	return NextResponse.next();
});

// Optionally, don't invoke Middleware on some paths
export const config = {
	matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
