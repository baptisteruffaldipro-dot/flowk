/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Atelier Rufo'

interface FilesDeliveredProps {
  name?: string
  description?: string
  portalUrl?: string
}

const FilesDeliveredEmail = ({ name, description, portalUrl }: FilesDeliveredProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Vos fichiers sont disponibles</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Vos fichiers sont prêts</Heading>
        <Text style={text}>{name ? `Bonjour ${name},` : 'Bonjour,'}</Text>
        <Text style={text}>
          Les livrables{description ? ` du projet « ${description} »` : ''} sont
          disponibles dans votre espace. Vous pouvez les télécharger dès maintenant.
        </Text>
        {portalUrl && (
          <Button style={button} href={portalUrl}>
            Télécharger les fichiers
          </Button>
        )}
        <Text style={footer}>— {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: FilesDeliveredEmail,
  subject: 'Vos fichiers sont disponibles',
  displayName: 'Fichiers livrés',
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