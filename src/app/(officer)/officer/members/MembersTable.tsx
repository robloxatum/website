"use client";

import { Crown, Download, Search, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { button, card, field, label } from "@/components/ui/styles";
import { officerName } from "@/lib/names";
import { formatDate } from "@/lib/time";
import type { MemberRow } from "@/lib/types";
import { clearNickname, setOfficer } from "../actions";
import { ActionButton } from "../_components/ActionButton";

type Sort = "attendance" | "name" | "joined";
const th = "px-4 py-3 text-xs font-semibold tracking-wider text-fg-3 uppercase";

/** Owner (always also an officer) or Officer badge; nothing for members. */
function RoleBadge({ m }: { m: MemberRow }) {
  if (m.is_owner) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-maize px-2 py-0.5 text-xs font-bold text-navy">
        <Crown aria-hidden="true" className="size-3.5" /> Owner
      </span>
    );
  }
  if (!m.is_officer) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-maize/15 px-2 py-0.5 text-xs font-bold text-maize">
      <ShieldCheck aria-hidden="true" className="size-3.5" /> Officer
    </span>
  );
}

/** Officers can remove a nickname (e.g. an inappropriate one); members pick their own. */
function ClearNickname({ m, className = "" }: { m: MemberRow; className?: string }) {
  if (!m.nickname) return null;
  return (
    <ActionButton
      action={clearNickname.bind(null, m.id)}
      confirmText={`Clear the nickname “${m.nickname}” for ${m.full_name || m.uniqname}? They'll be called by their first name until they pick a new one.`}
      className={button({ variant: "ghost", size: "sm", className: `text-xs ${className}` })}
    >
      Clear nickname
    </ActionButton>
  );
}

/** Make/Remove officer: owners only (the database enforces it too), never on owners. */
function RoleAction({ m, canManage }: { m: MemberRow; canManage: boolean }) {
  if (!canManage || m.is_owner) return null;
  const name = officerName(m);
  return m.is_officer ? (
    <ActionButton
      action={setOfficer.bind(null, m.id, false)}
      confirmText={`Remove ${name} as an officer?`}
    >
      Remove officer
    </ActionButton>
  ) : (
    <ActionButton
      action={setOfficer.bind(null, m.id, true)}
      confirmText={`Make ${name} an officer? They'll be able to see codes, attendance and all members.`}
    >
      Make officer
    </ActionButton>
  );
}

export function MembersTable({
  members,
  currentUserId,
  canManageOfficers,
}: {
  /** Each member with their Roblox headshot URL (null: initial-letter icon). */
  members: (MemberRow & { avatar: string | null })[];
  currentUserId: string;
  /** Owners only: shows Make officer / Remove officer. */
  canManageOfficers: boolean;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("attendance");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? members.filter((m) => [m.full_name, m.nickname ?? "", m.uniqname, m.roblox_username ?? ""].some((v) => v.toLowerCase().includes(q)))
      : members;
    return [...filtered].sort((a, b) => {
      if (sort === "name") return a.full_name.localeCompare(b.full_name);
      if (sort === "joined") return b.created_at.localeCompare(a.created_at);
      return b.total_attendance - a.total_attendance || a.full_name.localeCompare(b.full_name);
    });
  }, [members, query, sort]);

  const officerCount = members.filter((m) => m.is_officer).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1">
          <label htmlFor="member-search" className={label}>Search</label>
          <div className="relative">
            <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-fg-3" />
            <input
              id="member-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name, nickname, uniqname or Roblox"
              className={`${field} pl-10`}
            />
          </div>
        </div>
        <div>
          <label htmlFor="member-sort" className={label}>Sort</label>
          <select id="member-sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)} className={field}>
            <option value="attendance">Most attendance</option>
            <option value="name">Name</option>
            <option value="joined">Newest</option>
          </select>
        </div>
        <a href="/officer/members.csv" className={button({ variant: "secondary", className: "min-h-12" })} download>
          <Download aria-hidden="true" />
          Export CSV
        </a>
      </div>

      <p className="text-sm text-fg-2" aria-live="polite">
        {members.length} members · {officerCount} {officerCount === 1 ? "officer" : "officers"}
        {query && ` · ${rows.length} shown`}
      </p>

      {/* Table from xl up (below that, next to the officer sidebar, it doesn't fit) */}
      <div className={`${card} relative hidden overflow-x-auto xl:block`}>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line/60 bg-bg-2/60">
            <tr>
              <th scope="col" className={th}>Name</th>
              <th scope="col" className={th}>Uniqname</th>
              <th scope="col" className={th}>Roblox</th>
              <th scope="col" className={`${th} text-right`}>Events</th>
              <th scope="col" className={th}>Last seen</th>
              <th scope="col" className={th}>Role</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/40">
            {rows.map((m) => {
              const isMe = m.id === currentUserId;
              return (
                <tr key={m.id} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3 font-semibold text-fg">
                    <span className="flex items-center gap-2.5">
                      <Avatar name={m.full_name || m.uniqname} src={m.avatar} size="sm" />
                      <span className="flex flex-col items-start">
                        <span>
                          {officerName(m)} {isMe && <span className="font-normal text-fg-3">(you)</span>}
                        </span>
                        <ClearNickname m={m} className="-ml-3.5 min-h-9!" />
                      </span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-fg-2">{m.uniqname}</td>
                  <td className="px-4 py-3 text-fg-2">{m.roblox_username ?? ""}</td>
                  <td className="px-4 py-3 text-right font-display text-lg font-bold text-fg tabular-nums">{m.total_attendance}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-fg-2">{m.last_checked_in_at ? formatDate(m.last_checked_in_at) : "—"}</td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <RoleBadge m={m} />
                      <RoleAction m={m} canManage={canManageOfficers} />
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-fg-2">No members match.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Cards on phones and narrower windows */}
      <ul className="space-y-3 xl:hidden">
        {rows.map((m) => {
          const isMe = m.id === currentUserId;
          return (
            <li key={m.id} className={`${card} p-4`}>
              <div className="flex items-start justify-between gap-3">
                <Avatar name={m.full_name || m.uniqname} src={m.avatar} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-fg">
                    {officerName(m)} {isMe && <span className="font-normal text-fg-3">(you)</span>}
                  </p>
                  <p className="truncate text-sm text-fg-2">
                    {m.uniqname}
                    {m.roblox_username && ` · ${m.roblox_username}`}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-display text-2xl leading-none font-extrabold text-fg tabular-nums">{m.total_attendance}</p>
                  <p className="text-xs text-fg-3">events</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-fg-3">
                  Last seen {m.last_checked_in_at ? formatDate(m.last_checked_in_at) : "—"}
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <ClearNickname m={m} />
                  <RoleBadge m={m} />
                  <RoleAction m={m} canManage={canManageOfficers} />
                </div>
              </div>
            </li>
          );
        })}
        {rows.length === 0 && <li className="p-6 text-center text-fg-2">No members match.</li>}
      </ul>
    </div>
  );
}
