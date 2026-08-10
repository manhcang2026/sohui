export function isFourDigitPin(value: string) {
  return /^\d{4}$/.test(value)
}

/**
 * Người dùng chỉ nhìn thấy 4 số.
 * Supabase Auth nhận một password nội bộ dài hơn để đáp ứng password auth.
 * Đây KHÔNG làm tăng entropy thực tế của PIN; PIN 4 số vẫn là PIN 4 số.
 */
export function authPasswordFromPin(pin: string) {
  if (!isFourDigitPin(pin)) {
    throw new Error("PIN phải gồm đúng 4 chữ số.")
  }

  return `SOHUI-${pin}`
}
