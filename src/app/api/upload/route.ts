import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { v4 as uuidv4 } from "uuid";
import { existsSync } from "fs";
import { getSession } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    
    if (!file) {
      return NextResponse.json({ error: "File tidak ditemukan" }, { status: 400 });
    }

    if (file.size > 100 * 1024 * 1024) {
      return NextResponse.json({ error: "File terlalu besar (maksimal 100MB)" }, { status: 413 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uploadDir = join(process.cwd(), "public", "uploads");
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    const uniqueFileName = `${uuidv4()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const filePath = join(uploadDir, uniqueFileName);

    await writeFile(filePath, buffer);

    return NextResponse.json({ url: `/uploads/${uniqueFileName}` });
  } catch (error: any) {
    console.error("Upload error:", error);
    // Return specific error for payload too large
    if (error.message?.includes("large") || error.code === "PAYLOAD_TOO_LARGE") {
      return NextResponse.json({ error: "File terlalu besar (maksimal 100MB)" }, { status: 413 });
    }
    return NextResponse.json({ error: "Gagal menyimpan file" }, { status: 500 });
  }
}
