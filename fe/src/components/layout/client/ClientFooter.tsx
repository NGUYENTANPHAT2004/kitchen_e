import React from 'react';
import { Instagram, Facebook, Twitter } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface CategoryType {
  _id: string;
  name: string;
}

interface ClientFooterProps {
  categories: CategoryType[];
}

const ClientFooter: React.FC<ClientFooterProps> = ({ categories }) => {
  const navigate = useNavigate();

  return (
    <footer className="bg-[#475569] text-white pt-12 pb-6">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <h3 className="text-xl font-bold mb-4">Giữ liên lạc</h3>
            <div className="flex mb-4">
              <input
                type="email"
                placeholder="Địa chỉ Email"
                className="bg-transparent border-b border-white py-2 px-4 text-white placeholder-gray-300 flex-grow focus:outline-none"
              />
              <button className="ml-2 border border-white p-2">→</button>
            </div>
            <div className="flex space-x-4">
              <a href="#" className="border border-white rounded-full p-2"><Instagram size={16} /></a>
              <a href="#" className="border border-white rounded-full p-2"><Facebook size={16} /></a>
              <a href="#" className="border border-white rounded-full p-2"><Twitter size={16} /></a>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-bold mb-4">SẢN PHẨM</h3>
            <ul className="space-y-2">
              {categories.slice(0, 6).map(cat => (
                <li key={cat._id}>
                  <button
                    className="hover:underline"
                    onClick={() => navigate(`/shop/category/${cat._id}`)}
                  >
                    {cat.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-bold mb-4">CÔNG TY</h3>
            <ul className="space-y-2">
              <li><a href="#" className="hover:underline">Sứ Mệnh</a></li>
              <li><a href="#" className="hover:underline">Blog</a></li>
              <li><a href="#" className="hover:underline">Cơ Hội Nghề Nghiệp</a></li>
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-bold mb-4">HỖ TRỢ</h3>
            <ul className="space-y-2">
              <li><a href="#" className="hover:underline">Câu Hỏi Thường Gặp</a></li>
              <li><a href="#" className="hover:underline">Liên Hệ</a></li>
              <li><a href="#" className="hover:underline">Trả Hàng</a></li>
              <li><a href="#" className="hover:underline">Bảo Hành</a></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-700 mt-12 pt-6 text-center">
          <p>© Kitchen E 2025</p>
        </div>
      </div>
    </footer>
  );
};

export default ClientFooter;
