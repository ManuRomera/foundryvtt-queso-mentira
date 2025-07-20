# Queso o Mentira (Liar's Dice)

![Foundry VTT Compatible](https://img.shields.io/badge/Foundry%20VTT-v11%20/%20v12-green)
[![Version](https://img.shields.io/badge/Version-1.3.1-blue)](https://github.com/ManuRomera/foundryvtt-queso-mentira/releases)
[![Manifest](https://img.shields.io/badge/Manifest-URL-orange)](https://github.com/ManuRomera/foundryvtt-queso-mentira/releases/latest/download/module.json)
[![License](https://img.shields.io/badge/License-MIT-lightgrey)](./LICENSE)

**[Versión en Español](./README.md)**

A "Liar's Dice" minigame module for Foundry VTT with a *pulp-military* theme. Perfect for settling character disputes, passing the time in a tavern, or as a fun session activity.

---

## Core Features

* **Complete Liar's Dice Game:** Implements the classic game experience directly within Foundry VTT.
* **Dedicated UI:** Each human player gets their own "Dice Tray" window, which intuitively displays their hand and available actions.
* **Game Master's View:** The GM has a special window that allows them to see all players' hands (including the AI's!) to oversee the game.
* **Multi-level Artificial Intelligence (AI):**
    * **Basic AI:** Plays in a simple, predictable manner.
    * **Expert AI:** Uses probability calculations to make smarter decisions.
    * **Cheater AI:** Watch out! This AI knows everyone's rolls and acts accordingly.
* **Playable GM:** The Game Master can assign an actor to themselves and participate in the game as another player.
* **Customizable Rules:** Tailor the game to your liking from the setup screen:
    * **Starting Dice Count:** Decide how many dice each player begins with.
    * **"1s are Wild" Rule:** Enable or disable whether 1s can count as any other value.
    * **"Palifico" Rule:** Activate a special round with stricter rules when a player is down to their last die.
* **Dynamic Game Start:** The game begins with a 1d20 initiative roll-off among all players to determine who starts.
* **Sound Effects:** Audio feedback for key actions: betting, calling a lie, losing a die, etc.
* **Persistent State:** The game is saved automatically. You can close Foundry and resume later exactly where you left off.

## Installation

### Automatic Installation (Recommended)

1.  In the Foundry VTT setup menu, go to the "Add-on Modules" tab.
2.  Click "Install Module".
3.  In the "Manifest URL" field, copy and paste the following link:
    ```
    [https://github.com/ManuRomera/foundryvtt-queso-mentira/releases/latest/download/module.json](https://github.com/ManuRomera/foundryvtt-queso-mentira/releases/latest/download/module.json)
    ```
4.  Click "Install" and wait for the installation to complete.

### Manual Installation

1.  Download the latest release of the module from the [Releases page](https://github.com/ManuRomera/foundryvtt-queso-mentira/releases).
2.  Unzip the `.zip` file into your `modules` folder within your Foundry data directory.
3.  Restart Foundry VTT.

Finally, remember to enable the module in your game world's settings.

## How to Play

1.  **Start the Game (GM Only):** With at least two actor tokens on the scene, select the "Token" tools (the pawn icon) and click the new cheese icon (🧀) that appears.
2.  **Configure the Game:** A window will open to set up the game.
    * Assign a mode to each actor: **Human**, **Game Master** (for yourself), or one of the **AI** levels.
    * Adjust the optional rules (Starting Dice, Wilds, Palifico).
    * Click "Start Game".
3.  **Initiative Roll:** A 1d20 will be rolled for each participant. The player with the highest result goes first.
4.  **The Game Begins:** Each human player (and the GM, if participating) will receive their own window with their dice. The game proceeds in turns.
5.  **Take an Action:** When it's your turn, your dice tray will enable the action buttons:
    * **Raise:** Increase the bet. It must be a higher bid than the previous one (a higher quantity of the same value, or any quantity of a higher value).
    * **Liar!:** Call the previous player's bet a lie. All dice are revealed to check if the bet was true or not.
    * **Spot On:** A risky move. You claim the previous player's bet is **exactly** correct.

## Game Master (GM) Controls

As the GM, you have several tools to manage the game:

* **Global View:** Your GM dice tray shows you the hidden hands of all players.
* **Play as a Character:** If you assign an actor to yourself, your GM tray will include the action buttons when it's your turn.
* **Administrative Controls:** In the status message that appears in the chat each round, you have two buttons next to each player:
    * **Remove Die (-1):** To penalize a player or manually adjust the game.
    * **End Game:** Forcibly ends the current game for all players.

## Credits

Developed by **Manu Romera**.

This project is made possible by the Foundry VTT community.

## License

This module is distributed under the **MIT License**. See the `LICENSE` file for more details.
