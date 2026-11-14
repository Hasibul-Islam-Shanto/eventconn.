import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import type { PrismaClient } from "../../../generated/client/index.js";
import type { z } from "zod";
import { AppError } from "../../../../../packages/config/src/http.js";
import { registerSchema, loginSchema } from "./auth.validation.js";
export const publicUser = {
  id: true,
  name: true,
  email: true,
  role: true,
  createdAt: true,
  updatedAt: true,
} as const;
export class AuthService {
  constructor(
    private db: PrismaClient,
    private secret: string,
  ) {}
  async register(input: z.infer<typeof registerSchema>) {
    return this.db.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash: await bcrypt.hash(input.password, 12),
        role: input.accountType,
      },
      select: publicUser,
    });
  }
  async login(input: z.infer<typeof loginSchema>) {
    const user = await this.db.user.findUnique({
      where: { email: input.email },
    });
    const valid = await bcrypt.compare(
      input.password,
      user?.passwordHash ??
        "$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW",
    );
    if (!user || !valid)
      throw new AppError(
        401,
        "INVALID_CREDENTIALS",
        "Invalid email or password",
      );
    return {
      user: await this.me(user.id),
      token: jwt.sign({ userId: user.id, role: user.role }, this.secret, {
        algorithm: "HS256",
        expiresIn: "1h",
        issuer: "eventconn",
        audience: "eventconn",
      }),
    };
  }
  async me(id: string) {
    const user = await this.db.user.findUnique({
      where: { id },
      select: publicUser,
    });
    if (!user)
      throw new AppError(401, "UNAUTHENTICATED", "User no longer exists");
    return user;
  }
}
