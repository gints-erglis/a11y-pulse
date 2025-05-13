import { useEffect, useState } from "react"

export default function Home() {
  const [sites, setSites] = useState([])

  useEffect(() => {
    fetch("/api/sites")
      .then(res => res.json())
      .then(setSites)
  }, [])

  return (
    <main className="p-4">
      <h1 className="text-2xl font-bold mb-4">A11Y Pulse: Tracked Sites</h1>
      <ul className="list-disc ml-6">
        {sites.map((site: any) => (
          <li key={site.id}>{site.url} (owner: {site.owner})</li>
        ))}
      </ul>
    </main>
  )
}
