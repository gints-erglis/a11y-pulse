import { getServerSession } from "next-auth/next"
import { authOptions } from "./api/auth/[...nextauth]"
import { GetServerSidePropsContext } from "next"
import { Session } from "next-auth"
import { prisma } from "@/lib/prisma"
import { signOut } from "next-auth/react"

type Site = {
  id: number
  url: string
}

type Props = {
  session: Session
  sites: Site[]
}

export default function Dashboard({ session }: any) {
  console.log("RENDER", session?.user)

  return <h1>Hello {session?.user?.email}</h1>
}

export async function getServerSideProps(context: GetServerSidePropsContext) {
  const session = await getServerSession(context.req, context.res, authOptions)
  console.log("Session user:", session.user)
  if (!session || !session.user?.email) {
    return {
      redirect: { destination: "/", permanent: false },
    }
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { sites: true },
  })

  return {
    props: {
      session,
      sites: user?.sites || [],
    },
  }
}
