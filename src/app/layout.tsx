import "~/styles/globals.css";

import type { Metadata } from "next";
import { SessionProvider } from "next-auth/react";
import { Geist } from "next/font/google";

import { TRPCReactProvider } from "~/trpc/react";

export const metadata: Metadata = {
	title: "Airtable Clone - by Sam",
	description: "Airtable Clone - by Samuel Razali",
	icons: [{ rel: "icon", url: "/airtable_icon.png" }],
};

const geist = Geist({
	subsets: ["latin"],
	variable: "--font-geist-sans",
});

export default function RootLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return (
		<html lang="en" className={`${geist.variable}`}>
			<body>
				<SessionProvider>
					<TRPCReactProvider>{children}</TRPCReactProvider>
				</SessionProvider>
			</body>
		</html>
	);
}
