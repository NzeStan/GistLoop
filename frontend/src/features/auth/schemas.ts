import { z } from "zod";

/** Mirrors the API's password rules (min 10, not all digits); the server has the final say. */
export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(128, "That's a little too long")
  .refine((value) => !/^\d+$/.test(value), "Use letters as well as numbers");

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, "Enter your email or username"),
  password: z.string().min(1, "Enter your password"),
});

export const registerSchema = z.object({
  display_name: z.string().trim().min(1, "Enter your name").max(100),
  handle: z
    .string()
    .trim()
    .min(3, "At least 3 characters")
    .max(30, "30 characters at most")
    .regex(/^[A-Za-z0-9_]+$/, "Letters, numbers and underscores only"),
  email: z.email("Enter a valid email address"),
  password: passwordSchema,
  accept: z.literal(true, { error: "You need to accept the terms to join" }),
});

export const emailSchema = z.object({ email: z.email("Enter a valid email address") });

export const resetSchema = z
  .object({ new_password: passwordSchema, confirm: z.string() })
  .refine((v) => v.new_password === v.confirm, { path: ["confirm"], message: "Passwords don't match" });
