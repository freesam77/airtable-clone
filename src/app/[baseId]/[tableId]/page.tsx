import { redirect } from "next/navigation";
import { auth } from "~/server/auth";
import { BaseLayout } from "../../_components/base-layout";

interface BaseTablePageProps {
	params: Promise<{
		baseId: string;
		tableId: string;
	}>;
}

export default async function BaseTablePage({ params }: BaseTablePageProps) {
	const { baseId, tableId } = await params;
	const session = await auth();

	if (!session) {
		redirect("/");
	}

	return (
		<BaseLayout 
			user={session.user} 
			initialBaseId={baseId}
			initialTableId={tableId}
		/>
	);
}