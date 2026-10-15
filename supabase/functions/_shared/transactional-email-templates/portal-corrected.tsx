/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Link, Preview, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Atelier Rufo'

interface PortalCorrectedProps {
  name?: string
  portalUrl?: string
  message?: string
  title?: string
}

const PortalCorrectedEmail = ({ name, portalUrl, message, title }: PortalCorrectedProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Votre modification a été effectuée</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>C'est corrigé !</Heading>
        <Text style={text}>{name ? `Bonjour ${name},` : 'Bonjour,'}</Text>
        <Text style={text}>
          {title
            ? `La modification demandée sur « ${title} » a été effectuée.`
            : 'La modification que vous aviez demandée a été effectuée.'}
        </Text>
        {message && <Text style={quote}>{message}</Text>}
        <Text style={text}>
          Vous pouvez consulter la version à jour et la valider depuis votre espace client.
        </Text>
        {portalUrl && (
          <>
            <Button
              style={button}
              href={portalUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Voir la correction
            </Button>
            <Text style={small}>
              Si le bouton ne s'affiche pas, copiez ce lien dans votre navigateur :<br />
              <Link href={portalUrl} style={link}>{portalUrl}</Link>
            </Text>
          </>
        )}
        <Text style={footer}>— {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: PortalCorrectedEmail,
  subject: (d: Record<string, any>) => d?.title ? `Correction effectuée sur « ${d.title} »` : `Votre correction est prête`,
  displayName: 'Correction effectuée',
  previewData: {
    name: 'Camille',
    portalUrl: 'https://example.com/portail',
    title: 'Carte de visite',
    message: 'Le tarif de l’impression a été mis à jour, merci de valider le BAT.',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 600 as const, color: 'hsl(152, 40%, 26%)', margin: '0 0 20px', letterSpacing: '-0.01em' }
const text = { fontSize: '15px', color: 'hsl(220, 9%, 30%)', lineHeight: '1.6', margin: '0 0 18px' }
const button = {
  backgroundColor: '#166534',
  border: '1px solid #166534',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: 500 as const,
  borderRadius: '8px',
  padding: '13px 22px',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  margin: '8px 0 24px',
}
const footer = { fontSize: '13px', color: 'hsl(220, 9%, 46%)', margin: '32px 0 0' }
const small = { fontSize: '13px', color: 'hsl(220, 9%, 46%)', lineHeight: '1.6', margin: '0 0 8px', wordBreak: 'break-all' as const }
const link = { color: 'hsl(220, 13%, 13%)', textDecoration: 'underline' }
const quote = { fontSize: '15px', color: 'hsl(220, 13%, 13%)', lineHeight: '1.6', margin: '0 0 20px', padding: '14px 16px', backgroundColor: '#ecfdf5', borderRadius: '8px', whiteSpace: 'pre-wrap' as const }
