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

    // Aggiungi gestione Drag and Drop
    setupDragAndDrop();

    // Event listeners per i controlli
    setupControlEventListeners();
    setupVideoEventListeners();
    setupLoopEventListeners();
}

function setupDragAndDrop() {
    const dropZone = document.body;

    dropZone.addEventListener('dragover', (event) => {
        event.preventDefault();
        event.stopPropagation();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', (event) => {
        event.preventDefault();
        event.stopPropagation();
        dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (event) => {
        event.preventDefault();
        event.stopPropagation();
        dropZone.classList.remove('drag-over');

        const files = event.dataTransfer.files;
        if (files.length > 0) {
            const file = files[0];
            // Assicurati che il file sia un video
            if (file.type.startsWith('video/')) {
                loadVideo(file);
            } else {
                alert('Per favore, trascina un file video valido.');
            }
        }
    });
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
    // Mostra loading
    showLoading('Inizializzazione Tone.js...', 'Preparazione del contesto audio');
    
    let timeoutId;
    try {
        // Timeout di 10 secondi
        timeoutId = setTimeout(() => {
            throw new Error('Timeout: inizializzazione troppo lenta');
        }, 10000);

        // Inizializza Tone.js context se necessario
        updateLoadingText('Avvio contesto audio...', 'Questo può richiedere qualche secondo');
        if (Tone.context.state !== 'running') {
            await Tone.start();
        }

        // Crea il player Tone.js con il video caricato
        updateLoadingText('Creazione player audio...', 'Caricamento del file');
        player = new Tone.Player(videoUrl);
        pitch_shift = new Tone.PitchShift({}).toDestination();

        // Aspetta che Tone.js abbia caricato l'audio
        updateLoadingText('Caricamento audio...', 'Analisi del file in corso');
        await Tone.loaded();
        
        // Connette il player al pitch shifter
        updateLoadingText('Finalizzazione...', 'Connessione dei componenti');
        player.connect(pitch_shift);
        
        clearTimeout(timeoutId);
        
        isToneInitialized = true;
        
        // Nasconde loading
        hideLoading();
        
        // Aggiungi animazione ai controlli
        const controlsSection = document.querySelector('.loop-controls-sidebar');
        controlsSection.classList.add('fade-in');
        
        // Carica le impostazioni salvate
        loadSavedSettings();
        
        console.log('Tone.js inizializzato correttamente');
    } catch (error) {
        clearTimeout(timeoutId);
        console.error('Errore nell\'inizializzazione di Tone.js:', error);
        
        hideLoading();
        
        // Mostra errore dettagliato
        showErrorDialog(error.message);
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

    // Pitch controls
    if (pitchSlider) pitchSlider.addEventListener('input', (e) => updatePitchOutput(e.target.value));
    if (pitchInput) {
        pitchInput.addEventListener('input', (e) => handleTextInputChange(e, 'pitch', -12, 12));
        pitchInput.addEventListener('blur', (e) => validateAndUpdatePitch(e.target.value));
        pitchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') validateAndUpdatePitch(e.target.value);
        });
    }

    // Playback rate controls  
    if (playbackRateSlider) playbackRateSlider.addEventListener('input', (e) => updatePlaybackRateOutput(e.target.value));
    if (playbackRateInput) {
        playbackRateInput.addEventListener('input', (e) => handleTextInputChange(e, 'playback-rate', 10, 300));
        playbackRateInput.addEventListener('blur', (e) => validateAndUpdatePlaybackRate(e.target.value));
        playbackRateInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') validateAndUpdatePlaybackRate(e.target.value);
        });
    }

    // Volume controls
    if (volumeSlider) volumeSlider.addEventListener('input', (e) => updateVolumeOutput(e.target.value));
    if (volumeInput) {
        volumeInput.addEventListener('input', (e) => handleTextInputChange(e, 'volume', 0, 100));
        volumeInput.addEventListener('blur', (e) => validateAndUpdateVolume(e.target.value));
        volumeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') validateAndUpdateVolume(e.target.value);
        });
    }
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

// Funzioni di validazione per input text
function handleTextInputChange(event, type, min, max) {
    const value = event.target.value;
    const numValue = Number(value);
    
    // Rimuovi stili di errore precedenti
    event.target.classList.remove('input-error');
    
    // Se il valore è vuoto, non fare nulla
    if (value === '') return;
    
    // Se non è un numero valido, aggiungi stile di errore
    if (isNaN(numValue)) {
        event.target.classList.add('input-error');
        return;
    }
    
    // Se è fuori range, aggiungi stile di errore
    if (numValue < min || numValue > max) {
        event.target.classList.add('input-error');
        return;
    }
}

