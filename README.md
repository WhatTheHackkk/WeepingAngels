<div align="center">

# 🪦 WEEPING ANGELS: THE FINAL GAZE 🪦
### *Project 27 // Enterprise-Grade 3D Survival Horror Architecture*

[![GitHub Release](https://img.shields.io/badge/Release-v1.0.0--RC-red?style=flat-square&logo=github)](https://github.com/WhatTheHackkk/WeepingAngels)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Engine: Three.js](https://img.shields.io/badge/Engine-Three.js%20r128-blue?style=flat-square&logo=three.js)](https://threejs.org/)
[![Status: Containment Breached](https://img.shields.io/badge/Containment-Breached-darkred?style=flat-square)](https://github.com/WhatTheHackkk/WeepingAngels)

*“Blink and you’re dead. Don’t look away. Don’t even blink. The stone breathes when the lights die.”*

</div>

---

## 📋 Table of Contents
1. [Project Overview](#-project-overview)
2. [Project 27 // Lore & Containment Directive](#-project-27--lore--containment-directive)
3. [System Architecture & Core Mechanics](#-system-architecture--core-mechanics)
4. [Audio Pipeline & Visual Asset Suite](#-audio-pipeline--visual-asset-suite)
5. [Installation & Local Deployment](#-installation--local-deployment)
6. [Gameplay Progression Flow](#-gameplay-progression-flow)
7. [Psychological Debriefing & Victory Protocol](#-psychological-debriefing--victory-protocol)
8. [Contributors & Acknowledgments](#-contributors--acknowledgments)

---

## 👁️ Project Overview

**Weeping Angels: The Final Gaze** is a high-fidelity, enterprise-grade 3D survival horror experience developed under strict **Project 27** protocols. Built utilizing modern web graphics pipelines (`Three.js`, WebGL, and custom procedural math generators), the engine drops players into an algorithmically generated 10x10 concrete labyrinth swarming with multi-entity quantum-locked predators.

The core design philosophy is absolute psychological tension: survival is entirely dependent on line-of-sight tracking, spatial awareness, and resource management under total darkness.

---

## 🏛️ Project 27 // Lore & Containment Directive

> *"Subject designates multiple humanoid stone entities exhibiting anomalous quantum-locking properties when subjected to direct optical observation. In unobserved states, velocity exceeds standard human kinetic limits. Casualties among containment personnel are 100% correlated with optical fatigue and blink intervals."*

### Classified Briefing Dossier:
* **The Labyrinth:** A sprawling 10x10 concrete containment grid featuring randomized dead-ends, monolithic walls, and dense ground-level rolling fog.
* **The Threat:** Multi-entity stone demons hunting the operative. They freeze instantly when illuminated by the player's flashlight view but hunt relentlessly when unobserved or outside the 12-meter threat radius.
* **The Objective:** Navigate the claustrophobic corridors, bypass corner-occlusion blind spots, and locate **3 Violet Security Keycards** securely dispersed across the furthest sectors of the maze.
* **The Extraction:** Once all keycards are verified, locate and breach the randomized extraction portal to trigger absolute AI quantum-freezing and escape the sector—*for now*.

---

## ⚙️ System Architecture & Core Mechanics

* **Procedural 10x10 Maze Generation (`mazeGenerator.ts`):** 
  * Generates a mathematically unique labyrinth layout on every round initiation using advanced cell-traversal algorithms.
  * Ensures structural complexity with hidden alcoves, monolithic dead-ends, and dynamic lighting nodes.
* **Furthest-Point Keycard Dispersion:** 
  * Rather than clustering items near spawn points, the item placement engine calculates absolute Euclidean distances, forcing operators deep into hostile sectors to retrieve all 3 Violet Keycards.
* **Multi-Entity Angel AI Engine (`weepingAngel.ts`):** 
  * Implements rigorous raycasting and frustum checks to govern quantum-state transitions (movement vs. stone statue paralysis).
  * Features a 12-meter unobserved aggro tracking radius and corner-occlusion behavior models.
* **Cinematic Screen & State Manager:** 
  * Manages zero-latency transitions across 5 distinct execution phases: Studio Intro (`PROJECT 27 PRESENTS...`), Gothic Video Menu (`IntroPage.mp4`), Briefing Terminal, 3D Game Canvas, and the Horror Victory Overlay.

---

## 🎵 Audio Pipeline & Visual Asset Suite

The audio-visual architecture is engineered to deliver suffocating psychological immersion:
* **Studio Intro & Menu Soundscape:** Low, vibrating industrial drone transitioning into eerie ambient background sound loops (`menu-ambient.mp3`).
* **In-Game Soundscape:** Spatialized footstep cues on wet stone, distant grinding granite blocks, and atmospheric cavernous echoes.
* **Transition Plate (`IntroPage.mp4`):** A cinematic, single-take overhead drone descent shifting seamlessly from a high aerial view of the gothic labyrinth down into the interior hallways.

---

## 🚀 Installation & Local Deployment

To spin up the containment grid locally on your machine, follow these steps:

### Prerequisites
* [Node.js](https://nodejs.org/) (v18.x or higher recommended)
* [Bun](https://bun.sh/) or npm package manager

### Step-by-Step Setup
1. **Clone the Repository:**
   ```bash
   git clone [https://github.com/WhatTheHackkk/WeepingAngels.git](https://github.com/WhatTheHackkk/WeepingAngels.git)
   cd WeepingAngels/weeping-angels
