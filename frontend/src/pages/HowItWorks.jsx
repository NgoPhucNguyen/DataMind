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
        <div className="min-h-screen bg-canvas text-ink font-sans">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
                <div className="text-center mb-16">
                    <h1 className="text-3xl sm:text-4xl font-serif tracking-tight mb-4 text-ink">
                        Cách <span className="text-forest italic font-semibold">hoạt động</span>
                    </h1>
                    <p className="text-muted max-w-xl mx-auto">
                        Chỉ 4 bước đơn giản để biến dữ liệu thô thành insights có giá trị.
                    </p>
                </div>

                <div className="relative">
                    {/* Vertical line */}
                    <div className="absolute left-8 top-0 bottom-0 w-px bg-border hidden md:block" />

                    <div className="flex flex-col gap-10">
                        {steps.map((step) => (
                            <div key={step.number} className="flex gap-6 items-start">
                                <div className="flex-shrink-0 w-16 h-16 rounded-2xl bg-sage/40 border border-[#c8e0cb]/50 flex items-center justify-center z-10 shadow-sm">
                                    <span className="text-forest font-bold text-sm">{step.number}</span>
                                </div>
                                <div className="pt-3">
                                    <h3 className="text-lg font-semibold text-ink mb-2">{step.title}</h3>
                                    <p className="text-muted leading-relaxed text-sm">{step.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
