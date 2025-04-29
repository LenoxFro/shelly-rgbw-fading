
// Array of color objects defining RGB values, gain (brightness), and white channel intensity
let colors = [
    { r: 200, g: 0, b: 0, gain: 100, white: 0 },  // Red
    { r: 0, g: 200, b: 0, gain: 100, white: 0 },  // Green
    { r: 0, g: 0, b: 200, gain: 100, white: 0 },  // Blue
];

// Object to store the previous state of the RGBW device before fading starts
let previousState = {
  red: 0,
  green: 0,
  blue: 0,
  white: 0,
  brightness: 0
};

// Variables to control the fading process
let index = 0;               // Current color index in the colors array
let duration = 10000;        // Total duration of one fade cycle in milliseconds
let steps = 25;              // Number of steps in the fade transition
let interval = Math.floor(duration / steps);  // Time interval between each fade step

// Flags and timers to manage fade state and looping
let fadeRunning = false;     // Indicates if fading is currently active
let fadeInProgress = false;  // Indicates if a fade transition is currently running
let loopTimer = null;        // Timer for looping fade cycles
let fadeTimer = null;        // Timer for individual fade steps

// Calculates the intermediate color at a given step between two colors
function getColorStep(from, to, step, total) {
    return {
        r: Math.round(from.r + ((to.r - from.r) * step) / total),
        g: Math.round(from.g + ((to.g - from.g) * step) / total),
        b: Math.round(from.b + ((to.b - from.b) * step) / total),
        gain: to.gain || 100,   // Use target gain or default to 100
        white: to.white || 0    // Use target white or default to 0
    };
}

// Starts fading from the current color to the next color in the array
function fadeToNextColor() {
    if (fadeInProgress) return;  // Prevent overlapping fades

    fadeInProgress = true;

    let from = colors[index];              // Current color
    index = (index + 1) % colors.length;   // Advance to next color cyclically
    let to = colors[index];                // Target color
    let step = 0;

    print("Fading from", JSON.stringify(from), "to", JSON.stringify(to));

    // Set a repeating timer to update the color gradually
    fadeTimer = Timer.set(interval, true, function () {
        let c = getColorStep(from, to, step, steps);

        // Send command to RGBW device to update color and brightness
        Shelly.call("RGBW.Set", {
            id: 0,
            on: true,
            rgb: [c.r, c.g, c.b],
            white: 0,
            brightness: c.gain
        });

        step++;
        if (step > steps) {
            Timer.clear(fadeTimer);  // Stop fade timer when done
            fadeInProgress = false;  // Mark fade as finished
        }
    });
}

// Saves the current RGBW device state to restore later
function saveState() {
    const status = Shelly.getComponentStatus('rgbw:0');
    previousState.rgb        = status.rgb;
    previousState.red        = status.rgb[0];
    previousState.green      = status.rgb[1];
    previousState.blue       = status.rgb[2];
    previousState.white      = status.white;
    previousState.brightness = status.brightness;
}

// Restores the RGBW device to the previously saved state
function restoreState() {
  Shelly.call("RGBW.Set", {
      id: 0,
      on: true,
      rgb: previousState.rgb,
      white: previousState.white,
      brightness: previousState.brightness
  });
}

// Starts the fading loop and saves the current device state
function startFade() {
    saveState();
    fadeRunning = true;
    fadeToNextColor();  // Start first fade immediately
    // Set a timer to repeat fading every duration milliseconds
    loopTimer = Timer.set(duration, true, function () {
        fadeToNextColor();
    });
}

// Stops the fading loop and restores the previous device state
function stopFade() {
    fadeRunning = false;
    fadeInProgress = false;
    if (loopTimer !== null) Timer.clear(loopTimer);
    if (fadeTimer !== null) Timer.clear(fadeTimer);
    restoreState();
}

// Event handler for button presses on inputs 0 and 1
Shelly.addEventHandler(function (event) {
    if (event.component === "input:1" && event.info.event === "single_push") {
        // Toggle fading on input 1 single press
        if (!fadeRunning) {
            startFade();
        } else {
            stopFade();
        }
    } else if (event.component === "input:0" && event.info.event === "single_push") {
        // On input 0 single press, stop fading if running and toggle device on/off
        if (fadeRunning) {
            stopFade();
        }
        Shelly.call("RGBW.Toggle", {
            id: 0
        });
    }
});
