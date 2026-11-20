import { Paperclip } from "@phosphor-icons/react/dist/ssr";

export type FileChip = { id: string; originalName: string; sizeBytes: number };

function size(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Private attachments. Links go through the access-checked download route, never a public URL. */
export function FileList({ files, label = "Attachments" }: { files: FileChip[]; label?: string }) {
  if (!files.length) return null;
  return <ul className="file-list" aria-label={label}>{files.map((file) => <li key={file.id}><a className="file-chip" href={`/api/files/${file.id}`} target="_blank" rel="noreferrer"><Paperclip size={13} aria-hidden="true" /><span>{file.originalName}</span><small>{size(file.sizeBytes)}</small></a></li>)}</ul>;
}

export function FileInput({ name = "attachment", label = "Attach a file (optional)" }: { name?: string; label?: string }) {
  return <label>{label}<input type="file" name={name} accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.mp4,.m4v,.mov,.txt,.md,.csv,.docx,.xlsx,.pptx" /><small className="field-note">Private to authorised participants. Up to {process.env.NEXT_PUBLIC_UPLOAD_MAX_MB ?? 4} MB. PDF, images, MP4/MOV, text, CSV, or Office files.</small></label>;
}
