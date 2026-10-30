let records = [];
let nextId = 1;

const $ = id => document.getElementById(id);

const tableBody = $("trafficTableBody");
const searchInput = $("searchInput");
const congestionFilter = $("congestionFilter");
const recordModal = $("recordModal");
const trafficForm = $("trafficForm");

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[character]);
}

function formatNumber(number) {
    return Number(number).toLocaleString("en-IN");
}

// Load records from MySQL through the Node.js API.
async function loadRecords() {
    try {
        const response = await fetch("/api/roads");

        if (!response.ok) {
            throw new Error("Unable to fetch traffic records");
        }

        const rows = await response.json();

        records = rows.map(row => ({
            id: Number(row.id),
            road: row.road_name,
            location: row.location,
            vehicles: Number(row.vehicle_count),
            congestion: row.congestion,
            incident: row.incident || "None",
            updated: row.updated_at
                ? new Date(row.updated_at).toLocaleTimeString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: true
                })
                : "-"
        }));

        nextId = records.length
            ? Math.max(...records.map(record => record.id)) + 1
            : 1;

        renderDashboard();
    } catch (error) {
        console.error("Error loading records:", error);
        showToast("Unable to load database records.");
    }
}

function getFilteredRecords() {
    const query = searchInput.value.trim().toLowerCase();
    const level = congestionFilter.value;

    return records.filter(record => {
        const matchesSearch =
            record.road.toLowerCase().includes(query) ||
            record.location.toLowerCase().includes(query);

        const matchesLevel =
            level === "all" || record.congestion === level;

        return matchesSearch && matchesLevel;
    });
}

function renderStats() {
    const uniqueRoads = new Set(
        records.map(record => record.road.toLowerCase())
    );

    $("totalRoads").textContent = uniqueRoads.size;

    $("highCongestion").textContent = records.filter(
        record => record.congestion === "High"
    ).length;

    const vehicles = records.reduce(
        (total, record) => total + record.vehicles, 0
    );

    $("totalVehicles").textContent = formatNumber(vehicles);

    $("totalIncidents").textContent = records.filter(
        record => record.incident !== "None"
    ).length;
}

