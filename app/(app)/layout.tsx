import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { LayoutDashboard, Package, MessageSquare, Users } from "lucide-react";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/offerings", label: "Offerings", icon: Package },
  { href: "/prompts", label: "Prompts", icon: MessageSquare },
  { href: "/prospects", label: "Prospects", icon: Users },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");

  return (
    <div className="flex h-screen">
      <aside className="w-56 shrink-0 border-r bg-zinc-50 flex flex-col">
        <div className="px-5 py-4 border-b">
          <span className="font-semibold text-sm">Kakiyo Outreach</span>
        </div>
        <nav className="flex flex-col gap-1 p-3 flex-1">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="px-4 py-3 border-t text-xs text-zinc-400 truncate">
          {session.user.email}
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
