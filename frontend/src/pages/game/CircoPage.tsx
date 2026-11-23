import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { CircoScene } from '../../game/CircoScene';
import {
  CircoNetworkManager,
  CircoTeamState,
  QuestionDataPayload,
  QuestionResultPayload,
  SharkSelectTargetPromptPayload,
} from '../../game/CircoNetworkManager';
import { matchService } from '../../services/match.service';
import { MatchLobbyDetails } from '../../types/match';
import { MapObjectDefinition } from '../../types/map';
import {
  GameLeaderboardHUD,
  GameCoordinatesHUD,
  GameHelpBarHUD,
  GameTimerHUD,
  MapEditorPanel,
} from '../../components/game/hud';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  LogOut,
  Maximize2,
  Minimize2,
  Sparkles,
  Tent,
  HelpCircle,
  Clock,
  Compass,
  Armchair,
  ChevronUp,
  ChevronDown,
  GripVertical,
  Send,
  Puzzle,
  ShieldAlert,
} from 'lucide-react';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';

export const CircoPage: React.FC = () => {
  const { matchId } = useParams<{ matchId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const gameRootRef = useRef<HTMLDivElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const circoSceneRef = useRef<CircoScene | null>(null);
  const networkManagerRef = useRef<CircoNetworkManager | null>(null);

  const [lobby, setLobby] = useState<MatchLobbyDetails | null>(null);
  const lobbyRef = useRef<MatchLobbyDetails | null>(null);
  lobbyRef.current = lobby;
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [playerCoords, setPlayerCoords] = useState<{ x: number; y: number; z: number } | null>(null);

  // Estados de carga de assets 3D
  const [loadingAssets, setLoadingAssets] = useState<boolean>(true);
  const [loadProgress, setLoadProgress] = useState<number>(0);
  const [currentAssetLoading, setCurrentAssetLoading] = useState<string>('Iniciando escenario Circo...');

  // Estados multijugador del Circo sincronizados por Colyseus
  const [phase, setPhase] = useState<string>('SELECTING_PODIUMS'); // "SELECTING_PODIUMS" | "PLAYING" | "FINISHED"
  const [timeRemaining, setTimeRemaining] = useState<number>(30 * 60);
  const [questionTimeRemaining, setQuestionTimeRemaining] = useState<number>(0);
  const [currentTurnSeat, setCurrentTurnSeat] = useState<number>(1);
  const [turnStep, setTurnStep] = useState<string>('IDLE');
  const [teams, setTeams] = useState<CircoTeamState[]>([]);
  const [activeQuestion, setActiveQuestion] = useState<QuestionDataPayload | null>(null);
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState<boolean>(false);

  // Estados para Carta Adivínalo (Fase 1: Ordenar pista, Fase 2: Ingresar concepto)
  const [guessItOrderPrompt, setGuessItOrderPrompt] = useState<{
    itemNumber: number;
    fragments: string[];
    timeSeconds: number;
  } | null>(null);
  const [orderedFragments, setOrderedFragments] = useState<string[]>([]);
  const [draggedFragmentIndex, setDraggedFragmentIndex] = useState<number | null>(null);

  const [guessItAnswerPrompt, setGuessItAnswerPrompt] = useState<{
    itemNumber: number;
    orderedPhrase: string;
    timeSeconds: number;
  } | null>(null);
  const [guessItConceptInput, setGuessItConceptInput] = useState<string>('');
  const [isSubmittingGuessIt, setIsSubmittingGuessIt] = useState<boolean>(false);

  const [guessItStatusMessage, setGuessItStatusMessage] = useState<{ teamName: string; text: string } | null>(null);

  // Estados para Cartas de Tiburon (Eliminar una oportunidad)
  const [sharkSelectTargetPrompt, setSharkSelectTargetPrompt] = useState<SharkSelectTargetPromptPayload | null>(null);
  const [isSubmittingSharkTarget, setIsSubmittingSharkTarget] = useState<boolean>(false);

  // Proximidad e interaccion contextual (tecla E)
  const [nearbyPrompt, setNearbyPrompt] = useState<string | null>(null);
  const currentInteractableRef = useRef<{ type: 'claim_seat' | 'spin_roulette'; seat?: number } | null>(null);

  // Estados del Editor de Mapas (F2)
  const [isEditorActive, setIsEditorActive] = useState<boolean>(false);
  const [selectedObjectDef, setSelectedObjectDef] = useState<MapObjectDefinition | null>(null);
  const [transformMode, setTransformMode] = useState<'translate' | 'rotate' | 'scale'>('translate');
  const [selectedNewModel, setSelectedNewModel] = useState<string>('FichaPlayer_Rojo.glb');
  const [isSavingMap, setIsSavingMap] = useState<boolean>(false);

  // Identificar el equipo y rol de representante del usuario local
  const myTeam = useMemo(() => {
    if (!user) return null;
    return teams.find((t) => {
      // Comparar con el equipo registrado en el lobby
      const lobbyTeam = lobby?.teams?.find((lt) => lt.members.some((m) => m.userId === user.id));
      return t.teamId === lobbyTeam?.id;
    }) || null;
  }, [teams, lobby, user]);

  const isMyTeamRepresentative = useMemo(() => {
    if (!user || !myTeam) return false;
    return myTeam.representativeId === user.id;
  }, [user, myTeam]);

  const isMyTurn = useMemo(() => {
    if (!myTeam || myTeam.seat <= 0) return false;
    return currentTurnSeat === myTeam.seat && phase === 'PLAYING' && turnStep === 'IDLE';
  }, [myTeam, currentTurnSeat, phase, turnStep]);

  // Cargar datos de la partida y detalles de lobby
  useEffect(() => {
    if (!matchId) return;

    matchService
      .getMatchLobby(matchId)
      .then((data) => {
        setLobby(data);
      })
      .catch((err) => {
        console.error('[ERROR] Error al consultar datos de partida en el Circo:', err);
      });
  }, [matchId]);

  // Sincronizar coordenadas del jugador local para el HUD y para la red
  useEffect(() => {
    const interval = setInterval(() => {
      if (circoSceneRef.current) {
        const pos = circoSceneRef.current.getPlayerPosition();
        const pc = circoSceneRef.current.getPlayerController();

        setPlayerCoords({
          x: Number(pos.x.toFixed(2)),
          y: Number(pos.y.toFixed(2)),
          z: Number(pos.z.toFixed(2)),
        });

        // Enviar posicion al servidor para sincronizacion de avatares remotos
        networkManagerRef.current?.sendPlayerPosition(
          pos.x,
          pos.y,
          pos.z,
          pc.getYaw(),
          pc.getAnimationState()
        );
      }
    }, 55);

    return () => clearInterval(interval);
  }, []);

  // Comprobar proximidad con atriles para interacción con tecla E
  useEffect(() => {
    const interval = setInterval(() => {
      if (!circoSceneRef.current || loadingAssets) return;

      const pos = circoSceneRef.current.getPlayerPosition();
      const nearbyPodium = circoSceneRef.current.checkPodiumProximity(pos, 3.5);

      if (phase === 'SELECTING_PODIUMS') {
        if (nearbyPodium) {
          const seat = nearbyPodium.seat;
          const isOccupied = teams.some((t) => t.seat === seat);

          if (!isOccupied && myTeam && myTeam.seat <= 0) {
            setNearbyPrompt(`Presione [E] para ocupar el Puesto ${seat}`);
            currentInteractableRef.current = { type: 'claim_seat', seat };
            return;
          }
        }
        setNearbyPrompt(null);
        currentInteractableRef.current = null;
        return;
      }

      if (phase === 'PLAYING') {
        if (isMyTurn && isMyTeamRepresentative && nearbyPodium && nearbyPodium.seat === myTeam?.seat) {
          setNearbyPrompt('Presione [E] para girar la ruleta');
          currentInteractableRef.current = { type: 'spin_roulette' };
          return;
        }
        setNearbyPrompt(null);
        currentInteractableRef.current = null;
      }
    }, 150);

    return () => clearInterval(interval);
  }, [phase, teams, myTeam, isMyTurn, isMyTeamRepresentative, loadingAssets]);

  // Solicitar o salir de pantalla completa
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      const elem = gameRootRef.current || document.documentElement;
      elem
        .requestFullscreen()
        .then(() => setIsFullscreen(true))
        .catch(() => {});
    } else {
      document
        .exitFullscreen()
        .then(() => setIsFullscreen(false))
        .catch(() => {});
    }
  }, []);

  // Intentar ingresar a pantalla completa automaticamente al cargar o interactuar
  useEffect(() => {
    const enterFullscreen = () => {
      if (!document.fullscreenElement) {
        const elem = gameRootRef.current || document.documentElement;
        elem
          .requestFullscreen()
          .then(() => setIsFullscreen(true))
          .catch(() => {});
      }
    };

    if ((navigator as any).userActivation?.hasBeenActive) {
      enterFullscreen();
    }

    const handleFirstUserInteraction = () => {
      enterFullscreen();
      window.removeEventListener('click', handleFirstUserInteraction, true);
      window.removeEventListener('keydown', handleFirstUserInteraction, true);
    };

    window.addEventListener('click', handleFirstUserInteraction, true);
    window.addEventListener('keydown', handleFirstUserInteraction, true);

    return () => {
      window.removeEventListener('click', handleFirstUserInteraction, true);
      window.removeEventListener('keydown', handleFirstUserInteraction, true);
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, []);

  const openMenu = useCallback(() => {
    setIsMenuOpen(true);
    if (circoSceneRef.current) {
      circoSceneRef.current.getPlayerController().unlockPointer();
    }
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  }, []);

  const handleResumeGame = useCallback(() => {
    setIsMenuOpen(false);
    const canvas = canvasContainerRef.current?.querySelector('canvas');
    if (canvas && !isEditorActive && !activeQuestion && !guessItOrderPrompt && !guessItAnswerPrompt && !sharkSelectTargetPrompt) {
      canvas.requestPointerLock();
    }
  }, [isEditorActive, activeQuestion, guessItOrderPrompt, guessItAnswerPrompt, sharkSelectTargetPrompt]);

  // Manejar teclado para pausa, interaccion E y deseleccion en editor
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Tecla E para interaccion contextual
      if (e.code === 'KeyE' && !isMenuOpen && !isEditorActive && !activeQuestion && !guessItOrderPrompt && !guessItAnswerPrompt && !sharkSelectTargetPrompt) {
        if (currentInteractableRef.current) {
          e.preventDefault();
          if (currentInteractableRef.current.type === 'claim_seat' && currentInteractableRef.current.seat) {
            networkManagerRef.current?.claimSeat(currentInteractableRef.current.seat);
          } else if (currentInteractableRef.current.type === 'spin_roulette') {
            networkManagerRef.current?.spinRoulette();
          }
          return;
        }
      }

      // Escape con editor activo deselecciona objeto
      if (e.code === 'Escape') {
        if (isEditorActive && selectedObjectDef) {
          e.preventDefault();
          circoSceneRef.current?.getMapEditor()?.deselect();
          return;
        }
      }

      // Teclas para alternar menu de opciones
      const isMenuKey =
        e.key === 'Alt' ||
        e.code === 'AltLeft' ||
        e.code === 'AltRight' ||
        e.code === 'KeyM' ||
        e.code === 'KeyP' ||
        e.code === 'Escape';

      if (isMenuKey) {
        e.preventDefault();
        e.stopPropagation();
        if (isMenuOpen) {
          handleResumeGame();
        } else {
          openMenu();
        }
      }
    };

    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [isEditorActive, selectedObjectDef, isMenuOpen, handleResumeGame, openMenu, activeQuestion, guessItOrderPrompt, guessItAnswerPrompt, sharkSelectTargetPrompt]);

  // Inicializar escena 3D y conexion multijugador Colyseus
  useEffect(() => {
    if (!canvasContainerRef.current || !matchId) return;

    const scene = new CircoScene(canvasContainerRef.current);
    circoSceneRef.current = scene;

    if (import.meta.env.DEV) {
      const editor = scene.getMapEditor();
      if (editor) {
        editor.onActiveStateChange = (active) => {
          setIsEditorActive(active);
        };
        editor.onSelectionChange = (def) => {
          setSelectedObjectDef(def);
        };
        editor.onTransformUpdate = (pos, rot, scale) => {
          setSelectedObjectDef((prev) =>
            prev ? { ...prev, position: pos, rotation: rot, scale } : null
          );
        };
      }
    }

    // Inicializar el mundo 3D
    scene
      .initWorld((progress) => {
        const percent = Math.round((progress.loaded / progress.total) * 100);
        setLoadProgress(percent);
        setCurrentAssetLoading(`Cargando ${progress.currentAsset} (${progress.loaded}/${progress.total})`);
      })
      .then(() => {
        setLoadingAssets(false);
        const currentTeams = nm.getCurrentTeams();
        const total = lobbyRef.current?.teams?.length || currentTeams.length || 6;
        if (currentTeams.length > 0) {
          setTeams(currentTeams);
        }
        scene.configureTeams(currentTeams, total);
      })
      .catch((err) => {
        console.error('[ERROR] Error al inicializar el escenario 3D del Circo:', err);
        setLoadingAssets(false);
      });

    // Inicializar conexion Colyseus con CircoRoom
    const nm = new CircoNetworkManager();
    networkManagerRef.current = nm;

    nm.onPlayerJoined = (sessionId, player) => {
      scene.addRemotePlayer(sessionId, player);
    };
    nm.onPlayerLeft = (sessionId) => {
      scene.removeRemotePlayer(sessionId);
    };
    nm.onPlayerMoved = (sessionId, player) => {
      scene.updateRemotePlayer(sessionId, player);
    };

    nm.onPhaseChanged = (newPhase) => {
      setPhase((prev) => {
        if (prev === 'SELECTING_PODIUMS' && newPhase === 'PLAYING') {
          toast.info('Comienza la fase de juego: La ruleta esta habilitada.');
        }
        return newPhase;
      });
    };

    nm.onTimeRemainingChanged = (seconds) => {
      setTimeRemaining(seconds);
    };

    nm.onQuestionTimeRemainingChanged = (seconds) => {
      setQuestionTimeRemaining(seconds);
    };

    nm.onCurrentTurnChanged = (seat) => {
      setCurrentTurnSeat(seat);
    };

    nm.onTurnStepChanged = (step) => {
      setTurnStep(step);
      if (step === 'IDLE') {
        scene.clearActiveCard();
        setActiveQuestion(null);
        setIsSubmittingAnswer(false);
        setGuessItOrderPrompt(null);
        setGuessItAnswerPrompt(null);
        setGuessItStatusMessage(null);
        setIsSubmittingGuessIt(false);
        setSharkSelectTargetPrompt(null);
        setIsSubmittingSharkTarget(false);
      }
    };

    nm.onArrowRotationChanged = (rotY) => {
      scene.setArrowRotationY(rotY);
    };

    nm.onTeamsUpdated = (updatedTeams) => {
      setTeams(updatedTeams);
      const total = lobbyRef.current?.teams?.length || updatedTeams.length;
      scene.configureTeams(updatedTeams, total);
    };

    nm.onSeatClaimed = (payload) => {
      toast.success(`${payload.teamName} ha ocupado el Puesto ${payload.seat}`);
    };

    nm.onRouletteSpun = (payload) => {
      scene.setArrowRotationY(payload.targetRotationY);
      toast.info(`${payload.teamName} ha girado la ruleta...`);
    };

    nm.onCardEmerged = (payload) => {
      scene.setActiveCard(payload.cardType);
    };

    nm.onCardPlaceholder = (payload) => {
      toast.info(`Carta obtenida: ${payload.cardType} (${payload.teamName})`);
    };

    nm.onQuestionStarted = (payload) => {
      setActiveQuestion(payload);
      setIsSubmittingAnswer(false);
      scene.setActiveCard('PREGUNTA');

      // Liberar cursor para permitir interaccion con la tarjeta de pregunta
      if (document.pointerLockElement) {
        document.exitPointerLock();
      }
    };

    nm.onQuestionResult = (payload: QuestionResultPayload) => {
      if (payload.correct) {
        scene.soundManager.playCorrectAnswerSound();
        toast.success(`Respuesta correcta de ${payload.teamName} (+1 punto)`);
      } else {
        scene.soundManager.playIncorrectAnswerSound();
        toast.error(`Respuesta incorrecta de ${payload.teamName}`);
      }
    };

    nm.onQuestionTimeout = (payload) => {
      scene.soundManager.playTimeoutSound();
      toast.warning(`${payload.teamName}: ${payload.message}`);
      setActiveQuestion(null);
      setIsSubmittingAnswer(false);
    };

    nm.onGuessItOrderPrompt = (payload) => {
      setGuessItOrderPrompt(payload);
      setOrderedFragments([...payload.fragments]);
      setIsSubmittingGuessIt(false);
      scene.setActiveCard('ADIVINALO');

      if (document.pointerLockElement) {
        document.exitPointerLock();
      }
    };

    nm.onGuessItAnswerPrompt = (payload) => {
      setGuessItAnswerPrompt(payload);
      setGuessItConceptInput('');
      setIsSubmittingGuessIt(false);
      scene.setActiveCard('ADIVINALO');

      if (document.pointerLockElement) {
        document.exitPointerLock();
      }
    };

    nm.onGuessItOrderingStarted = (payload) => {
      setGuessItStatusMessage({
        teamName: payload.teamName,
        text: `${payload.ordererName} está ordenando la pista para su equipo...`,
      });
      scene.setActiveCard('ADIVINALO');
    };

    nm.onGuessItAnsweringStarted = (payload) => {
      setGuessItOrderPrompt(null);
      setGuessItStatusMessage({
        teamName: payload.teamName,
        text: `${payload.representativeName} está ingresando el concepto...`,
      });
    };

    nm.onGuessItResult = (payload) => {
      setGuessItOrderPrompt(null);
      setGuessItAnswerPrompt(null);
      setGuessItStatusMessage(null);
      setIsSubmittingGuessIt(false);

      if (payload.correct) {
        scene.soundManager.playCorrectAnswerSound();
        toast.success(`Desafío Adivínalo acertado por ${payload.teamName}! Concepto: "${payload.concept}" (+1 punto)`);
      } else {
        scene.soundManager.playIncorrectAnswerSound();
        toast.error(`Desafío Adivínalo fallido por ${payload.teamName}`);
      }
    };

    nm.onGuessItTimeout = (payload) => {
      scene.soundManager.playTimeoutSound();
      toast.warning(`${payload.teamName}: ${payload.message}`);
      setGuessItOrderPrompt(null);
      setGuessItAnswerPrompt(null);
      setGuessItStatusMessage(null);
      setIsSubmittingGuessIt(false);
    };

    nm.onSharkOptionDrawn = (payload) => {
      const sharkTitle = payload.cardType === 'TIBURON_ROJO' ? 'Tiburón Rojo' : 'Tiburón Azul';
      toast.info(`Carta ${sharkTitle}: ${payload.optionLabel} (${payload.teamName})`);
    };

    nm.onSharkSelectTargetPrompt = (payload) => {
      setSharkSelectTargetPrompt(payload);
      setIsSubmittingSharkTarget(false);
      scene.setActiveCard(payload.cardType);

      if (document.pointerLockElement) {
        document.exitPointerLock();
      }
    };

    nm.onSharkOpportunityRemoved = (payload) => {
      setSharkSelectTargetPrompt(null);
      setIsSubmittingSharkTarget(false);
      if (payload.hadOpportunity) {
        toast.warning(`${payload.actorTeamName} le quitó una oportunidad a ${payload.targetTeamName}`);
      } else {
        toast.info(`${payload.actorTeamName} seleccionó a ${payload.targetTeamName}, pero no contaba con oportunidades`);
      }
    };

    nm.onSharkTimeout = (payload) => {
      scene.soundManager.playTimeoutSound();
      toast.warning(`${payload.teamName}: ${payload.message}`);
      setSharkSelectTargetPrompt(null);
      setIsSubmittingSharkTarget(false);
    };

    nm.onOpportunityEarned = (payload) => {
      toast.success(`${payload.teamName} ha completado el circuito y gano la Oportunidad #${payload.opportunities}!`, {
        duration: 5000,
      });
      scene.setActiveCard('CORONA');
    };

    nm.onMatchFinished = (payload) => {
      toast.info(`Partida finalizada: ${payload.message}`);
    };

    nm.onMatchTerminated = (payload) => {
      toast.error(`Partida cancelada: ${payload.message}`);
      setTimeout(() => navigate('/matches'), 2000);
    };

    nm.onErrorReceived = (msg) => {
      toast.error(msg);
    };

    nm.joinMatch(matchId).catch((err) => {
      console.error('[ERROR] Error al conectar a circo_room:', err);
    });

    return () => {
      nm.leave();
      networkManagerRef.current = null;
      scene.dispose();
      circoSceneRef.current = null;
    };
  }, [matchId, navigate]);

  // Responder pregunta activa
  const handleAnswerQuestion = useCallback(
    (selectedOption: string) => {
      if (!activeQuestion || isSubmittingAnswer || questionTimeRemaining <= 0) return;
      setIsSubmittingAnswer(true);
      networkManagerRef.current?.answerQuestion(activeQuestion.questionId, selectedOption);
    },
    [activeQuestion, isSubmittingAnswer, questionTimeRemaining]
  );

  // Reordenar fragmentos arrastrados (HTML5 Drag & Drop)
  const handleDropFragment = (targetIndex: number) => {
    if (draggedFragmentIndex === null || draggedFragmentIndex === targetIndex) return;
    setOrderedFragments((prev) => {
      const copy = [...prev];
      const [draggedItem] = copy.splice(draggedFragmentIndex, 1);
      copy.splice(targetIndex, 0, draggedItem);
      return copy;
    });
    setDraggedFragmentIndex(null);
  };

  // Mover fragmento arriba o abajo mediante botones accesibles
  const handleMoveFragment = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === orderedFragments.length - 1) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    setOrderedFragments((prev) => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy;
    });
  };

  // Enviar fragmentos ordenados al servidor (Fase 1)
  const handleSubmitGuessItOrder = useCallback(() => {
    if (isSubmittingGuessIt || questionTimeRemaining <= 0 || orderedFragments.length === 0) return;
    setIsSubmittingGuessIt(true);
    networkManagerRef.current?.sendGuessItOrder(orderedFragments);
    setGuessItOrderPrompt(null);
  }, [isSubmittingGuessIt, questionTimeRemaining, orderedFragments]);

  // Enviar concepto de Adivínalo al servidor (Fase 2)
  const handleSubmitGuessItAnswer = useCallback(() => {
    if (isSubmittingGuessIt || questionTimeRemaining <= 0 || !guessItConceptInput.trim()) return;
    setIsSubmittingGuessIt(true);
    networkManagerRef.current?.sendGuessItAnswer(guessItConceptInput.trim());
  }, [isSubmittingGuessIt, questionTimeRemaining, guessItConceptInput]);

  // Enviar seleccion de equipo rival en carta de Tiburon
  const handleSelectSharkTarget = useCallback(
    (targetTeamId: string) => {
      if (isSubmittingSharkTarget || questionTimeRemaining <= 0) return;
      setIsSubmittingSharkTarget(true);
      networkManagerRef.current?.sendSharkTarget(targetTeamId);
      setSharkSelectTargetPrompt(null);
    },
    [isSubmittingSharkTarget, questionTimeRemaining]
  );

  // Girar la ruleta
  const handleSpinRoulette = useCallback(() => {
    if (!isMyTurn || !isMyTeamRepresentative) return;
    networkManagerRef.current?.spinRoulette();
  }, [isMyTurn, isMyTeamRepresentative]);

  // Funciones de control del Editor de Mapas
  const handleToggleEditor = useCallback(() => {
    circoSceneRef.current?.getMapEditor()?.toggleActive();
  }, []);

  const handleSetGizmoMode = useCallback((mode: 'translate' | 'rotate' | 'scale') => {
    setTransformMode(mode);
    circoSceneRef.current?.getMapEditor()?.setMode(mode);
  }, []);

  const handleDuplicateObject = useCallback(() => {
    circoSceneRef.current?.getMapEditor()?.duplicateSelected();
  }, []);

  const handleDeleteObject = useCallback(() => {
    circoSceneRef.current?.getMapEditor()?.deleteSelected();
  }, []);

  const handleAddNewObject = useCallback(() => {
    circoSceneRef.current?.getMapEditor()?.addNewObject(selectedNewModel);
  }, [selectedNewModel]);

  const handleSaveMap = useCallback(async () => {
    const editor = circoSceneRef.current?.getMapEditor();
    if (!editor) return;
    setIsSavingMap(true);
    try {
      const ok = await editor.saveMapToDisk();
      if (ok) {
        toast.success('Mapa del Circo guardado exitosamente en circo-map.json');
      } else {
        toast.error('Error al guardar el mapa en disco.');
      }
    } finally {
      setIsSavingMap(false);
    }
  }, []);

  const handleManualCoordChange = useCallback((axis: 'x' | 'y' | 'z', value: number) => {
    if (!selectedObjectDef) return;
    const current = [...selectedObjectDef.position] as [number, number, number];
    const idx = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
    current[idx] = value;
    circoSceneRef.current?.getMapEditor()?.updateSelectedTransform(current, undefined);
  }, [selectedObjectDef]);

  const handleManualRotChange = useCallback((axis: 'x' | 'y' | 'z', value: number) => {
    if (!selectedObjectDef) return;
    const current = [...selectedObjectDef.rotation] as [number, number, number];
    const idx = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
    current[idx] = value;
    circoSceneRef.current?.getMapEditor()?.updateSelectedTransform(undefined, current);
  }, [selectedObjectDef]);

  const availableModels = circoSceneRef.current?.getMapEditor()?.getAvailableModels() || [
    'Flecha.glb',
    'FichaPlayer_Amarillo.glb',
    'FichaPlayer_AmarilloClaro.glb',
    'FichaPlayer_Azul.glb',
    'FichaPlayer_MoradoClaro.glb',
    'FichaPlayer_Rojo.glb',
    'FichaPlayer_VerdeClaro.glb',
    'CircoBase.glb',
  ];

  // Calculo de equipos ordenados y estado de puestos
  const sortedTeams = useMemo(() => {
    return [...teams].sort((a, b) => b.score - a.score);
  }, [teams]);

  const assignedSeatsCount = useMemo(() => {
    return teams.filter((t) => t.seat > 0).length;
  }, [teams]);

  const totalTeamsCount = useMemo(() => {
    return lobby?.teams?.length || teams.length || 6;
  }, [lobby, teams]);

  const currentTurnTeamName = useMemo(() => {
    const t = teams.find((team) => team.seat === currentTurnSeat);
    return t ? t.name : `Puesto ${currentTurnSeat}`;
  }, [teams, currentTurnSeat]);

  // Mensaje de cabecera en el temporizador
  const timerLabel = useMemo(() => {
    if (phase === 'SELECTING_PODIUMS') {
      return `Esperando puestos: ${assignedSeatsCount}/${totalTeamsCount}`;
    }
    if (phase === 'FINISHED') {
      return 'Partida Finalizada';
    }
    return `Turno: ${currentTurnTeamName}`;
  }, [phase, assignedSeatsCount, totalTeamsCount, currentTurnTeamName]);

  return (
    <div
      ref={gameRootRef}
      className="fixed inset-0 w-screen h-screen overflow-hidden select-none bg-slate-950 font-sans z-50"
    >
      {/* Canvas 3D de Three.js */}
      <div
        ref={canvasContainerRef}
        className="w-full h-full cursor-crosshair"
        onClick={() => {
          if (!document.fullscreenElement) {
            const elem = gameRootRef.current || document.documentElement;
            elem.requestFullscreen().catch(() => {});
          }
          if (!isMenuOpen && !isEditorActive && !activeQuestion) {
            const canvas = canvasContainerRef.current?.querySelector('canvas');
            canvas?.requestPointerLock();
          }
        }}
      />

      <Toaster position="top-right" richColors />

      {/* Pantalla de carga superpuesta mientras se descargan e instancian los GLB */}
      {loadingAssets && (
        <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center p-6 z-50">
          <Card className="w-full max-w-md border-slate-800 bg-slate-900 shadow-2xl">
            <CardHeader className="text-center space-y-2">
              <div className="inline-flex items-center justify-center p-3 bg-amber-500/10 rounded-2xl text-amber-400 mx-auto">
                <Tent className="w-8 h-8 text-amber-400" />
              </div>
              <CardTitle className="text-xl text-slate-100">
                Cargando Isla del Circo
              </CardTitle>
              <p className="text-xs text-slate-400">
                Arena Flotante - Plataforma de Gamificacion
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <Progress value={loadProgress} className="h-2" />
              <div className="flex justify-between text-xs text-slate-400">
                <span className="truncate">{currentAssetLoading}</span>
                <span className="font-mono">{loadProgress}%</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Reticula central */}
      {!loadingAssets && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="relative w-4 h-4 flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 opacity-80" />
          </div>
        </div>
      )}

      {/* Temporizador Superior Central con Fase y Turno */}
      {!loadingAssets && (
        <GameTimerHUD timeRemaining={timeRemaining} label={timerLabel} />
      )}

      {/* Botones de control superior derecho y accion de Gradas */}
      {!loadingAssets && (
        <div className="absolute top-4 right-4 flex items-center gap-2 pointer-events-auto">
          {/* Boton para integrantes del equipo asignado que quieran ir a las gradas */}
          {myTeam && myTeam.seat > 0 && !isMyTeamRepresentative && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => circoSceneRef.current?.teleportToStands()}
              className="bg-slate-900/80 border-slate-700 text-slate-200 hover:bg-slate-800 text-xs gap-1.5"
            >
              <Armchair className="w-3.5 h-3.5 text-amber-400" />
              Ir a las gradas
            </Button>
          )}

          {/* Boton directo para girar ruleta cuando sea el turno del representante */}
          {isMyTurn && isMyTeamRepresentative && (
            <Button
              size="sm"
              onClick={handleSpinRoulette}
              className="bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold gap-1.5 shadow-lg shadow-amber-600/30 animate-pulse"
            >
              <Compass className="w-4 h-4" />
              Girar Ruleta
            </Button>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={openMenu}
            className="bg-slate-900/80 border-slate-700 text-slate-200 hover:bg-slate-800 text-xs gap-1.5"
          >
            Menu (Alt)
          </Button>

          <Button
            size="icon"
            variant="outline"
            onClick={toggleFullscreen}
            className="w-8 h-8 bg-slate-900/80 border-slate-700 text-slate-200 hover:bg-slate-800"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>
        </div>
      )}

      {/* Tabla de posiciones flotante lateral izquierda con iconos de oportunidades */}
      {!loadingAssets && (
        <GameLeaderboardHUD
          stageName="Circo"
          matchName={lobby?.match.name || matchId}
          teams={sortedTeams}
          myTeamId={myTeam?.teamId}
          showEditorButton={import.meta.env.DEV}
          isEditorActive={isEditorActive}
          onToggleEditor={handleToggleEditor}
          onOpenMenu={openMenu}
        />
      )}

      {/* Tarjeta de Pregunta Activa (Esquina superior derecha) */}
      {!loadingAssets && activeQuestion && (
        <div className="absolute top-16 right-4 z-50 w-[420px] max-w-[92vw] pointer-events-auto">
          <Card className="bg-slate-900/95 backdrop-blur-md border-amber-500/50 shadow-2xl text-slate-100">
            <CardHeader className="pb-3 border-b border-slate-800">
              <div className="flex items-center justify-between">
                <Badge className="bg-emerald-600 text-white text-xs px-2.5 py-0.5">
                  <HelpCircle className="w-3.5 h-3.5 mr-1 inline" />
                  Carta Pregunta
                </Badge>
                <div className="flex items-center gap-1.5">
                  <Clock className={`w-3.5 h-3.5 ${questionTimeRemaining <= 10 ? 'text-red-400' : 'text-amber-400'}`} />
                  <span
                    className={`font-mono font-bold text-sm ${
                      questionTimeRemaining <= 10 ? 'text-red-400 animate-pulse' : 'text-amber-300'
                    }`}
                  >
                    {questionTimeRemaining}s
                  </span>
                </div>
              </div>
              <Progress
                value={Math.max(0, (questionTimeRemaining / (activeQuestion.timeSeconds || 30)) * 100)}
                className={`h-1.5 mt-2 ${questionTimeRemaining <= 10 ? 'bg-red-950 [&>div]:bg-red-500' : 'bg-slate-800 [&>div]:bg-amber-400'}`}
              />
              <CardDescription className="text-slate-400 text-xs mt-1">
                Turno de: <strong className="text-slate-200">{activeQuestion.teamName}</strong>
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-3 pt-3">
              <p className="text-xs font-semibold leading-relaxed text-slate-100">
                {activeQuestion.pregunta}
              </p>

              <div className="space-y-2">
                {activeQuestion.opciones.map((opt) => (
                  <Button
                    key={opt.key}
                    variant="outline"
                    size="sm"
                    disabled={
                      !isMyTeamRepresentative ||
                      isSubmittingAnswer ||
                      questionTimeRemaining <= 0 ||
                      currentTurnSeat !== myTeam?.seat
                    }
                    onClick={() => handleAnswerQuestion(opt.key)}
                    className="w-full justify-start items-start text-left h-auto py-2.5 px-3 text-xs border-slate-800 bg-slate-950/60 hover:bg-amber-500/20 hover:border-amber-500/40 text-slate-200 gap-2.5 font-normal whitespace-normal transition-colors"
                  >
                    <span className="font-bold text-amber-400 font-mono uppercase shrink-0 mt-0.5">
                      [{opt.key}]
                    </span>
                    <span className="break-words whitespace-normal flex-1 leading-snug">
                      {opt.texto}
                    </span>
                  </Button>
                ))}
              </div>

              {!isMyTeamRepresentative && (
                <p className="text-[11px] text-center text-slate-400 italic">
                  Esperando respuesta del representante de {activeQuestion.teamName}...
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Panel de Ordenamiento - Fase 1 de Adivinalo */}
      {!loadingAssets && guessItOrderPrompt && (
        <div className="absolute top-16 right-4 z-50 w-[460px] max-w-[92vw] pointer-events-auto">
          <Card className="bg-slate-900/95 backdrop-blur-md border-amber-500/50 shadow-2xl text-slate-100">
            <CardHeader className="pb-3 border-b border-slate-800">
              <div className="flex items-center justify-between">
                <Badge className="bg-amber-600 text-white text-xs px-2.5 py-0.5">
                  <Puzzle className="w-3.5 h-3.5 mr-1 inline" />
                  Carta Adivínalo — Ordenar Pista
                </Badge>
                <div className="flex items-center gap-1.5">
                  <Clock
                    className={`w-3.5 h-3.5 ${
                      questionTimeRemaining <= 15 ? 'text-red-400' : 'text-amber-400'
                    }`}
                  />
                  <span
                    className={`font-mono font-bold text-sm ${
                      questionTimeRemaining <= 15 ? 'text-red-400 animate-pulse' : 'text-amber-300'
                    }`}
                  >
                    {questionTimeRemaining}s
                  </span>
                </div>
              </div>
              <Progress
                value={Math.max(
                  0,
                  (questionTimeRemaining / (guessItOrderPrompt.timeSeconds || 90)) * 100
                )}
                className={`h-1.5 mt-2 ${
                  questionTimeRemaining <= 15
                    ? 'bg-red-950 [&>div]:bg-red-500'
                    : 'bg-slate-800 [&>div]:bg-amber-400'
                }`}
              />
              <CardDescription className="text-slate-400 text-xs mt-1">
                Arrastre o use las flechas para ordenar los fragmentos de la frase y habilitar a su representante.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-3 pt-3">
              <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                {orderedFragments.map((frag, idx) => (
                  <div
                    key={idx}
                    draggable={!isSubmittingGuessIt && questionTimeRemaining > 0}
                    onDragStart={() => setDraggedFragmentIndex(idx)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleDropFragment(idx)}
                    className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-800 bg-slate-950/70 hover:border-amber-500/40 transition-colors cursor-grab active:cursor-grabbing text-xs text-slate-200 select-none"
                  >
                    <GripVertical className="w-4 h-4 text-slate-500 shrink-0" />
                    <span className="font-mono text-[11px] font-bold text-amber-400 shrink-0">
                      #{idx + 1}
                    </span>
                    <span className="flex-1 leading-snug break-words">
                      {frag}
                    </span>
                    <div className="flex flex-col gap-0.5 shrink-0">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        disabled={idx === 0 || isSubmittingGuessIt || questionTimeRemaining <= 0}
                        onClick={() => handleMoveFragment(idx, 'up')}
                        className="h-5 w-5 text-slate-400 hover:text-white hover:bg-slate-800"
                        title="Subir"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        disabled={idx === orderedFragments.length - 1 || isSubmittingGuessIt || questionTimeRemaining <= 0}
                        onClick={() => handleMoveFragment(idx, 'down')}
                        className="h-5 w-5 text-slate-400 hover:text-white hover:bg-slate-800"
                        title="Bajar"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-2">
                <Button
                  onClick={handleSubmitGuessItOrder}
                  disabled={isSubmittingGuessIt || questionTimeRemaining <= 0 || orderedFragments.length === 0}
                  className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs gap-1.5 shadow-md shadow-amber-600/20"
                >
                  <Send className="w-3.5 h-3.5" />
                  Siguiente (Enviar Frase Ordenada)
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Panel de Respuesta - Fase 2 de Adivinalo (Representante en el puesto) */}
      {!loadingAssets && guessItAnswerPrompt && (
        <div className="absolute top-16 right-4 z-50 w-[440px] max-w-[92vw] pointer-events-auto">
          <Card className="bg-slate-900/95 backdrop-blur-md border-amber-500/50 shadow-2xl text-slate-100">
            <CardHeader className="pb-3 border-b border-slate-800">
              <div className="flex items-center justify-between">
                <Badge className="bg-amber-600 text-white text-xs px-2.5 py-0.5">
                  <Puzzle className="w-3.5 h-3.5 mr-1 inline" />
                  Carta Adivínalo — Ingresar Concepto
                </Badge>
                <div className="flex items-center gap-1.5">
                  <Clock
                    className={`w-3.5 h-3.5 ${
                      questionTimeRemaining <= 15 ? 'text-red-400' : 'text-amber-400'
                    }`}
                  />
                  <span
                    className={`font-mono font-bold text-sm ${
                      questionTimeRemaining <= 15 ? 'text-red-400 animate-pulse' : 'text-amber-300'
                    }`}
                  >
                    {questionTimeRemaining}s
                  </span>
                </div>
              </div>
              <Progress
                value={Math.max(
                  0,
                  (questionTimeRemaining / (guessItAnswerPrompt.timeSeconds || 90)) * 100
                )}
                className={`h-1.5 mt-2 ${
                  questionTimeRemaining <= 15
                    ? 'bg-red-950 [&>div]:bg-red-500'
                    : 'bg-slate-800 [&>div]:bg-amber-400'
                }`}
              />
              <CardDescription className="text-slate-400 text-xs mt-1">
                Su compañero ha organizado la pista. Escriba el concepto que corresponde a la definición.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-3.5 pt-3">
              <div className="p-3 rounded-lg border border-amber-500/30 bg-slate-950/80 text-xs leading-relaxed text-amber-200/90 italic">
                "{guessItAnswerPrompt.orderedPhrase}"
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-slate-300">
                  Concepto:
                </label>
                <Input
                  type="text"
                  placeholder="Escriba el concepto (respete mayúsculas y tildes)"
                  value={guessItConceptInput}
                  onChange={(e) => setGuessItConceptInput(e.target.value)}
                  disabled={isSubmittingGuessIt || questionTimeRemaining <= 0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSubmitGuessItAnswer();
                  }}
                  className="bg-slate-950 border-slate-700 text-white placeholder:text-slate-500 text-xs h-9"
                  autoFocus
                />
                <p className="text-[10px] text-slate-400 italic">
                  Atención: La validación es estricta. Respete mayúsculas y tildes.
                </p>
              </div>

              <Button
                onClick={handleSubmitGuessItAnswer}
                disabled={isSubmittingGuessIt || questionTimeRemaining <= 0 || !guessItConceptInput.trim()}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs gap-1.5 shadow-md shadow-emerald-600/20"
              >
                <Send className="w-3.5 h-3.5" />
                Responder Desafío
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Aviso informativo de Adivinalo para los demas jugadores en la sala */}
      {!loadingAssets && !guessItOrderPrompt && !guessItAnswerPrompt && (turnStep === 'GUESS_IT_ORDERING' || turnStep === 'GUESS_IT_ANSWERING') && (
        <div className="absolute top-16 right-4 z-50 w-[380px] max-w-[92vw] pointer-events-auto">
          <Card className="bg-slate-900/95 backdrop-blur-md border-amber-500/40 shadow-xl text-slate-100">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <Badge className="bg-amber-600 text-white text-xs px-2.5 py-0.5">
                  <Puzzle className="w-3.5 h-3.5 mr-1 inline" />
                  Carta Adivínalo
                </Badge>
                <div className="flex items-center gap-1.5">
                  <Clock
                    className={`w-3.5 h-3.5 ${
                      questionTimeRemaining <= 15 ? 'text-red-400' : 'text-amber-400'
                    }`}
                  />
                  <span
                    className={`font-mono font-bold text-sm ${
                      questionTimeRemaining <= 15 ? 'text-red-400 animate-pulse' : 'text-amber-300'
                    }`}
                  >
                    {questionTimeRemaining}s
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-1 pb-3 text-xs text-slate-300">
              {guessItStatusMessage ? (
                <p className="leading-relaxed">
                  <strong className="text-amber-300">{guessItStatusMessage.teamName}:</strong>{' '}
                  {guessItStatusMessage.text}
                </p>
              ) : turnStep === 'GUESS_IT_ORDERING' ? (
                <p className="leading-relaxed">
                  Un compañero del equipo en turno está ordenando los fragmentos de la pista...
                </p>
              ) : (
                <p className="leading-relaxed">
                  El representante en el puesto está ingresando el concepto correspondiente...
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Panel de Seleccion de Equipo Objetivo - Carta Tiburon */}
      {!loadingAssets && sharkSelectTargetPrompt && (
        <div className="absolute top-16 right-4 z-50 w-[460px] max-w-[92vw] pointer-events-auto">
          <Card
            className={`bg-slate-900/95 backdrop-blur-md shadow-2xl text-slate-100 ${
              sharkSelectTargetPrompt.cardType === 'TIBURON_ROJO'
                ? 'border-red-500/50'
                : 'border-cyan-500/50'
            }`}
          >
            <CardHeader className="pb-3 border-b border-slate-800">
              <div className="flex items-center justify-between">
                <Badge
                  className={`text-white text-xs px-2.5 py-0.5 ${
                    sharkSelectTargetPrompt.cardType === 'TIBURON_ROJO'
                      ? 'bg-red-600'
                      : 'bg-cyan-600'
                  }`}
                >
                  <ShieldAlert className="w-3.5 h-3.5 mr-1 inline" />
                  {sharkSelectTargetPrompt.cardType === 'TIBURON_ROJO'
                    ? 'Carta Tiburón Rojo — Eliminar Oportunidad'
                    : 'Carta Tiburón Azul — Eliminar Oportunidad'}
                </Badge>
                <div className="flex items-center gap-1.5">
                  <Clock
                    className={`w-3.5 h-3.5 ${
                      questionTimeRemaining <= 15 ? 'text-red-400' : 'text-cyan-400'
                    }`}
                  />
                  <span
                    className={`font-mono font-bold text-sm ${
                      questionTimeRemaining <= 15 ? 'text-red-400 animate-pulse' : 'text-cyan-300'
                    }`}
                  >
                    {questionTimeRemaining}s
                  </span>
                </div>
              </div>
              <Progress
                value={Math.max(
                  0,
                  (questionTimeRemaining / (sharkSelectTargetPrompt.timeSeconds || 90)) * 100
                )}
                className={`h-1.5 mt-2 ${
                  questionTimeRemaining <= 15
                    ? 'bg-red-950 [&>div]:bg-red-500'
                    : sharkSelectTargetPrompt.cardType === 'TIBURON_ROJO'
                    ? 'bg-slate-800 [&>div]:bg-red-500'
                    : 'bg-slate-800 [&>div]:bg-cyan-500'
                }`}
              />
              <CardTitle className="text-sm font-semibold text-slate-200 mt-2">
                Selecciona un equipo rival
              </CardTitle>
              <CardDescription className="text-xs text-slate-400 mt-1">
                Elige al equipo al que deseas retirarle una oportunidad acumulada:
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-3 pb-3 space-y-2">
              {sharkSelectTargetPrompt.availableTeams.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No hay otros equipos rivales disponibles.</p>
              ) : (
                sharkSelectTargetPrompt.availableTeams.map((target) => (
                  <div
                    key={target.teamId}
                    className="flex items-center justify-between p-3 rounded-lg border border-slate-700/60 bg-slate-800/60 hover:bg-slate-800 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: target.color }}
                      />
                      <div className="truncate">
                        <p className="text-sm font-medium text-slate-100 truncate">{target.name}</p>
                        <p className="text-xs text-slate-400">
                          Oportunidades actuales:{' '}
                          <strong className="text-amber-400">{target.opportunities}</strong>
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="text-xs h-8 flex-shrink-0"
                      disabled={isSubmittingSharkTarget || questionTimeRemaining <= 0}
                      onClick={() => handleSelectSharkTarget(target.teamId)}
                    >
                      Seleccionar
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Banner Informativo para la sala durante Carta Tiburon */}
      {!loadingAssets && !sharkSelectTargetPrompt && turnStep === 'SHARK_SELECTING_TARGET' && (
        <div className="absolute top-16 right-4 z-40 w-[420px] max-w-[90vw] pointer-events-none">
          <Card className="bg-slate-900/90 backdrop-blur-md border-cyan-500/40 shadow-xl text-slate-100">
            <CardHeader className="py-2.5 px-4 border-b border-slate-800">
              <div className="flex items-center justify-between">
                <Badge className="bg-cyan-700 text-white text-xs px-2 py-0.5">
                  <ShieldAlert className="w-3 h-3 mr-1 inline" />
                  Carta Tiburón — En Proceso
                </Badge>
                <div className="flex items-center gap-1.5">
                  <Clock
                    className={`w-3.5 h-3.5 ${
                      questionTimeRemaining <= 15 ? 'text-red-400' : 'text-cyan-400'
                    }`}
                  />
                  <span
                    className={`font-mono font-bold text-xs ${
                      questionTimeRemaining <= 15 ? 'text-red-400 animate-pulse' : 'text-cyan-300'
                    }`}
                  >
                    {questionTimeRemaining}s
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="py-3 px-4">
              <p className="text-xs text-slate-300 leading-relaxed">
                El representante del equipo en turno está decidiendo a qué equipo rival restarle una oportunidad...
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Panel del Editor de Mapas (DEV y F2) */}
      {import.meta.env.DEV && (
        <MapEditorPanel
          isEditorActive={isEditorActive}
          selectedObjectDef={selectedObjectDef}
          transformMode={transformMode}
          selectedNewModel={selectedNewModel}
          availableModels={availableModels}
          isSavingMap={isSavingMap}
          mapFileName="circo-map.json"
          onToggleEditor={handleToggleEditor}
          onSetGizmoMode={handleSetGizmoMode}
          onDeselect={() => circoSceneRef.current?.getMapEditor()?.deselect()}
          onDuplicate={handleDuplicateObject}
          onDelete={handleDeleteObject}
          onAddNew={handleAddNewObject}
          onSaveMap={handleSaveMap}
          onManualCoordChange={handleManualCoordChange}
          onManualRotChange={handleManualRotChange}
          onSelectModelChange={setSelectedNewModel}
        />
      )}

      {/* Controles en barra inferior con aviso de proximidad E */}
      {!loadingAssets && (
        <GameHelpBarHUD nearbyPrompt={nearbyPrompt} showInteractKey={!!nearbyPrompt} interactLabel="Interactuar" />
      )}

      {/* Coordenadas en esquina inferior izquierda */}
      {!loadingAssets && (
        <GameCoordinatesHUD coords={playerCoords} />
      )}

      {/* Dialogo modal de pausa */}
      <Dialog open={isMenuOpen} onOpenChange={setIsMenuOpen}>
        <DialogContent
          container={gameRootRef.current}
          className="bg-slate-900 border-slate-800 text-slate-100 max-w-sm"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              Escenario Circo
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              Partida: {lobby?.match.name || matchId}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-3">
            <Button
              className="w-full bg-amber-600 hover:bg-amber-700 text-white"
              onClick={handleResumeGame}
            >
              Reanudar juego
            </Button>
            <Button
              variant="outline"
              className="w-full border-slate-700 text-slate-300 hover:bg-slate-800"
              onClick={() => {
                circoSceneRef.current?.resetPlayerSpawn();
                toast.info('Posicion restablecida al spawn del circo.');
                handleResumeGame();
              }}
            >
              Restablecer posicion
            </Button>
            <Button
              variant="outline"
              className="w-full border-slate-700 text-slate-300 hover:bg-slate-800"
              onClick={() => {
                circoSceneRef.current?.teleportToStands();
                toast.info('Reubicado en las gradas.');
                handleResumeGame();
              }}
            >
              Ir a las gradas
            </Button>
            <Button
              variant="outline"
              className="w-full border-slate-700 text-slate-300 hover:bg-slate-800"
              onClick={toggleFullscreen}
            >
              {isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
            </Button>
            <Button
              variant="destructive"
              className="w-full gap-2"
              onClick={() => {
                if (document.fullscreenElement) {
                  document.exitFullscreen().catch(() => {});
                }
                navigate('/matches');
              }}
            >
              <LogOut className="w-4 h-4" />
              Salir a salas
            </Button>
          </div>

          <DialogFooter className="text-xs text-slate-500 justify-center">
            Presione Alt para cerrar este menu
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CircoPage;
