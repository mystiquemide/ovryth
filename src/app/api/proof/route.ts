import { json } from "@/lib/http";
import { getProofArtifacts } from "@/lib/proof";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Machine-readable proof artifacts: the same rows /proof renders, as JSON. */
export async function GET() {
  const artifacts = await getProofArtifacts();
  return json({ artifacts });
}
