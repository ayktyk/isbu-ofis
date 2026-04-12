import { Request, Response, NextFunction } from 'express'
import { ZodSchema, ZodError } from 'zod'

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body)
      next()
    } catch (error) {
      if (error instanceof ZodError) {
        const details: Record<string, string[]> = {}
        for (const issue of error.issues) {
          const path = issue.path.join('.') || '_root'
          if (!details[path]) details[path] = []
          details[path].push(issue.message)
        }

        res.status(422).json({
          error: 'Doğrulama hatası',
          details,
        })
        return
      }
      next(error)
    }
  }
}
