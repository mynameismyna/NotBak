"use client";

import { useState, useEffect } from "react";
import { NavDropdown, NavDropdownItem } from "./NavDropdown";
import { EmailRecordsBadge } from "./EmailRecordsBadge";

interface Props {
  isAdmin: boolean;
}

export function KayitlarDropdown({ isAdmin }: Props) {
  const [emailBadgeCount, setEmailBadgeCount] = useState(0);
  const [taleplerCount, setTaleplerCount] = useState(0);

  useEffect(() => {
    const fetchTalepler = () => {
      fetch("/api/talepler/counts")
        .then((r) => r.json())
        .then((d) => setTaleplerCount(d.receivedCount ?? 0))
        .catch(() => setTaleplerCount(0));
    };
    fetchTalepler();
    const t = setInterval(fetchTalepler, 60000);
    return () => clearInterval(t);
  }, []);

  const totalBadgeCount = emailBadgeCount + taleplerCount;

  return (
    <NavDropdown
      label="Kayıtlar"
      activePaths={[
        "/dashboard/talepler",
        "/dashboard/email-records",
        "/dashboard/unknown-email-records",
      ]}
      badgeCount={totalBadgeCount}
    >
      <NavDropdownItem href="/dashboard/talepler">
        Gelen Talepler
        {taleplerCount > 0 && (
          <span className="ml-2 inline-flex min-w-[18px] h-[18px] px-1 items-center justify-center rounded-full bg-amber-500 text-white text-xs font-medium leading-none">
            {taleplerCount > 99 ? "99+" : taleplerCount}
          </span>
        )}
      </NavDropdownItem>
      <EmailRecordsBadge
        isAdmin={isAdmin}
        variant="dropdown"
        onTotalCountChange={setEmailBadgeCount}
      />
    </NavDropdown>
  );
}
