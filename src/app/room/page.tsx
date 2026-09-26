import { notFound } from "next/navigation";
import { RoomScreen } from "@/components/site/RoomScreen";
import { MinimalFooter } from "@/components/site/MinimalFooter";
import { getRoomView, SHOWCASE_SLUG } from "@/lib/room-view";

// Live room data (rules, ledger): rebuild at most every 30 seconds instead of freezing at build time.
export const revalidate = 30;

export async function generateMetadata() {
  const room = await getRoomView(SHOWCASE_SLUG);
  return { title: room ? `${room.name} · Ovryth room` : "Room · Ovryth", alternates: { canonical: "/room" } };
}

export default async function RoomPage() {
  const room = await getRoomView(SHOWCASE_SLUG);
  if (!room) notFound();
  return (
    <>
      <RoomScreen room={room} />
      <MinimalFooter />
    </>
  );
}
