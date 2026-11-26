"use client";
import { Header } from "@/components/Header";

export default function OrganizerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-muted/30">
      <Header />
      <main className="max-w-7xl mx-auto py-8 px-4">{children}</main>
    </div>
  );
}