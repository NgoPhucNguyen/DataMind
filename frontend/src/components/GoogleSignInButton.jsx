import { useEffect, useRef, useId } from "react";

/**
 * Nút đăng nhập bằng Google, dùng Google Identity Services (script đã
 * được nạp trong index.html). Khi người dùng chọn tài khoản, Google trả
 * về một ID token (`credential`) — component này gọi `onCredential`
 * với token đó để cha component gửi lên backend (`/auth/google`).
 */
export default function GoogleSignInButton({ onCredential, onError, text = "continue_with" }) {
  const buttonRef = useRef(null);
  const reactId = useId();

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

    if (!clientId) {
      console.warn("VITE_GOOGLE_CLIENT_ID chưa được cấu hình — ẩn nút Đăng nhập Google.");
      return;
    }

    let cancelled = false;

    const renderButton = () => {
      if (cancelled || !window.google?.accounts?.id || !buttonRef.current) return;

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => {
          if (response?.credential) {
            onCredential?.(response.credential);
          } else {
            onError?.(new Error("Không nhận được thông tin xác thực từ Google."));
          }
        },
      });

      buttonRef.current.innerHTML = "";
      window.google.accounts.id.renderButton(buttonRef.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        shape: "rectangular",
        text,
        logo_alignment: "left",
        width: buttonRef.current.offsetWidth || 360,
      });
    };

    if (window.google?.accounts?.id) {
      renderButton();
    } else {
      // Script GIS có thể chưa load xong (async/defer) — chờ rồi thử lại.
      const interval = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(interval);
          renderButton();
        }
      }, 100);
      return () => {
        cancelled = true;
        clearInterval(interval);
      };
    }

    return () => {
      cancelled = true;
    };
  }, [onCredential, onError, text]);

  return <div id={`google-btn-${reactId}`} ref={buttonRef} className="w-full flex justify-center" />;
}