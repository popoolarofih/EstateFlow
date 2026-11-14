import { Logo } from "@/components/layout/logo";

export default function NotificationsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="border-b border-line bg-canvas">
        <div className="mx-auto flex max-w-3xl items-center px-4 py-3 md:px-6">
          <Logo href="/sign-in" />
        </div>
      </header>
      <main id="main" className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6 md:px-6">
        {children}
      </main>
    </div>
  );
}
