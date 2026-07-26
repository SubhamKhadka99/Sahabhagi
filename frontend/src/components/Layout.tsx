import type { ReactNode } from "react";

interface LayoutProps {
  mode: "citizen" | "admin";
  children: ReactNode;
}

export default function Layout({ mode, children }: LayoutProps) {
  if (mode === "citizen") {
    return (
      <div className="min-h-screen min-h-[100dvh] w-full bg-slate-200 dark:bg-black flex items-center justify-center md:p-6">
        <div className="relative mx-auto flex h-screen h-[100dvh] w-full max-w-md flex-col overflow-hidden page-bg shadow-2xl md:rounded-2xl">
          {children}
        </div>
      </div>
    );
  }
  return (
    <div className="flex h-screen h-[100dvh] w-full overflow-hidden page-bg">
      {children}
    </div>
  );
}
