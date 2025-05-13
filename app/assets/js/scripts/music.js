const fs = require("fs");
const path = require("path");

const musicFolder = path.join(__dirname, "assets", "musics");

let lastTrackPath = null;

// Sélectionne un fichier mp3 aléatoire différent du précédent
function getRandomTrack() {
  const files = fs
    .readdirSync(musicFolder)
    .filter((file) => file.endsWith(".mp3"));
  if (files.length === 0) return null;

  // Filtrer l'ancien
  let choices = files.map((file) => path.join(musicFolder, file));
  if (lastTrackPath && choices.length > 1) {
    choices = choices.filter((file) => file !== lastTrackPath);
  }

  const randomFile = choices[Math.floor(Math.random() * choices.length)];
  return randomFile;
}

// Joue une piste audio aléatoire
function playRandomTrack(audioElement) {
  const trackPath = getRandomTrack();
  if (trackPath) {
    lastTrackPath = trackPath;
    audioElement.src = `file://${trackPath}`;
    audioElement.play().catch((err) => {
      console.error("Erreur de lecture audio :", err);
    });
  } else {
    console.warn("Aucune piste audio trouvée.");
  }
}

// Attendre que le DOM soit prêt
window.addEventListener("DOMContentLoaded", () => {
  const audioElement = document.getElementById("audio-player");

  if (!audioElement) {
    console.error("Élément audio introuvable !");
    return;
  }

  // Lecture initiale
  playRandomTrack(audioElement);

  // Lecture suivante à la fin de la piste
  audioElement.addEventListener("ended", () => {
    playRandomTrack(audioElement);
  });
});
