import React, { useState } from "react";
import { Play, Sparkles, AlertCircle } from "lucide-react";
import { TypeBadge } from "../Profiler/Badges";
import { explainDetection } from "../../utils/explainDetection";
import api from "../../services/axiosClient";

export default function TryClassifierBlock() {
  const [inputMode, setInputMode] = useState("lines"); // 'lines' | 'comma'
  const [inputText, setInputText] = useState("100,000 VND\n250,000 VND\n1,250,000 VND\n50,000 VND");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleTest = async () => {
    setError(null);
    setResult(null);

    let values = [];
    if (inputMode === "lines") {
      values = inputText
        .split("\n")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    } else {
      values = inputText
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    }

    if (values.length === 0) {
      setError("Vui lòng nhập ít nhất 1 giá trị để thử nghiệm.");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/meta/classify", {
        values: values.slice(0, 200),
      });

      setResult(res.data);
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(typeof detail === "string" ? detail : (err.message || "Không thể phân loại dữ liệu."));
    } finally {
      setLoading(false);
    }
  };

  // explainDetection returns an array of strings: [step1, step2, ..., "→ Kết luận: ..."]
  const explanations = result?.detection_reason
    ? explainDetection(result.detection_reason, (k, o) => o?.defaultValue || "")
    : [];

  const checkSteps = explanations.filter((s) => !s.startsWith("→"));
  const conclusion = explanations.find((s) => s.startsWith("→"));

  return (
    <div className="my-6 border border-border rounded-xl bg-white shadow-xs p-4 max-w-full overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 pb-2 border-b border-border/60">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-forest shrink-0" />
          <span className="text-xs font-semibold text-ink uppercase tracking-wider">
            Thử nghiệm phân loại kiểu dữ liệu trực tiếp
          </span>
        </div>
        <div className="flex items-center gap-1 bg-sage/50 p-0.5 rounded-lg border border-border text-xs self-start">
          <button
            type="button"
            onClick={() => setInputMode("lines")}
            className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
              inputMode === "lines" ? "bg-white text-forest shadow-xs font-semibold" : "text-muted"
            }`}
          >
            Mỗi dòng 1 giá trị
          </button>
          <button
            type="button"
            onClick={() => setInputMode("comma")}
            className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
              inputMode === "comma" ? "bg-white text-forest shadow-xs font-semibold" : "text-muted"
            }`}
          >
            Phân cách dấu phẩy
          </button>
        </div>
      </div>

      <div className="mb-3">
        <textarea
          rows={3}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={
            inputMode === "lines"
              ? "Dán các giá trị, mỗi giá trị một dòng..."
              : "Nhập các giá trị phân cách bằng dấu phẩy..."
          }
          className="w-full text-xs font-mono p-2.5 rounded-lg border border-border focus:border-forest focus:outline-none bg-canvas text-ink placeholder:text-muted/60"
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={handleTest}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-forest text-white text-xs font-medium hover:bg-forest/90 disabled:opacity-50 transition-colors shadow-xs"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>{loading ? "Đang nhận diện..." : "Kiểm tra kiểu dữ liệu"}</span>
        </button>
        <span className="text-[11px] text-muted">Tối đa 200 dòng mẫu · Miễn phí</span>
      </div>

      {error && (
        <div className="mt-3 p-2.5 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div className="mt-4 pt-3 border-t border-border/80 animate-fade-in-up">
          <div className="flex flex-wrap items-center gap-2 mb-2.5">
            <span className="text-xs text-muted">Kết quả nhận diện:</span>
            <TypeBadge type={result.detected_type} />
            {result.disguised_numeric && (
              <span className="text-[11px] px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                Có thể là số (Disguised)
              </span>
            )}
            <span className="text-xs text-muted ml-auto">
              Duy nhất: <strong>{result.unique_count}</strong> · Ô trống:{" "}
              <strong>{result.null_pct}%</strong>
            </span>
          </div>

          {explanations.length > 0 && (
            <div className="p-3 bg-sage/30 rounded-lg border border-border text-xs space-y-1.5">
              <div className="font-semibold text-ink text-[11.5px]">Lý do nhận diện:</div>
              <ul className="list-disc pl-4 space-y-1 text-muted">
                {checkSteps.map((stepText, i) => (
                  <li key={i}>{stepText}</li>
                ))}
              </ul>
              {conclusion && (
                <p className="text-forest font-semibold pt-1 text-[11.5px]">
                  {conclusion}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
