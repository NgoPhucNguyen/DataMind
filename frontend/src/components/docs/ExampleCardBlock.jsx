import React from "react";
import { TypeBadge } from "../Profiler/Badges";
import { CheckCircle2, AlertCircle } from "lucide-react";

export default function ExampleCardBlock({ data }) {
  if (!data) return null;

  // Single card format: { title, type, values, explanation }
  if (!data.pair && data.match) {
    const { values, expect, note } = data.match;
    return (
      <div className="my-4 p-4 rounded-xl border border-border bg-white shadow-xs max-w-full overflow-hidden">
        <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-border/60">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="text-xs font-semibold text-ink">Ví dụ điển hình</span>
          </div>
          <TypeBadge type={expect} />
        </div>
        <div className="flex flex-wrap gap-1.5 my-2.5">
          {values?.map((v, i) => (
            <span
              key={i}
              className="px-2 py-0.5 rounded text-xs font-mono bg-sage/60 text-ink border border-border/80 max-w-full break-all"
            >
              {v}
            </span>
          ))}
        </div>
        {note && <p className="text-xs text-muted mt-2 leading-relaxed break-words">{note}</p>}
      </div>
    );
  }

  // Pair comparison format: { pair: true, match: {...}, near: {...} }
  if (data.pair && data.match && data.near) {
    return (
      <div className="my-4 grid grid-cols-1 md:grid-cols-2 gap-3 max-w-full">
        {/* Match Card */}
        <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/30 flex flex-col justify-between max-w-full overflow-hidden">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-emerald-100">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="text-xs font-semibold text-emerald-900">Khớp chuẩn</span>
              </div>
              <TypeBadge type={data.match.expect} />
            </div>
            <div className="flex flex-wrap gap-1.5 my-2">
              {data.match.values?.map((v, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 rounded text-xs font-mono bg-white text-ink border border-emerald-200 shadow-2xs max-w-full break-all"
                >
                  {v}
                </span>
              ))}
            </div>
          </div>
          <p className="text-xs text-emerald-800/80 mt-2 leading-relaxed break-words">
            {data.match.note}
          </p>
        </div>

        {/* Near Miss Card */}
        <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/30 flex flex-col justify-between max-w-full overflow-hidden">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-amber-100">
              <div className="flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="text-xs font-semibold text-amber-900">Suýt khớp</span>
              </div>
              <TypeBadge type={data.near.expect} />
            </div>
            <div className="flex flex-wrap gap-1.5 my-2">
              {data.near.values?.map((v, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 rounded text-xs font-mono bg-white text-ink border border-amber-200 shadow-2xs max-w-full break-all"
                >
                  {v}
                </span>
              ))}
            </div>
          </div>
          <p className="text-xs text-amber-800/80 mt-2 leading-relaxed break-words">
            {data.near.note}
          </p>
        </div>
      </div>
    );
  }

  return null;
}
