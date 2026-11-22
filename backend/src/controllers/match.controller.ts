import { Request, Response } from 'express';
import { MatchService } from '../services/match.service.js';
import { z } from 'zod';

const createMatchSchema = z.object({
  name: z.string().min(1, 'El nombre de la partida es obligatorio').max(100),
  maxTeams: z.number().int().min(1).max(6),
});

const createTeamSchema = z.object({
  name: z.string().min(1, 'El nombre del equipo es obligatorio').max(50),
});

const respondInvitationSchema = z.object({
  action: z.enum(['ACCEPT', 'REJECT']),
});

const inviteSchema = z.object({
  inviteeId: z.string().uuid('Identificador de usuario invalido'),
});

/**
 * Controlador de solicitudes HTTP relacionadas con partidas, equipos y lobbies.
 */
export class MatchController {
  public static async getMatches(req: Request, res: Response): Promise<void> {
    try {
      const data = await MatchService.getMatches(req.user!.id, req.user!.role);
      res.status(200).json({ status: 'ok', data });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error al consultar partidas';
      res.status(500).json({ status: 'error', message });
    }
  }

  public static async createMatch(req: Request, res: Response): Promise<void> {
    try {
      const parseResult = createMatchSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          status: 'error',
          message: 'Datos de creacion invalidos.',
          errors: parseResult.error.format(),
        });
        return;
      }

      const match = await MatchService.createMatch(req.user!.id, parseResult.data);
      res.status(201).json({ status: 'ok', data: match });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error al crear la partida';
      res.status(400).json({ status: 'error', message });
    }
  }

  public static async getMatchLobby(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const data = await MatchService.getMatchLobby(id, req.user!.id);
      res.status(200).json({ status: 'ok', data });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error al consultar el lobby';
      res.status(404).json({ status: 'error', message });
    }
  }

  public static async joinMatch(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const match = await MatchService.joinMatch(id, req.user!.id);
      res.status(200).json({ status: 'ok', data: match });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error al unirse a la partida';
      res.status(400).json({ status: 'error', message });
    }
  }

  public static async leaveMatch(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await MatchService.leaveMatch(id, req.user!.id);
      res.status(200).json({ status: 'ok', message: 'Ha abandonado la partida correctamente.' });
    } catch (error: unknown) {
      console.error('[ERROR] Error al salir de la partida:', error);
      const message = error instanceof Error ? error.message : 'Error al salir de la partida';
      res.status(400).json({ status: 'error', message });
    }
  }

  public static async createTeam(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const parseResult = createTeamSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          status: 'error',
          message: 'Nombre de equipo invalido.',
          errors: parseResult.error.format(),
        });
        return;
      }

      const team = await MatchService.createTeam(id, req.user!.id, parseResult.data);
      res.status(201).json({ status: 'ok', data: team });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error al crear equipo';
      res.status(400).json({ status: 'error', message });
    }
  }

  public static async joinTeam(req: Request, res: Response): Promise<void> {
    try {
      const { id, teamId } = req.params;
      await MatchService.joinTeam(id, teamId, req.user!.id);
      res.status(200).json({ status: 'ok', message: 'Ingreso al equipo exitosamente.' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error al unirse al equipo';
      res.status(400).json({ status: 'error', message });
    }
  }

  public static async leaveTeam(req: Request, res: Response): Promise<void> {
    try {
      const { id, teamId } = req.params;
      await MatchService.leaveTeam(id, teamId, req.user!.id);
      res.status(200).json({ status: 'ok', message: 'Salio del equipo exitosamente.' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error al salir del equipo';
      res.status(400).json({ status: 'error', message });
    }
  }

  public static async inviteToTeam(req: Request, res: Response): Promise<void> {
    try {
      const { id, teamId } = req.params;
      const parseResult = inviteSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({ status: 'error', message: 'Identificador de invitado invalido.' });
        return;
      }

      const invitation = await MatchService.inviteToTeam(
        id,
        teamId,
        req.user!.id,
        parseResult.data.inviteeId
      );
      res.status(201).json({ status: 'ok', data: invitation });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error al enviar invitacion';
      res.status(400).json({ status: 'error', message });
    }
  }

  public static async respondInvitation(req: Request, res: Response): Promise<void> {
    try {
      const { id, invitationId } = req.params;
      const parseResult = respondInvitationSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({ status: 'error', message: 'Accion de respuesta invalida.' });
        return;
      }

      await MatchService.respondInvitation(id, invitationId, req.user!.id, parseResult.data);
      res.status(200).json({ status: 'ok', message: 'Respuesta procesada correctamente.' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error al responder invitacion';
      res.status(400).json({ status: 'error', message });
    }
  }

  public static async startMatch(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const match = await MatchService.startMatch(id, req.user!.id, req.user!.role);
      res.status(200).json({ status: 'ok', data: match });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error al iniciar la partida';
      res.status(400).json({ status: 'error', message });
    }
  }

  public static async finishMatch(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const match = await MatchService.finishMatch(id, req.user!.id, req.user!.role);
      res.status(200).json({ status: 'ok', data: match });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error al finalizar la partida';
      res.status(400).json({ status: 'error', message });
    }
  }

  public static async cancelMatch(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const match = await MatchService.cancelMatch(id, req.user!.id, req.user!.role);
      res.status(200).json({ status: 'ok', data: match });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error al cancelar la partida';
      res.status(400).json({ status: 'error', message });
    }
  }
}
