import { AttachmentItem, type AttachmentItemData } from "./AttachmentItem";

interface Props {
  attachments: AttachmentItemData[];
  onDelete?: (a: AttachmentItemData) => void;
  deletingId?: string | null;
  emptyLabel?: string;
}

export function AttachmentList({
  attachments,
  onDelete,
  deletingId,
  emptyLabel,
}: Props) {
  if (attachments.length === 0) {
    if (!emptyLabel) return null;
    return (
      <p className="text-xs text-muted-foreground">{emptyLabel}</p>
    );
  }
  return (
    <div className="space-y-2">
      {attachments.map((a) => (
        <AttachmentItem
          key={a.id}
          attachment={a}
          onDelete={onDelete}
          deleting={deletingId === a.id}
        />
      ))}
    </div>
  );
}
