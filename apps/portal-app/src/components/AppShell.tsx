"use client";

import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import CloudSyncOutlinedIcon from "@mui/icons-material/CloudSyncOutlined";
import CreditCardOutlinedIcon from "@mui/icons-material/CreditCardOutlined";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import GroupOutlinedIcon from "@mui/icons-material/GroupOutlined";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import MenuIcon from "@mui/icons-material/Menu";
import PolicyOutlinedIcon from "@mui/icons-material/PolicyOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import ReportOutlinedIcon from "@mui/icons-material/ReportOutlined";
import SpaceDashboardOutlinedIcon from "@mui/icons-material/SpaceDashboardOutlined";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import { useState } from "react";
import PageSkeleton from "@/components/PageSkeleton";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import FilterBar from "@/components/FilterBar";
import Initials from "@/components/Initials";
import Logo from "@/components/Logo";
import { clearOrganization } from "@/lib/portal-entry";
import { browserSupabase } from "@/lib/supabase-browser";
import type { PortalData } from "@/lib/types";

const drawerWidth = 252;

const sections = [
  {
    items: [
      { href: "/", label: "Overview", icon: <SpaceDashboardOutlinedIcon fontSize="small" /> },
      { href: "/invoices", label: "Invoices", icon: <ReceiptLongOutlinedIcon fontSize="small" /> },
      { href: "/exceptions", label: "Exceptions", icon: <ReportOutlinedIcon fontSize="small" /> },
      { href: "/schedule-02", label: "Schedule 02", icon: <FactCheckOutlinedIcon fontSize="small" /> },
      { href: "/audit", label: "Audit", icon: <PolicyOutlinedIcon fontSize="small" />, audit: true },
    ],
  },
  {
    label: "Administration",
    items: [
      { href: "/ingestion", label: "Ingestion", icon: <CloudSyncOutlinedIcon fontSize="small" /> },
      { href: "/setup/mapping", label: "Field mapping", icon: <AccountTreeOutlinedIcon fontSize="small" /> },
      { href: "/setup/branches", label: "Branches", icon: <StorefrontOutlinedIcon fontSize="small" /> },
      { href: "/users", label: "Users", icon: <GroupOutlinedIcon fontSize="small" /> },
      { href: "/subscription", label: "Subscription", icon: <CreditCardOutlinedIcon fontSize="small" /> },
    ],
  },
];

function showsFilters(pathname: string) {
  return (
    pathname === "/" ||
    pathname.startsWith("/invoices") ||
    pathname.startsWith("/exceptions") ||
    pathname.startsWith("/schedule-02") ||
    pathname.startsWith("/audit") ||
    pathname.startsWith("/ingestion") ||
    pathname.startsWith("/setup/")
  );
}

