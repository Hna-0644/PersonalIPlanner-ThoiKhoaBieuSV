import http from 'k6/http';
import { check, sleep } from 'k6';

// Cấu hình giả lập tải
export let options = {
    stages: [
        { duration: '30s', target: 50 },  // Tăng dần lên 50 user ảo trong 30 giây
        { duration: '1m', target: 500 },  // Đẩy vọt lên 500 user ảo (Spike/Burst traffic lúc đăng ký môn)
        { duration: '30s', target: 0 },   // Giảm dần về 0
    ],
};

export default function () {
    // Thay ID 1 bằng ID của một user test trong database của bạn
    let url = 'http://localhost:5000/api/timetable/1'; 
    
    // Giả lập header chứa JWT token
    let params = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer MOCK_JWT_TOKEN_HERE',
        },
    };

    let res = http.get(url, params);

    // Kiểm tra API có trả về status 200 và phản hồi dưới 200ms không
    check(res, {
        'status is 200': (r) => r.status === 200,
        'transaction time < 200ms': (r) => r.timings.duration < 200,
    });

    sleep(1); // Giả lập thời gian user đọc trang web trước khi thao tác tiếp
}