import { z } from "zod";
import {
  CURRENCIES,
  PROPERTY_TYPES,
  PURPOSES,
  TIMELINES,
} from "@/lib/constants";

export const clientSignUpSchema = z
  .object({
    name: z.string().trim().min(2, "Informe seu nome"),
    email: z
      .string()
      .trim()
      .email("E-mail inválido")
      .optional()
      .or(z.literal("")),
    phone: z
      .string()
      .trim()
      .min(6, "Telefone inválido")
      .optional()
      .or(z.literal("")),
    password: z.string().min(8, "A senha precisa ter ao menos 8 caracteres"),
  })
  .refine((data) => !!data.email || !!data.phone, {
    message: "Informe ao menos um e-mail ou telefone",
    path: ["email"],
  });

export const loginSchema = z.object({
  identifier: z.string().trim().min(3, "Informe seu e-mail ou telefone"),
  password: z.string().min(1, "Informe sua senha"),
});

export const profileSchema = z
  .object({
    propertyTypes: z
      .array(z.enum(PROPERTY_TYPES))
      .min(1, "Selecione ao menos um tipo de imóvel"),
    purpose: z.enum(PURPOSES),
    timeline: z.enum(TIMELINES),
    budgetMin: z.coerce.number().nonnegative().optional(),
    budgetMax: z.coerce.number().positive().optional(),
    currency: z.enum(CURRENCIES),
    bedroomsMin: z.coerce.number().int().nonnegative().optional(),
    zone: z.string().trim().optional(),
    notes: z.string().trim().optional(),
  })
  .refine(
    (data) =>
      !data.budgetMin || !data.budgetMax || data.budgetMin <= data.budgetMax,
    {
      message: "O valor mínimo não pode ser maior que o máximo",
      path: ["budgetMax"],
    },
  );

export const propertySchema = z.object({
  title: z.string().trim().min(3, "Informe um título"),
  description: z.string().trim().optional(),
  type: z.enum(PROPERTY_TYPES),
  suitableFor: z.enum(PURPOSES),
  price: z.coerce.number().positive("Informe um preço válido"),
  currency: z.enum(CURRENCIES),
  zone: z.string().trim().min(2, "Informe o bairro/zona"),
  bedrooms: z.coerce.number().int().nonnegative().optional(),
  bathrooms: z.coerce.number().int().nonnegative().optional(),
  areaM2: z.coerce.number().positive().optional(),
  photos: z.string().trim().optional(),
  status: z.enum(["ATIVO", "INATIVO"]).optional(),
});

export const feedbackSchema = z.object({
  recommendationId: z.string().min(1),
  status: z.enum(["INTERESSADO", "NAO_INTERESSADO", "TALVEZ"]),
  feedbackNote: z.string().trim().optional(),
});

export const ratesSchema = z.object({
  usdToPyg: z.coerce.number().positive(),
  usdToBrl: z.coerce.number().positive(),
});
