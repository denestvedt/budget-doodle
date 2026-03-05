import Papa from 'papaparse'
import crypto from 'crypto'

export type Institution = 'wells_fargo' | 'chase' | 'betterment' | 'unknown'

export interface ParsedTransaction {
  date: string
  description: string
  full_description: string | null
  amount: number
  balance?: number
  dedupHash: string
}

export interface ParseResult {
  institution: Institution
  transactions: ParsedTransaction[]
  detectedBalance?: number
  errors: string[]
}

function hashTransaction(date: string, amount: number, description: string): string {
  const str = `${date}|${amount}|${description.toLowerCase().trim()}`
  return crypto.createHash('md5').update(str).digest('hex')
}

function detectInstitution(headers: string[]): Institution {
  const h = headers.map((s) => s.toLowerCase().trim())
  const joined = h.join(',')

  // Wells Fargo: "Date","Amount","*","*","Description"
  if (h.includes('date') && h.includes('amount') && h.length <= 6 && !h.includes('transaction date')) {
    return 'wells_fargo'
  }

  // Chase: "Transaction Date","Post Date","Description","Category","Type","Amount","Memo"
  if (h.includes('transaction date') || joined.includes('post date')) {
    return 'chase'
  }

  // Betterment: typically has "Date","Activity","Amount","Shares","Price","Description"
  if (joined.includes('activity') || joined.includes('shares') || joined.includes('net amount')) {
    return 'betterment'
  }

  return 'unknown'
}

function parseWellsFargo(rows: string[][]): ParsedTransaction[] {
  // WF format: Date, Amount, *, *, Description (no header row, or 5 columns)
  const transactions: ParsedTransaction[] = []

  for (const row of rows) {
    if (row.length < 5) continue

    const dateStr = row[0]?.trim()
    const amountStr = row[1]?.trim().replace(/,/g, '')
    const description = row[4]?.trim()

    if (!dateStr || !amountStr || !description) continue

    // Parse date MM/DD/YYYY
    const dateParts = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
    if (!dateParts) continue

    const date = `${dateParts[3]}-${dateParts[1].padStart(2, '0')}-${dateParts[2].padStart(2, '0')}`
    const amount = parseFloat(amountStr)
    if (isNaN(amount)) continue

    transactions.push({
      date,
      description,
      full_description: description,
      amount,
      dedupHash: hashTransaction(date, amount, description),
    })
  }

  return transactions
}

function parseChase(rows: string[][], headers: string[]): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = []
  const h = headers.map((s) => s.toLowerCase().trim())

  const dateIdx = h.indexOf('transaction date')
  const descIdx = h.indexOf('description')
  const amountIdx = h.indexOf('amount')
  const memoIdx = h.indexOf('memo')

  if (dateIdx === -1 || descIdx === -1 || amountIdx === -1) return transactions

  for (const row of rows) {
    if (row.length < 3) continue

    const dateStr = row[dateIdx]?.trim()
    const description = row[descIdx]?.trim()
    const amountStr = row[amountIdx]?.trim().replace(/,/g, '')
    const memo = memoIdx !== -1 ? row[memoIdx]?.trim() : null

    if (!dateStr || !description || !amountStr) continue

    // Parse date MM/DD/YYYY
    const dateParts = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
    if (!dateParts) continue

    const date = `${dateParts[3]}-${dateParts[1].padStart(2, '0')}-${dateParts[2].padStart(2, '0')}`
    const amount = parseFloat(amountStr)
    if (isNaN(amount)) continue

    transactions.push({
      date,
      description,
      full_description: memo || description,
      amount,
      dedupHash: hashTransaction(date, amount, description),
    })
  }

  return transactions
}

