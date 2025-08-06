import { Metadata } from "next";
import DashboardNavigation from "@/components/DashboardNavigation";

export const metadata: Metadata = {
  title: "InsightFlow",
  description: "Manage your video transcriptions and chat with AI",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardNavigation>{children}</DashboardNavigation>;
}
