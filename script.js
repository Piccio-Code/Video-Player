// Variabili globali
const music = document.getElementById("music");
const videoFileInput = document.getElementById("video-file");
const controls = document.getElementById("controls");

let player = null;
let pitch_shift = null;
let isVideoLoaded = false;
let isToneInitialized = false;

// Inizializzazione quando il DOM è caricato
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
    setupFileUpload();
});

function initializeEventListeners() {
    // Gestisce la selezione del file video
    videoFileInput.addEventListener('change', function(event) {
        const file = event.target.files[0];
        if (file) {
            loadVideo(file);
        }
    });

    // Event listeners per i controlli
    setupControlEventListeners();
    setupVideoEventListeners();
    setupLoopEventListeners();
}

function loadVideo(file) {
    // Reset dello stato precedente
    if (player) {
        player.dispose();
        player = null;
    }
    if (pitch_shift) {
        pitch_shift.dispose();
        pitch_shift = null;
    }
    isVideoLoaded = false;
    isToneInitialized = false;
    
    // Resetta il video per il nuovo caricamento
    // (i controlli e video sono già visibili dal CSS)

    // Crea URL per il file selezionato
    const videoUrl = URL.createObjectURL(file);
    music.src = videoUrl;
    
    // Aggiungi animazione di caricamento
    const videoSection = document.querySelector('.video-section');
    videoSection.classList.add('fade-in');
    
    // Aspetta che il video sia caricato prima di inizializzare Tone.js
    music.addEventListener('loadeddata', function() {
        isVideoLoaded = true;
        initializeTone(videoUrl);
    }, { once: true });

    music.addEventListener('error', function() {
        alert('Errore nel caricamento del video. Assicurati che il file sia un video valido.');
        // Il video rimane visibile anche in caso di errore
    });
}

async function initializeTone(videoUrl) {
    try {
        // Inizializza Tone.js context se necessario
        if (Tone.context.state !== 'running') {
            await Tone.start();
        }

        // Crea il player Tone.js con il video caricato
        player = new Tone.Player(videoUrl);
        pitch_shift = new Tone.PitchShift({}).toDestination();

        // Aspetta che Tone.js abbia caricato l'audio
        await Tone.loaded();
        
        // Connette il player al pitch shifter
        player.connect(pitch_shift);
        
        isToneInitialized = true;
        
        // Aggiungi animazione ai controlli
        const controlsSection = document.querySelector('.controls-section');
        controlsSection.classList.add('fade-in');
        
        // Carica le impostazioni salvate
        loadSavedSettings();
        
        console.log('Tone.js inizializzato correttamente');
    } catch (error) {
        console.error('Errore nell\'inizializzazione di Tone.js:', error);
        alert('Errore nell\'inizializzazione dell\'audio. Riprova.');
    }
}

function setupVideoEventListeners() {
    music.addEventListener('play', () => {
        if (isToneInitialized && player) {
            player.start(0, music.currentTime);
        }
    });

    music.addEventListener('pause', () => {
        if (player) {
            player.stop();
        }
    });

    music.addEventListener('timeupdate', () => {
        handleLoopLogic();
    });

    // Forza il video a rimanere sempre mutato per evitare audio doppio
    music.addEventListener('volumechange', () => {
        if (!music.muted) {
            music.muted = true;
        }
    });

    // Assicurati che sia mutato al caricamento
    music.muted = true;
}

function setupControlEventListeners() {
    // Event listeners per i controlli slider e input
    const pitchSlider = document.getElementById('pitch');
    const pitchInput = document.getElementById('pitch-input');
    const playbackRateSlider = document.getElementById('playback-rate');
    const playbackRateInput = document.getElementById('playback-rate-input');
    const volumeSlider = document.getElementById('volume');
    const volumeInput = document.getElementById('volume-input');

    if (pitchSlider) pitchSlider.addEventListener('input', (e) => updatePitchOutput(e.target.value));
    if (pitchInput) pitchInput.addEventListener('input', (e) => updatePitchOutput(e.target.value));
    if (playbackRateSlider) playbackRateSlider.addEventListener('input', (e) => updatePlaybackRateOutput(e.target.value));
    if (playbackRateInput) playbackRateInput.addEventListener('input', (e) => updatePlaybackRateOutput(e.target.value));
    if (volumeSlider) volumeSlider.addEventListener('input', (e) => updateVolumeOutput(e.target.value));
    if (volumeInput) volumeInput.addEventListener('input', (e) => updateVolumeOutput(e.target.value));
}

