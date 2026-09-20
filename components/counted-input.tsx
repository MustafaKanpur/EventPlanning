"use client";

import { useState } from "react";

/**
 * A text input/textarea with a live character counter. `maxLength` already stops typing at
 * the limit; the counter is there so someone writing a long note can see it coming.
 */
export function CountedInput({
  name,
  defaultValue = "",
  required,
  maxLength,
  placeholder,
  multiline,
  className,
}: {
  name: string;
  defaultValue?: string;
  required?: boolean;
  maxLength: number;
  placeholder?: string;
  multiline?: boolean;
  className?: string;
}) {
  const [length, setLength] = useState(defaultValue.length);

  const shared = {
    name,
    required,
    maxLength,
    placeholder,
    defaultValue,
    className,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setLength(e.target.value.length),
  };

  return (
    <>
      {multiline ? <textarea rows={2} {...shared} /> : <input type="text" {...shared} />}
      <p
        className={`text-right text-xs ${
          length >= maxLength ? "text-red-500" : "text-ink-muted"
        }`}
      >
        {length} / {maxLength}
      </p>
    </>
  );
}
