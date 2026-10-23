import { NextRequest, NextResponse } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendProblemReportMail } from "@/lib/email";

export async function POST(request: NextRequest) {
  const session = getSessionFromHeaders(request.headers.get("cookie"));
  if (!session?.id) {
    return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  }

  let body: { subject?: string; description?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 });
  }

  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";

  if (!subject) {
    return NextResponse.json({ error: "Konu gerekli" }, { status: 400 });
  }
  if (!description) {
    return NextResponse.json({ error: "Açıklama gerekli" }, { status: 400 });
  }

  const reporter = await prisma.user.findUnique({
    where: { id: session.id },
    select: { email: true, displayName: true },
  });
  if (!reporter?.email) {
    return NextResponse.json({ error: "Kullanıcı e-posta adresi bulunamadı" }, { status: 400 });
  }

  const adminUser = await prisma.user.findFirst({
    where: { isAdmin: true, isActive: true },
    select: { email: true },
  });
  if (!adminUser?.email) {
    return NextResponse.json({ error: "Admin kullanıcısı bulunamadı" }, { status: 500 });
  }

  const mailResult = await sendProblemReportMail({
    fromEmail: reporter.email,
    fromName: reporter.displayName || undefined,
    toEmail: adminUser.email,
    subject,
    description,
  });

  if (!mailResult.ok) {
    return NextResponse.json(
      { error: mailResult.error || "E-posta gönderilemedi" },
      { status: 500 }
    );
  }

  try {
    await prisma.problemReport.create({
      data: {
        subject: subject.slice(0, 500),
        description,
        reporterId: session.id,
      },
    });
  } catch (e) {
    console.error("ProblemReport create failed:", e);
  }

  return NextResponse.json({ success: true });
}
