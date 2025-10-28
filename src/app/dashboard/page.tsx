import { redirect } from "next/navigation";
import { auth } from "~/server/auth";
import { DashboardLayout } from "../_components/dashboard-layout";

export default async function Dashboard() {
	const session = await auth();

	if (!session) {
		redirect("/");
	}

	return <DashboardLayout user={session.user} />;
}
