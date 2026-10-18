import { headers } from "next/headers";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const host = (await headers()).get("host")?.split(":")[0] ?? "";
  return <LoginForm host={host} error={params.error} />;
}
