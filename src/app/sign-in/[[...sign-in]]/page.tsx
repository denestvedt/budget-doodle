import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center mb-8 absolute top-12 left-1/2 -translate-x-1/2">
        <div
          className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-lg mx-auto mb-3"
          style={{ backgroundColor: '#1E3A5F' }}
        >
          CFO
        </div>
        <h1
          className="text-2xl font-bold"
          style={{ fontFamily: 'Georgia, serif', color: '#1E3A5F' }}
        >
          Household CFO
        </h1>
      </div>
      <SignIn />
    </div>
  )
}
