/**
 * Professional field-level mask replacements for bills & documents.
 * Matches the product table: Customer A, INV-XXXXX, XXXX1234, remove QR, etc.
 */

export type MaskRender =
  | { mode: 'label'; text: string }
  | { mode: 'remove' }

/** How each category is shown after masking */
export function formatMaskReplacement(
  category: string,
  original: string,
): MaskRender {
  const raw = (original || '').trim()

  switch (category) {
    case 'customerName':
    case 'lastName':
      // Table: Customer Name → Customer A
      return { mode: 'label', text: 'Customer A' }

    case 'customerId':
      return { mode: 'label', text: prefixMask(raw, 'CUS', 4) }

    case 'invoiceId': {
      // INV-2026-000451 → INV-XXXXX ; also Bill No, etc.
      if (/^PO[\s\-_]/i.test(raw) || /\bPO[\s\-_#]/i.test(raw)) {
        return { mode: 'label', text: prefixMask(raw, 'PO', 5) }
      }
      if (/bill/i.test(raw)) return { mode: 'label', text: prefixMask(raw, 'BILL', 5) }
      if (/rcp|receipt/i.test(raw)) return { mode: 'label', text: prefixMask(raw, 'RCP', 5) }
      return { mode: 'label', text: prefixMask(raw, 'INV', 5) }
    }

    case 'poNumber':
      return { mode: 'label', text: prefixMask(raw, 'PO', 5) }

    case 'vat':
    case 'gst':
    case 'ssn':
    case 'tradeLicense':
    case 'taxId':
      // Tax Registration → XXX...XXX
      return { mode: 'label', text: 'XXX...XXX' }

    case 'bankAccount': {
      // IBAN / Account No → XXXX1234 (last 4 digits if present)
      const digits = raw.replace(/\D/g, '')
      if (digits.length >= 4) {
        return { mode: 'label', text: `XXXX${digits.slice(-4)}` }
      }
      return { mode: 'label', text: 'XXXX1234' }
    }

    case 'swift':
      return { mode: 'label', text: 'XXXXXXXX' }

    case 'companyAddress':
      return { mode: 'label', text: '[Address Hidden]' }

    case 'customerAddress':
    case 'address':
      // Prefer customer address wording for generic address on bills
      return { mode: 'label', text: '[Customer Address]' }

    case 'email':
      return { mode: 'label', text: 'user@example.com' }

    case 'phone':
      return { mode: 'label', text: maskPhone(raw) }

    case 'website':
      // optional mask — replace with generic domain
      return { mode: 'label', text: 'company.com' }

    case 'companyName':
      // Seller / letterhead company (not customer)
      return { mode: 'label', text: '[Company]' }

    case 'amount':
      return { mode: 'label', text: '***.**' }

    case 'signature':
    case 'qrCode':
    case 'barcode':
      return { mode: 'remove' }

    case 'custom':
    default: {
      // Clean uniform stars as fallback
      const n = Math.max(4, Math.min(12, raw.replace(/\s/g, '').length || 6))
      return { mode: 'label', text: '*'.repeat(n) }
    }
  }
}

/** INV-2026-000451 → INV-XXXXX ; CUS-10234 → CUS-XXXX */
function prefixMask(raw: string, fallbackPrefix: string, xCount: number): string {
  const m = raw.match(/^([A-Za-z]{1,8})[\s\-_#]*/i)
  const prefix = (m?.[1] || fallbackPrefix).toUpperCase()
  return `${prefix}-${'X'.repeat(xCount)}`
}

/** +971501234567 → +971XXXXXXXX */
function maskPhone(raw: string): string {
  const cleaned = raw.replace(/[^\d+]/g, '')
  // Keep leading + and up to 3-digit country code
  const m = cleaned.match(/^(\+\d{1,3})(\d+)$/)
  if (m) {
    const rest = m[2]
    return m[1] + 'X'.repeat(Math.max(6, rest.length))
  }
  if (/^\d{10,15}$/.test(cleaned)) {
    // Assume last 9 are local
    if (cleaned.startsWith('971') && cleaned.length >= 11) {
      return '+971' + 'X'.repeat(cleaned.length - 3)
    }
    return cleaned.slice(0, 3) + 'X'.repeat(cleaned.length - 3)
  }
  // Fallback keep + if present
  if (raw.trim().startsWith('+')) return '+XXX' + 'X'.repeat(8)
  return 'XXXXXXXXXX'
}
