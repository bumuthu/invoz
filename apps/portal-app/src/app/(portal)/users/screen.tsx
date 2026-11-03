"use client";

import PageData from "@/components/PageData";
import { fetchUsers } from "@/lib/portal-client";
import UsersView from "./UsersView";

export default function UsersPage() {
  return (
    <PageData load={fetchUsers}>
      {(portal) => (
        <UsersView users={portal.users} organizationId={portal.organization.id} canInvite={portal.canInvite} />
      )}
    </PageData>
  );
}