function SidebarContent({
  organization,
  canAudit,
  pendingHref,
  onSelect,
  onNavigate,
}: {
  organization: PortalData["organization"];
  canAudit: boolean;
  pendingHref: string | null;
  onSelect: (href: string) => void;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const search = useSearchParams().toString();
  const current = pendingHref ?? pathname;

  return (
    <Stack sx={{ height: "100%" }}>
      <Box sx={{ px: 2.5, pt: 2.75, pb: 1.5 }}>
        <Logo height={32} />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
          {organization.name}
        </Typography>
      </Box>
      <Box sx={{ px: 1.25, flex: 1 }}>
        {sections.map((section) => (
          <Box key={section.label ?? "main"} sx={{ mb: 1 }}>
            {section.label ? (
              <Typography
                sx={{
                  px: 1.5,
                  pt: 1.75,
                  pb: 0.75,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "text.secondary",
                }}
              >
                {section.label}
              </Typography>
            ) : null}
            <List disablePadding>
              {section.items.filter((item) => !("audit" in item) || canAudit).map((item) => {
                const active =
                  item.href === "/"
                    ? current === "/"
                    : current === item.href || current.startsWith(`${item.href}/`);
                return (
                  <ListItemButton
                    key={item.href}
                    selected={active}
                    onClick={() => {
                      if (pathname !== item.href) onSelect(item.href);
                      router.push(search ? `${item.href}?${search}` : item.href);
                      onNavigate?.();
                    }}
                    sx={{
                      mb: 0.5,
                      borderRadius: 2,
                      py: 0.9,
                      pl: 1.25,
                      borderLeft: "3px solid",
                      borderColor: active ? "secondary.main" : "transparent",
                      color: active ? "text.primary" : "text.secondary",
                      "&:hover": {
                        bgcolor: "action.hover",
                      },
                      "&.Mui-selected": {
                        bgcolor: "action.hover",
                        color: "text.primary",
                      },
                      "&.Mui-selected:hover": {
                        bgcolor: "action.hover",
                      },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 32, color: "inherit" }}>{item.icon}</ListItemIcon>
                    <ListItemText
                      primary={item.label}
                      slotProps={{
                        primary: { sx: { fontSize: 14, fontWeight: active ? 600 : 500 } },
                      }}
                    />
                  </ListItemButton>
                );
              })}
            </List>
          </Box>
        ))}
      </Box>
      <Box className="no-print" sx={{ px: 2.5, py: 2.25 }}>
        <Typography variant="caption" color="text.secondary" display="block">
          {organization.host}
        </Typography>
      </Box>
    </Stack>
  );
}

function AccountDetail({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography
        sx={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "text.secondary",
        }}
      >
        {label}
      </Typography>
      <Typography sx={{ mt: 0.25, fontSize: 14, fontWeight: 600, lineHeight: 1.4 }}>{value}</Typography>
    </Box>
  );
}

function AccountMenu({
  currentUser,
  organizationName,
  compact = false,
}: {
  currentUser: PortalData["currentUser"];
  organizationName: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  async function signOut() {
    setAnchor(null);
    await clearOrganization();
    await browserSupabase().auth.signOut();
    router.push("/auth/login");
    router.refresh();
  }

  return (
    <>
      <Button
        color="inherit"
        onClick={(event) => setAnchor(event.currentTarget)}
        aria-haspopup="menu"
        aria-expanded={Boolean(anchor)}
        aria-label={`Account menu for ${currentUser.name}`}
        sx={{
          px: compact ? 0.5 : 1.25,
          py: 0.5,
          minWidth: 0,
          borderRadius: 999,
          bgcolor: anchor ? "action.hover" : "transparent",
          "&:hover": { bgcolor: "action.hover" },
        }}
      >
        <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
          <Initials name={currentUser.name} size={compact ? 32 : 36} />
          {compact ? null : (
            <Box sx={{ minWidth: 0, textAlign: "left" }}>
              <Typography sx={{ fontSize: 14, fontWeight: 600, lineHeight: 1.2 }}>
                {currentUser.name}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.3 }}>
                {currentUser.role}
              </Typography>
            </Box>
          )}
        </Stack>
      </Button>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          paper: { sx: { mt: 1, width: 300, overflow: "hidden" } },
          list: { sx: { py: 0 } },
        }}
      >
        <Box
          component="li"
          sx={{
            px: 2.25,
            pt: 2.25,
            pb: 2,
            bgcolor: "background.default",
            listStyle: "none",
          }}
        >
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
            <Initials name={currentUser.name} size={48} />
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.25 }}>
                {currentUser.name}
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 0.25, overflow: "hidden", textOverflow: "ellipsis" }}
              >
                {currentUser.email}
              </Typography>
            </Box>
          </Stack>
        </Box>
        <Box component="li" sx={{ px: 2.25, py: 1.75, listStyle: "none" }}>
          <Stack spacing={1.5}>
            <AccountDetail label="Role" value={currentUser.role} />
            <AccountDetail label="Organization" value={organizationName} />
          </Stack>
        </Box>
        <Divider component="li" />
        <MenuItem
          onClick={signOut}
          sx={{
            px: 2.25,
            py: 1.35,
            borderRadius: 0,
            fontSize: 14,
            fontWeight: 600,
            "&:hover": {
              bgcolor: "error.light",
              color: "error.main",
            },
          }}
        >
          <ListItemIcon sx={{ minWidth: 32, color: "inherit" }}>
            <LogoutOutlinedIcon fontSize="small" />
          </ListItemIcon>
          Sign out
        </MenuItem>
      </Menu>
    </>
  );
}

