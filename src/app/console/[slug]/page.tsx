import { notFound, redirect } from "next/navigation";
import { ConsoleScreen } from "@/components/site/ConsoleScreen";
import { getRoomView, SHOWCASE_SLUG } from "@/lib/room-view";
import { getOperatorNotes } from "@/lib/console";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const room = await getRoomView(slug);
  return { title: room ? `${room.name} console · Ovryth` : "Console · Ovryth" };
}

export default async function ConsoleBySlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // The showcase console lives at the clean /console path.
  if (slug === SHOWCASE_SLUG) redirect("/console");
  const [room, notes] = await Promise.all([getRoomView(slug), getOperatorNotes()]);
  if (!room) notFound();
  return <ConsoleScreen room={room} notes={notes} publicHref={`/r/${slug}`} />;
}
