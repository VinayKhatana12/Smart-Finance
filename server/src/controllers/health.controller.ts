import type { Request, Response } from 'express';
import { prisma } from '../db/prisma.js';

export function health(_req: Request, res: Response): void {
  void prisma
    .$queryRaw`SELECT 1`
    .then(() => {
      res.status(200).json({
        success: true,
        data: {
          status: 'ok',
          db: 'connected',
          uptimeSeconds: Math.round(process.uptime()),
          timestamp: new Date().toISOString(),
        },
      });
    })
    .catch(() => {
      res.status(200).json({
        success: true,
        data: {
          status: 'ok',
          db: 'disconnected',
          uptimeSeconds: Math.round(process.uptime()),
          timestamp: new Date().toISOString(),
        },
      });
    });
}