function validateAndUpdatePitch(value) {
    const numValue = Number(value);
    const pitchInput = document.getElementById('pitch-input');
    
    if (isNaN(numValue) || value === '') {
        // Ripristina l'ultimo valore valido
        const pitchSlider = document.getElementById('pitch');
        pitchInput.value = pitchSlider.value;
        pitchInput.classList.remove('input-error');
        return;
    }
    
    updatePitchOutput(value);
    pitchInput.classList.remove('input-error');
}

function validateAndUpdatePlaybackRate(value) {
    const numValue = Number(value);
    const playbackRateInput = document.getElementById('playback-rate-input');
    
    if (isNaN(numValue) || value === '') {
        // Ripristina l'ultimo valore valido
        const playbackRateSlider = document.getElementById('playback-rate');
        playbackRateInput.value = playbackRateSlider.value;
        playbackRateInput.classList.remove('input-error');
        return;
    }
    
    updatePlaybackRateOutput(value);
    playbackRateInput.classList.remove('input-error');
}

function validateAndUpdateVolume(value) {
    const numValue = Number(value);
    const volumeInput = document.getElementById('volume-input');
    
    if (isNaN(numValue) || value === '') {
        // Ripristina l'ultimo valore valido
        const volumeSlider = document.getElementById('volume');
        volumeInput.value = volumeSlider.value;
        volumeInput.classList.remove('input-error');
        return;
    }
    
    updateVolumeOutput(value);
    volumeInput.classList.remove('input-error');
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
    const pitchInput = document.getElementById('pitch-input');

    if (pitchRange) pitchRange.value = clampedValue;
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
    const playbackRateInput = document.getElementById('playback-rate-input');

    if (playbackRateRange) playbackRateRange.value = clampedValue;
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
    const volumeInput = document.getElementById('volume-input');

    if (volumeRange) volumeRange.value = clampedValue;
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
    const volumeInput = document.getElementById('volume-input');
    const volumeRange = document.getElementById('volume');
    
    if (volumeInput) volumeInput.value = value;
    if (volumeRange) volumeRange.value = value;
}

function updatePitchDisplay(value) {
    const pitchInput = document.getElementById('pitch-input');
    const pitchRange = document.getElementById('pitch');
    
    if (pitchInput) pitchInput.value = value;
    if (pitchRange) pitchRange.value = value;
}

function updatePlaybackRateDisplay(value) {
    const playbackRateInput = document.getElementById('playback-rate-input');
    const playbackRateRange = document.getElementById('playback-rate');
    
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

// Gestione del loading
function showLoading(mainText, subText) {
    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingText = document.querySelector('.loading-text');
    const loadingSubtext = document.querySelector('.loading-subtext');
    const cancelButton = document.getElementById('loading-cancel');
    
    if (loadingText) loadingText.textContent = mainText;
    if (loadingSubtext) loadingSubtext.textContent = subText;
    if (loadingOverlay) loadingOverlay.style.display = 'flex';
    
    // Gestione del bottone annulla
    if (cancelButton) {
        cancelButton.onclick = () => {
            hideLoading();
            // Reset dello stato
            if (player) {
                player.dispose();
                player = null;
            }
            if (pitch_shift) {
                pitch_shift.dispose();
                pitch_shift = null;
            }
            isToneInitialized = false;
        };
    }
}

function updateLoadingText(mainText, subText) {
    const loadingText = document.querySelector('.loading-text');
    const loadingSubtext = document.querySelector('.loading-subtext');
    
    if (loadingText) loadingText.textContent = mainText;
    if (loadingSubtext) loadingSubtext.textContent = subText;
}

function hideLoading() {
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) loadingOverlay.style.display = 'none';
}

function showErrorDialog(errorMessage) {
    let userMessage = 'Errore nell\'inizializzazione dell\'audio.';
    
    if (errorMessage.includes('Timeout')) {
        userMessage += '\n\nIl caricamento sta impiegando troppo tempo. Possibili cause:\n• File audio troppo grande\n• Connessione lenta\n• Problemi del browser';
    } else if (errorMessage.includes('context')) {
        userMessage += '\n\nProblema con il contesto audio del browser.\nProva a:\n• Ricaricare la pagina\n• Cliccare prima sul video\n• Usare un browser diverso';
    } else if (errorMessage.includes('decode') || errorMessage.includes('format')) {
        userMessage += '\n\nFormato audio non supportato.\nAssicurati che il video contenga audio valido.';
    } else {
        userMessage += `\n\nDettagli tecnici: ${errorMessage}`;
    }
    
    userMessage += '\n\nVuoi riprovare?';
    
    if (confirm(userMessage)) {
        // Riprova automaticamente
        const videoFileInput = document.getElementById('video-file');
        if (videoFileInput.files[0]) {
            setTimeout(() => {
                loadVideo(videoFileInput.files[0]);
            }, 1000);
        }
    }
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