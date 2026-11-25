"use client";

import { Plus } from "lucide-react";
import { useActionState, useState } from "react";
import { AboutStory, FoundersGrid, Timeline } from "@/components/content/About";
import { Alert } from "@/components/ui/Alert";
import { button, field, label } from "@/components/ui/styles";
import { type AboutContent, type AboutPerson, type LastEdit, type Milestone, LIMITS, cleanText, normalizeAbout } from "@/lib/site-content";
import { type AboutState, saveAbout } from "./actions";
import { PreviewLabel, RowControls, SectionCard, useKeyedList } from "./Shared";

export function AboutSection({ content, edit }: { content: AboutContent; edit: LastEdit }) {
  const [state, action, pending] = useActionState<AboutState, FormData>(saveAbout, {});
  return (
    <AboutForm
      key={state.version ?? 0}
      initial={state.content ?? content}
      edit={state.lastEdit ?? edit}
      state={state}
      action={action}
      pending={pending}
    />
  );
}

const EMPTY_MILESTONE: Milestone = { date_label: "", title: "", body: "" };
const EMPTY_PERSON: AboutPerson & { roblox_username: string } = { name: "", role: "", roblox_username: "", blurb: "", visible: true };

function AboutForm({
  initial,
  edit,
  state,
  action,
  pending,
}: {
  initial: AboutContent;
  edit: LastEdit;
  state: AboutState;
  action: (formData: FormData) => void;
  pending: boolean;
}) {
  const start = { ...initial, people: initial.people.map((p) => ({ ...p, roblox_username: p.roblox_username ?? "" })) };
  const [story, setStory] = useState(start.story);
  const timeline = useKeyedList(start.timeline);
  const people = useKeyedList(start.people);
  const about = { story, timeline: timeline.items, people: people.items };
  const dirty = JSON.stringify(about) !== JSON.stringify(start);

  const previewPeople = people.items
    .filter((p) => p.visible)
    .map((p) => ({ name: cleanText(p.name) || "Name", role: cleanText(p.role) || "Role", blurb: cleanText(p.blurb), avatar: null }));

  return (
    <SectionCard
      id="about"
      title="About page"
      description="The story, milestones and founders on /about. Plain text only (line breaks become spaces). Founders' full-body avatars come from their Roblox username."
      edit={edit}
      error={state.error}
      saved={!!state.version}
      pending={pending}
      dirty={dirty}
      action={action}
      hidden={{ about: JSON.stringify(about), expected: edit?.at ?? "" }}
      check={() => {
        const a = normalizeAbout(about);
        return "error" in a ? a.error : null;
      }}
      preview={
        <div className="space-y-6">
          <div>
            <PreviewLabel>Story</PreviewLabel>
            <AboutStory story={cleanText(story)} />
          </div>
          <div>
            <PreviewLabel>Milestones</PreviewLabel>
            {timeline.items.length ? (
              <Timeline
                items={timeline.items.map((m) => ({ date_label: cleanText(m.date_label), title: cleanText(m.title) || "Untitled", body: cleanText(m.body) }))}
              />
            ) : (
              <p className="text-sm text-fg-3">No milestones: the timeline is hidden.</p>
            )}
          </div>
          <div>
            <PreviewLabel>Founders (avatars appear after saving)</PreviewLabel>
            {previewPeople.length ? <FoundersGrid people={previewPeople} /> : <p className="text-sm text-fg-3">Nobody shown: “coming soon”.</p>}
          </div>
        </div>
      }
    >
      {state.notice && !dirty && <Alert tone="warning" title={state.notice} />}

      <div>
        <label htmlFor="about-story" className={label}>
          Story
        </label>
        <textarea
          id="about-story"
          value={story}
          rows={5}
          maxLength={LIMITS.story}
          onChange={(e) => setStory(e.target.value)}
          className={`${field} resize-y`}
        />
      </div>

      <fieldset className="space-y-4">
        <legend className="mb-3 text-lg font-semibold text-fg">Timeline</legend>
        {timeline.rows.length === 0 && <p className="text-sm text-fg-3">No milestones. The page hides the timeline.</p>}
        <ol className="space-y-4">
          {timeline.rows.map(({ key, item }, i) => {
            const idp = `milestone-${key}`;
            return (
              <li key={key} className="rounded-xl border border-line/60 bg-bg-2/40 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-fg">Milestone {i + 1}</p>
                  <RowControls name={`milestone ${i + 1}`} index={i} count={timeline.rows.length} onMove={timeline.move} onRemove={timeline.remove} />
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-[10rem_1fr]">
                  <div>
                    <label htmlFor={`${idp}-date`} className={label}>
                      Date
                    </label>
                    <input
                      id={`${idp}-date`}
                      value={item.date_label}
                      maxLength={LIMITS.dateLabel}
                      onChange={(e) => timeline.update(i, { date_label: e.target.value })}
                      className={field}
                      placeholder="Oct 2025"
                    />
                  </div>
                  <div>
                    <label htmlFor={`${idp}-title`} className={label}>
                      Title
                    </label>
                    <input
                      id={`${idp}-title`}
                      value={item.title}
                      maxLength={LIMITS.milestoneTitle}
                      onChange={(e) => timeline.update(i, { title: e.target.value })}
                      className={field}
                      placeholder="First game night"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor={`${idp}-body`} className={label}>
                      Short text <span className="font-normal text-fg-3">(optional)</span>
                    </label>
                    <input
                      id={`${idp}-body`}
                      value={item.body}
                      maxLength={LIMITS.milestoneBody}
                      onChange={(e) => timeline.update(i, { body: e.target.value })}
                      className={field}
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
        <button
          type="button"
          disabled={timeline.rows.length >= LIMITS.timeline}
          onClick={() => timeline.add(EMPTY_MILESTONE)}
          className={button({ variant: "secondary" })}
        >
          <Plus aria-hidden="true" />
          Add milestone
        </button>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-3 text-lg font-semibold text-fg">Founders</legend>
        {people.rows.length === 0 && <p className="text-sm text-fg-3">Nobody yet. The page says founder profiles are coming soon.</p>}
        <ol className="space-y-4">
          {people.rows.map(({ key, item }, i) => {
            const idp = `person-${key}`;
            return (
              <li key={key} className="rounded-xl border border-line/60 bg-bg-2/40 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="min-w-0 truncate font-semibold text-fg">{cleanText(item.name) || `Person ${i + 1}`}</p>
                  <RowControls name={`person ${i + 1}`} index={i} count={people.rows.length} onMove={people.move} onRemove={people.remove} />
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor={`${idp}-name`} className={label}>
                      Name
                    </label>
                    <input
                      id={`${idp}-name`}
                      value={item.name}
                      maxLength={LIMITS.personName}
                      onChange={(e) => people.update(i, { name: e.target.value })}
                      className={field}
                    />
                  </div>
                  <div>
                    <label htmlFor={`${idp}-role`} className={label}>
                      Role
                    </label>
                    <input
                      id={`${idp}-role`}
                      value={item.role}
                      maxLength={LIMITS.personRole}
                      onChange={(e) => people.update(i, { role: e.target.value })}
                      className={field}
                      placeholder="Co-founder & President"
                    />
                  </div>
                  <div>
                    <label htmlFor={`${idp}-roblox`} className={label}>
                      Roblox username <span className="font-normal text-fg-3">(optional)</span>
                    </label>
                    <input
                      id={`${idp}-roblox`}
                      value={item.roblox_username ?? ""}
                      maxLength={21}
                      autoCapitalize="off"
                      autoCorrect="off"
                      spellCheck={false}
                      onChange={(e) => people.update(i, { roblox_username: e.target.value })}
                      className={field}
                      placeholder="builderman"
                    />
                  </div>
                  <div>
                    <label htmlFor={`${idp}-blurb`} className={label}>
                      One-liner <span className="font-normal text-fg-3">(optional)</span>
                    </label>
                    <input
                      id={`${idp}-blurb`}
                      value={item.blurb}
                      maxLength={LIMITS.personBlurb}
                      onChange={(e) => people.update(i, { blurb: e.target.value })}
                      className={field}
                    />
                  </div>
                </div>
                <label className="mt-3 inline-flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold text-fg">
                  <input
                    type="checkbox"
                    checked={item.visible}
                    onChange={(e) => people.update(i, { visible: e.target.checked })}
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
          disabled={people.rows.length >= LIMITS.people}
          onClick={() => people.add(EMPTY_PERSON)}
          className={button({ variant: "secondary" })}
        >
          <Plus aria-hidden="true" />
          Add person
        </button>
      </fieldset>
    </SectionCard>
  );
}
