import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(12).max(128),
  fullName: z.string().trim().min(2).max(120)
}).strict();

export const loginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(128)
}).strict();

export const verifyLoginTwoFactorSchema = z.object({
  challengeToken: z.string().min(1),
  token: z.string().regex(/^\d{6}$/)
}).strict();

export const verifyTwoFactorSchema = z.object({
  token: z.string().regex(/^\d{6}$/)
}).strict();

export const disableTwoFactorSchema = z.object({
  password: z.string().min(1).max(128),
  token: z.string().regex(/^\d{6}$/)
}).strict();

export const requestCreateSchema = z.object({
  type: z.enum([
    'General Inquiry',
    'Subscription Inquiry',
    'Redemption Inquiry',
    'Withdrawal Inquiry',
    'Document Request',
    'Support Request'
  ]),
  productId: z.string().uuid().nullable().optional(),
  amount: z.number().positive().max(1_000_000_000).nullable().optional(),
  message: z.string().trim().min(3).max(2000)
}).strict();

export const requestUpdateSchema = z.object({
  status: z.enum(['Submitted', 'Under Review', 'Completed', 'Rejected']),
  adminNote: z.string().trim().max(2000).optional().default('')
}).strict();

export const dividendCreateSchema = z.object({
  clientId: z.string().uuid(),
  productId: z.string().uuid().nullable().optional(),
  amount: z.number().positive().max(1_000_000_000),
  date: z.string().date(),
  status: z.enum(['Pending', 'Distributed']).default('Distributed')
}).strict();
