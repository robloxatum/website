"use client";

import { Plus } from "lucide-react";
import { useActionState } from "react";
import { ClubLinkButtons, ClubLinkIcons } from "@/components/ui/ClubLinkButtons";
import { button, field, label } from "@/components/ui/styles";
import { type CommunityLink, type LastEdit, LIMITS, cleanText, normalizeHttpsUrl, normalizeLinks } from "@/lib/site-content";
import { type LinksState, saveLinks } from "./actions";
import { PreviewLabel, RowControls, SectionCard, useKeyedList } from "./Shared";

export function LinksSection({ links, edit }: { links: CommunityLink[]; edit: LastEdit }) {
  const [state, action, pending] = useActionState<LinksState, FormData>(saveLinks, {});
  return (
    <LinksForm
      key={state.version ?? 0}
      initial={state.content ?? links}
      edit={state.lastEdit ?? edit}
      state={state}
      action={action}
      pending={pending}
    />
  );
}

/** What a link looks like with its typed values (invalid URLs don't go anywhere). */
function previewLinks(links: CommunityLink[]): CommunityLink[] {
  return links
    .filter((l) => l.visible)
    .map((l) => {
      const url = normalizeHttpsUrl(l.url);
      return { ...l, label: cleanText(l.label) || "Untitled link", blurb: cleanText(l.blurb), url: "ok" in url ? url.ok : "#" };
    });
}

function LinksForm({
  initial,
  edit,
  state,
  action,
  pending,
}: {
  initial: CommunityLink[];
  edit: LastEdit;
  state: LinksState;
  action: (formData: FormData) => void;
  pending: boolean;
}) {
  const list = useKeyedList(initial);
  const links = list.items;
  const dirty = JSON.stringify(links) !== JSON.stringify(initial);
  const shown = previewLinks(links);

  return (
    <SectionCard
      id="links"
      title="Links"
      description="Community links on /links, the Join page, “You’re in!” and the footer, in this order. Links must be https. The officers’ email always shows last on /links."
      edit={edit}
      error={state.error}
      saved={!!state.version}
      pending={pending}
      dirty={dirty}
      action={action}
      hidden={{ links: JSON.stringify(links), expected: edit?.at ?? "" }}
      check={() => {
        const r = normalizeLinks(links);
        return "error" in r ? r.error : null;
      }}
      preview={
        <div className="space-y-6">
          <div>
            <PreviewLabel>/links</PreviewLabel>
            <ClubLinkButtons links={shown} withBlurb withEmail />
          </div>
          <div>
            <PreviewLabel>Join page and “You’re in!”</PreviewLabel>
            {shown.length ? <ClubLinkButtons links={shown} /> : <p className="text-sm text-fg-3">No links shown.</p>}
          </div>
          <div>
            <PreviewLabel>Footer</PreviewLabel>
            <ClubLinkIcons links={shown} />
          </div>
        </div>
      }
    >
      {list.rows.length === 0 && <p className="text-sm text-fg-3">No links. Add one below.</p>}
      <ol className="space-y-4">
        {list.rows.map(({ key, item }, i) => {
          const name = cleanText(item.label) || `link ${i + 1}`;
          const idp = `link-${key}`;
          return (
            <li key={key} className={`rounded-xl border border-line/60 bg-bg-2/40 p-4 ${item.visible ? "" : "opacity-70"}`}>
              <div className="flex items-center justify-between gap-3">
                <p className="min-w-0 truncate font-semibold text-fg">
                  {i + 1}. {name}
                  {!item.visible && <span className="ml-2 rounded-md bg-elevated px-2 py-0.5 text-xs text-fg-2">Hidden</span>}
                </p>
                <RowControls name={name} index={i} count={list.rows.length} onMove={list.move} onRemove={list.remove} />
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor={`${idp}-label`} className={label}>
                    Label
                  </label>
                  <input
                    id={`${idp}-label`}
                    value={item.label}
                    maxLength={LIMITS.label}
                    onChange={(e) => list.update(i, { label: e.target.value })}
                    className={field}
                    placeholder="Discord"
                  />
                </div>
                <div>
                  <label htmlFor={`${idp}-url`} className={label}>
                    URL
                  </label>
                  <input
                    id={`${idp}-url`}
                    value={item.url}
                    inputMode="url"
                    autoCapitalize="off"
                    spellCheck={false}
                    maxLength={LIMITS.url}
                    onChange={(e) => list.update(i, { url: e.target.value })}
                    className={field}
                    placeholder="https://discord.gg/…"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor={`${idp}-blurb`} className={label}>
                    Short description <span className="font-normal text-fg-3">(on /links)</span>
                  </label>
                  <input
                    id={`${idp}-blurb`}
                    value={item.blurb}
                    maxLength={LIMITS.blurb}
                    onChange={(e) => list.update(i, { blurb: e.target.value })}
                    className={field}
                    placeholder="Hang out, find teammates, play together"
                  />
                </div>
              </div>
              <label className="mt-3 inline-flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold text-fg">
                <input
                  type="checkbox"
                  checked={item.visible}
                  onChange={(e) => list.update(i, { visible: e.target.checked })}
                  className="size-5 accent-maize"
                />
                Show on the site
              </label>
            </li>
          );
        })}
      </ol>
      <button
        type="button"
        disabled={list.rows.length >= LIMITS.links}
        onClick={() => list.add({ label: "", url: "", blurb: "", visible: true })}
        className={button({ variant: "secondary" })}
      >
        <Plus aria-hidden="true" />
        Add link
      </button>
      {list.rows.length >= LIMITS.links && <p className="text-sm text-fg-3">That&apos;s the most ({LIMITS.links}).</p>}
    </SectionCard>
  );
}
