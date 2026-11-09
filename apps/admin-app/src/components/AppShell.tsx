"use client";

import ApartmentOutlinedIcon from "@mui/icons-material/ApartmentOutlined";
import CableOutlinedIcon from "@mui/icons-material/CableOutlined";
import InboxOutlinedIcon from "@mui/icons-material/InboxOutlined";
import InsightsOutlinedIcon from "@mui/icons-material/InsightsOutlined";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import MarkEmailReadOutlinedIcon from "@mui/icons-material/MarkEmailReadOutlined";
import MenuIcon from "@mui/icons-material/Menu";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Stack from "@mui/material/Stack";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import Logo from "@/components/Logo";

const links = [
  { href: "/", label: "Overview", icon: <InsightsOutlinedIcon fontSize="small" /> },
  { href: "/organizations", label: "Organizations", icon: <ApartmentOutlinedIcon fontSize="small" /> },
  { href: "/connections", label: "Connections", icon: <CableOutlinedIcon fontSize="small" /> },
  { href: "/requests", label: "Requests", icon: <InboxOutlinedIcon fontSize="small" /> },
  { href: "/leads", label: "Leads", icon: <MarkEmailReadOutlinedIcon fontSize="small" /> },
];

const drawerWidth = 232;

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const desktop = useMediaQuery("(min-width:900px)");
  const [open, setOpen] = useState(false);

  const drawer = (
    <Stack spacing={3} sx={{ height: "100%", p: 2 }}>
      <Box>
        <Logo />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Platform admin
        </Typography>
      </Box>
      <List sx={{ p: 0, flex: 1 }}>
        {links.map((link) => {
          const selected = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
          return (
            <ListItemButton
              key={link.href}
              component={Link}
              href={link.href}
              selected={selected}
              sx={{ borderRadius: 2, mb: 0.5 }}
              onClick={() => setOpen(false)}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>{link.icon}</ListItemIcon>
              <ListItemText primary={link.label} />
            </ListItemButton>
          );
        })}
      </List>
      <Button
        variant="outlined"
        startIcon={<LogoutOutlinedIcon />}
        onClick={async () => {
          await fetch("/api/auth/logout", { method: "POST" });
          router.replace("/auth/login");
          router.refresh();
        }}
      >
        Sign out
      </Button>
    </Stack>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      {desktop ? (
        <Drawer
          variant="permanent"
          sx={{
            width: drawerWidth,
            flexShrink: 0,
            "& .MuiDrawer-paper": { width: drawerWidth, boxSizing: "border-box", borderRight: 1, borderColor: "divider" },
          }}
        >
          {drawer}
        </Drawer>
      ) : (
        <>
          <AppBar position="fixed" color="inherit" elevation={0} sx={{ borderBottom: 1, borderColor: "divider" }}>
            <Toolbar>
              <IconButton edge="start" aria-label="Open navigation" onClick={() => setOpen(true)} sx={{ mr: 1 }}>
                <MenuIcon />
              </IconButton>
              <Logo height={28} />
            </Toolbar>
          </AppBar>
          <Drawer open={open} onClose={() => setOpen(false)}>
            <Box sx={{ width: drawerWidth }}>{drawer}</Box>
          </Drawer>
        </>
      )}
      <Box component="main" sx={{ flex: 1, p: { xs: 2, md: 4 }, pt: { xs: 10, md: 4 }, minWidth: 0 }}>
        {children}
      </Box>
    </Box>
  );
}
