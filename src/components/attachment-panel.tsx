"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Paperclip, Upload, Trash2, Loader2, FileText, Download, X } from "lucide-react";

interface Attachment {
  id: number;
  file_name: string;
  file_url: string;
  file_size: number;
  created_at: string;
}

interface AttachmentPanelProps {
  salesLogId: string | number;
  canDelete?: boolean;
}

function formatBytes(bytes: number) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentPanel({ salesLogId, canDelete = false }: AttachmentPanelProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchAttachments = async () => {
    try {
      const res = await fetch(`/api/sales/${salesLogId}/attachments`);
      if (res.ok) setAttachments(await res.json());
    } catch {
      toast.error("Failed to load attachments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAttachments(); }, [salesLogId]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("File exceeds 10 MB limit");
      return;
    }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/sales/${salesLogId}/attachments`, {
        method: "POST",
        body: fd,
      });
      if (res.ok) {
        toast.success("File uploaded");
        await fetchAttachments();
      } else {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.error || "Upload failed");
      }
    } catch {
      toast.error("Upload failed — network error");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Delete this attachment? This cannot be undone.")) return;
    setDeleting(id);
    try {
      const res = await fetch(
        `/api/sales/${salesLogId}/attachments?attachment_id=${id}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        toast.success("Attachment deleted");
        setAttachments(prev => prev.filter(a => a.id !== id));
      } else {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.error || "Delete failed");
      }
    } catch {
      toast.error("Delete failed");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Paperclip className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
            Attachments {!loading && `(${attachments.length})`}
          </span>
        </div>
        <label className="cursor-pointer">
          <input
            ref={fileRef}
            type="file"
            className="sr-only"
            onChange={handleUpload}
            disabled={uploading}
            accept=".pdf,.png,.jpg,.jpeg,.xlsx,.csv,.doc,.docx"
          />
          <span className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-lg text-[11px] font-semibold border transition-all
            ${uploading
              ? "border-slate-200 text-slate-400 bg-slate-50 cursor-not-allowed"
              : "border-slate-200 text-slate-600 bg-white hover:border-blue-300 hover:text-blue-600 cursor-pointer"
            }`}>
            {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
            {uploading ? "Uploading..." : "Upload File"}
          </span>
        </label>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-3 text-slate-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span className="text-xs">Loading attachments...</span>
        </div>
      ) : attachments.length === 0 ? (
        <div className="py-6 flex flex-col items-center justify-center text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/30">
          <Paperclip className="h-6 w-6 text-slate-300 mb-2" />
          <p className="text-xs font-medium text-slate-400">No attachments yet</p>
          <p className="text-[10px] text-slate-300 mt-0.5">Upload contracts, POs, or supporting documents</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {attachments.map(att => (
            <div key={att.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-slate-100 bg-white hover:border-slate-200 transition-all group">
              <FileText className="h-4 w-4 text-slate-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-800 truncate">{att.file_name}</p>
                <p className="text-[10px] text-slate-400">
                  {formatBytes(att.file_size)} · {new Date(att.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                </p>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <a
                  href={att.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
                  title="Download"
                >
                  <Download className="h-3.5 w-3.5" />
                </a>
                {canDelete && (
                  <button
                    onClick={() => handleDelete(att.id)}
                    disabled={deleting === att.id}
                    className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all disabled:opacity-50"
                    title="Delete"
                  >
                    {deleting === att.id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