function renderTable() {
    const filtered = getFilteredRecords();

    $("recordCount").textContent =
        `${filtered.length} record${filtered.length === 1 ? "" : "s"}`;

    if (filtered.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-row">
                    No traffic records found.
                </td>
            </tr>`;
        return;
    }

    tableBody.innerHTML = filtered.map(record => {
        const level = record.congestion.toLowerCase();

        const levelClass = level === "low"
            ? "level-low"
            : level === "medium"
                ? "level-medium"
                : "level-high";

        const incidentClass = record.incident === "None"
            ? "incident-none"
            : "incident-active";

        return `
            <tr>
                <td>
                    <span class="road-name">
                        ${escapeHTML(record.road)}
                    </span>
                    <span class="road-location">
                        ${escapeHTML(record.location)}
                    </span>
                </td>

                <td class="vehicle-count">
                    ${formatNumber(record.vehicles)}
                </td>

                <td>
                    <span class="level ${levelClass}">
                        ${escapeHTML(record.congestion)}
                    </span>
                </td>

                <td>
                    <span class="${incidentClass}">
                        ${escapeHTML(record.incident)}
                    </span>
                </td>

                <td>${escapeHTML(record.updated)}</td>

                <td>
                    <button class="delete-button"
                            data-delete-id="${record.id}"
                            aria-label="Delete ${escapeHTML(record.road)} record">
                        Delete
                    </button>
                </td>
            </tr>`;
    }).join("");
}

function renderChart() {
    const levels = ["Low", "Medium", "High"];

    const colors = {
        Low: "low-bar",
        Medium: "medium-bar",
        High: "high-bar"
    };

    const counts = levels.map(level =>
        records.filter(record => record.congestion === level).length
    );

    const maxCount = Math.max(1, ...counts);

    $("congestionChart").innerHTML = levels.map((level, index) => {
        const count = counts[index];
        const height = count === 0
            ? 2
            : Math.max(8, count / maxCount * 100);

        return `
            <div class="chart-column">
                <span class="chart-value">${count}</span>
                <div class="chart-bar ${colors[level]}"
                     style="height: ${height}%"
                     title="${level}: ${count} records"></div>
                <span class="chart-label">${level}</span>
            </div>`;
    }).join("");

    const total = records.length;

    $("distribution").innerHTML = levels.map(level => {
        const count = records.filter(
            record => record.congestion === level
        ).length;

        const percentage = total === 0
            ? 0
            : Math.round(count / total * 100);

        return `
            <div class="distribution-row">
                <div class="distribution-label">
                    <span>${level} congestion</span>
                    <strong>${percentage}% (${count})</strong>
                </div>
                <div class="progress-track">
                    <div class="progress-fill ${colors[level]}"
                         style="width: ${percentage}%"></div>
                </div>
            </div>`;
    }).join("");

    $("distributionSummary").textContent = total === 0
        ? "No records available yet. Add a traffic record to see the distribution."
        : `${total} total records are included in this overview.`;
}

function renderDashboard() {
    renderStats();
    renderTable();
    renderChart();
}

function showToast(message) {
    const toast = $("toast");
    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(showToast.timeoutId);

    showToast.timeoutId = setTimeout(() => {
        toast.classList.remove("show");
    }, 2600);
}

function openForm() {
    trafficForm.reset();
    $("formError").textContent = "";
    recordModal.classList.remove("hidden");
    $("roadName").focus();
}

function closeForm() {
    recordModal.classList.add("hidden");
    $("formError").textContent = "";
}

$("openFormButton").addEventListener("click", openForm);
$("closeFormButton").addEventListener("click", closeForm);
$("cancelFormButton").addEventListener("click", closeForm);

recordModal.addEventListener("click", event => {
    if (event.target === recordModal) {
        closeForm();
    }
});

document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
        closeForm();
    }
});

searchInput.addEventListener("input", renderTable);
congestionFilter.addEventListener("change", renderTable);

$("resetButton").addEventListener("click", () => {
    searchInput.value = "";
    congestionFilter.value = "all";
    renderTable();
    showToast("Filters have been reset.");
});

// Add a record to the current browser session.

// Add a record permanently to MySQL.
trafficForm.addEventListener("submit", async event => {
    event.preventDefault();

    const road = $("roadName").value.trim();
    const location = $("location").value.trim();
    const vehicles = Number($("vehicles").value);
    const congestion = $("congestion").value;
    const incident = $("incident").value;

    if (!road || !location) {
        $("formError").textContent =
            "Please enter both the road name and location.";
        return;
    }

    if (!Number.isSafeInteger(vehicles) ||
        vehicles < 0 || vehicles > 1000000) {
        $("formError").textContent =
            "Enter a whole vehicle count between 0 and 1,000,000.";
        return;
    }

    try {
        const response = await fetch("/api/roads", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                road,
                location,
                vehicles,
                congestion,
                incident
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Unable to add road");
        }

        closeForm();
        searchInput.value = "";
        congestionFilter.value = "all";

        await loadRecords();
        showToast("Road record saved to MySQL.");
    } catch (error) {
        console.error("Add road error:", error);
        $("formError").textContent =
            error.message || "Could not save the road record.";
    }
});

// Delete a record from the current browser session.
// Delete a record permanently from MySQL.
tableBody.addEventListener("click", async event => {
    const button = event.target.closest("[data-delete-id]");

    if (!button) return;

    const id = Number(button.dataset.deleteId);
    const record = records.find(item => item.id === id);

    if (!record) return;

    const confirmed = window.confirm(
        `Delete the traffic record for ${record.road}?`
    );

    if (!confirmed) return;

    button.disabled = true;

    try {
        const response = await fetch(`/api/roads/${id}`, {
            method: "DELETE"
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Unable to delete road");
        }

        await loadRecords();
        showToast("Road record deleted from MySQL.");
    } catch (error) {
        console.error("Delete road error:", error);
        showToast(error.message || "Could not delete road.");
        button.disabled = false;
    }
});

// Load database records when the page opens.
loadRecords();

/* ===== FOUR-WAY TRAFFIC SIMULATION ===== */

const vehicleLayer = document.getElementById("vehicleLayer");
const simVehicleCount = document.getElementById("simVehicleCount");
const simActiveSignal = document.getElementById("simActiveSignal");
const simCountdown = document.getElementById("simCountdown");
const simStatus = document.getElementById("simStatus");

let simCars = [];
let signalPhase = 0;
let secondsLeft = 10;

// Phase 0: North-South green
// Phase 1: East-West green
let signalDuration = 10;

/* Simulation report metrics */
let vehiclesServed = 0;
let totalWaitSeconds = 0;
let maximumQueue = 0;
let simulationStartTime = Date.now();
let totalWaitSamples = 0;
let controllerMode = "adaptive";




function updateSignals() {
    function setColor(id, color) {
        const signal = document.getElementById(id);
        if (!signal) return;

        const lights = signal.querySelectorAll("span");

        lights[0].className = color === "red" ? "light-red" : "";
        lights[1].className = color === "yellow" ? "light-yellow" : "";
        lights[2].className = color === "green" ? "light-green" : "";
    }

    let northSouth = "red";
    let eastWest = "red";

    if (signalPhase === 0) northSouth = "green";
    if (signalPhase === 1) northSouth = "yellow";
    if (signalPhase === 3) eastWest = "green";
    if (signalPhase === 4) eastWest = "yellow";

    setColor("signalNorth", northSouth);
    setColor("signalSouth", northSouth);
    setColor("signalEast", eastWest);
    setColor("signalWest", eastWest);

    if (simActiveSignal) {
        if (signalPhase === 0 || signalPhase === 1) {
            simActiveSignal.textContent = "North–South";
        } else if (signalPhase === 3 || signalPhase === 4) {
            simActiveSignal.textContent = "East–West";
        } else {
            simActiveSignal.textContent = "All-Red";
        }
    }
}



function setSignal(id, isGreen) {
    const signal = document.getElementById(id);
    if (!signal) return;

    const lights = signal.querySelectorAll("span");

    // Red light
    lights[0].className = isGreen ? "" : "light-red";

    // Yellow light off
    lights[1].className = "";

    // Green light
    lights[2].className = isGreen ? "light-green" : "";
}


function createCar() {
    if (!vehicleLayer) return;

    const car = document.createElement("div");
    car.className = "sim-car";

    const directions = ["north", "south", "east", "west"];
    const direction =
        directions[Math.floor(Math.random() * directions.length)];

    const colors = ["#3984e8", "#e76f51", "#e9b949", "#8b6bd6", "#20a477"];
    car.style.background =
        colors[Math.floor(Math.random() * colors.length)];

    const position = Math.random() * 12 - 6;

    if (direction === "north") {
        car.style.left = `${47 + position / 4}%`;
        car.style.top = "-30px";
        car.dataset.direction = "north";
    } else if (direction === "south") {
        car.style.left = `${53 + position / 4}%`;
        car.style.top = "105%";
        car.dataset.direction = "south";
    } else if (direction === "east") {
        car.classList.add("horizontal-car");
        car.style.left = "105%";
        car.style.top = `${53 + position / 4}%`;
        car.dataset.direction = "east";
    } else {
        car.classList.add("horizontal-car");
        car.style.left = "-30px";
        car.style.top = `${47 + position / 4}%`;
        car.dataset.direction = "west";
    }

    vehicleLayer.appendChild(car);

simCars.push({
    element: car,
    direction: direction,
    position: direction === "north" || direction === "south"
        ? parseFloat(car.style.top)
        : parseFloat(car.style.left),

    waitingTime: 0,
    waitingNow: false
});

    updateVehicleCount();
}


function updateVehicleCount() {
    const count = simCars.length;

    if (simVehicleCount) {
        simVehicleCount.textContent = count;
    }

    const status = document.querySelector(".congestion-status");
    const level = document.getElementById("congestionLevel");
    const message = document.getElementById("congestionMessage");

    if (!status || !level || !message) return;

    let congestion;

    if (count <= 5) {
        congestion = "low";
        message.textContent = "Traffic is flowing smoothly.";
    } else if (count <= 10) {
        congestion = "medium";
        message.textContent = "Moderate traffic detected.";
    } else {
        congestion = "high";
        message.textContent = "Heavy traffic detected.";
    }

    status.classList.remove("low", "medium", "high");
    status.classList.add(congestion);

    level.textContent = congestion.toUpperCase();
}


function calculateGreenDuration(phase) {
    let northSouthCars = 0;
    let eastWestCars = 0;

    simCars.forEach(car => {
        if (
            car.direction === "north" ||
            car.direction === "south"
        ) {
            northSouthCars++;
        } else {
            eastWestCars++;
        }
    });

    const carsOnRoad =
        phase === 0 ? northSouthCars : eastWestCars;

    // More simulated cars = longer green light.
    // Minimum 6 seconds, maximum 15 seconds.
    return Math.min(15, Math.max(6, 6 + carsOnRoad));
}




function moveCars() {
    const gap = 6;
    const speed = 0.45;

    // Process cars from the front to the back of each lane.
    const directions = ["north", "south", "east", "west"];

    directions.forEach(direction => {
        const laneCars = simCars
            .filter(car => car.direction === direction)
            .sort((a, b) => {
                if (direction === "north" || direction === "west") {
                    return b.position - a.position;
                }
                return a.position - b.position;
            });

        let frontCarPosition = null;

        laneCars.forEach(car => {
            let next = car.position;

            const isNorthSouth =
                direction === "north" || direction === "south";

            // Only the green direction can enter the intersection.
            const isGreen = isNorthSouth
                ? signalPhase === 0
                : signalPhase === 3;

            // Move toward the intersection or off the screen.
            if (direction === "north" || direction === "west") {
                next += speed;
            } else {
                next -= speed;
            }

            // Stop at the signal line during yellow, red,
            // and all-red clearance.
            if (!isGreen) {
                if (direction === "north") next = Math.min(next, 26);
                if (direction === "south") next = Math.max(next, 72);
                if (direction === "east") next = Math.max(next, 72);
                if (direction === "west") next = Math.min(next, 26);
            }

            // Maintain distance from the car ahead.
            if (frontCarPosition !== null) {
                if (direction === "north" || direction === "west") {
                    next = Math.min(next, frontCarPosition - gap);
                } else {
                    next = Math.max(next, frontCarPosition + gap);
                }
            }

            // A car that cannot advance is waiting at the signal or in the queue.
            if (Math.abs(next - car.position) < 0.01) {
                car.waitingTime = (car.waitingTime || 0) + 0.05;
            }

            car.position = next;
            frontCarPosition = next;

            if (direction === "north" || direction === "south") {
                car.element.style.top = next + "%";
            } else {
                car.element.style.left = next + "%";
            }
        });
    });

    // Remove vehicles that have left the visible intersection.
    simCars = simCars.filter(car => {
        const outside =
            (car.direction === "north" && car.position > 110) ||
            (car.direction === "south" && car.position < -10) ||
            (car.direction === "east" && car.position < -10) ||
            (car.direction === "west" && car.position > 110);

        if (outside) {
            car.element.remove();
            vehiclesServed++;
            totalWaitSeconds += car.waitingTime || 0;
            totalWaitSamples++;
            return false;
        }

        return true;
    });

    updateVehicleCount();
}



// Change the active signal every 10 seconds.


function changeSignal() {
    secondsLeft--;

    if (secondsLeft <= 0) {

        // Phase 0 = North-South green
        // Phase 1 = North-South yellow
        // Phase 2 = All-red clearance
        // Phase 3 = East-West green
        // Phase 4 = East-West yellow
        // Phase 5 = All-red clearance

        if (signalPhase === 0) {
            signalPhase = 1;
            secondsLeft = 3;
            setSignal("signalNorth", false);
            setSignal("signalSouth", false);
            setSignal("signalEast", false);
            setSignal("signalWest", false);
            setYellowSignal("signalNorth");
            setYellowSignal("signalSouth");

        } else if (signalPhase === 1) {
            signalPhase = 2;
            secondsLeft = 2;
            updateSignals();

        } else if (signalPhase === 2) {
            signalPhase = 3;
            signalDuration = controllerMode === "fixed"
                ? 10
                : calculateGreenDuration(1);
            secondsLeft = signalDuration;
            updateSignals();

        } else if (signalPhase === 3) {
            signalPhase = 4;
            secondsLeft = 3;
            setSignal("signalNorth", false);
            setSignal("signalSouth", false);
            setSignal("signalEast", false);
            setSignal("signalWest", false);
            setYellowSignal("signalEast");
            setYellowSignal("signalWest");

        } else if (signalPhase === 4) {
            signalPhase = 5;
            secondsLeft = 2;
            updateSignals();

        } else {
            signalPhase = 0;
            signalDuration = controllerMode === "fixed"
                ? 10
                : calculateGreenDuration(0);
            secondsLeft = signalDuration;
            updateSignals();
        }
    }

    if (simCountdown) {
        simCountdown.textContent = secondsLeft + " s";
    }
}

function setYellowSignal(id) {
    const signal = document.getElementById(id);
    if (!signal) return;

    const lights = signal.querySelectorAll("span");
    lights[0].className = "";
    lights[1].className = "light-yellow";
    lights[2].className = "";
}



// Start the simulation.
if (vehicleLayer) {
    updateSignals();

    if (simStatus) {
        simStatus.textContent = "SIMULATION RUNNING";
    }

    setInterval(createCar, 1200);
    setInterval(moveCars, 50);
    setInterval(changeSignal, 1000);
}

/* ===== SIGNAL CONTROLLER EXPERIMENT METRICS ===== */

function updateExperimentMetrics() {
    // Count cars currently waiting near a non-green signal as the queue.
    const waitingCount = simCars.filter(car => {
        const isNorthSouth =
            car.direction === "north" || car.direction === "south";
        const isGreen = isNorthSouth ? signalPhase === 0 : signalPhase === 3;
        if (isGreen) return false;
        if (car.direction === "north") return car.position < 27;
        if (car.direction === "south") return car.position > 71;
        if (car.direction === "east") return car.position > 71;
        if (car.direction === "west") return car.position < 27;
        return false;
    }).length;

    if (waitingCount > maximumQueue) {
        maximumQueue = waitingCount;
    }

    const servedEl = document.getElementById("vehiclesServed");
    const waitEl = document.getElementById("averageWait");
    const queueEl = document.getElementById("maximumQueue");

    if (servedEl) servedEl.textContent = vehiclesServed;
    if (waitEl) {
        const avg = totalWaitSamples > 0
            ? (totalWaitSeconds / totalWaitSamples).toFixed(1)
            : "0.0";
        waitEl.textContent = avg + " s";
    }
    if (queueEl) queueEl.textContent = maximumQueue;
}

if (vehicleLayer) {
    setInterval(updateExperimentMetrics, 1000);
}

// Controller mode selector (adaptive vs fixed-time).
const controllerModeSelect = document.getElementById("controllerMode");
if (controllerModeSelect) {
    controllerModeSelect.addEventListener("change", () => {
        controllerMode = controllerModeSelect.value;
        const status = document.getElementById("experimentStatus");
        if (status) {
            status.textContent = controllerMode === "fixed"
                ? "Fixed-time control active: signals run on a fixed schedule."
                : "Adaptive control active: green time adjusts to traffic demand.";
        }
    });
}

// Reset the experiment results.
const resetExperimentButton = document.getElementById("resetExperiment");
if (resetExperimentButton) {
    resetExperimentButton.addEventListener("click", () => {
        vehiclesServed = 0;
        totalWaitSeconds = 0;
        totalWaitSamples = 0;
        maximumQueue = 0;
        simulationStartTime = Date.now();
        updateExperimentMetrics();
        const status = document.getElementById("experimentStatus");
        if (status) status.textContent = "Results reset. Observing a new run.";
    });
}

/* ===== LIVE TRAFFIC DENSITY GRAPH ===== */

const simChart = document.getElementById("simTrafficChart");
const simChartContext = simChart
    ? simChart.getContext("2d")
    : null;

let trafficHistory = [];

function recordTrafficDensity() {
    if (!simChartContext) return;

    trafficHistory.push({
        time: new Date().toLocaleTimeString(),
        count: simCars.length
    });

    // Keep the latest 20 readings.
    if (trafficHistory.length > 20) {
        trafficHistory.shift();
    }

    drawTrafficGraph();
}

function drawTrafficGraph() {
    if (!simChart || !simChartContext) return;

    const width = simChart.clientWidth;
    const height = 220;

    if (width <= 0) return;

    const dpr = window.devicePixelRatio || 1;

    simChart.width = width * dpr;
    simChart.height = height * dpr;

    simChartContext.setTransform(dpr, 0, 0, dpr, 0, 0);

    const ctx = simChartContext;
    const left = 35;
    const right = width - 12;
    const top = 15;
    const bottom = height - 30;
    const graphWidth = right - left;
    const graphHeight = bottom - top;

    const maxCount = Math.max(
        5,
        ...trafficHistory.map(item => item.count)
    );

    ctx.clearRect(0, 0, width, height);

    // Draw horizontal grid lines and labels.
    ctx.font = "11px Arial";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    for (let i = 0; i <= 4; i++) {
        const y = bottom - (graphHeight * i / 4);
        const value = Math.round(maxCount * i / 4);

        ctx.beginPath();
        ctx.strokeStyle = "#e2e8f0";
        ctx.lineWidth = 1;
        ctx.moveTo(left, y);
        ctx.lineTo(right, y);
        ctx.stroke();

        ctx.fillStyle = "#718096";
        ctx.fillText(value, left - 8, y);
    }

    if (trafficHistory.length === 0) return;

    const points = trafficHistory.map((item, index) => ({
        x: left + (
            trafficHistory.length === 1
                ? graphWidth / 2
                : index * graphWidth / (trafficHistory.length - 1)
        ),
        y: bottom - (item.count / maxCount) * graphHeight
    }));

    // Draw the traffic line.
    ctx.beginPath();
    points.forEach((point, index) => {
        if (index === 0) {
            ctx.moveTo(point.x, point.y);
        } else {
            ctx.lineTo(point.x, point.y);
        }
    });

    ctx.strokeStyle = "#3984e8";
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.stroke();

    // Draw a point for every reading.
    points.forEach(point => {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = "#3984e8";
        ctx.fill();
    });

    ctx.fillStyle = "#718096";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("Earlier", left, bottom + 9);

    ctx.textAlign = "right";
    ctx.fillText("Now", right, bottom + 9);
}

// Record vehicle count every 2 seconds.
if (simChartContext) {
    recordTrafficDensity();
    setInterval(recordTrafficDensity, 2000);

    window.addEventListener("resize", drawTrafficGraph);
}

/* Save simulation report to MySQL */

const saveReportButton = document.getElementById("saveSimulationReport");

if (saveReportButton) {
    saveReportButton.addEventListener("click", async function () {
        function getNumber(id) {
            const element = document.getElementById(id);

            if (!element) return 0;

            const match = element.textContent.match(/-?\d+(\.\d+)?/);
            return match ? Number(match[0]) : 0;
        }

        const modeElement = document.getElementById("controllerMode");

        const report = {
            controller_mode: modeElement ? modeElement.value : "adaptive",
            vehicles_served: getNumber("vehiclesServed"),
            average_wait_seconds: getNumber("averageWait"),
            maximum_queue: getNumber("maximumQueue"),
            simulation_duration_seconds:
                typeof simulationStartTime !== "undefined"
                    ? Math.floor((Date.now() - simulationStartTime) / 1000)
                    : 0
        };

        try {
            const response = await fetch("/api/simulation-reports", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(report)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || "Could not save report");
            }

            alert("Simulation report saved successfully!");

            console.log("Saved report:", result);

        } catch (error) {
            console.error("Error saving report:", error);
            alert("Failed to save report. Check the server terminal.");
        }
    });
}

