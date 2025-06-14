# ping-render-service

## Cấu hình

Tạo file `.env` (hoặc cấu hình biến môi trường trên Render):

```
# Danh sách URL cần ping, cách nhau bằng dấu phẩy
BACKEND_URLS=https://your-main-service.onrender.com/api/health,https://another-service.onrender.com/

# (Tuỳ chọn) Khoảng thời gian giữa các lần ping (ms)
PING_INTERVAL=60000
```

Nếu chỉ muốn ping một URL, bạn có thể dùng `BACKEND_URL` thay cho `BACKEND_URLS` để tương thích với phiên bản cũ.

## API

| Phương thức | Endpoint | Payload | Mô tả |
|-------------|----------|---------|-------|
| GET | /health | - | Kiểm tra trạng thái dịch vụ |
| GET | /links | - | Lấy danh sách link đang quản lý |
| POST | /links | `{ "url": "https://example.onrender.com" }` | Thêm link mới, mặc định bật ping |
| PATCH | /links/:id/enable | - | Bật ping cho link |
| PATCH | /links/:id/disable | - | Tắt ping cho link |
| DELETE | /links/:id | - | Xoá link |

## Chạy local

```bash
npm install
MONGO_URI=<your-mongo-uri> node index.js
```

Trên Render, khai báo các biến môi trường:

- `MONGO_URI` – Chuỗi kết nối MongoDB
- `PING_INTERVAL` – (tuỳ chọn) khoảng ping ms
- `SELF_URL` – (tuỳ chọn) URL health của chính dịch vụ (mặc định `https://<service>.onrender.com/health` hoặc localhost)

Dịch vụ sẽ tự thêm `SELF_URL` vào DB lần đầu khởi động; bạn có thể disable nếu muốn tiết kiệm tài nguyên.
