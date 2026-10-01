import {
  ScatterChart, Scatter, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer
} from "recharts";
import { X, AlertTriangle, Check } from "lucide-react";
import { CARD, TEXT, BTN, BADGE } from "../../constants/ui";

const AnchorScatterPanel = ({ colA, colB, rValue, scatterData, loading, error, onClear, isSelected, onToggle }) => {
  const rBadgeClass = rValue > 0
    ? `${BADGE.success}`
    : `${BADGE.error}`;

  return (
    <div className={`${CARD} mt-6 relative block w-full min-h-[420px] sm:!p-8`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className={`${TEXT.sectionTitle} mb-0`}>
            Khám phá: {colA} × {colB}
          </h2>
          <span className={rBadgeClass}>
            r = {typeof rValue === "number" ? rValue.toFixed(4) : rValue}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onToggle}
            className={`w-6 h-6 rounded flex items-center justify-center border-[2.5px] transition-colors shrink-0 ${isSelected ? "bg-[#121A14] border-[#121A14] text-white" : "border-[#87938B] text-transparent hover:border-[#121A14]"}`}
            title="Thêm biểu đồ vào báo cáo"
          >
            <Check className="w-4 h-4" strokeWidth={3} />
          </button>
          <button
            onClick={onClear}
            className={`${BTN.secondary} flex items-center gap-1.5`}
            title="Bỏ chọn cặp cột"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
            Bỏ chọn
          </button>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-10 h-10 rounded-full border-4 border-[#1B4324] border-t-transparent animate-spin mb-4"></div>
          <p className={`${TEXT.secondary}`}>Đang tải dữ liệu phân tán...</p>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <AlertTriangle className="w-8 h-8 text-[#9F2F2D] mb-3" strokeWidth={1.5} />
          <p className={`${TEXT.body} mb-1 font-medium`}>{error}</p>
          <p className={`${TEXT.caption} mt-1`}>
            Vui lòng tải lại file hoặc thử lại sau.
          </p>
        </div>
      )}

      {/* Scatter chart */}
      {!loading && !error && scatterData && (
        <div className="w-full block">
          <div className="h-[480px] lg:h-[60vh] lg:max-h-[600px] w-full block">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 30, bottom: 40, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EAEAEA" />
                <XAxis
                  dataKey="x"
                  type="number"
                  name={colA}
                  stroke="#626C65"
                  fontSize={10}
                  label={{ value: colA, position: "insideBottomRight", offset: -5, fill: "#626C65", fontSize: 11 }}
                />
                <YAxis
                  dataKey="y"
                  type="number"
                  name={colB}
                  stroke="#626C65"
                  fontSize={10}
                  label={{ value: colB, position: "insideTopLeft", offset: -5, fill: "#626C65", fontSize: 11, angle: -90 }}
                />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3", stroke: "#626C65" }}
                  contentStyle={{
                    backgroundColor: "#ffffff",
                    border: "1px solid #EAEAEA",
                    borderRadius: 8,
                    color: "#121A14",
                    fontSize: 12,
                  }}
                  wrapperStyle={{ zIndex: 1000 }}
                  formatter={(value, name) => [
                    typeof value === "number" ? value.toFixed(2) : value,
                    name === "x" ? colA : colB
                  ]}
                />
                <Scatter
                  data={scatterData.points}
                  fill="#1B4324"
                  fillOpacity={0.6}
                  r={3}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>

          {/* Downsample indicator */}
          {scatterData.count < scatterData.total && (
            <p className="text-xs text-[#626C65] mt-3 text-center">
              Hiển thị {scatterData.count} / {scatterData.total} điểm dữ liệu (lấy mẫu ngẫu nhiên)
            </p>
          )}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && scatterData && scatterData.points.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className={`${TEXT.secondary}`}>
            Không có dữ liệu hợp lệ cho cặp cột này (toàn bộ giá trị bị thiếu).
          </p>
        </div>
      )}
    </div>
  );
};

export default AnchorScatterPanel;
