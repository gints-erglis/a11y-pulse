// /pages/user.tsx
import { getServerSession } from "next-auth"
import { authOptions } from "@/pages/api/auth/[...nextauth]"

export async function getServerSideProps(context) {
  const session = await getServerSession(context.req, context.res, authOptions)
  if (!session) {
    return { redirect: { destination: "/", permanent: false } }
  }
  return { props: { session } }
}

export default function UserPage({ session }: any) {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Account Settings</h1>
      <p>Email: {session.user?.email}</p>
      <p>Name: {session.user?.name}</p>
    </div>
  )
}
