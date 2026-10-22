/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Atelier Rufo'

interface BrandStrategyReadyProps {
  name?: string
  projectName?: string
  presentationUrl?: string
}

const BrandStrategyReadyEmail = ({ name, projectName, presentationUrl }: BrandStrategyReadyProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Votre stratégie de marque est disponible</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Votre stratégie de marque est prête</Heading>
        <Text style={text}>
          {name ? `Bonjour ${name},` : 'Bonjour,'}
        </Text>
        <Text style={text}>
          Le document de stratégie de marque{projectName ? ` pour « ${projectName} »` : ''} est
          disponible à la consultation. Vous y retrouverez le positionnement, le
          storytelling, le moodboard, l'univers visuel ainsi que le plan de
          communication.
        </Text>
        <Text style={text}>
          Prenez le temps de le parcourir et n'hésitez pas à revenir vers moi avec
          vos retours, vos préférences ou vos questions.
        </Text>
        {presentationUrl && (
          <Button style={button} href={presentationUrl}>
            Découvrir la stratégie
          </Button>
        )}
        <Text style={footer}>— {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: BrandStrategyReadyEmail,
  subject: 'Votre stratégie de marque est disponible',
  displayName: 'Stratégie de marque prête',
  previewData: {
    name: 'Camille',
    projectName: 'Atelier Rivage',
    presentationUrl: 'https://example.com/p/strategie/abc',
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
