import { getServerSession } from "next-auth"
import { authOptions } from "@/pages/api/auth/[...nextauth]"
import { prisma } from "@/lib/prisma"
import Link from "next/link"

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

export default function SitesPage({ sites }) {
  const handleDelete = async (id) => {
    if (confirm("Are you sure you want to delete this site?")) {
      const res = await fetch(`/api/sites/${id}`, {
        method: "DELETE",
      })
      if (res.ok) {
        window.location.reload()
      } else {
        alert("Failed to delete.")
      }
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
        <ul className="list list--sites">
          {sites.map((site) => (
            <li key={site.id} className="list--item">
              <Link href={`/sites/${site.id}`} className="text-blue-600 underline">
                {site.url}
              </Link>

              <Link href={`/sites/${site.id}/edit`} className="button button--edit">
                Edit
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}