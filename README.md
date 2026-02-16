# Penguin's Valentine Adventure 🐧💜

A heartwarming 3D web-based game featuring two penguins finding love in the frozen wilderness. Developed using **Three.js**, this project combines exploration, interactive storytelling, and a fun tobogganing mini-game perfect for Valentine's Day.

![Project Banner]![Uploading Gemini_Generated_Image_4tmuij4tmuij4tmu.png…]
*(Note: Screenshot/banner placeholder based on project assets)*

## 📖 About the Project
Inspired by the viral **"Nihilist Penguin"** meme (famous for the *"but why?"* moment), this project reimagines that solitary walk into the void. 

**The Twist:** What if the penguin didn't leave the colony out of despair, but to find their soulmate? 

This personal hobby project combines that philosophical solitude with a heartwarming Valentine's Day theme. You play as the lone penguin braving the "Lonely Ice," not to meet a dark fate, but to reunite with your love and joyful slide down the snowy slopes together under the Aurora Borealis.

## ✨ Features

- **Immersive 3D Environment**: Explore a beautifully rendered arctic landscape with falling snow, dynamic lighting, and the shimmering Northern Lights.
- **Interactive Storytelling**: The game begins with a 3D storybook interface that sets the scene for the adventure.
- **Two Distinct Gameplay Phases**:
  1.  **Exploration Mode**: Walk through the snow to find your partner.
  2.  **Tobogganing Mode**: A fast-paced sliding mini-game.
- **"Love Wins" Competitive Mode**: 
  -   Two players can control separate penguins (Blue & Pink) simultaneously during the toboggan run.
  -   Compete to collect hearts, but with a twist: the game celebrates unity with a "Love Wins" finale regardless of who collects more!
-   **Dynamic Audio & Visuals**: Includes atmospheric music and particle effects for snow and hearts.

## 🎮 Controls

### Phase 1: Exploration (Walking)
*Find your soulmate in the vast snow.*
-   **W, A, S, D**: Move the Blue Penguin
-   **Mouse Drag**: Rotate the Camera
-   **Mouse Scroll**: Zoom In/Out

### Phase 2: Tobogganing (Sliding)
*Collect 20 hearts together!*

| **Player 1 (Blue Scarf)** 💙 | **Player 2 (Pink Scarf)** 💖 |
| :--- | :--- |
| **A** - Steer Left | **Left Arrow (←)** - Steer Left |
| **D** - Steer Right | **Right Arrow (→)** - Steer Right |

*Note: Controls are independent, allowing for two people to play on the same keyboard!*

## 🛠 Technologies Used

-   **HTML5 & CSS3**: For the UI overlays, storybook animations, and responsive design.
-   **JavaScript (ES6+)**: Core game logic and interaction handling.
-   **Three.js**: The powerful 3D library used for rendering the scene, characters, particles, and physics.

## 🚀 How to Run

1.  **Clone the Repository**:
    ```bash
    git clone https://github.com/importmymind/penguin-valentine-adventure.git
    cd penguin-valentine-adventure
    ```

2.  **Start a Local Server**:
    Due to browser security policies regarding 3D texture loading (CORS), **you cannot simply double-click `index.html`**. You must run it through a local server.
    
    -   **VS Code (Recommended)**: Install the "Live Server" extension, right-click `index.html`, and select "Open with Live Server".
    -   **Python**:
        ```bash
        # Python 3.x
        python -m http.server
        ```
    -   **Node.js**:
        ```bash
        npx serve
        ```

3.  **Open in Browser**:
    Navigate to `http://localhost:5500` (or whatever port your server uses).

## 📂 Project Structure

-   `index.html`: The main entry point containing the game container and UI overlays.
-   `script.js`: Contains the main Three.js logic, game loop, and event listeners.
-   `style.css`: Styles for the intro book, HUD, and ending screens.
-   `assets/`: Stores images and textures (ensure this folder exists with your game assets).

## 💜 Future Improvements

-   Adding more levels to the toboggan run.
-   Enhanced character animations.
-   Mobile touch control support.

---

*Happy Valentine's Day!* 🐧❄️
