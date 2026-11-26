import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import {
  createSessionCookie,
  getAdminAuthInstance,
  setCustomClaims,
} from "@/lib/api/auth";

export async function POST(request: NextRequest) {
  try {
    const { idToken, role } = await request.json();
    if (!idToken)
      return NextResponse.json(
        { error: "ID token requerido" },
        { status: 400 },
      );

    const sessionCookie = await createSessionCookie(idToken);
    const adminAuth = getAdminAuthInstance();
    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid;

    // Default role is estudiante, organizador requires approval
    const customClaims = {
      rol: role === "organizador" ? "organizador" : "estudiante",
      organizadorAprobado: role === "organizador" ? false : undefined,
    };
    await setCustomClaims(uid, customClaims);

    const cookieStore = await cookies();
    cookieStore.set("__session", sessionCookie, {
      maxAge: 60 * 60 * 24 * 5,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    return NextResponse.json({ success: true, role: customClaims.rol });
  } catch (err) {
    console.error("Auth callback error:", err);
    return NextResponse.json(
      { error: "Error en autenticación" },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete("__session");
  return NextResponse.json({ success: true });
}
