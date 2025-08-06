"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserControl } from "./user-control";
import { Search, MessageSquare, Video, Home, ArrowLeft } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";

const navigationItems = [
  {
    name: "Search",
    href: "/dashboard",
    icon: Search,
    description: "Search and transcribe videos",
  },
  {
    name: "Chat",
    href: "/dashboard/chat",
    icon: MessageSquare,
    description: "Chat with AI about your videos",
  },
  {
    name: "My Videos",
    href: "/dashboard/videos",
    icon: Video,
    description: "View your transcribed videos",
  },
];

function AppSidebar() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }
    return pathname.startsWith(href);
  };

  return (
    <Sidebar variant="inset">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-2">
          <Home className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-semibold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            InsightFlow
          </h1>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.description}
                    >
                      <Link href={item.href}>
                        <Icon />
                        <span>{item.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link href="/" className="flex items-center gap-2">
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Home</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="px-2 py-2">
          <UserControl showName />
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}

export default function DashboardNavigation({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Top header with sidebar trigger */}
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <div className="h-4 w-px bg-sidebar-border" />
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Dashboard</span>
          </div>
        </header>

        {/* Scrollable content area */}
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 overflow-auto p-4 md:p-8">{children}</div>
        </div>
      </main>
    </SidebarProvider>
  );
}
