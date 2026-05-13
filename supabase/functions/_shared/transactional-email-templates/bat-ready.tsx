/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Atelier Rufo'

interface BatReadyProps {
  name?: string
  description?: string
  portalUrl?: string
}

const BatReadyEmail = ({ name, description, portalUrl }: BatReadyProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Votre BAT est prêt à être validé</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Votre BAT est prêt</Heading>
        <Text style={text}>
          {name ? `Bonjour ${name},` : 'Bonjour,'}
        </Text>
        <Text style={text}>
          Le bon à tirer{description ? ` pour « ${description} »` : ''} est disponible
          dans votre espace. Vous pouvez le consulter, l'annoter et le valider.
        </Text>
        {portalUrl && (
          <Button style={button} href={portalUrl}>
            Accéder au portail
          </Button>
        )}
        <Text style={footer}>— {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: BatReadyEmail,
  subject: 'Votre BAT est prêt à être validé',
  displayName: 'BAT prêt',
  previewData: {
    name: 'Camille',
    description: 'Affiche concert',
    portalUrl: 'https://example.com/portail',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 600 as const, color: 'hsl(220, 13%, 13%)', margin: '0 0 20px', letterSpacing: '-0.01em' }
const text = { fontSize: '15px', color: 'hsl(220, 9%, 30%)', lineHeight: '1.6', margin: '0 0 18px' }
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