import { useEffect, useRef, type ChangeEvent, type FormEvent, type KeyboardEvent } from "react";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  attachments: File[];
  onAttachmentsChange: (files: File[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

const MAX_HEIGHT_PX = 160;

/**
 * Shared multi-line chat input: Enter sends, Shift+Enter inserts a newline,
 * auto-grows up to MAX_HEIGHT_PX then scrolls. `e.shiftKey` is a standard
 * DOM KeyboardEvent property — identical behavior on Windows and Mac
 * browsers, no platform branching needed.
 */
export default function ChatInput({
  value,
  onChange,
  onSubmit,
  attachments,
  onAttachmentsChange,
  placeholder,
  disabled,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT_PX)}px`;
  }, [value]);

  function canSubmit() {
    return (value.trim() || attachments.length > 0) && !disabled;
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canSubmit()) onSubmit();
    }
  }

  function handleFormSubmit(e: FormEvent) {
    e.preventDefault();
    if (canSubmit()) onSubmit();
  }

  function handleChange(e: ChangeEvent<HTMLTextAreaElement>) {
    onChange(e.target.value);
  }

  function handleFilesSelected(e: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    if (picked.length > 0) onAttachmentsChange([...attachments, ...picked]);
    e.target.value = "";
  }

  function removeAttachment(index: number) {
    onAttachmentsChange(attachments.filter((_, i) => i !== index));
  }

  return (
    <form className="chat-input-form" onSubmit={handleFormSubmit}>
      {attachments.length > 0 && (
        <div className="chat-attachment-chips">
          {attachments.map((file, i) => (
            <span className="chat-attachment-chip" key={`${file.name}-${i}`}>
              📎 {file.name}
              <button type="button" onClick={() => removeAttachment(i)} aria-label={`Remove ${file.name}`}>
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="chat-input-row">
        <input ref={fileInputRef} type="file" multiple hidden onChange={handleFilesSelected} />
        <button
          type="button"
          className="chat-attach-button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          aria-label="Attach files"
          title="Attach files"
        >
          📎
        </button>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
        />
        <button type="submit" disabled={!canSubmit()} aria-label="Send message" title="Send">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 19V5M12 5l-6 6M12 5l6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </form>
  );
}
