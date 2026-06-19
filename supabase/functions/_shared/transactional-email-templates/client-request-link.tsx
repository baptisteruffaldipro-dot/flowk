/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Atelier Rufo'

interface Props {
  name?: string
  title?: string
  description?: string
  amount?: string
  deadline?: string
  url?: string
  message?: string
}

const ClientRequestLinkEmail = ({ name, title, description, amount, deadline, url, message }: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>{title ? `Votre demande : ${title}` : 'Votre demande'}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>{title || 'Votre demande'}</Heading>
        <Text style={text}>{name ? `Bonjour ${name},` : 'Bonjour,'}</Text>
        <Text style={text}>
          Vous trouverez ci-dessous le récapitulatif de votre demande.
          Vous pouvez la valider, la refuser ou échanger avec moi via le lien.
        </Text>
        {message && (
          <>
            <Text style={text}>{message}</Text>
            <Hr style={hr} />
          </>
        )}
        {description && <Text style={text}><strong>Détails :</strong> {description}</Text>}
        {amount && <Text style={text}><strong>Montant estimé :</strong> {amount} € HT</Text>}
        {deadline && <Text style={text}><strong>Échéance :</strong> {deadline}</Text>}
        {url && <Button style={button} href={url}>Voir et valider la demande</Button>}
        <Text style={footer}>— {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ClientRequestLinkEmail,
  subject: (data: Record<string, any>) => data?.title ? `Votre demande : ${data.title}` : 'Votre demande',
  displayName: 'Demande client – lien',
  previewData: {
    name: 'Camille',
    title: 'Refonte logo',
    description: 'Refonte complète avec déclinaisons.',
    amount: '1200',
    deadline: '15/07/2026',
    url: 'https://example.com/p/demande/abc',
    message: 'Voici le récap, dites-moi si tout est ok.',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 600 as const, color: 'hsl(220, 13%, 13%)', margin: '0 0 20px', letterSpacing: '-0.01em' }
const text = { fontSize: '15px', color: 'hsl(220, 9%, 30%)', lineHeight: '1.6', margin: '0 0 18px' }
const hr = { borderColor: 'hsl(220, 13%, 91%)', margin: '20px 0' }
const button = {
  backgroundColor: 'hsl(220, 13%, 13%)',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: 500 as const,
  borderRadius: '10px',
  padding: '12px 22px',
  textDecoration: 'none',
  display: 'inline-block',
  margin: '8px 0 24px',
}
const footer = { fontSize: '13px', color: 'hsl(220, 9%, 46%)', margin: '32px 0 0' }