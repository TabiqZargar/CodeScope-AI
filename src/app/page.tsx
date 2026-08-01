import { redirect } from "next/navigation";
import { LandingPage } from "@/components/landing/landing-page";

/**
 * Landing page at the root. Legacy share links (`/?session=…`) are forwarded
 * to the playground, which owns the session-restore flow.
 */
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ session?: string }>;
}) {
  const params = await searchParams;
  if (typeof params.session === "string" && params.session) {
    redirect(`/playground?session=${encodeURIComponent(params.session)}`);
  }
  return <LandingPage />;
}
