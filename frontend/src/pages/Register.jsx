import { useState } from "react";
import { register } from "../services/authService";
import { Link, useNavigate } from "react-router-dom";
export default function Register() {

    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        full_name: "",
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

        await register(formData);

        alert("Đăng ký thành công");

        navigate("/login");

    } catch (error) {

        const detail = error.response?.data?.detail;

        if (Array.isArray(detail)) {

            let message = detail[0].msg;

            message = message.replace("Value error, ", "");

            alert(message);

        } else {

            alert(detail || "Đăng ký thất bại");

        }
    }
};
    return (

        <div className="flex justify-center items-center min-h-screen">

            <form
                onSubmit={handleSubmit}
                className="w-96 p-6 border rounded"
            >

                <h1 className="text-2xl mb-4">
                    Register
                </h1>

                <input
                    type="text"
                    name="full_name"
                    placeholder="Full Name"
                    className="w-full border p-2 mb-3"
                    onChange={handleChange}
                />

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
                    className="bg-green-500 text-white w-full p-2"
                >
                    Register
                </button>
                 <p className="mt-4 text-center">
  Đã có tài khoản?

  <Link
    to="/login"
    className="text-blue-500 ml-2"
  >
    Đăng nhập
  </Link>
</p>
            </form>

        </div>
    );
}