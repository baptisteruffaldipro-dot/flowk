/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Atelier Rufo'

interface OnboardingReadyProps {
  name?: string
  portalUrl?: string
}

const OnboardingReadyEmail = ({ name, portalUrl }: OnboardingReadyProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Votre espace client {SITE_NAME} est prêt</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Votre espace est prêt</Heading>
        <Text style={text}>{name ? `Bonjour ${name},` : 'Bonjour,'}</Text>
        <Text style={text}>
          Votre espace client {SITE_NAME} est en place. Vous y retrouverez vos
          projets, briefs, BAT, factures et rendez-vous, en un seul endroit.
        </Text>
        {portalUrl && (
          <Button style={button} href={portalUrl}>Accéder à mon espace</Button>
        )}
        <Text style={footer}>— L'équipe {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: OnboardingReadyEmail,
  subject: `Votre espace client ${SITE_NAME} est prêt`,
  displayName: 'Onboarding prêt',
  previewData: {
    name: 'Camille',
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