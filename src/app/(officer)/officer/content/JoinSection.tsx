"use client";

import { Plus } from "lucide-react";
import { useActionState, useState } from "react";
import { FaqList, HomeWhatWeDo, JoinWhatWeDo } from "@/components/content/SiteContent";
import { button, field, label } from "@/components/ui/styles";
import {
  type FaqItem,
  type LastEdit,
  LIMITS,
  type WhatWeDoItem,
  cleanText,
  normalizeFaq,
  normalizeWhatWeDo,
} from "@/lib/site-content";
import { type JoinState, saveJoinContent } from "./actions";
import { PreviewLabel, RowControls, SectionCard, useKeyedList } from "./Shared";

type Content = { faq: FaqItem[]; whatWeDo: WhatWeDoItem[] };

export function JoinSection({ content, edit }: { content: Content; edit: LastEdit }) {
  const [state, action, pending] = useActionState<JoinState, FormData>(saveJoinContent, {});
  return (
    <JoinForm
      key={state.version ?? 0}
      initial={state.content ?? content}
      edit={state.lastEdit ?? edit}
      state={state}
      action={action}
      pending={pending}
    />
  );
}

function JoinForm({
  initial,
  edit,
  state,
  action,
  pending,
}: {
  initial: Content;
  edit: LastEdit;
  state: JoinState;
  action: (formData: FormData) => void;
  pending: boolean;
}) {
  const faqList = useKeyedList(initial.faq);
  const faq = faqList.items;
  const [whatWeDo, setWhatWeDo] = useState(initial.whatWeDo);
  const dirty = JSON.stringify({ faq, whatWeDo }) !== JSON.stringify(initial);
  const updateCard = (i: number, patch: Partial<WhatWeDoItem>) =>
    setWhatWeDo((cards) => cards.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  const previewFaq = faq.map((f) => ({ question: cleanText(f.question) || "Untitled question", answer: cleanText(f.answer) }));
  const previewCards = whatWeDo.map((c) => ({ ...c, title: cleanText(c.title), body: cleanText(c.body) }));

  return (
    <SectionCard
      id="join"
      title="Join page: FAQ and “What we do”"
      description="Plain text only (line breaks become spaces). The four “What we do” cards also show on the home page; each keeps its icon."
      edit={edit}
      error={state.error}
      saved={!!state.version}
      pending={pending}
      dirty={dirty}
      action={action}
      hidden={{ faq: JSON.stringify(faq), whatWeDo: JSON.stringify(whatWeDo), expected: edit?.at ?? "" }}
      check={() => {
        const w = normalizeWhatWeDo(whatWeDo);
        if ("error" in w) return w.error;
        const f = normalizeFaq(faq);
        return "error" in f ? f.error : null;
      }}
      preview={
        <div className="space-y-6">
          <div>
            <PreviewLabel>Join page: What we do</PreviewLabel>
            <JoinWhatWeDo items={previewCards} />
          </div>
          <div>
            <PreviewLabel>Home page: What we do</PreviewLabel>
            <HomeWhatWeDo items={previewCards} />
          </div>
          <div>
            <PreviewLabel>Join page: Questions</PreviewLabel>
            {previewFaq.length ? <FaqList items={previewFaq} /> : <p className="text-sm text-fg-3">No questions: the FAQ is hidden.</p>}
          </div>
        </div>
      }
    >
      <fieldset className="space-y-4">
        <legend className="mb-3 text-lg font-semibold text-fg">What we do</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          {whatWeDo.map((c, i) => (
            <div key={c.key} className="rounded-xl border border-line/60 bg-bg-2/40 p-4">
              <label htmlFor={`what-${c.key}-title`} className={label}>
                Card {i + 1} title
              </label>
              <input
                id={`what-${c.key}-title`}
                value={c.title}
                maxLength={LIMITS.whatTitle}
                onChange={(e) => updateCard(i, { title: e.target.value })}
                className={field}
              />
              <label htmlFor={`what-${c.key}-body`} className={`${label} mt-3`}>
                Text
              </label>
              <textarea
                id={`what-${c.key}-body`}
                value={c.body}
                rows={3}
                maxLength={LIMITS.whatBody}
                onChange={(e) => updateCard(i, { body: e.target.value })}
                className={`${field} resize-y`}
              />
            </div>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-3 text-lg font-semibold text-fg">FAQ</legend>
        {faqList.rows.length === 0 && <p className="text-sm text-fg-3">No questions. The Join page hides the FAQ.</p>}
        <ol className="space-y-4">
          {faqList.rows.map(({ key, item }, i) => {
            const name = `question ${i + 1}`;
            return (
              <li key={key} className="rounded-xl border border-line/60 bg-bg-2/40 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-fg">Question {i + 1}</p>
                  <RowControls name={name} index={i} count={faqList.rows.length} onMove={faqList.move} onRemove={faqList.remove} />
                </div>
                <label htmlFor={`faq-${key}-q`} className={`${label} mt-3`}>
                  Question
                </label>
                <input
                  id={`faq-${key}-q`}
                  value={item.question}
                  maxLength={LIMITS.question}
                  onChange={(e) => faqList.update(i, { question: e.target.value })}
                  className={field}
                  placeholder="Does it cost anything?"
                />
                <label htmlFor={`faq-${key}-a`} className={`${label} mt-3`}>
                  Answer
                </label>
                <textarea
                  id={`faq-${key}-a`}
                  value={item.answer}
                  rows={3}
                  maxLength={LIMITS.answer}
                  onChange={(e) => faqList.update(i, { answer: e.target.value })}
                  className={`${field} resize-y`}
                />
              </li>
            );
          })}
        </ol>
        <button
          type="button"
          disabled={faqList.rows.length >= LIMITS.faq}
          onClick={() => faqList.add({ question: "", answer: "" })}
          className={button({ variant: "secondary" })}
        >
          <Plus aria-hidden="true" />
          Add question
        </button>
      </fieldset>
    </SectionCard>
  );
}
