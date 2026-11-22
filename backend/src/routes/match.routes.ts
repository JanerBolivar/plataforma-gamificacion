import { Router } from 'express';
import { MatchController } from '../controllers/match.controller.js';
import { authenticate, requireActive } from '../middlewares/auth.middleware.js';

const router = Router();

// Proteccion para usuarios autenticados y activos
router.use(authenticate, requireActive);

router.get('/', MatchController.getMatches);
router.post('/', MatchController.createMatch);
router.get('/:id', MatchController.getMatchLobby);
router.get('/:id/collectibles', MatchController.getMatchCollectibles);
router.post('/:id/join', MatchController.joinMatch);
router.post('/:id/leave', MatchController.leaveMatch);

router.post('/:id/teams', MatchController.createTeam);
router.post('/:id/teams/:teamId/join', MatchController.joinTeam);
router.post('/:id/teams/:teamId/leave', MatchController.leaveTeam);
router.post('/:id/teams/:teamId/invite', MatchController.inviteToTeam);

router.post('/:id/invitations/:invitationId/respond', MatchController.respondInvitation);

router.post('/:id/start', MatchController.startMatch);
router.post('/:id/finish', MatchController.finishMatch);
router.post('/:id/cancel', MatchController.cancelMatch);

export default router;
