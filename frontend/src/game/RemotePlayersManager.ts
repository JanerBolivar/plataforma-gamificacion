import * as THREE from 'three';
import { RemotePlayerAvatar, RemotePlayerData } from './RemotePlayerAvatar';

/**
 * Gestor centralizado y reutilizable para la creacion, actualizacion,
 * sincronizacion y disposicion de avatares de jugadores remotos en Three.js.
 * Utilizado de manera compartida en los escenarios Pantano y Circo.
 */
export class RemotePlayersManager {
  private scene: THREE.Scene;
  private remoteAvatars: Map<string, RemotePlayerAvatar> = new Map();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /**
   * Agrega o refresca el avatar 3D de un jugador remoto en la escena.
   */
  public addPlayer(sessionId: string, data: RemotePlayerData): void {
    if (this.remoteAvatars.has(sessionId)) {
      this.removePlayer(sessionId);
    }
    const avatar = new RemotePlayerAvatar(data);
    this.scene.add(avatar.group);
    this.remoteAvatars.set(sessionId, avatar);
    console.log(`[INFO] RemotePlayersManager: Avatar registrado para ${data.fullName} (${sessionId})`);
  }

  /**
   * Remueve y destruye los recursos visuales del avatar al desconectarse un jugador.
   */
  public removePlayer(sessionId: string): void {
    const avatar = this.remoteAvatars.get(sessionId);
    if (avatar) {
      avatar.dispose(this.scene);
      this.remoteAvatars.delete(sessionId);
      console.log(`[INFO] RemotePlayersManager: Avatar removido (${sessionId})`);
    }
  }

  /**
   * Actualiza las coordenadas de destino y estado de animacion de un avatar remoto.
   */
  public updatePlayer(
    sessionId: string,
    data: { x: number; y: number; z: number; ry: number; animState?: string }
  ): void {
    const avatar = this.remoteAvatars.get(sessionId);
    if (avatar) {
      avatar.updateData(data);
    }
  }

  /**
   * Ejecuta el ciclo de actualizacion de interpolacion y esqueletos (llamar en animate).
   */
  public update(delta: number): void {
    this.remoteAvatars.forEach((avatar) => {
      avatar.update(delta);
    });
  }

  /**
   * Libera todos los avatares activos y limpia referencias al destruir la escena.
   */
  public dispose(): void {
    this.remoteAvatars.forEach((avatar) => {
      avatar.dispose(this.scene);
    });
    this.remoteAvatars.clear();
  }

  /**
   * Retorna la cantidad de avatares remotos actualmente instanciados.
   */
  public getPlayerCount(): number {
    return this.remoteAvatars.size;
  }

  /**
   * Retorna el mapa completo de avatares remotos.
   */
  public getAvatars(): Map<string, RemotePlayerAvatar> {
    return this.remoteAvatars;
  }
}
