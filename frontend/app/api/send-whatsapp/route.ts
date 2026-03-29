import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { phone, message } = await req.json();

    if (!phone || !message) {
      return NextResponse.json(
        { error: "phone and message are required" },
        { status: 400 }
      );
    }

    const EVOLUTION_URL = process.env.EVOLUTION_API_URL;
    const EVOLUTION_KEY = process.env.EVOLUTION_API_KEY;
    const INSTANCE = process.env.EVOLUTION_INSTANCE_NAME;

    // Detailed diagnostics so we know exactly which variable is missing
    if (!EVOLUTION_URL || !EVOLUTION_KEY || !INSTANCE) {
      const missing = [
        !EVOLUTION_URL && "EVOLUTION_API_URL",
        !EVOLUTION_KEY && "EVOLUTION_API_KEY",
        !INSTANCE && "EVOLUTION_INSTANCE_NAME",
      ].filter(Boolean);

      console.error("Missing env vars:", missing);

      return NextResponse.json(
        {
          error: `Variables de entorno no configuradas en el servidor: ${missing.join(", ")}. Configurarlas en Easypanel → Environment.`,
        },
        { status: 500 }
      );
    }

    // Clean phone number - remove spaces, dashes, parentheses, and leading +
    const cleanPhone = phone.replace(/[\s\-\(\)\+]/g, "");

    const response = await fetch(
      `${EVOLUTION_URL}/message/sendText/${INSTANCE}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: EVOLUTION_KEY,
        },
        body: JSON.stringify({
          number: cleanPhone,
          text: message,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Evolution API error:", data);
      return NextResponse.json(
        { error: "Error de Evolution API: " + (data?.message || data?.error || "Sin detalles"), details: data },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error("send-whatsapp route error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
