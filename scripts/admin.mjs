import pg from "pg";
const command = process.argv[2];
if (
  !["set-app-password", "create-admin"].includes(command) ||
  !process.env.DATABASE_ADMIN_URL
) {
  console.error("사용법: npm run admin -- set-app-password | create-admin");
  process.exit(1);
}
const client = new pg.Client({
  connectionString: process.env.DATABASE_ADMIN_URL,
  ssl:
    process.env.DATABASE_SSL === "true"
      ? { rejectUnauthorized: true }
      : undefined,
});
try {
  await client.connect();
  if (command === "set-app-password") {
    const password = process.env.APP_DB_PASSWORD;
    if (!password || password.length < 20)
      throw new Error("APP_DB_PASSWORD는 20자 이상이어야 합니다.");
    const { rows } = await client.query(
      "SELECT format('ALTER ROLE hub_app LOGIN PASSWORD %L', $1::text) AS ddl",
      [password],
    );
    await client.query(rows[0].ddl);
    console.log("hub_app 로그인 비밀번호를 설정했습니다.");
  } else {
    const {
      ADMIN_EMAIL: email,
      ADMIN_PASSWORD: password,
      ADMIN_NAME: name,
    } = process.env;
    if (
      !email ||
      !name ||
      !password ||
      password.length < 10 ||
      Buffer.byteLength(password) > 72 ||
      !/^\S+@\S+\.\S+$/.test(email)
    )
      throw new Error(
        "ADMIN_EMAIL, ADMIN_NAME과 10자 이상·72바이트 이하 ADMIN_PASSWORD가 필요합니다.",
      );
    await client.query(
      "INSERT INTO hub.operators(email,name,password_hash,role) VALUES(lower($1),$2,extensions.crypt($3,extensions.gen_salt('bf',12)),'admin')",
      [email, name, password],
    );
    console.log("관리자 계정을 추가했습니다.");
  }
} catch (e) {
  console.error("관리 명령 실패:", e.code ?? "입력값을 확인하세요.");
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
