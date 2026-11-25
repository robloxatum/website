import type { FormEvent, TransitionStartFunction } from "react";

/**
 * Submit a form's action ourselves instead of letting <form action> do it.
 * React resets a form after an action it submitted, which wipes everything the
 * person typed when the server refuses it ("end must be after start") and they
 * have to start over. Dispatching from onSubmit keeps every field (and chosen
 * files) as they were; without JavaScript, the form's action still works.
 */
export function submitKeepingFields(
  e: FormEvent<HTMLFormElement>,
  dispatch: (formData: FormData) => void,
  startTransition: TransitionStartFunction,
) {
  e.preventDefault();
  const submitter = (e.nativeEvent as SubmitEvent).submitter;
  const formData = new FormData(e.currentTarget, submitter instanceof HTMLElement ? submitter : null);
  startTransition(() => dispatch(formData));
}
