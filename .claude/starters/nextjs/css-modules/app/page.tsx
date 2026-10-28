import GreetingForm from '@/app/ui/greeting-form'
import styles from './page.module.css'

export default function Page() {
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>__PROJECT_NAME__</h1>
      <GreetingForm />
    </main>
  )
}
