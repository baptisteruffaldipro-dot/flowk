/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Link, Preview, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Atelier Rufo'

interface PaymentLinkRequestProps {
  name?: string
  portalUrl?: string
  paymentUrl?: string
  amountTtc?: string
}

const PaymentLinkRequestEmail = ({
  name,
  portalUrl,
  paymentUrl,
  amountTtc,
}: PaymentLinkRequestProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Votre lien de paiement par carte bancaire</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Votre lien de paiement</Heading>
        <Text style={text}>{name ? `Bonjour ${name},` : 'Bonjour,'}</Text>
        <Text style={text}>
          Comme convenu, voici votre lien de paiement sécurisé par carte bancaire
          {amountTtc ? <> pour un montant de <strong>{amountTtc}</strong></> : null}.
          Le règlement ne prend que quelques instants.
        </Text>
        {paymentUrl && (
          <>
            <Button style={button} href={paymentUrl} target="_blank" rel="noopener noreferrer">
              Régler par carte bancaire
            </Button>
            <Text style={small}>
              Si le bouton ne s'affiche pas, copiez ce lien dans votre navigateur :<br />
              <Link href={paymentUrl} style={link}>{paymentUrl}</Link>
            </Text>
          </>
        )}
        {portalUrl && (
          <Text style={text}>
            Vous pouvez suivre l'avancement de votre dossier, valider vos BAT et retrouver vos
            documents dans votre espace client :<br />
            <Link href={portalUrl} style={link}>{portalUrl}</Link>
          </Text>
        )}
        <Text style={text}>
          Merci de votre confiance — et à très vite.
        </Text>
        <Text style={footer}>— {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: PaymentLinkRequestEmail,
  subject: 'Votre lien de paiement par carte bancaire',
  displayName: 'Lien de paiement CB',
  previewData: {
    name: 'Camille',
    portalUrl: 'https://example.com/p/portail/abc',
    paymentUrl: 'https://example.com/pay',
    amountTtc: '240,00 € TTC',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 600 as const, color: 'hsl(220, 13%, 13%)', margin: '0 0 20px', letterSpacing: '-0.01em' }
const text = { fontSize: '15px', color: 'hsl(220, 9%, 30%)', lineHeight: '1.6', margin: '0 0 18px' }
const button = {
  backgroundColor: '#202124',
  border: '1px solid #202124',
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
const small = { fontSize: '13px', color: 'hsl(220, 9%, 46%)', lineHeight: '1.6', margin: '0 0 18px', wordBreak: 'break-all' as const }
const link = { color: 'hsl(220, 13%, 13%)', textDecoration: 'underline' }
