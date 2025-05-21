import { getServerSession } from "next-auth"
import { authOptions } from "@/pages/api/auth/[...nextauth]"
import { prisma } from "@/lib/prisma"
import { GetServerSidePropsContext } from "next"
import { useState } from "react"
import { useRouter } from "next/router"

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
    const session = await getServerSession(ctx.req, ctx.res, authOptions)
    const id = Number(ctx.params?.id)

    if (!session?.user?.email) {
        return { redirect: { destination: "/", permanent: false } }
    }

    const site = await prisma.site.findUnique({
        where: { id },
        include: { owner: true }, // ← ŠEIT IR IEVIETS LABOJUMS
    })

    if (!site || site.owner?.email !== session.user.email) {
        return { notFound: true }
    }

    return { props: { site } }
}

export default function EditSitePage({ site }: {
    site: {
        id: number
        url: string
    }
}) {
    const [url, setUrl] = useState(site.url)
    const [error, setError] = useState("")
    const router = useRouter()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        const res = await fetch(`/api/sites/${site.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url }),
        })

        if (res.ok) {
            router.push("/sites")
        } else {
            const data = await res.json()
            setError(data.message || "Error updating site.")
        }
    }

    return (
        <div className="max-w-xl mx-auto p-8">
            <h1 className="text-2xl font-bold mb-4">Edit Site</h1>
            <form onSubmit={handleSubmit} className="space-y-4">
                <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="w-full border p-2 rounded"
                    required
                />
                <button
                    className="bg-blue-600 text-white px-4 py-2 rounded"
                    type="submit"
                >
                    Save Changes
                </button>
                {error && <p className="text-red-600">{error}</p>}
            </form>
        </div>
    )
}
