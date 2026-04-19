export const metadata = {
  title: 'Fund Your Goals — Goal-Based Financial Planning',
  description: 'Personalized goal-based investment plans for families. Retirement planning, mutual fund advisory, insurance analysis.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,500;0,9..144,700;0,9..144,900;1,9..144,400&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800;9..40,900&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
        <style>{`*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:#0a0a10}::-webkit-scrollbar-thumb{background:#1c1c2e;border-radius:3px}input[type="date"]::-webkit-calendar-picker-indicator{filter:invert(0.7)}`}</style>
      </head>
      <body>{children}</body>
    </html>
  )
}
