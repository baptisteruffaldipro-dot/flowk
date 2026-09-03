/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Link, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Atelier Rufo'

interface PaymentReminderProps {
  name?: string
  portalUrl?: string
  paymentUrl?: string
  amountTtc?: string
  transferEnabled?: boolean
  ribIban?: string
  ribBic?: string
  ribAccountHolder?: string
  ribBankName?: string
  ribTransferNote?: string
}

const PaymentReminderEmail = ({
  name,
  portalUrl,
  paymentUrl,
  amountTtc,
  transferEnabled,
  ribIban,
  ribBic,
  ribAccountHolder,
  ribBankName,
  ribTransferNote,
}: PaymentReminderProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Rappel : le règlement de votre prestation est disponible par carte ou virement</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Rappel de règlement</Heading>
        <Text style={text}>{name ? `Bonjour ${name},` : 'Bonjour,'}</Text>
        <Text style={text}>
          Petit rappel concernant votre prestation{amountTtc ? ` : le solde à régler est de ` : ' est en attente de règlement'}
          {amountTtc && <strong>{amountTtc}</strong>}
          {amountTtc ? '.' : ''}
        </Text>
        <Text style={text}>
          Pour vous faciliter la démarche, plusieurs moyens de règlement sont disponibles :
          le <strong>paiement par carte bancaire</strong> (sécurisé, quelques instants) et/ou
          le <strong>virement bancaire</strong>.
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
        {transferEnabled && ribIban && (
          <Section style={ribBox}>
            <Text style={ribTitle}>Règlement par virement</Text>
            <Text style={ribText}>
              <strong>Bénéficiaire :</strong> {ribAccountHolder || SITE_NAME}<br />
              {ribBankName && <><strong>Banque :</strong> {ribBankName}<br /></>}
              <strong>IBAN :</strong> {ribIban}<br />
              {ribBic && <><strong>BIC :</strong> {ribBic}<br /></>}
              {ribTransferNote && (
                <>
                  <strong>Libellé à indiquer :</strong> {ribTransferNote}
                </>
              )}
            </Text>
          </Section>
        )}
        <Section style={notice}>
          <Text style={noticeText}>
            <strong>Commande d'impression :</strong> nous vous rappelons que toute commande
            d'impression doit être <strong>intégralement réglée avant son lancement</strong>.
            Dès réception de votre règlement, votre commande est transmise à la production
            sans délai supplémentaire.
          </Text>
        </Section>
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
  component: PaymentReminderEmail,
  subject: 'Rappel : règlement de votre prestation',
  displayName: 'Relance paiement',
  previewData: {
    name: 'Camille',
    portalUrl: 'https://example.com/p/portail/abc',
    paymentUrl: 'https://example.com/pay',
    amountTtc: '240,00 € TTC',
    transferEnabled: true,
    ribIban: 'FR12 3456 7890 1234 5678 9012 345',
    ribBic: 'ABCDEFGH',
    ribAccountHolder: 'Atelier Rufo',
    ribBankName: 'Exemple Banque',
    ribTransferNote: 'Facture ABC - Camille',
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
const notice = {
  backgroundColor: 'hsl(45, 93%, 95%)',
  borderLeft: '3px solid hsl(38, 92%, 50%)',
  borderRadius: '6px',
  padding: '14px 16px',
  margin: '0 0 22px',
}
const noticeText = { fontSize: '14px', color: 'hsl(30, 40%, 25%)', lineHeight: '1.6', margin: '0' }
const footer = { fontSize: '13px', color: 'hsl(220, 9%, 46%)', margin: '32px 0 0' }
const small = { fontSize: '13px', color: 'hsl(220, 9%, 46%)', lineHeight: '1.6', margin: '0 0 18px', wordBreak: 'break-all' as const }
const link = { color: 'hsl(220, 13%, 13%)', textDecoration: 'underline' }
