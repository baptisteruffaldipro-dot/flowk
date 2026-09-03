/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as batReady } from './bat-ready.tsx'
import { template as filesDelivered } from './files-delivered.tsx'
import { template as onboardingReady } from './onboarding-ready.tsx'
import { template as logoReady } from './logo-ready.tsx'
import { template as clientRequestLink } from './client-request-link.tsx'
import { template as paymentReminder } from './payment-reminder.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'bat-ready': batReady,
  'files-delivered': filesDelivered,
  'onboarding-ready': onboardingReady,
  'logo-ready': logoReady,
  'client-request-link': clientRequestLink,
  'payment-reminder': paymentReminder,
}