function setupLoopEventListeners() {
    const startTimeInput = document.getElementById('start-time-input');
    const stopTimeInput = document.getElementById('stop-time-input');
    const startButton = document.getElementById('start');
    const stopButton = document.getElementById('stop');
    const resetButton = document.getElementById('reset');

    if (startTimeInput) {
        startTimeInput.addEventListener('input', function() {
            validateTimes();
            const time = parseTimeInput(this.value);
            if (time !== null && validateTimes()) {
                music.currentTime = time;
                startButton.dataset.startValue = time;
                document.getElementById('start-value').innerHTML = formatTime(time);
            }
        });
    }

    if (stopTimeInput) {
        stopTimeInput.addEventListener('input', function() {
            validateTimes();
            const time = parseTimeInput(this.value);
            if (time !== null && validateTimes()) {
                stopButton.dataset.stopValue = time;
                document.getElementById('stop-value').innerHTML = formatTime(time);
            }
        });
    }

    if (startButton) {
        startButton.addEventListener('click', function() {
            this.dataset.startValue = music.currentTime;
            document.getElementById('start-value').innerHTML = formatTime(this.dataset.startValue);
        });
    }

    if (stopButton) {
        stopButton.addEventListener('click', function() {
            this.dataset.stopValue = music.currentTime;
            document.getElementById('stop-value').innerHTML = formatTime(this.dataset.stopValue);
        });
    }

    if (resetButton) {
        resetButton.addEventListener('click', function() {
            resetLoop();
        });
    }
}

// Funzioni di utilità per il parsing e formattazione del tempo
function parseTimeInput(input) {
    if (!input) return null;
    
    input = input.trim();
    
    if (/^\d+$/.test(input)) {
        return parseInt(input);
    }
    
    if (input.includes(':')) {
        const parts = input.split(':').map(p => parseInt(p) || 0);
        if (parts.length === 2) {
            return parts[0] * 60 + parts[1];
        } else if (parts.length === 3) {
            return parts[0] * 3600 + parts[1] * 60 + parts[2];
        }
    }
    
    return null;
}

function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
        return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
}

function validateTimes() {
    const startInput = document.getElementById('start-time-input');
    const stopInput = document.getElementById('stop-time-input');
    const startError = document.getElementById('start-error');
    const stopError = document.getElementById('stop-error');

    const startTime = parseTimeInput(startInput.value);
    const stopTime = parseTimeInput(stopInput.value);

    // Reset errors
    startError.style.display = 'none';
    stopError.style.display = 'none';

    let isValid = true;

    if (startInput.value && startTime === null) {
        startError.style.display = 'block';
        isValid = false;
    }

    if (stopInput.value && stopTime === null) {
        stopError.style.display = 'block';
        isValid = false;
    }

    if (startTime !== null && stopTime !== null && startTime >= stopTime) {
        stopError.style.display = 'block';
        isValid = false;
    }

    return isValid;
}

// Funzioni per l'aggiornamento dei controlli
function updatePitchOutput(value) {
    if (!isToneInitialized || !pitch_shift) return;
    
    const parsedValue = Number(value);
    if (isNaN(parsedValue)) {
        return;
    }
    const clampedValue = Math.max(-12, Math.min(parsedValue, 12));

    const pitchRange = document.getElementById('pitch');
    const pitchOutput = document.getElementById('pitch-output');
    const pitchInput = document.getElementById('pitch-input');

    if (pitchRange) pitchRange.value = clampedValue;
    if (pitchOutput) pitchOutput.textContent = clampedValue;
    if (pitchInput) pitchInput.value = clampedValue;
    
    pitch_shift.pitch = clampedValue;
    localStorage.setItem('pitch', clampedValue);
}

function updatePlaybackRateOutput(value) {
    const parsedValue = Number(value);
    if (isNaN(parsedValue)) {
        return;
    }

    const clampedValue = Math.max(10, Math.min(parsedValue, 300));
    music.playbackRate = clampedValue / 100;

    const playbackRateRange = document.getElementById('playback-rate');
    const playbackRateOutput = document.getElementById('playback-rate-output');
    const playbackRateInput = document.getElementById('playback-rate-input');

    if (playbackRateRange) playbackRateRange.value = clampedValue;
    if (playbackRateOutput) playbackRateOutput.textContent = clampedValue;
    if (playbackRateInput) playbackRateInput.value = clampedValue;
    
    if (isToneInitialized && player) {
        player.playbackRate = clampedValue / 100;
    }

    localStorage.setItem('playback-rate', clampedValue);
}

