import { Upload } from "lucide-react";
import { useTranslation } from "react-i18next";

export const UploadZone = ({
  isDragging,
  setIsDragging,
  loading,
  fileInputRef,
  handleDrop,
  handleInputChange
}) => {
  const { t } = useTranslation();

  return (
    <div
      id="upload-zone"
      className={`
        border-2 border-dashed rounded-lg p-6 sm:p-10 text-center cursor-pointer transition-colors
        ${isDragging
          ? "border-forest bg-sage"
          : "border-border hover:border-forest hover:bg-sage/40"
        }
        ${loading ? "pointer-events-none opacity-60" : ""}
      `}
      onClick={() => !loading && fileInputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); if (!loading) setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        className="hidden"
        onChange={handleInputChange}
        id="file-input"
      />
      <div className="text-muted text-sm">
        <Upload size={40} strokeWidth={1.5} className="mx-auto mb-3 text-forest" />
        <span className="block mb-1 text-ink font-medium">{t("profiler.upload_drag")}</span>
        {t("profiler.upload_hint")}
      </div>
    </div>
  );
};

