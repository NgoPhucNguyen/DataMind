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

export const CorrelationHeatmap = ({ matrix, topCorr }) => {
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

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-center border-collapse">
          <thead>
            <tr>
              <th className="p-2 border border-border bg-[#F9F9F8]"></th>
              {cols.map(c => <th key={c} className="p-2 border border-border bg-[#F9F9F8] text-ink truncate max-w-[80px]" title={c}>{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {cols.map(row => (
              <tr key={row}>
                <th className="p-2 border border-border bg-[#F9F9F8] text-left text-ink truncate max-w-[80px]" title={row}>{row}</th>
                {cols.map(col => {
                  const val = matrix[row][col];
                  return (
                    <td key={col} className={`p-2 border border-border ${getColor(val)}`}>
                      {val.toFixed(2)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
