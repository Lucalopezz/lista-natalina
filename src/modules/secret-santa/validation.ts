import { z } from "zod";
import { groupIdSchema } from "../groups/validation";

export { MIN_PARTICIPANTS } from "./constants";
export const drawOperationSchema = z.enum(["start", "redraw", "invalidate"]);
export const drawExpectationSchema = z.object({ revision: z.number().int().nonnegative().safe(), compositionVersion: z.number().int().nonnegative().safe() });
export const drawRequestSchema = drawExpectationSchema.extend({ groupId: groupIdSchema, operation: drawOperationSchema });
export type DrawOperation = z.infer<typeof drawOperationSchema>;
export type DrawExpectation = z.infer<typeof drawExpectationSchema>;
