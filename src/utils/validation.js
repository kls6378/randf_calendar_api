// ID 유효성 검사 (영문, 숫자)
exports.isValidId = (id) => /^[a-zA-Z0-9]+$/.test(id);