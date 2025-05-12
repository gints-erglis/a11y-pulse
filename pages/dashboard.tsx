import { useSession } from "next-auth/react";
import { useState } from "react";

export default function Dashboard() {
  const { data: session } = useSession();
  const [url, setUrl] = useState("");

  const addUrl = async () => {
    const res = await fetch("/api/urls", {
      method: "POST",
      body: JSON.stringify({ url }),
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json();
    console.log(data);
  };

  return (
    <div className="p-6">
      <h1 className="text-xl">Welcome, {session?.user?.name}</h1>
      <input type="text" value={url} onChange={e => setUrl(e.target.value)} className="border p-2" />
      <button onClick={addUrl} className="bg-blue-500 text-white px-4 py-2 ml-2">Testēt</button>
    </div>
  );
}
