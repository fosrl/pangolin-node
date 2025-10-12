import CryptoJS from "crypto-js";

export function encrypt(value: string, key: string): string {
    const ciphertext = CryptoJS.AES.encrypt(value, key).toString();
    return ciphertext;
}

export function decrypt(encryptedValue: string, key: string): string {
    const bytes = CryptoJS.AES.decrypt(encryptedValue, key);
    const originalText = bytes.toString(CryptoJS.enc.Utf8);
    return originalText;
}
