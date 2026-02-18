export default async function GamePage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  return (
    <main className="min-h-screen p-8">
      <h1 className="text-2xl font-bold">게임</h1>
      <p>방 ID: {roomId}</p>
    </main>
  );
}
