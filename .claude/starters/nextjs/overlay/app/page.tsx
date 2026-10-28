import GreetingForm from '@/app/ui/greeting-form'

export default function Page() {
  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">__PROJECT_NAME__</h1>
      <GreetingForm />
    </main>
  )
}
