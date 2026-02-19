import { NextResponse } from "next/server";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

export async function POST(request: Request) {
  if (!ADMIN_PASSWORD) {
    return NextResponse.json(
      { error: "관리자 비밀번호가 설정되지 않았습니다." },
      { status: 503 }
    );
  }
  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "요청 본문이 올바르지 않습니다." },
      { status: 400 }
    );
  }
  const password = body.password;
  if (typeof password !== "string") {
    return NextResponse.json(
      { error: "password를 입력해주세요." },
      { status: 400 }
    );
  }
  if (password !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: "비밀번호가 일치하지 않습니다." }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
