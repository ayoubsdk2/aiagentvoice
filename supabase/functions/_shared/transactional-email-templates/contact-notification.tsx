import * as React from 'npm:react@18.3.1'
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Phaos AI'

interface ContactNotificationProps {
  name?: string
  email?: string
  phone?: string
  reason?: string
  submittedAt?: string
}

const ContactNotificationEmail = ({
  name = 'Unknown',
  email = '',
  phone = '',
  reason = '',
  submittedAt = '',
}: ContactNotificationProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>New contact form submission from {name}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>New "I Want This!" Submission</Heading>
        <Text style={text}>
          A new prospect just reached out via the {SITE_NAME} site.
        </Text>

        <Section style={card}>
          <Row label="Name" value={name} />
          <Row label="Email" value={email} />
          {phone ? <Row label="Phone" value={phone} /> : null}
          {submittedAt ? <Row label="Submitted" value={submittedAt} /> : null}
        </Section>

        <Heading as="h2" style={h2}>
          Reason for contacting {SITE_NAME}
        </Heading>
        <Section style={messageBox}>
          <Text style={messageText}>{reason}</Text>
        </Section>

        <Hr style={hr} />
        <Text style={footer}>
          Reply directly to this lead at{' '}
          <a href={`mailto:${email}`} style={link}>
            {email}
          </a>
          .
        </Text>
      </Container>
    </Body>
  </Html>
)

function Row({ label, value }: { label: string; value: string }) {
  return (
    <Text style={rowText}>
      <span style={rowLabel}>{label}:</span> {value}
    </Text>
  )
}

export const template = {
  component: ContactNotificationEmail,
  subject: (data: Record<string, any>) =>
    `New lead from ${data.name || 'website'} — Phaos AI`,
  displayName: 'Contact form notification',
  previewData: {
    name: 'Jane Smith',
    email: 'jane@example.com',
    phone: '+1 (555) 555-5555',
    reason: 'Interested in scheduling a demo for our copier fleet.',
    submittedAt: 'May 25, 2026 at 10:30 PM',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px' }
const h1 = {
  fontSize: '22px',
  fontWeight: 'bold',
  color: '#0a0a0a',
  margin: '0 0 12px',
}
const h2 = {
  fontSize: '15px',
  fontWeight: 'bold',
  color: '#0a0a0a',
  margin: '24px 0 8px',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.04em',
}
const text = { fontSize: '14px', color: '#55575d', lineHeight: '1.5', margin: '0 0 20px' }
const card = {
  border: '1px solid #e5e7eb',
  borderRadius: '12px',
  padding: '16px 20px',
  backgroundColor: '#fafafa',
}
const rowText = { fontSize: '14px', color: '#0a0a0a', margin: '6px 0', lineHeight: '1.5' }
const rowLabel = { fontWeight: 'bold', color: '#6b7280', marginRight: '6px' }
const messageBox = {
  border: '1px solid #e5e7eb',
  borderLeft: '4px solid #a855f7',
  borderRadius: '8px',
  padding: '14px 18px',
  backgroundColor: '#fafafa',
}
const messageText = { fontSize: '14px', color: '#0a0a0a', lineHeight: '1.6', margin: 0, whiteSpace: 'pre-wrap' as const }
const hr = { borderColor: '#e5e7eb', margin: '24px 0' }
const footer = { fontSize: '12px', color: '#6b7280', margin: '0' }
const link = { color: '#a855f7', textDecoration: 'underline' }
