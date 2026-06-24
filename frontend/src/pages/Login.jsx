import { useState } from "react";
import { login } from "../services/authService";
import { Link, useNavigate } from "react-router-dom";

export default function Login() {

    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        email: "",
        password: ""
    });

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {

            const response = await login(formData);

            localStorage.setItem(
                "token",
                response.token.access_token
            );

            alert("Đăng nhập thành công");

            navigate("/home");

        } catch (error) {

            alert(
                error.response?.data?.detail ||
                "Đăng nhập thất bại"
            );
        }
    };

    return (
        <div className="flex justify-center items-center min-h-screen">

            <form
                onSubmit={handleSubmit}
                className="w-96 p-6 border rounded"
            >

                <h1 className="text-2xl mb-4">
                    Login
                </h1>

                <input
                    type="email"
                    name="email"
                    placeholder="Email"
                    className="w-full border p-2 mb-3"
                    onChange={handleChange}
                />

                <input
                    type="password"
                    name="password"
                    placeholder="Password"
                    className="w-full border p-2 mb-3"
                    onChange={handleChange}
                />

                <button
                    className="bg-blue-500 text-white w-full p-2"
                >
                    Login
                </button>
                <p className="mt-4 text-center">
  Chưa có tài khoản?

  <Link
    to="/register"
    className="text-blue-500 ml-2"
  >
    Đăng ký
  </Link>
</p>
            </form>

        </div>
    );
}
