import type { ChangeEvent, FormEvent, KeyboardEvent } from "react";
import { useRef } from "react";
import { Box, IconButton, Paper, TextField, Chip } from "@mui/material";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import { colors } from "../theme/colors.styles.js";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  attachments: File[];
  onAttachmentsChange: (files: File[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * Shared multi-line chat input: Enter sends, Shift+Enter inserts a newline
 * (`e.shiftKey` is a standard DOM property — identical on Windows and Mac).
 * Auto-grow is MUI TextField's own multiline/maxRows behavior, not hand-rolled.
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  function canSubmit() {
    return (value.trim() || attachments.length > 0) && !disabled;
  }

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canSubmit()) onSubmit();
    }
  }

  function handleFormSubmit(e: FormEvent) {
    e.preventDefault();
    if (canSubmit()) onSubmit();
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
    <Box component="form" onSubmit={handleFormSubmit}>
      {attachments.length > 0 && (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mb: 1 }}>
          {attachments.map((file, i) => (
            <Chip
              key={`${file.name}-${i}`}
              icon={<AttachFileIcon sx={{ fontSize: 16 }} />}
              label={file.name}
              size="small"
              onDelete={() => removeAttachment(i)}
              sx={{ backgroundColor: colors.gray[100] }}
            />
          ))}
        </Box>
      )}
      <Paper
        variant="outlined"
        sx={{
          display: "flex",
          alignItems: "flex-end",
          gap: 1,
          p: 1,
          borderRadius: "1.5rem",
          borderColor: colors.gray[300],
        }}
      >
        <input ref={fileInputRef} type="file" multiple hidden onChange={handleFilesSelected} />
        <IconButton
          size="small"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          aria-label="Attach files"
          title="Attach files"
          sx={{ border: `1px solid ${colors.gray[300]}` }}
        >
          <AttachFileIcon fontSize="small" />
        </IconButton>
        <TextField
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          multiline
          minRows={1}
          maxRows={6}
          fullWidth
          variant="standard"
          InputProps={{ disableUnderline: true }}
          sx={{ px: 1 }}
        />
        <IconButton
          type="submit"
          size="small"
          disabled={!canSubmit()}
          aria-label="Send message"
          title="Send"
          sx={{
            backgroundColor: canSubmit() ? colors.primary.main : colors.gray[200],
            color: "#fff",
            "&:hover": { backgroundColor: colors.primary.dark600 },
            "&.Mui-disabled": { backgroundColor: colors.gray[200], color: colors.text.placeholder },
          }}
        >
          <ArrowUpwardIcon fontSize="small" />
        </IconButton>
      </Paper>
    </Box>
  );
}
