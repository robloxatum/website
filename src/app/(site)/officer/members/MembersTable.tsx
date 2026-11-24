"use client";

import { useMemo, useState } from "react";
import type { MemberRow } from "@/lib/types";
import { formatDate } from "@/lib/time";
import { setOfficer } from "../actions";
import { ActionButton } from "../_components/ActionButton";

type Sort = "attendance" | "name" | "joined";

export function MembersTable({ members, currentUserId }: { members: MemberRow[]; currentUserId: string }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("attendance");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? members.filter((m) =>
          [m.full_name, m.uniqname, m.roblox_username ?? ""].some((v) => v.toLowerCase().includes(q)),
        )
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
        <div className="min-w-48 flex-1">
          <label htmlFor="member-search" className="label">Search</label>
          <input
            id="member-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name, uniqname or Roblox username"
            className="field"
          />
        </div>
        <div>
          <label htmlFor="member-sort" className="label">Sort</label>
          <select id="member-sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="field">
            <option value="attendance">Most attendance</option>
            <option value="name">Name</option>
            <option value="joined">Newest</option>
          </select>
        </div>
        <a href="/officer/members.csv" className="btn btn-white" download>
          Export CSV
        </a>
      </div>

      <p className="text-sm text-blue/70">
        {members.length} members · {officerCount} {officerCount === 1 ? "officer" : "officers"}
      </p>

      <div className="block-card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-cream font-display text-xs uppercase">
            <tr>
              <th className="p-3">Name</th>
              <th className="p-3">Uniqname</th>
              <th className="p-3">Roblox</th>
              <th className="p-3 text-right">Events</th>
              <th className="p-3">Last seen</th>
              <th className="p-3">Role</th>
            </tr>
          </thead>
          <tbody className="divide-y-2 divide-blue/10">
            {rows.map((m) => {
              const isMe = m.id === currentUserId;
              const name = m.full_name || m.uniqname;
              return (
                <tr key={m.id}>
                  <td className="p-3 font-semibold">
                    {name} {isMe && <span className="text-blue/50">(you)</span>}
                  </td>
                  <td className="p-3">{m.uniqname}</td>
                  <td className="p-3">{m.roblox_username ?? ""}</td>
                  <td className="p-3 text-right font-display text-lg">{m.total_attendance}</td>
                  <td className="p-3 whitespace-nowrap">
                    {m.last_checked_in_at ? formatDate(m.last_checked_in_at) : "—"}
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {m.is_officer && <span className="tag bg-maize">Officer</span>}
                      {m.is_officer ? (
                        <ActionButton
                          action={setOfficer.bind(null, m.id, false)}
                          confirmText={
                            isMe
                              ? "Remove YOURSELF as an officer? You'll lose access to officer pages."
                              : `Remove ${name} as an officer?`
                          }
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
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="p-4 text-center">
                  No members match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
