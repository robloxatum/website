"use client";

import { useActionState, useState } from "react";
import { FeaturedPanel } from "@/components/content/SiteContent";
import { field, label } from "@/components/ui/styles";
import {
  type FeaturedPanelContent,
  type LastEdit,
  LIMITS,
  cleanText,
  normalizeFeatured,
  normalizeFeaturedHref,
} from "@/lib/site-content";
import { type FeaturedState, saveFeatured } from "./actions";
import { SectionCard } from "./Shared";

type Draft = { enabled: boolean; title: string; body: string; link_text: string; link_href: string };

const toDraft = (f: FeaturedPanelContent): Draft => ({ ...f, link_text: f.link_text ?? "", link_href: f.link_href ?? "" });

export function FeaturedSection({ featured, edit }: { featured: FeaturedPanelContent; edit: LastEdit }) {
  const [state, action, pending] = useActionState<FeaturedState, FormData>(saveFeatured, {});
  return (
    <FeaturedForm
      key={state.version ?? 0}
      initial={toDraft(state.content ?? featured)}
      edit={state.lastEdit ?? edit}
      state={state}
      action={action}
      pending={pending}
    />
  );
}

function FeaturedForm({
  initial,
  edit,
  state,
  action,
  pending,
}: {
  initial: Draft;
  edit: LastEdit;
  state: FeaturedState;
  action: (formData: FormData) => void;
  pending: boolean;
}) {
  const [draft, setDraft] = useState(initial);
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const href = normalizeFeaturedHref(draft.link_href, []);
  const linkText = cleanText(draft.link_text);
  const preview: FeaturedPanelContent = {
    enabled: draft.enabled,
    title: cleanText(draft.title) || "Untitled",
    body: cleanText(draft.body),
    link_text: linkText && draft.link_href.trim() ? linkText : null,
    link_href: linkText && draft.link_href.trim() ? ("ok" in href ? href.ok : "/") : null,
  };

  return (
    <SectionCard
      id="featured"
      title="Featured panel"
      description="The panel next to Upcoming Events on the home page. When it's off, the events take the full width."
      edit={edit}
      error={state.error}
      saved={!!state.version}
      pending={pending}
      dirty={dirty}
      action={action}
      hidden={{ featured: JSON.stringify(draft), expected: edit?.at ?? "" }}
      check={() => {
        const r = normalizeFeatured(draft, []);
        return "error" in r ? r.error : null;
      }}
      preview={
        draft.enabled ? (
          <div className="max-w-[340px]">
            <FeaturedPanel featured={preview} />
          </div>
        ) : (
          <p className="text-sm text-fg-2">Off: the home page shows no Featured panel, and Upcoming Events take the full width.</p>
        )
      }
    >
      <label className="flex min-h-12 cursor-pointer items-center justify-between gap-4 rounded-xl border border-line/60 bg-bg-2/40 px-4 py-2">
        <span>
          <span className="block font-semibold text-fg">Show on the home page</span>
          <span className="block text-sm text-fg-3">{draft.enabled ? "On" : "Off"}</span>
        </span>
        <input type="checkbox" role="switch" checked={draft.enabled} onChange={(e) => set({ enabled: e.target.checked })} className="peer sr-only" />
        <span
          aria-hidden="true"
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-150 peer-focus-visible:ring-2 peer-focus-visible:ring-maize ${
            draft.enabled ? "bg-maize" : "bg-elevated"
          }`}
        >
          <span
            className={`absolute top-1 left-1 size-5 rounded-full bg-white shadow transition-transform duration-150 ${draft.enabled ? "translate-x-5" : ""}`}
          />
        </span>
      </label>

      <div>
        <label htmlFor="featured-title" className={label}>
          Title
        </label>
        <input
          id="featured-title"
          value={draft.title}
          maxLength={LIMITS.featuredTitle}
          onChange={(e) => set({ title: e.target.value })}
          className={field}
        />
      </div>
      <div>
        <label htmlFor="featured-body" className={label}>
          Text
        </label>
        <textarea
          id="featured-body"
          value={draft.body}
          rows={4}
          maxLength={LIMITS.featuredBody}
          onChange={(e) => set({ body: e.target.value })}
          className={`${field} resize-y`}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="featured-link-text" className={label}>
            Link text <span className="font-normal text-fg-3">(optional)</span>
          </label>
          <input
            id="featured-link-text"
            value={draft.link_text}
            maxLength={LIMITS.linkText}
            onChange={(e) => set({ link_text: e.target.value })}
            className={field}
            placeholder="Be part of the next one"
          />
        </div>
        <div>
          <label htmlFor="featured-link" className={label}>
            Link
          </label>
          <input
            id="featured-link"
            value={draft.link_href}
            inputMode="url"
            autoCapitalize="off"
            spellCheck={false}
            maxLength={LIMITS.url}
            onChange={(e) => set({ link_href: e.target.value })}
            className={field}
            placeholder="/join, or an https:// link"
            aria-describedby="featured-link-help"
          />
          <p id="featured-link-help" className="mt-1.5 text-sm text-fg-3">
            A page on our site like /join or /events, or an https link.
          </p>
        </div>
      </div>
    </SectionCard>
  );
}
