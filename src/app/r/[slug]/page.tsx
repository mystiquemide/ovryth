import { notFound } from "next/navigation";
import { RoomScreen } from "@/components/site/RoomScreen";
import { getRoomView, SHOWCASE_SLUG } from "@/lib/room-view";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const room = await getRoomView(slug);
  return { title: room ? `${room.name} · Ovryth room` : "Room · Ovryth", alternates: { canonical: `/r/${slug}` } };
}

export default async function RoomBySlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // The showcase room lives at the clean /room path.
  if (slug === SHOWCASE_SLUG) {
    const { redirect } = await import("next/navigation");
    redirect("/room");
  }
  const room = await getRoomView(slug);
  if (!room) notFound();
  return <RoomScreen room={room} />;
}
