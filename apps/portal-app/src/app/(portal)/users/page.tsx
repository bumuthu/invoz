import UsersView from "./UsersView";
import { loadPortal } from "@/lib/portal";

export default async function UsersPage() {
  const portal = await loadPortal();
  return <UsersView users={portal.users} />;
}
