/**
 * Utility untuk mengirim notifikasi WhatsApp menggunakan Fonnte
 * Masukkan FONNTE_TOKEN di file .env untuk mengaktifkan
 */
export async function sendWhatsApp(to: string | null | undefined, message: string) {
  if (!to) return;
  
  const token = process.env.FONNTE_TOKEN;
  if (!token) {
    console.warn("WhatsApp Notification: FONNTE_TOKEN tidak ditemukan di .env. Pesan batal dikirim.");
    return { success: false, error: "Token missing" };
  }

  // Bersihkan nomor telepon (pastikan format internasional/angka saja)
  const cleanPhone = to.replace(/[^0-9]/g, "");
  if (!cleanPhone) return { success: false, error: "Invalid phone number" };

  try {
    const response = await fetch("https://api.fonnte.com/send", {
      method: "POST",
      headers: {
        "Authorization": token,
      },
      body: new URLSearchParams({
        target: cleanPhone,
        message: message,
      }),
    });

    const result = await response.json();
    return { success: result.status, data: result };
  } catch (error) {
    console.error("WhatsApp Send Error:", error);
    return { success: false, error };
  }
}
