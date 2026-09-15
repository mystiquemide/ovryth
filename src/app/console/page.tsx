import { notFound } from "next/navigation";
import { ConsoleScreen } from "@/components/site/ConsoleScreen";
import { getRoomView, SHOWCASE_SLUG } from "@/lib/room-view";
import { getOperatorNotes } from "@/lib/console";

export async function generateMetadata() {
  const room = await getRoomView(SHOWCASE_SLUG);
  return { title: room ? `${room.name} console · Ovryth` : "Console · Ovryth", alternates: { canonical: "/console" } };
}

export default async function ConsolePage() {
  const [room, notes] = await Promise.all([getRoomView(SHOWCASE_SLUG), getOperatorNotes()]);
  if (!room) notFound();
  return <ConsoleScreen room={room} notes={notes} publicHref="/room" />;
}
