import { RoomClient } from "@/components/RoomClient";

export const dynamic = "force-dynamic";

export default async function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <RoomClient code={code.toUpperCase()} />;
}
