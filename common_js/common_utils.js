const removeVietnameseTones = (str) => {
    return str
        .normalize('NFD') // Chuyển đổi thành dạng tổ hợp ký tự
        .replace(/[\u0300-\u036f]/g, '') // Loại bỏ dấu
        .replace(/đ/g, 'd') // Chuyển đ thành d
        .replace(/Đ/g, 'D'); // Chuyển Đ thành D
};
