"use client";

import { CurrencyNgn, House, UserCircle, Users, Wrench } from "@phosphor-icons/react";
import { BottomNav, TopTabs, type NavItem } from "@/components/layout/role-nav";

const ITEMS: NavItem[] = [
  { href: "/resident", label: "Home", icon: House, exact: true },
  { href: "/resident/visitors", label: "Visitors", icon: Users },
  { href: "/resident/payments", label: "Payments", icon: CurrencyNgn },
  { href: "/resident/services", label: "Services", icon: Wrench },
  { href: "/resident/profile", label: "Profile", icon: UserCircle },
];

export function ResidentBottomNav() {
  return <BottomNav items={ITEMS} />;
}

export function ResidentTopTabs() {
  return <TopTabs items={ITEMS} />;
}
