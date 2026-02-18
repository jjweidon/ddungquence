export default async function LobbyPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return (
    <main className="min-h-screen p-8">
      <h1 className="text-2xl font-bold">로비</h1>
      <p>방 코드: {code}</p>
    </main>
  );
}
