import { TopNav } from "@/components/top-nav";

export default function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <TopNav />
      <main className="pt-14">{children}</main>
    </>
  );
}
