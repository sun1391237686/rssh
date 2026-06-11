export type SftpNoticeKind = "queued" | "folder_empty" | null;

export function shouldClearQueuedNotice(kind: SftpNoticeKind, activeTransfers: number): boolean {
  return kind === "queued" && activeTransfers === 0;
}