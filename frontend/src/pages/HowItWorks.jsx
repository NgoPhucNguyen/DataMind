export default function HowItWorks() {
    const steps = [
        {
            number: "01",
            title: "Tải dữ liệu lên",
            description: "Tải lên tập dữ liệu của bạn dưới dạng CSV, Excel hoặc JSON. DataMind hỗ trợ mọi định dạng phổ biến.",
        },
        {
            number: "02",
            title: "Phân tích tự động",
            description: "Hệ thống AI của chúng tôi tự động phân tích, làm sạch và trực quan hóa dữ liệu trong vài giây.",
        },
        {
            number: "03",
            title: "Nhận insights",
            description: "Nhận báo cáo chi tiết với các xu hướng, bất thường và khuyến nghị hành động cụ thể.",
        },
        {
            number: "04",
            title: "Xuất kết quả",
            description: "Xuất báo cáo dưới dạng PDF, chia sẻ dashboard hoặc tích hợp qua API vào hệ thống của bạn.",
        },
    ];

    return (
        <div className="min-h-screen bg-[#0B0F1A] text-white">
            <div className="max-w-4xl mx-auto px-6 py-20">
                <div className="text-center mb-16">
                    <h1 className="text-4xl font-bold tracking-tight mb-4">
                        Cách <span className="text-violet-400">hoạt động</span>
                    </h1>
                    <p className="text-white/40 max-w-xl mx-auto">
                        Chỉ 4 bước đơn giản để biến dữ liệu thô thành insights có giá trị.
                    </p>
                </div>

                <div className="relative">
                    {/* Vertical line */}
                    <div className="absolute left-8 top-0 bottom-0 w-px bg-white/10 hidden md:block" />

                    <div className="flex flex-col gap-10">
                        {steps.map((step) => (
                            <div key={step.number} className="flex gap-6 items-start">
                                <div className="flex-shrink-0 w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center z-10">
                                    <span className="text-violet-400 font-bold text-sm">{step.number}</span>
                                </div>
                                <div className="pt-3">
                                    <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                                    <p className="text-white/40 leading-relaxed">{step.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="mt-20 p-8 rounded-2xl bg-white/5 border border-white/10 text-center">
                    <h2 className="text-2xl font-bold mb-3">Sẵn sàng bắt đầu?</h2>
                    <p className="text-white/40 mb-6">Dùng thử miễn phí, không cần thẻ tín dụng.</p>
                    <a href="/register">
                        <button className="bg-violet-500 hover:bg-violet-400 text-white px-8 py-3 rounded-xl font-semibold transition-all text-sm">
                            Tạo tài khoản miễn phí
                        </button>
                    </a>
                </div>
            </div>
        </div>
    );
}