function updateVolumeOutput(value) {
    if (!isToneInitialized || !player) return;
    
    const parsedValue = Number(value);
    if (isNaN(parsedValue)) {
        return;
    }
    const clampedValue = Math.max(0, Math.min(parsedValue, 100));

    const volumeRange = document.getElementById('volume');
    const volumeOutput = document.getElementById('volume-output');
    const volumeInput = document.getElementById('volume-input');

    if (volumeRange) volumeRange.value = clampedValue;
    if (volumeOutput) volumeOutput.textContent = clampedValue;
    if (volumeInput) volumeInput.value = clampedValue;
    
    player.volume.value = clampedValue - 100;
    localStorage.setItem('volume', clampedValue - 100);
}

// Gestione delle impostazioni salvate
function loadSavedSettings() {
    if (!isToneInitialized || !player || !pitch_shift) return;
    
    // Carica volume
    const volumeLocal = localStorage.getItem('volume');
    if (volumeLocal) {
        const volumeValue = 100 + Number(volumeLocal);
        player.volume.value = volumeLocal;
        updateVolumeDisplay(volumeValue);
    }

    // Carica pitch
    const pitch = localStorage.getItem('pitch');
    if (pitch) {
        pitch_shift.pitch = pitch;
        updatePitchDisplay(pitch);
    }
    
    // Carica playback rate
    const playbackRate = localStorage.getItem('playback-rate');
    if (playbackRate) {
        player.playbackRate = playbackRate / 100;
        music.playbackRate = playbackRate / 100;
        updatePlaybackRateDisplay(playbackRate);
    }
}

function updateVolumeDisplay(value) {
    const volumeOutput = document.getElementById('volume-output');
    const volumeInput = document.getElementById('volume-input');
    const volumeRange = document.getElementById('volume');
    
    if (volumeOutput) volumeOutput.textContent = value;
    if (volumeInput) volumeInput.value = value;
    if (volumeRange) volumeRange.value = value;
}

function updatePitchDisplay(value) {
    const pitchOutput = document.getElementById('pitch-output');
    const pitchInput = document.getElementById('pitch-input');
    const pitchRange = document.getElementById('pitch');
    
    if (pitchOutput) pitchOutput.textContent = value;
    if (pitchInput) pitchInput.value = value;
    if (pitchRange) pitchRange.value = value;
}

function updatePlaybackRateDisplay(value) {
    const playbackRateOutput = document.getElementById('playback-rate-output');
    const playbackRateInput = document.getElementById('playback-rate-input');
    const playbackRateRange = document.getElementById('playback-rate');
    
    if (playbackRateOutput) playbackRateOutput.textContent = value;
    if (playbackRateInput) playbackRateInput.value = value;
    if (playbackRateRange) playbackRateRange.value = value;
}

// Gestione del loop
function handleLoopLogic() {
    const startButton = document.getElementById('start');
    const stopButton = document.getElementById('stop');
    
    if (startButton && stopButton && startButton.dataset.startValue && stopButton.dataset.stopValue) {
        if (music.currentTime > stopButton.dataset.stopValue || music.currentTime < startButton.dataset.startValue) {
            music.currentTime = startButton.dataset.startValue;
            if (isToneInitialized && player) {
                player.start(0, music.currentTime);
            }
        }
    }
}

function resetLoop() {
    const startButton = document.getElementById('start');
    const stopButton = document.getElementById('stop');
    const startValue = document.getElementById('start-value');
    const stopValue = document.getElementById('stop-value');
    const startTimeInput = document.getElementById('start-time-input');
    const stopTimeInput = document.getElementById('stop-time-input');
    
    if (startButton) startButton.dataset.startValue = '';
    if (stopButton) stopButton.dataset.stopValue = '';
    if (startValue) startValue.innerHTML = '--:--';
    if (stopValue) stopValue.innerHTML = '--:--';
    if (startTimeInput) startTimeInput.value = '';
    if (stopTimeInput) stopTimeInput.value = '';
    
    validateTimes();
}

// Gestione del file upload personalizzato
function setupFileUpload() {
    const fileButton = document.querySelector('.file-button');
    const fileInput = document.getElementById('video-file');
    
    if (fileButton && fileInput) {
        fileButton.addEventListener('click', () => {
            fileInput.click();
        });
    }
} 