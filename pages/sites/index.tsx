import { getServerSession } from "next-auth"
import { authOptions } from "@/pages/api/auth/[...nextauth]"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { useState } from "react"

export async function getServerSideProps(context) {
  const session = await getServerSession(context.req, context.res, authOptions)
  if (!session || !session.user?.email) {
    return { redirect: { destination: "/", permanent: false } }
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { sites: true },
  })

  return {
    props: {
      sites: user?.sites || [],
    },
  }
}

export default function SitesPage({ sites: initialSites }) {
  const [sites, setSites] = useState(initialSites)

  const handleDelete = async (id) => {
    const confirmed = confirm("Are you sure you want to delete this site?")
    if (!confirmed) return

    const res = await fetch(`/api/sites/${id}`, {
      method: "DELETE",
    })

    if (res.ok) {
      setSites(sites.filter((site) => site.id !== id))
    } else {
      alert("Failed to delete site.")
    }
  }

  return (
    <>
      <h1 className="text-2xl font-bold mb-4">Your Sites</h1>

      <div className="toolbar">
        <Link href="/sites/add" className="button button--primary">
          Add a new site
        </Link>
      </div>

      {sites.length === 0 ? (
        <p className="text-gray-500">You haven’t added any sites yet.</p>
      ) : (
        <ul className="site-list">
          {sites.map((site) => (
            <li key={site.id} className="site-item">
              <div className="site-entry">
                <Link href={`/sites/${site.id}`} className="site-url">
                  {site.url}
                </Link>
                <div className="site-actions">
                  <Link href={`/sites/${site.id}/edit`} className="edit-button">
                    Edit
                  </Link>
                  <button
                    onClick={() => handleDelete(site.id)}
                    className="delete-button"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
