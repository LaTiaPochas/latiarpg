import { MainLayoutShell } from "@/components/main-layout-shell";
import { TopNav } from "@/components/top-nav";

export default function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <MainLayoutShell topNav={<TopNav />}>{children}</MainLayoutShell>;
}
