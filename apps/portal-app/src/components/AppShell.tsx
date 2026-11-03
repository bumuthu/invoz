"use client";

import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import CloudSyncOutlinedIcon from "@mui/icons-material/CloudSyncOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import Collapse from "@mui/material/Collapse";
import CreditCardOutlinedIcon from "@mui/icons-material/CreditCardOutlined";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import ListAltOutlinedIcon from "@mui/icons-material/ListAltOutlined";
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
import { useState, type ReactNode } from "react";
import PageSkeleton from "@/components/PageSkeleton";
import FilterBar from "@/components/FilterBar";
import Initials from "@/components/Initials";
import Logo from "@/components/Logo";
import { navigate, usePortalPath } from "@/lib/portal-nav";
import { browserSupabase } from "@/lib/supabase-browser";
import type { PortalData } from "@/lib/types";

const drawerWidth = 252;

type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
  audit?: boolean;
  children?: { href: string; label: string }[];
};

const sections: { label?: string; items: NavItem[] }[] = [
  {
    items: [
      { href: "/", label: "Overview", icon: <SpaceDashboardOutlinedIcon fontSize="small" /> },
      {
        href: "/schedules/automated",
        label: "Automated Schedules",
        icon: <ReceiptLongOutlinedIcon fontSize="small" />,
        children: [
          { href: "/schedules/01", label: "Schedule 01" },
          { href: "/schedules/04", label: "Schedule 04" },
          { href: "/schedules/07", label: "Schedule 07" },
        ],
      },
      {
        href: "/schedules/manual",
        label: "Manual Schedules",
        icon: <ListAltOutlinedIcon fontSize="small" />,
        children: [{ href: "/schedules/02", label: "Schedule 2" }],
      },
      { href: "/exceptions", label: "Exceptions", icon: <ReportOutlinedIcon fontSize="small" /> },
      { href: "/audit", label: "Audit", icon: <PolicyOutlinedIcon fontSize="small" />, audit: true },
    ],
  },
  {
    label: "Administration",
    items: [
      { href: "/ingestion", label: "Ingestion", icon: <CloudSyncOutlinedIcon fontSize="small" /> },
      { href: "/setup/erp", label: "ERP", icon: <FactCheckOutlinedIcon fontSize="small" /> },
      { href: "/setup/mapping", label: "Field Mapping", icon: <AccountTreeOutlinedIcon fontSize="small" /> },
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
    pathname.startsWith("/schedules") ||
    pathname.startsWith("/exceptions") ||
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
  const { pathname, search } = usePortalPath();
  const current = pendingHref ?? pathname;
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  return (
    <Stack sx={{ height: "100%" }}>
      <Box sx={{ px: 2.5, pt: 2.75, pb: 1.5 }}>
        <Box
          component="button"
          type="button"
          aria-label="Overview"
          onClick={() => {
            if (pathname !== "/") onSelect("/");
            navigate("/");
            onNavigate?.();
          }}
          sx={{
            p: 0,
            border: 0,
            bgcolor: "transparent",
            display: "inline-flex",
            cursor: "pointer",
            "& img": { cursor: "pointer" },
          }}
        >
          <Logo height={32} />
        </Box>
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
              {section.items.filter((item) => !item.audit || canAudit).map((item) => {
                const active =
                  item.href === "/"
                    ? current === "/"
                    : current === item.href || current.startsWith(`${item.href}/`);
                const itemSx = (selected: boolean) => ({
                  mb: 0.5,
                  borderRadius: 2,
                  py: 0.9,
                  borderLeft: "3px solid",
                  borderColor: selected ? "primary.main" : "transparent",
                  color: selected ? "primary.main" : "text.secondary",
                  "&:hover": { bgcolor: "action.hover" },
                  "&.Mui-selected": { bgcolor: "action.hover", color: "primary.main" },
                  "&.Mui-selected:hover": { bgcolor: "action.hover" },
                });
                if (item.children) {
                  const groupHasCurrent = item.children.some(
                    (child) => current === child.href || current.startsWith(`${child.href}/`),
                  );
                  const groupOpen = openGroups[item.href] ?? groupHasCurrent;
                  return (
                    <Box key={item.href}>
                      <ListItemButton
                        selected={false}
                        onClick={() => setOpenGroups((groups) => ({ ...groups, [item.href]: !groupOpen }))}
                        aria-expanded={groupOpen}
                        sx={{ ...itemSx(false), pl: 1.25 }}
                      >
                        <ListItemIcon sx={{ minWidth: 32, color: "inherit" }}>{item.icon}</ListItemIcon>
                        <ListItemText
                          primary={item.label}
                          slotProps={{ primary: { sx: { fontSize: 14, fontWeight: 500 } } }}
                        />
                        <ExpandMoreIcon
                          fontSize="small"
                          sx={{ transform: groupOpen ? "rotate(180deg)" : "none", transition: "transform 150ms" }}
                        />
                      </ListItemButton>
                      <Collapse in={groupOpen}>
                        <List disablePadding>
                          {item.children.map((child) => {
                            const childActive = current === child.href || current.startsWith(`${child.href}/`);
                            return (
                              <ListItemButton
                                key={child.href}
                                selected={childActive}
                                onClick={() => {
                                  if (pathname !== child.href) onSelect(child.href);
                                  navigate(search ? `${child.href}?${search}` : child.href);
                                  onNavigate?.();
                                }}
                                sx={{ ...itemSx(childActive), pl: 5.5 }}
                              >
                                <ListItemText
                                  primary={child.label}
                                  slotProps={{
                                    primary: { sx: { fontSize: 13.5, fontWeight: childActive ? 600 : 500 } },
                                  }}
                                />
                              </ListItemButton>
                            );
                          })}
                        </List>
                      </Collapse>
                    </Box>
                  );
                }
                return (
                  <ListItemButton
                    key={item.href}
                    selected={active}
                    onClick={() => {
                      if (pathname !== item.href) onSelect(item.href);
                      navigate(item.href === "/" ? "/" : search ? `${item.href}?${search}` : item.href);
                      onNavigate?.();
                    }}
                    sx={{ ...itemSx(active), pl: 1.25 }}
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
  clearOrganization,
  compact = false,
}: {
  currentUser: PortalData["currentUser"];
  organizationName: string;
  clearOrganization: () => Promise<void>;
  compact?: boolean;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  async function signOut() {
    setAnchor(null);
    await clearOrganization();
    await browserSupabase().auth.signOut();
    window.location.assign("/auth/login");
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
  clearOrganization,
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
  clearOrganization: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const { pathname } = usePortalPath();
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
          <Box
            component="button"
            type="button"
            aria-label="Overview"
            onClick={() => {
              if (pathname !== "/") setPendingHref("/");
              navigate("/");
              setOpen(false);
            }}
            sx={{
              ml: 1,
              flex: 1,
              p: 0,
              border: 0,
              bgcolor: "transparent",
              cursor: "pointer",
              textAlign: "left",
              "& img": { cursor: "pointer" },
            }}
          >
            <Logo height={28} />
          </Box>
          <AccountMenu
            currentUser={currentUser}
            organizationName={organization.name}
            clearOrganization={clearOrganization}
            compact
          />
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
                account={<AccountMenu currentUser={currentUser} organizationName={organization.name} clearOrganization={clearOrganization} compact />}
              />
            </Box>
          ) : (
            <Box sx={{ flex: 1 }} />
          )}
          {showsFilters(route) ? null : (
            <Box sx={{ display: { xs: "none", md: "block" }, flexShrink: 0 }}>
              <AccountMenu currentUser={currentUser} organizationName={organization.name} clearOrganization={clearOrganization} compact />
            </Box>
          )}
        </Stack>
        {arrived || !pendingHref ? children : <PageSkeleton route={pendingHref} />}
      </Box>
    </Box>
  );
}
