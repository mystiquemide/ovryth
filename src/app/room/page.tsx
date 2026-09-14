import { notFound } from "next/navigation";
import { RoomScreen } from "@/components/site/RoomScreen";
import { getRoomView, SHOWCASE_SLUG } from "@/lib/room-view";

export async function generateMetadata() {
  const room = await getRoomView(SHOWCASE_SLUG);
  return { title: room ? `${room.name} · Ovryth room` : "Room · Ovryth" };
}

export default async function RoomPage() {
  const room = await getRoomView(SHOWCASE_SLUG);
  if (!room) notFound();
  return <RoomScreen room={room} />;
}
