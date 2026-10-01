import { useState } from "react";
import { ZoomIn, ZoomOut } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell
} from "recharts";

export const DistributionChart = ({ data = [], color = "#1B4324" }) => {
  const chartData = data.map(d => ({
    name: `${d.bin_start.toFixed(1)} - ${d.bin_end.toFixed(1)}`,
    count: d.count
  }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#EAEAEA" vertical={false} />
        <XAxis dataKey="name" stroke="#626C65" fontSize={10} tickFormatter={(val) => val.split(" - ")[0]} />
        <YAxis stroke="#626C65" fontSize={10} />
        <Tooltip cursor={{ fill: "rgba(0,0,0,0.02)" }} contentStyle={{ backgroundColor: "#ffffff", border: "1px solid #EAEAEA", borderRadius: 8, color: "#121A14" }} wrapperStyle={{ zIndex: 1000 }} />
        <Bar dataKey="count" fill={color} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
};

export const CategoricalChart = ({ data = [], color = "#1B4324" }) => {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#EAEAEA" horizontal={false} />
        <XAxis type="number" stroke="#626C65" fontSize={10} />
        <YAxis 
          dataKey="value" 
          type="category" 
          width={100} 
          stroke="#626C65" 
          fontSize={10} 
          tickFormatter={(val) => typeof val === 'string' && val.length > 15 ? val.substring(0, 15) + '...' : val} 
        />
        <Tooltip cursor={{ fill: "rgba(0,0,0,0.02)" }} contentStyle={{ backgroundColor: "#ffffff", border: "1px solid #EAEAEA", borderRadius: 8, color: "#121A14" }} wrapperStyle={{ zIndex: 1000 }} />
        <Bar dataKey="count" fill={color} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
};

export const TrendChart = ({ data = [], color = "#1B4324" }) => {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#EAEAEA" vertical={false} />
        <XAxis dataKey="period" stroke="#626C65" fontSize={10} />
        <YAxis stroke="#626C65" fontSize={10} />
        <Tooltip contentStyle={{ backgroundColor: "#ffffff", border: "1px solid #EAEAEA", borderRadius: 8, color: "#121A14" }} wrapperStyle={{ zIndex: 1000 }} />
        <Line type="monotone" dataKey="count" stroke={color} strokeWidth={2} dot={{ r: 3, fill: color }} />
      </LineChart>
    </ResponsiveContainer>
  );
};

export const CorrelationHeatmap = ({ matrix, topCorr, onCellClick, anchorPair }) => {
  const [zoom, setZoom] = useState(1);

  if (!matrix || Object.keys(matrix).length === 0) return <p className="text-muted text-sm">Không đủ cột số để tính tương quan.</p>;

  const cols = Object.keys(matrix);

  const getColor = (val) => {
    if (val === 1) return "bg-sage text-forest font-semibold border border-forest/10";
    if (val > 0.5) return "bg-[#EAF2EB] text-[#1B4324] font-medium border border-[#c8e0cb]/50";
    if (val > 0) return "bg-[#EAF2EB]/40 text-[#1B4324]/80";
    if (val < -0.5) return "bg-[#FDEBEC] text-[#9F2F2D] font-medium border border-[#f5c6cb]/50";
    if (val < 0) return "bg-[#FDEBEC]/40 text-[#9F2F2D]/80";
    return "bg-[#F9F9F8] text-muted";
  };

  const isAnchored = (row, col) => {
    if (!anchorPair) return false;
    return (anchorPair.colA === row && anchorPair.colB === col) ||
           (anchorPair.colA === col && anchorPair.colB === row);
  };

  const isDiagonal = (row, col) => row === col;

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex justify-end gap-2 mb-2 shrink-0">
        <button onClick={() => setZoom(z => Math.max(0.4, z - 0.2))} className="p-1.5 border border-[#EAEAEA] bg-white text-[#626C65] hover:bg-[#EAF2EB] hover:text-[#1B4324] rounded-md transition-colors" title="Thu nhỏ">
          <ZoomOut size={16} strokeWidth={1.5} />
        </button>
        <span className="text-xs font-mono flex items-center justify-center w-12 text-[#626C65]">{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom(z => Math.min(2, z + 0.2))} className="p-1.5 border border-[#EAEAEA] bg-white text-[#626C65] hover:bg-[#EAF2EB] hover:text-[#1B4324] rounded-md transition-colors" title="Phóng to">
          <ZoomIn size={16} strokeWidth={1.5} />
        </button>
      </div>
      
      <div className="overflow-auto flex-1 relative border border-[#EAEAEA] rounded-lg bg-[#F9F9F8]">
        <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top left', minWidth: 'max-content' }} className="p-2 transition-transform duration-200">
          <table className="w-full text-xs text-center border-collapse bg-white shadow-sm">
            <thead>
              <tr>
                <th className="p-2 border border-border bg-[#F9F9F8] sticky top-0 left-0 z-[60]"></th>
                {cols.map(c => {
                  const isColActive = anchorPair && (anchorPair.colA === c || anchorPair.colB === c);
                  return (
                    <th key={c} className={`p-2 border border-border text-ink truncate max-w-[100px] sticky top-0 z-[50] shadow-[0_1px_0_#EAEAEA] transition-colors ${isColActive ? "bg-[#EAF2EB] text-[#1B4324] font-bold" : "bg-[#F9F9F8]"}`} title={c}>{c}</th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {cols.map(row => (
                <tr key={row}>
                  {(() => {
                    const isRowActive = anchorPair && (anchorPair.colA === row || anchorPair.colB === row);
                    return (
                      <th className={`p-2 border border-border text-left text-ink truncate max-w-[100px] sticky left-0 z-[50] shadow-[1px_0_0_#EAEAEA] transition-colors ${isRowActive ? "bg-[#EAF2EB] text-[#1B4324] font-bold" : "bg-[#F9F9F8]"}`} title={row}>{row}</th>
                    );
                  })()}
                  {cols.map(col => {
                    const val = matrix[row][col];
                    const diagonal = isDiagonal(row, col);
                    const anchored = isAnchored(row, col);
                    const isCrosshair = anchorPair && (anchorPair.colA === row || anchorPair.colB === row || anchorPair.colA === col || anchorPair.colB === col);

                    return (
                      <td
                        key={col}
                        className={`p-2 border border-border transition-all duration-150 relative ${getColor(val)} ${
                          diagonal
                            ? "opacity-50 cursor-default"
                            : `cursor-pointer hover:ring-2 hover:ring-[#1B4324]/50 hover:z-40 ${
                                anchored 
                                  ? "outline outline-2 outline-[#1B4324] outline-offset-[-2px] z-40 font-bold shadow-lg" 
                                  : isCrosshair 
                                    ? "after:absolute after:inset-0 after:bg-[#1B4324]/5 z-10"
                                    : ""
                              }`
                        }`}
                        onClick={diagonal ? undefined : () => onCellClick?.(row, col, val)}
                        title={diagonal ? `${row} (self)` : `${row} × ${col}: ${val.toFixed(4)}`}
                      >
                        {val.toFixed(2)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {onCellClick && (
        <p className="text-xs text-[#626C65] mt-3 text-center">
          Click vào ô để khám phá chi tiết mối tương quan
        </p>
      )}

      {topCorr && topCorr.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-semibold mb-2 text-ink">Tương quan mạnh nhất:</p>
          <div className="flex flex-wrap gap-2">
            {topCorr.slice(0, 5).map((tc, idx) => (
              <span key={idx} className="text-xs px-2.5 py-1 rounded-full bg-[#F9F9F8] border border-border text-ink">
                {tc.col_a} ↔ {tc.col_b}: <span className={tc.r > 0 ? "text-forest font-semibold" : "text-[#9F2F2D] font-semibold"}>{tc.r}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export const PieChartComponent = ({ data = [], color = "#1B4324" }) => {
  const COLORS = [color, "#2C6E3B", "#4A8C57", "#73AB7D", "#A1C9A7", "#D1E6D5"];
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={80}
          paddingAngle={2}
          dataKey="count"
          nameKey="value"
        >
          {data?.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={{ backgroundColor: "#ffffff", border: "1px solid #EAEAEA", borderRadius: 8, color: "#121A14" }} />
      </PieChart>
    </ResponsiveContainer>
  );
};

export const BoxPlotChart = ({ stats, color = "#1B4324" }) => {
  if (!stats) return null;
  const data = [
    { name: "Phân bố", box: [stats.p25 || 0, stats.p75 || 0], min: stats.min, max: stats.max, median: stats.median }
  ];
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" stroke="#EAEAEA" horizontal={false} />
        <XAxis type="number" stroke="#626C65" fontSize={10} domain={[stats.min || 0, stats.max || 0]} />
        <YAxis dataKey="name" type="category" width={80} stroke="#626C65" fontSize={10} />
        <Tooltip 
          cursor={{ fill: "rgba(0,0,0,0.02)" }} 
          contentStyle={{ backgroundColor: "#ffffff", border: "1px solid #EAEAEA", borderRadius: 8, color: "#121A14" }} 
          formatter={(value, name, props) => {
            if (name === "box") return `p25: ${props.payload.box[0].toFixed(2)}, p75: ${props.payload.box[1].toFixed(2)}`;
            return value;
          }}
        />
        <Bar dataKey="box" fill={color} radius={[4, 4, 4, 4]} barSize={40} />
      </BarChart>
    </ResponsiveContainer>
  );
};
