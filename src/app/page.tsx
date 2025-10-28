import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "~/server/auth";

export default async function Home() {
	const session = await auth();

	if (session) {
		redirect("/dashboard");
	}

	return (
		<main className="flex min-h-screen flex-col items-center justify-center bg-white">
			<div className="flex flex-col items-center gap-8">
				<Image
					src="/airtable-logo.png"
					alt="Airtable"
					width={300}
					height={100}
					priority
				/>
				<Link
					href="/api/auth/signin"
					className="rounded-lg bg-blue-600 px-8 py-3 font-semibold text-white no-underline transition hover:bg-blue-700"
				>
					Sign in
				</Link>
			</div>
		</main>
	);
}