export default function AppShell({
  children,
  organization,
  organizations,
  hostPinned,
  currentUser,
  canAudit,
  filters,
  entities,
  branches,
  periods,
}: {
  children: React.ReactNode;
  organization: PortalData["organization"];
  organizations: PortalData["organizations"];
  hostPinned: boolean;
  currentUser: PortalData["currentUser"];
  canAudit: boolean;
  filters: PortalData["filters"];
  entities: PortalData["entities"];
  branches: PortalData["branches"];
  periods: PortalData["periods"];
}) {
  const [open, setOpen] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const pathname = usePathname();
  const arrived = pendingHref !== null && pathname === pendingHref;
  if (arrived) setPendingHref(null);
  const route = arrived ? pathname : (pendingHref ?? pathname);
  const drawer = (
    <SidebarContent
      organization={organization}
      canAudit={canAudit}
      pendingHref={pendingHref}
      onSelect={setPendingHref}
      onNavigate={() => setOpen(false)}
    />
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", p: { xs: 0, md: 1.5 }, gap: { md: 1.5 } }}>
      <AppBar
        position="fixed"
        color="inherit"
        elevation={0}
        sx={{
          display: { md: "none" },
          bgcolor: "background.paper",
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        <Toolbar>
          <IconButton edge="start" onClick={() => setOpen(true)} aria-label="Open navigation">
            <MenuIcon />
          </IconButton>
          <Box sx={{ ml: 1, flex: 1 }}>
            <Logo height={28} />
          </Box>
          <AccountMenu currentUser={currentUser} organizationName={organization.name} compact />
        </Toolbar>
      </AppBar>
      <Drawer
        variant="temporary"
        open={open}
        onClose={() => setOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: "block", md: "none" },
          "& .MuiDrawer-paper": { width: drawerWidth, borderColor: "divider" },
        }}
      >
        {drawer}
      </Drawer>
      <Paper
        className="no-print"
        component="nav"
        sx={{
          display: { xs: "none", md: "flex" },
          width: drawerWidth,
          flexShrink: 0,
          flexDirection: "column",
          position: "sticky",
          top: 12,
          height: "calc(100vh - 24px)",
          borderRadius: "20px",
          border: 1,
          borderColor: "divider",
          boxShadow: "var(--portal-shadow)",
          overflow: "hidden",
        }}
      >
        {drawer}
      </Paper>
      <Box
        component="main"
        sx={{
          flex: 1,
          minWidth: 0,
          px: { xs: 2, md: 3.5 },
          pt: { xs: 10, md: 2 },
          pb: 6,
        }}
      >
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={1.5}
          className="no-print"
          sx={{
            alignItems: { md: "center" },
            mb: 2.5,
            position: showsFilters(route) ? "sticky" : "static",
            top: 12,
            zIndex: 2,
            bgcolor: "background.default",
          }}
        >
          {showsFilters(route) ? (
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <FilterBar
                filters={filters}
                entities={entities}
                branches={branches}
                periods={periods}
                organizations={organizations}
                organizationId={organization.id}
                showOrganization={!hostPinned && organizations.length > 1}
                account={<AccountMenu currentUser={currentUser} organizationName={organization.name} compact />}
              />
            </Box>
          ) : (
            <Box sx={{ flex: 1 }} />
          )}
          {showsFilters(route) ? null : (
            <Box sx={{ display: { xs: "none", md: "block" }, flexShrink: 0 }}>
              <AccountMenu currentUser={currentUser} organizationName={organization.name} compact />
            </Box>
          )}
        </Stack>
        {arrived || !pendingHref ? children : <PageSkeleton route={pendingHref} />}
      </Box>
    </Box>
  );
}
