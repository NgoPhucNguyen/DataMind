import React from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import i18n from "../i18n";

export default class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("ErrorBoundary caught an error:", error, errorInfo);
    }

    handleReload = () => {
        this.setState({ hasError: false, error: null });
        window.location.reload();
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center min-h-[400px]">
                    <div className="w-14 h-14 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
                        <AlertTriangle className="w-7 h-7" />
                    </div>
                    <h2 className="text-xl font-bold text-ink mb-2">
                        {i18n.t("errorBoundary.title", "Đã xảy ra sự cố hiển thị")}
                    </h2>
                    <p className="text-muted text-sm max-w-md mb-6">
                        {i18n.t("errorBoundary.desc", "Giao diện gặp lỗi trong quá trình hiển thị. Dữ liệu tài khoản của bạn vẫn an toàn. Vui lòng tải lại trang.")}
                    </p>
                    <button
                        onClick={this.handleReload}
                        className="px-4 py-2 bg-forest hover:bg-forest/90 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 shadow-sm"
                    >
                        <RotateCcw className="w-4 h-4" /> {i18n.t("errorBoundary.reload_btn", "Tải lại trang")}
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}