function parseBetterment(rows: string[][], headers: string[]): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = []
  const h = headers.map((s) => s.toLowerCase().trim())

  const dateIdx = h.indexOf('date')
  const descIdx = h.findIndex((s) => s.includes('description') || s.includes('activity'))
  const amountIdx = h.findIndex((s) => s.includes('amount') || s.includes('net amount'))

  if (dateIdx === -1 || amountIdx === -1) return transactions

  for (const row of rows) {
    if (row.length < 2) continue

    const dateStr = row[dateIdx]?.trim()
    const description = descIdx !== -1 ? row[descIdx]?.trim() : 'Betterment Activity'
    const amountStr = row[amountIdx]?.trim().replace(/,/g, '').replace(/\$/g, '')

    if (!dateStr || !amountStr) continue

    // Parse date - could be MM/DD/YYYY or YYYY-MM-DD
    let date = ''
    const isoMatch = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/)
    const usMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)

    if (isoMatch) {
      date = dateStr.substring(0, 10)
    } else if (usMatch) {
      date = `${usMatch[3]}-${usMatch[1].padStart(2, '0')}-${usMatch[2].padStart(2, '0')}`
    } else {
      continue
    }

    const amount = parseFloat(amountStr)
    if (isNaN(amount)) continue

    transactions.push({
      date,
      description: description || 'Betterment',
      full_description: description,
      amount,
      dedupHash: hashTransaction(date, amount, description || 'betterment'),
    })
  }

  return transactions
}

function parseGeneric(rows: string[][], headers: string[]): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = []
  const h = headers.map((s) => s.toLowerCase().trim())

  const dateIdx = h.findIndex((s) => s.includes('date'))
  const descIdx = h.findIndex((s) => s.includes('desc') || s.includes('name') || s.includes('payee'))
  const amountIdx = h.findIndex((s) => s.includes('amount'))

  if (dateIdx === -1 || amountIdx === -1) return transactions

  for (const row of rows) {
    const dateStr = row[dateIdx]?.trim()
    const description = descIdx !== -1 ? row[descIdx]?.trim() : 'Transaction'
    const amountStr = row[amountIdx]?.trim().replace(/,/g, '').replace(/\$/g, '')

    if (!dateStr || !amountStr) continue

    let date = ''
    const isoMatch = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/)
    const usMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)

    if (isoMatch) {
      date = dateStr.substring(0, 10)
    } else if (usMatch) {
      date = `${usMatch[3]}-${usMatch[1].padStart(2, '0')}-${usMatch[2].padStart(2, '0')}`
    } else {
      continue
    }

    const amount = parseFloat(amountStr)
    if (isNaN(amount)) continue

    transactions.push({
      date,
      description: description || 'Transaction',
      full_description: description,
      amount,
      dedupHash: hashTransaction(date, amount, description || 'transaction'),
    })
  }

  return transactions
}

export function parseCSV(csvText: string): ParseResult {
  const errors: string[] = []

  const result = Papa.parse<string[]>(csvText, {
    skipEmptyLines: true,
    header: false,
  })

  if (result.errors.length > 0) {
    errors.push(...result.errors.map((e) => e.message))
  }

  const allRows = result.data as string[][]
  if (allRows.length === 0) {
    return { institution: 'unknown', transactions: [], errors: ['Empty file'] }
  }

  // Detect if first row is headers
  const firstRow = allRows[0]
  const hasHeaders = firstRow.some((cell) =>
    /^(date|amount|description|transaction|post|memo|activity)/i.test(cell.trim())
  )

  let institution: Institution
  let transactions: ParsedTransaction[]

  if (hasHeaders) {
    const headers = firstRow
    const dataRows = allRows.slice(1)
    institution = detectInstitution(headers)

    switch (institution) {
      case 'chase':
        transactions = parseChase(dataRows, headers)
        break
      case 'betterment':
        transactions = parseBetterment(dataRows, headers)
        break
      default:
        transactions = parseGeneric(dataRows, headers)
    }
  } else {
    // Wells Fargo has no header row
    institution = 'wells_fargo'
    transactions = parseWellsFargo(allRows)
  }

  return { institution, transactions, errors }
}
