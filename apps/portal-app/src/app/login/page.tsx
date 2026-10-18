import LoginForm from "./LoginForm";
import { loadPortal } from "@/lib/portal";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const portal = await loadPortal();
  return <LoginForm host={portal.organization.host} email={portal.currentUser.email} />;
}
