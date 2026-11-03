"use client";

import Typography from "@mui/material/Typography";
import { useEffect, type ReactNode } from "react";
import AuditPage from "@/app/(portal)/audit/screen";
import StatementPage from "@/app/(portal)/audit/statement/screen";
import ExceptionsPage from "@/app/(portal)/exceptions/screen";
import IngestionPage from "@/app/(portal)/ingestion/screen";
import InvoicePage from "@/app/(portal)/invoices/[id]/screen";
import OverviewPage from "@/app/(portal)/overview-screen";
import SchedulePage from "@/app/(portal)/schedules/[schedule]/screen";
import BranchesPage from "@/app/(portal)/setup/branches/screen";
import ErpPage from "@/app/(portal)/setup/erp/screen";
import MappingPage from "@/app/(portal)/setup/mapping/screen";
import SubscriptionPage from "@/app/(portal)/subscription/screen";
import UsersPage from "@/app/(portal)/users/screen";
import { replacePortal, usePortalPath } from "@/lib/portal-nav";

const pages: Record<string, () => ReactNode> = {
  "/": OverviewPage,
  "/exceptions": ExceptionsPage,
  "/audit": AuditPage,
  "/audit/statement": StatementPage,
  "/ingestion": IngestionPage,
  "/setup/erp": ErpPage,
  "/setup/mapping": MappingPage,
  "/setup/branches": BranchesPage,
  "/users": UsersPage,
  "/subscription": SubscriptionPage,
};

export default function PortalScreen() {
  const { pathname, search } = usePortalPath();
  const canonical =
    pathname === "/invoices" ? "/schedules/01" : pathname === "/schedule-02" ? "/schedules/02" : pathname;

  useEffect(() => {
    if (canonical !== pathname) replacePortal(search ? `${canonical}?${search}` : canonical);
  }, [canonical, pathname, search]);

  const Page = pages[canonical];
  if (Page) return <Page />;

  const schedule = /^\/schedules\/([^/]+)$/.exec(canonical);
  if (schedule) return <SchedulePage schedule={decodeURIComponent(schedule[1])} />;

  const invoice = /^\/invoices\/([^/]+)$/.exec(canonical);
  if (invoice) return <InvoicePage id={decodeURIComponent(invoice[1])} />;

  return (
    <Typography color="text.secondary" role="alert">
      This page does not exist.
    </Typography>
  );
}
