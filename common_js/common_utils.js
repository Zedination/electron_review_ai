const removeVietnameseTones = (str) => {
    return str
        .normalize('NFD') // Chuyển đổi thành dạng tổ hợp ký tự
        .replace(/[\u0300-\u036f]/g, '') // Loại bỏ dấu
        .replace(/đ/g, 'd') // Chuyển đ thành d
        .replace(/Đ/g, 'D'); // Chuyển Đ thành D
};

async function fetchTemplate(fileName, variables) {
    try {
        const response = await fetch(`template/${fileName}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        let text = await response.text();
        // Thay thế các biến trong file bằng giá trị thực tế
        text = text.replace(/\$\{(\w+)\}/g, (_, variable) => {
            return variables[variable] || `\${${variable}}`; // Nếu không tìm thấy biến, giữ nguyên cú pháp
        });
        return text
    } catch (error) {
        console.error('Error reading file:', error);
    }
}