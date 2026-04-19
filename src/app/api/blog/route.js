import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const NOTION_TOKEN = 'ntn_Q23177572682vp4GoJ9g931XNLpbCN0rZYYayZL66mK7zX'
const DATABASE_ID = '7091161d55f54691ac981cb04eaed11b'

export async function GET() {
  try {
    const res = await fetch(`https://api.notion.com/v1/databases/${DATABASE_ID}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      cache: 'no-store',
      body: JSON.stringify({
        filter: {
          property: 'Status',
          select: { equals: 'Published' }
        },
        sorts: [
          { property: 'Date', direction: 'descending' }
        ]
      }),
      cache: 'no-store'
    })

    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json({ error: 'Notion API error', details: err }, { status: 500 })
    }

    const data = await res.json()

    const posts = data.results.map(page => {
      const props = page.properties
      const title = props.Title?.title?.[0]?.plain_text || 'Untitled'
      const subtitle = props.Subtitle?.rich_text?.[0]?.plain_text || ''
      const category = props.Category?.select?.name || ''
      const url = props['Substack URL']?.url || 'https://rahulmj.substack.com/'
      const dateRaw = props.Date?.date?.start || ''
      const date = dateRaw ? new Date(dateRaw).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''

      return { title, subtitle, category, url, date }
    })

    return NextResponse.json({ posts })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch', message: e.message }, { status: 500 })
  }
}
