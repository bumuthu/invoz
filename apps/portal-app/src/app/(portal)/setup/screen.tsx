"use client";

import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import PageData from "@/components/PageData";
import { fetchSetup } from "@/lib/portal-client";
import { navigate, usePortalPath } from "@/lib/portal-nav";
import ErpView from "./erp/ErpView";
import OrganizationView from "./OrganizationView";
import RamisView from "./RamisView";

const tabs = [
  { href: "/setup/erp", label: "ERP" },
  { href: "/setup/ramis", label: "RAMIS Connection" },
  { href: "/setup/organization", label: "Organization Settings" },
];

export default function SetupPage() {
  const { pathname, search } = usePortalPath();
  const value = tabs.some((tab) => tab.href === pathname) ? pathname : "/setup/erp";

  return (
    <PageData load={fetchSetup}>
      {(portal) => (
        <>
          <Tabs
            value={value}
            onChange={(_event, href: string) => {
              navigate(search ? `${href}?${search}` : href);
            }}
            sx={{ mb: 3, borderBottom: 1, borderColor: "divider" }}
          >
            {tabs.map((tab) => (
              <Tab key={tab.href} value={tab.href} label={tab.label} />
            ))}
          </Tabs>
          {value === "/setup/erp" ? (
            <ErpView
              catalog={portal.erpCatalog}
              connections={portal.erpConnections}
              organizationId={portal.organization.id}
              canConnect={portal.canMap}
              pollingEnabled={portal.pollingEnabled}
            />
          ) : null}
          {value === "/setup/ramis" ? (
            <RamisView
              entities={portal.legalEntities}
              organizationId={portal.organization.id}
              canChange={portal.canMap}
            />
          ) : null}
          {value === "/setup/organization" ? (
            <OrganizationView
              entities={portal.legalEntities}
              branches={portal.branches}
              organizationId={portal.organization.id}
              canChange={portal.canMap}
            />
          ) : null}
        </>
      )}
    </PageData>
  );
}
