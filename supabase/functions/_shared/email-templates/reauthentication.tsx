/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Preview, Text } from 'npm:@react-email/components@0.0.22'

interface Props { token: string }

export const ReauthenticationEmail = ({ token }: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Votre code de vérification</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Confirmer votre identité</Heading>
        <Text style={text}>Saisissez ce code pour confirmer votre identité :</Text>
        <Text style={codeStyle}>{token}</Text>
        <Text style={footer}>Ce code expirera bientôt. Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.</Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 600 as const, color: 'hsl(220, 13%, 13%)', margin: '0 0 20px', letterSpacing: '-0.01em' }
const text = { fontSize: '15px', color: 'hsl(220, 9%, 30%)', lineHeight: '1.6', margin: '0 0 18px' }
const link = { color: 'hsl(220, 13%, 13%)', textDecoration: 'underline' }
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
const codeStyle = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '24px', fontWeight: 600 as const, letterSpacing: '0.15em', color: 'hsl(220, 13%, 13%)', backgroundColor: 'hsl(220, 14%, 96%)', padding: '14px 20px', borderRadius: '10px', display: 'inline-block', margin: '0 0 24px' }
