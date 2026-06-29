import { useState } from "react";

const SECTIONS = [
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
        title: "Giá cả tính toán",
        content: [
            {
                heading: "Cơ chế Credits",
                body: "Mỗi thao tác xử lý dữ liệu (Phân tích, Làm sạch tự động, Sử dụng AI) sẽ tiêu tốn một số lượng credits nhất định trong ví của bạn. Bạn có thể mua thêm credits thông qua trang Giá cả.",
                code: false,
            },
            {
                heading: "Chi phí ước tính",
                body: `Phân tích dữ liệu: 50 - 200 credits / file (tùy dung lượng)\nPhân tích AI (Ngữ cảnh): 100 credits / lần gọi\nLàm sạch dữ liệu tự động: 150 credits / lần chạy`,
                code: true,
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
                heading: "Làm sao để tôi lấy thêm Credits?",
                body: "Bạn được cấp sẵn 100.000 credits khi tạo tài khoản. Sau khi dùng hết, bạn có thể vào mục Giá cả để mua các gói gia hạn.",
                code: false,
            },
        ],
    },
];

export default function Docs() {
    const [activeSection, setActiveSection] = useState("intro");

    const current = SECTIONS.find((s) => s.id === activeSection);

    return (
        <div className="min-h-screen bg-canvas text-ink flex">
            {/* Sidebar */}
            <aside className="w-56 flex-shrink-0 border-r border-border px-4 py-10 sticky top-16 self-start hidden md:block">
                <p className="text-xs font-semibold text-muted uppercase tracking-widest mb-4 px-2">Mục lục</p>
                <nav className="flex flex-col gap-1">
                    {SECTIONS.map((s) => (
                        <button
                            key={s.id}
                            onClick={() => setActiveSection(s.id)}
                            className={`text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                activeSection === s.id
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
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-canvas border-t border-border flex z-40">
                {SECTIONS.map((s) => (
                    <button
                        key={s.id}
                        onClick={() => setActiveSection(s.id)}
                        className={`flex-1 py-3 text-xs font-medium transition-colors ${
                            activeSection === s.id ? "text-forest font-bold" : "text-muted"
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
                        <h2 className="text-2xl font-serif font-bold text-ink mb-6 pb-2 border-b border-border">{current.title}</h2>
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
