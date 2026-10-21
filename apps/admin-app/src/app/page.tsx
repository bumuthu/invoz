import { portalRoleLabel, portalRoles } from "@invoz/common";

export default function AdminHome() {
  return (
    <main>
      <h1>Invoz Admin</h1>
      <p>Platform roles shared with the portal and the invoice workers.</p>
      <ul>
        {portalRoles.map((role) => (
          <li key={role}>{portalRoleLabel(role)}</li>
        ))}
      </ul>
    </main>
  );
}
