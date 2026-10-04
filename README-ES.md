# Queso o Mentira

<p align="center">
  <a href="https://github.com/ManuRomera/foundryvtt-queso-mentira/releases/latest"><img alt="Latest release" src="https://img.shields.io/github/v/release/ManuRomera/foundryvtt-queso-mentira?include_prereleases&style=for-the-badge&color=c9962b&label=release"></a>
  <a href="https://foundryvtt.com"><img alt="Foundry VTT V11 – V12" src="https://img.shields.io/badge/Foundry%20VTT-V11%20%E2%80%93%20V12-57d8c8?style=for-the-badge"></a>
  <img alt="System" src="https://img.shields.io/badge/system-agnostic-2b3245?style=for-the-badge">
</p>

**[English Version](./README_EN.md)**

Un minijuego de dados para Foundry VTT estilo "Liar's Dice" (también conocido como Mentiroso, Perudo o Dudo) con una temática *pulp-militar*. Ideal para resolver disputas entre personajes, pasar el tiempo en una taberna o como una divertida actividad de sesión.

---

## Características Principales

* **Juego de Dados del Mentiroso Completo:** Implementa la experiencia clásica del juego directamente en Foundry VTT.
* **Interfaz Dedicada:** Cada jugador humano recibe su propia "Bandeja de Dados" que le muestra su mano y le permite realizar sus acciones de forma intuitiva.
* **Vista de Director de Juego (GM):** El GM tiene una ventana especial que le permite ver las manos de todos los jugadores (¡incluidas las de la IA!) para supervisar la partida.
* **Inteligencia Artificial (IA) con Múltiples Dificultades:**
    * **IA Básica:** Juega de forma simple y predecible.
    * **IA Experta:** Utiliza cálculos de probabilidad para tomar decisiones más astutas.
    * **IA Tramposa:** ¡Cuidado! Esta IA conoce las tiradas de todos y actúa en consecuencia.
* **El GM puede Jugar:** El Director de Juego puede asignarse uno de los actores y participar en la partida como un jugador más.
* **Reglas Personalizables:** Adapta la partida a tu gusto desde la pantalla de configuración:
    * **Número de Dados Iniciales:** Decide con cuántos dados empieza cada jugador.
    * **Regla de "1 como Comodín":** Activa o desactiva si los 1s pueden contar como cualquier otro valor.
    * **Regla "Palifico":** Activa una ronda especial con reglas más estrictas cuando a un jugador le queda un solo dado.
* **Inicio de Partida Dinámico:** La partida comienza con una tirada de iniciativa (1d20) entre todos los jugadores para decidir quién empieza.
* **Efectos de Sonido:** Feedback sonoro para las acciones más importantes: apostar, dudar, perder un dado, etc.
* **Persistencia de Estado:** La partida se guarda automáticamente. Puedes cerrar Foundry y reanudarla más tarde exactamente donde la dejaste.

## Instalación

### Instalación Automática (Recomendada)

1.  En el menú de configuración de Foundry VTT, ve a la pestaña "Add-on Modules".
2.  Haz clic en "Install Module".
3.  En el campo "Manifest URL", copia y pega el siguiente enlace:
    ```
    [https://github.com/ManuRomera/foundryvtt-queso-mentira/releases/latest/download/module.json](https://github.com/ManuRomera/foundryvtt-queso-mentira/releases/latest/download/module.json)
    ```
4.  Haz clic en "Install" y espera a que la instalación finalice.

### Instalación Manual

1.  Descarga la última versión del módulo desde la [página de Releases](https://github.com/ManuRomera/foundryvtt-queso-mentira/releases).
2.  Descomprime el archivo `.zip` en tu carpeta de `modules` dentro de tu directorio de datos de Foundry.
3.  Reinicia Foundry VTT.

Finalmente, no te olvides de activar el módulo en la configuración de tu mundo de juego.

## Cómo Jugar

1.  **Iniciar la Partida (Solo GM):** Con al menos dos tokens de actor en la escena, selecciona la herramienta de "Tokens" (el icono del peón) y haz clic en el nuevo icono con forma de queso (🧀) que aparecerá.
2.  **Configurar la Partida:** Se abrirá una ventana para configurar la partida.
    * Asigna un modo a cada actor: **Humano**, **Director de Juego** (para ti), o uno de los niveles de **IA**.
    * Ajusta las reglas opcionales (Dados iniciales, Comodines, Palifico).
    * Haz clic en "Iniciar Partida".
3.  **Tirada de Iniciativa:** Se realizará una tirada de 1d20 por cada participante. El que saque el resultado más alto, empieza.
4.  **Comienza el Juego:** Cada jugador humano (y el GM, si participa) recibirá su propia ventana con sus dados. La partida transcurre por turnos.
5.  **Realizar una Acción:** Cuando sea tu turno, tu bandeja de dados activará los botones de acción:
    * **Subir:** Aumenta la apuesta. Debe ser una apuesta mayor que la anterior (más cantidad del mismo valor, o cualquier cantidad de un valor superior).
    * **¡Mentira!:** Duda de la apuesta del jugador anterior. Todos revelan sus dados para comprobar si la apuesta era cierta o no.
    * **Calzar:** Una jugada arriesgada. Dices que la apuesta del jugador anterior es **exactamente** correcta.

## Controles del Game Master (GM)

Como GM, tienes varias herramientas para gestionar la partida:

* **Vista Global:** Tu bandeja de dados te muestra las manos ocultas de todos los jugadores.
* **Jugar como un Personaje:** Si te asignas un actor, tu bandeja de GM incluirá los botones de acción cuando sea tu turno.
* **Controles Administrativos:** En el mensaje de estado que aparece en el chat en cada ronda, tienes dos botones junto a cada jugador:
    * **Quitar un dado (-1):** Para penalizar a un jugador o ajustar la partida manualmente.
    * **Finalizar Partida:** Termina la partida en curso para todos los jugadores.

## Créditos

Desarrollado por **Manu Romera**.

Este proyecto es posible gracias a la comunidad de Foundry VTT.

## Licencia

Este módulo se distribuye bajo la **Licencia MIT**. Ver el archivo `LICENSE` para más detalles.
