import { useEffect, useRef, useState } from "react";

export default function BufferedListInput({
  value = [],
  onCommit,
  separator = ",",
  multiline = false,
  ...props
}) {
  const focused = useRef(false);
  const joiner = separator === "\n" ? "\n" : `${separator} `;
  const [draft, setDraft] = useState(() => (value || []).join(joiner));

  useEffect(() => {
    if (!focused.current) setDraft((value || []).join(joiner));
  }, [joiner, value]);

  function commit() {
    focused.current = false;
    const items = draft.split(separator).map((item) => item.trim()).filter(Boolean);
    onCommit(items);
    setDraft(items.join(joiner));
  }

  const Tag = multiline ? "textarea" : "input";
  return <Tag
    {...props}
    value={draft}
    onFocus={() => { focused.current = true; }}
    onChange={(event) => setDraft(event.target.value)}
    onBlur={commit}
  />;
}
