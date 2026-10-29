import { useState } from "react";
import { useTranslation } from "react-i18next";

const STATIC_SECTIONS = [
    {
        id: "intro",
        title: "Giới thiệu đề tài",
        content: [
            {
                heading: "Về DataMind",
                body: "DataMind là một công cụ hỗ trợ phân tích và làm sạch dữ liệu tự động dành cho sinh viên Kinh tế và những người làm dữ liệu không chuyên. Dự án nhằm mục đích giảm thiểu thời gian xử lý dữ liệu thô và tự động gợi ý các biểu đồ trực quan hóa hữu ích thông qua AI.",
                code: false,
            },
            {
                heading: "Mục tiêu",
                body: "Giúp người dùng dễ dàng hiểu được bức tranh toàn cảnh của tập dữ liệu (dataset) thông qua các bảng thống kê tự động và nhận xét ngữ cảnh của AI mà không cần viết bất kỳ dòng code nào.",
                code: false,
            }
        ],
    },
    {
        id: "pricing_calc",
        title: "Gói dịch vụ",
        content: [
            {
                heading: "Gói Free — Miễn phí",
                body: "Mỗi ngày, tài khoản Free nhận được 3 lượt AI Insights. Lượt sử dụng được tự động làm mới vào 00:00 (giờ Việt Nam). Các tính năng phân tích dữ liệu, làm sạch thủ công và trực quan hóa hoạt động bình thường không giới hạn.",
                code: false,
            },
            {
                heading: "Gói Pro — 50.000đ / 30 ngày",
                body: "Nhận 20 lượt AI Insights mỗi ngày trong thời hạn 30 ngày. Lượt sử dụng reset vào 00:00 hàng ngày (giờ VN). Phù hợp cho người dùng cần phân tích chuyên sâu, làm sạch dữ liệu tự động bằng AI và xuất báo cáo chi tiết. Bạn có thể gia hạn bất kỳ lúc nào để cộng dồn thêm 30 ngày.",
                code: false,
            },
        ],
    },
    {
        id: "about",
        title: "Giới thiệu về chúng tôi",
        content: [
            {
                heading: "Đội ngũ phát triển",
                body: "Chúng tôi là nhóm sinh viên đam mê công nghệ và khoa học dữ liệu, phát triển DataMind với mong muốn biến quá trình Data Profiling và Data Cleaning trở nên cực kỳ đơn giản.",
                code: false,
            },
            {
                heading: "Tầm nhìn",
                body: "Trở thành bộ công cụ đắc lực (Swiss Army Knife) dành riêng cho các phân tích viên dữ liệu cấp độ Junior và sinh viên các khối ngành Kinh tế - Quản trị.",
                code: false,
            }
        ],
    },
    {
        id: "faq",
        title: "Câu hỏi thường gặp",
        content: [
            {
                heading: "DataMind hỗ trợ định dạng file nào?",
                body: "Hiện tại chúng tôi hỗ trợ các định dạng phổ biến như: CSV, Excel (.xlsx, .xls). Kích thước tối đa là 10MB.",
                code: false,
            },
            {
                heading: "Tính bảo mật dữ liệu ra sao?",
                body: "File của bạn KHÔNG được lưu trên trình duyệt hay ổ cứng máy chủ lâu dài. Dữ liệu được đẩy vào bộ nhớ RAM (Redis) và sẽ TỰ ĐỘNG BỐC HƠI sau 1 giờ. Đảm bảo an toàn tuyệt đối.",
                code: false,
            },
            {
                heading: "Cơ chế hạn mức AI Insights hoạt động như thế nào?",
                body: "Gói Free được cấp 3 lượt AI mỗi ngày. Gói Pro được cấp 20 lượt AI mỗi ngày trong thời hạn 30 ngày. Hệ thống tự động làm mới số lượt dùng vào 00:00 hàng ngày theo giờ Việt Nam (UTC+7). Khi gói Pro hết hạn sau 30 ngày, tài khoản sẽ tự động chuyển về gói Free (3 lượt/ngày).",
                code: false,
            },
        ],
    },
];

export default function Docs() {
    const { t } = useTranslation();
    const [activeSection, setActiveSection] = useState("intro");

    const sections = [
        ...STATIC_SECTIONS,
        {
            id: "visualize",
            title: t("visualize.help_docs_title"),
            content: [
                { heading: t("visualize.help_docs_step1_title"), body: t("visualize.help_docs_step1_text"), code: false },
                { heading: t("visualize.help_docs_step2_title"), body: t("visualize.help_docs_step2_text"), code: false },
                { heading: t("visualize.help_docs_step3_title"), body: t("visualize.help_docs_step3_text"), code: false },
                { heading: t("visualize.help_docs_step4_title"), body: t("visualize.help_docs_step4_text"), code: false },
                { heading: t("visualize.help_docs_step5_title"), body: t("visualize.help_docs_step5_text"), code: false },
                { heading: t("visualize.help_docs_step6_title"), body: t("visualize.help_docs_step6_text"), code: false },
                { heading: t("visualize.help_docs_step7_title"), body: t("visualize.help_docs_step7_text"), code: false },
            ]
        }
    ];

    const current = sections.find((s) => s.id === activeSection);

    return (
        <div className="min-h-screen bg-canvas text-ink flex">
            {/* Sidebar */}
            <aside className="w-56 flex-shrink-0 border-r border-border px-4 py-10 sticky top-16 self-start hidden md:block">
                <p className="text-xs font-semibold text-muted uppercase tracking-widest mb-4 px-2">Mục lục</p>
                <nav className="flex flex-col gap-1">
                    {sections.map((s) => (
                        <button
                            key={s.id}
                            onClick={() => setActiveSection(s.id)}
                            className={`text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeSection === s.id
                                ? "bg-sage text-forest"
                                : "text-muted hover:text-ink hover:bg-sage/40"
                                }`}
                        >
                            {s.title}
                        </button>
                    ))}
                </nav>
            </aside>

            {/* Mobile tabs */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-canvas border-t border-border flex z-40 overflow-x-auto">
                {sections.map((s) => (
                    <button
                        key={s.id}
                        onClick={() => setActiveSection(s.id)}
                        className={`flex-1 py-3 px-2 text-xs font-medium whitespace-nowrap transition-colors ${activeSection === s.id ? "text-forest font-bold" : "text-muted"
                            }`}
                    >
                        {s.title}
                    </button>
                ))}
            </div>

            {/* Content */}
            <main className="flex-1 px-6 md:px-12 py-10 max-w-3xl pb-24 md:pb-10">
                <h1 className="text-4xl md:text-5xl font-serif font-bold text-ink tracking-tight mb-2">
                    Tài <span className="text-forest">liệu</span>
                </h1>
                <p className="text-muted text-lg mb-10">Hướng dẫn sử dụng và tìm hiểu về DataMind.</p>

                {current && (
                    <div className="animate-fade-in-up">
                        <h2 className="text-2xl font-bold text-ink mb-6 pb-2 border-b border-border">{current.title}</h2>
                        <div className="space-y-8">
                            {current.content.map((item, i) => (
                                <div key={i}>
                                    <h3 className="text-lg font-semibold text-ink mb-3">{item.heading}</h3>
                                    {item.code ? (
                                        <pre className="bg-white border border-border rounded-xl p-4 text-sm text-forest overflow-x-auto whitespace-pre-wrap font-mono shadow-sm">
                                            {item.body}
                                        </pre>
                                    ) : (
                                        <p className="text-muted text-[15px] leading-relaxed">{item.body}</p>
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
