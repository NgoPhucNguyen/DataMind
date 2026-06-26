import { useState } from "react";

const SECTIONS = [
    {
        id: "quickstart",
        title: "Bắt đầu nhanh",
        content: [
            {
                heading: "Cài đặt",
                body: `Cài đặt DataMind SDK qua npm hoặc yarn:\n\nnpm install @datamind/sdk\n# hoặc\nyarn add @datamind/sdk`,
                code: true,
            },
            {
                heading: "Khởi tạo client",
                body: `import DataMind from '@datamind/sdk';\n\nconst client = new DataMind({\n  apiKey: 'YOUR_API_KEY',\n});`,
                code: true,
            },
        ],
    },
    {
        id: "api",
        title: "API Reference",
        content: [
            {
                heading: "POST /v1/analyze",
                body: "Phân tích một tập dữ liệu. Gửi file dưới dạng multipart/form-data hoặc truyền URL công khai.",
                code: false,
            },
            {
                heading: "GET /v1/reports/:id",
                body: "Lấy kết quả phân tích theo ID. Trả về JSON với insights, biểu đồ và khuyến nghị.",
                code: false,
            },
            {
                heading: "GET /v1/usage",
                body: "Kiểm tra số lượt phân tích đã dùng trong chu kỳ hiện tại và hạn mức gói hiện tại.",
                code: false,
            },
        ],
    },
    {
        id: "examples",
        title: "Ví dụ",
        content: [
            {
                heading: "Phân tích file CSV",
                body: `const result = await client.analyze({\n  file: './sales_data.csv',\n  options: { language: 'vi' },\n});\nconsole.log(result.insights);`,
                code: true,
            },
        ],
    },
    {
        id: "faq",
        title: "Câu hỏi thường gặp",
        content: [
            {
                heading: "DataMind hỗ trợ định dạng file nào?",
                body: "CSV, Excel (.xlsx, .xls), JSON, Parquet và Google Sheets (qua OAuth).",
                code: false,
            },
            {
                heading: "Dữ liệu của tôi có được lưu trữ không?",
                body: "Dữ liệu chỉ được lưu trong thời gian xử lý (tối đa 24h). Bạn có thể yêu cầu xóa ngay lập tức qua API.",
                code: false,
            },
            {
                heading: "Tôi có thể tích hợp với hệ thống hiện có không?",
                body: "Có. DataMind cung cấp REST API, SDK JavaScript/Python và webhook để tích hợp vào bất kỳ hệ thống nào.",
                code: false,
            },
        ],
    },
];

export default function Docs() {
    const [activeSection, setActiveSection] = useState("quickstart");

    const current = SECTIONS.find((s) => s.id === activeSection);

    return (
        <div className="min-h-screen bg-[#0B0F1A] text-white flex">
            {/* Sidebar */}
            <aside className="w-56 flex-shrink-0 border-r border-white/10 px-4 py-10 sticky top-16 self-start hidden md:block">
                <p className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-4 px-2">Mục lục</p>
                <nav className="flex flex-col gap-1">
                    {SECTIONS.map((s) => (
                        <button
                            key={s.id}
                            onClick={() => setActiveSection(s.id)}
                            className={`text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                activeSection === s.id
                                    ? "bg-violet-500/20 text-violet-400"
                                    : "text-white/50 hover:text-white hover:bg-white/5"
                            }`}
                        >
                            {s.title}
                        </button>
                    ))}
                </nav>
            </aside>

            {/* Mobile tabs */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-[#0B0F1A] border-t border-white/10 flex z-40">
                {SECTIONS.map((s) => (
                    <button
                        key={s.id}
                        onClick={() => setActiveSection(s.id)}
                        className={`flex-1 py-3 text-xs font-medium transition-colors ${
                            activeSection === s.id ? "text-violet-400" : "text-white/40"
                        }`}
                    >
                        {s.title}
                    </button>
                ))}
            </div>

            {/* Content */}
            <main className="flex-1 px-6 md:px-12 py-10 max-w-3xl pb-24 md:pb-10">
                <h1 className="text-3xl font-bold mb-2">
                    Tài <span className="text-violet-400">liệu</span>
                </h1>
                <p className="text-white/40 text-sm mb-10">Hướng dẫn tích hợp và sử dụng DataMind API.</p>

                {current && (
                    <div>
                        <h2 className="text-xl font-bold mb-6">{current.title}</h2>
                        <div className="space-y-8">
                            {current.content.map((item, i) => (
                                <div key={i}>
                                    <h3 className="font-semibold text-white/90 mb-3">{item.heading}</h3>
                                    {item.code ? (
                                        <pre className="bg-white/5 border border-white/10 rounded-xl p-4 text-sm text-violet-200 overflow-x-auto whitespace-pre-wrap font-mono">
                                            {item.body}
                                        </pre>
                                    ) : (
                                        <p className="text-white/50 text-sm leading-relaxed">{item.body}</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
