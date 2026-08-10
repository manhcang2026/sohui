export function isFourDigitPin(value: string) {
  return /^\d{4}$/.test(value)
}

export function authPasswordFromPin(pin: string) {
  if (!isFourDigitPin(pin)) {
    throw new Error("PIN phải gồm đúng 4 chữ số.")
  }
  return `SOHUI-${pin}`
}

export function normalizeVietnamPhone(input: string) {
  const raw = String(input ?? "").trim().replace(/[^\d+]/g, "")
  if (!raw) throw new Error("Số điện thoại là bắt buộc.")

  if (raw.startsWith("+84")) {
    const rest = raw.slice(3).replace(/\D/g, "")
    if (rest.length < 9 || rest.length > 10) {
      throw new Error("Số điện thoại Việt Nam không hợp lệ.")
    }
    return `+84${rest}`
  }

  const digits = raw.replace(/\D/g, "")
  if (digits.startsWith("84")) {
    const rest = digits.slice(2)
    if (rest.length < 9 || rest.length > 10) {
      throw new Error("Số điện thoại Việt Nam không hợp lệ.")
    }
    return `+84${rest}`
  }

  if (digits.startsWith("0")) {
    const rest = digits.slice(1)
    if (rest.length < 9 || rest.length > 10) {
      throw new Error("Số điện thoại Việt Nam không hợp lệ.")
    }
    return `+84${rest}`
  }

  if (digits.length >= 9 && digits.length <= 10) {
    return `+84${digits}`
  }

  throw new Error("Số điện thoại Việt Nam không hợp lệ.")
}

export function displayVietnamPhone(input: string | null | undefined) {
  const phone = String(input ?? "")
  if (phone.startsWith("+84")) return `0${phone.slice(3)}`
  return phone
}
