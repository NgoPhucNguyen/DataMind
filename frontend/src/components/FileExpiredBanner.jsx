import React, { useRef, useState } from "react";
import { AlertTriangle, UploadCloud, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { profileFile } from "../services/profilerService";
import { useToast } from "../contexts/ToastContext";
import { useFileSession } from "../contexts/FileSessionContext";

/**
 * FileExpiredBanner:
 * Calm amber banner shown when the file bytes expired in Redis (> 5h).
 * Allows the user to re-upload the exact same file without losing overrides, descriptions or AI quota.
 */
export default function FileExpiredBanner({ fileName, fileHash, onReuploaded }) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { updateFileSession } = useFileSession();
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleSelectFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const res = await profileFile(file, false);
      const data = res.data;
      if (data.file_hash !== fileHash) {
        showToast(
          t("profiler.file_mismatch_warning", "Đây là file khác với file ban đầu. Vui lòng tải lại đúng file cũ để giữ lại phân tích."),
          "warning"
        );
      }
      updateFileSession({
        fileHash: data.file_hash,
        fileName: data.filename,
        profileData: data,
        fileExpiresAt: data.file_expires_at,
        uploadedAt: Date.now(),
      });
      showToast(t("profiler.toast_reuploaded", "Đã nạp lại file thành công! Bạn có thể tiếp tục."), "success");
      if (onReuploaded) onReuploaded(data);
    } catch (err) {
      showToast(err.response?.data?.detail || "Lỗi tải lại file", "error");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const displayName = fileName || "Dữ liệu của bạn";

  return (
    <div className="mb-4 p-3.5 bg-amber-50/90 border border-amber-200/80 rounded-xl text-ink text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs animate-fade-in-up">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleSelectFile}
        accept=".csv, .xlsx, .xls"
        className="hidden"
      />
      <div className="flex items-center gap-2.5 min-w-0">
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
        <span className="text-amber-900 leading-relaxed text-[12.5px]">
          {t("profiler.expired_banner_text", { name: displayName })}
        </span>
      </div>
      <button
        type="button"
        disabled={uploading}
        onClick={() => fileInputRef.current?.click()}
        className="shrink-0 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-amber-900 font-medium hover:bg-amber-100/60 focus:outline-none transition-colors shadow-2xs disabled:opacity-50"
      >
        {uploading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-700" />
        ) : (
          <UploadCloud className="w-3.5 h-3.5 text-amber-700" />
        )}
        <span>{t("profiler.expired_banner_reupload", "Tải lại file này")}</span>
      </button>
    </div>
  );
}

