"use client";

import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import CreditCardOutlinedIcon from "@mui/icons-material/CreditCardOutlined";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import GroupOutlinedIcon from "@mui/icons-material/GroupOutlined";
import MenuIcon from "@mui/icons-material/Menu";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
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
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Initials from "@/components/Initials";
import Logo from "@/components/Logo";
import { browserSupabase } from "@/lib/supabase-browser";
import type { PortalData } from "@/lib/types";

const drawerWidth = 252;

const sections = [
  {
    items: [
      { href: "/", label: "Overview", icon: <SpaceDashboardOutlinedIcon fontSize="small" /> },
      { href: "/invoices", label: "Invoices", icon: <ReceiptLongOutlinedIcon fontSize="small" /> },
      { href: "/schedule-02", label: "Schedule 02", icon: <FactCheckOutlinedIcon fontSize="small" /> },
    ],
  },
  {
    label: "Administration",
    items: [
      { href: "/setup/mapping", label: "Field mapping", icon: <AccountTreeOutlinedIcon fontSize="small" /> },
      { href: "/setup/branches", label: "Branches", icon: <StorefrontOutlinedIcon fontSize="small" /> },
      { href: "/users", label: "Users", icon: <GroupOutlinedIcon fontSize="small" /> },
      { href: "/subscription", label: "Subscription", icon: <CreditCardOutlinedIcon fontSize="small" /> },
    ],
  },
];

function SidebarContent({
  organization,
  onNavigate,
}: {
  organization: PortalData["organization"];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();

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
              {section.items.map((item) => {
                const active =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <ListItemButton
                    key={item.href}
                    selected={active}
                    onClick={() => {
                      router.push(item.href);
                      onNavigate?.();
                    }}
                    sx={{
                      mb: 0.5,
                      borderRadius: 999,
                      py: 0.9,
                      px: 1.5,
                      color: active ? "primary.contrastText" : "text.secondary",
                      "&:hover": {
                        bgcolor: active ? "primary.dark" : "action.hover",
                      },
                      "&.Mui-selected": {
                        bgcolor: "primary.main",
                        color: "primary.contrastText",
                      },
                      "&.Mui-selected:hover": {
                        bgcolor: "primary.dark",
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
      <Box sx={{ px: 2.5, py: 2.25 }}>
        <Typography variant="caption" color="text.secondary" display="block">
          {organization.host}
        </Typography>
        <Button
          size="small"
          onClick={async () => {
            await browserSupabase().auth.signOut();
            router.push("/auth/login");
            router.refresh();
          }}
          sx={{ mt: 1, px: 0, minWidth: 0 }}
        >
          Sign out
        </Button>
      </Box>
    </Stack>
  );
}

function AccountChip({ currentUser }: { currentUser: PortalData["currentUser"] }) {
  return (
    <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
      <Initials name={currentUser.name} size={36} />
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 600, lineHeight: 1.2 }}>
          {currentUser.name}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.3 }}>
          {currentUser.role}
        </Typography>
      </Box>
    </Stack>
  );
}

export default function AppShell({
  children,
  organization,
  currentUser,
}: {
  children: React.ReactNode;
  organization: PortalData["organization"];
  currentUser: PortalData["currentUser"];
}) {
  const [open, setOpen] = useState(false);
  const drawer = <SidebarContent organization={organization} onNavigate={() => setOpen(false)} />;

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
          <Box sx={{ ml: 1 }}>
            <Logo height={28} />
          </Box>
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
          direction="row"
          sx={{
            display: { xs: "none", md: "flex" },
            justifyContent: "flex-end",
            mb: 3,
          }}
        >
          <AccountChip currentUser={currentUser} />
        </Stack>
        {children}
      </Box>
    </Box>
  );
}
