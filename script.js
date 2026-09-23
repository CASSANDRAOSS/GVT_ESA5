"use strict";

// START AUFGABE_5_KAMERABEWEGUNG_UND_REKURSIVE_KUGEL

// Elemente der Webseite
const canvas = document.getElementById("webglCanvas");
const statusanzeige = document.getElementById("webglStatus");
const kameraAnzeige = document.getElementById("kameraAnzeige");

const kameraLinks = document.getElementById("kameraLinks");
const kameraRechts = document.getElementById("kameraRechts");
const kameraNaeher = document.getElementById("kameraNaeher");
const kameraWeiter = document.getElementById("kameraWeiter");

const tiefeMinus = document.getElementById("tiefeMinus");
const tiefePlus = document.getElementById("tiefePlus");
const tiefeAnzeige = document.getElementById("tiefeAnzeige");
const linienButton = document.getElementById("linienButton");

// WebGL starten
const gl = canvas.getContext("webgl");

if (!gl) {
    statusanzeige.textContent =
        "WebGL konnte in diesem Browser nicht gestartet werden.";
} else {
    try {
        unterwasserszeneStarten();
    } catch (fehler) {
        console.error("Fehler beim Aufbau der Szene:", fehler);

        statusanzeige.textContent =
            "Die Unterwasserszene konnte nicht geladen werden.";
    }
}

function unterwasserszeneStarten() {
    // Der Vertex-Shader berechnet die Bildschirmposition.
    const vertexShaderQuelltext = `
        attribute vec3 aPosition;
        attribute vec3 aFarbe;

        uniform mat4 uProjektion;
        uniform mat4 uAnsicht;

        varying vec3 vFarbe;

        void main() {
            gl_Position =
                uProjektion
                * uAnsicht
                * vec4(aPosition, 1.0);

            vFarbe = aFarbe;
        }
    `;

    const fragmentShaderQuelltext = `
        precision mediump float;

        varying vec3 vFarbe;

        void main() {
            gl_FragColor = vec4(vFarbe, 1.0);
        }
    `;

    function shaderErstellen(typ, quelltext) {
        const shader = gl.createShader(typ);

        gl.shaderSource(shader, quelltext);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            throw new Error(gl.getShaderInfoLog(shader));
        }

        return shader;
    }

    const vertexShader = shaderErstellen(
        gl.VERTEX_SHADER,
        vertexShaderQuelltext
    );

    const fragmentShader = shaderErstellen(
        gl.FRAGMENT_SHADER,
        fragmentShaderQuelltext
    );

    const programm = gl.createProgram();

    gl.attachShader(programm, vertexShader);
    gl.attachShader(programm, fragmentShader);
    gl.linkProgram(programm);

    if (!gl.getProgramParameter(programm, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(programm));
    }

    gl.useProgram(programm);
    gl.enable(gl.DEPTH_TEST);

    const positionAttribut =
        gl.getAttribLocation(programm, "aPosition");

    const farbeAttribut =
        gl.getAttribLocation(programm, "aFarbe");

    const projektionUniform =
        gl.getUniformLocation(programm, "uProjektion");

    const ansichtUniform =
        gl.getUniformLocation(programm, "uAnsicht");

    // Die Kamera kreist um die Y-Achse.
    const kamera = {
        winkel: 0.65,
        radius: 5.8,
        hoehe: 2.2
    };

    const minimumRadius = 3.2;
    const maximumRadius = 9.2;

    // Rekursionstiefe 0 zeigt zunächst den Oktaeder.
    let rekursionstiefe = 0;
    const maximaleTiefe = 4;

    let linienSichtbar = true;

    // Die Szene und die Dreieckslinien erhalten eigene Arrays.
    const positionen = [];
    const farben = [];

    const linienPositionen = [];
    const linienFarben = [];

    const positionPuffer = gl.createBuffer();
    const farbePuffer = gl.createBuffer();

    const linienPositionPuffer = gl.createBuffer();
    const linienFarbePuffer = gl.createBuffer();

    function dreieck(a, b, c, farbeA, farbeB, farbeC) {
        positionen.push(...a, ...b, ...c);
        farben.push(...farbeA, ...farbeB, ...farbeC);
    }

    function viereck(a, b, c, d, farbeA, farbeB) {
        dreieck(a, b, c, farbeA, farbeA, farbeB);
        dreieck(a, c, d, farbeA, farbeB, farbeB);
    }

    // Vektorrechnung für Koralle, Kamera und Perle
    function subtrahieren(a, b) {
        return [
            a[0] - b[0],
            a[1] - b[1],
            a[2] - b[2]
        ];
    }

    function kreuzprodukt(a, b) {
        return [
            a[1] * b[2] - a[2] * b[1],
            a[2] * b[0] - a[0] * b[2],
            a[0] * b[1] - a[1] * b[0]
        ];
    }

    function normieren(v) {
        const laenge = Math.hypot(v[0], v[1], v[2]);

        return [
            v[0] / laenge,
            v[1] / laenge,
            v[2] / laenge
        ];
    }

    function skalarprodukt(a, b) {
        return a[0] * b[0]
            + a[1] * b[1]
            + a[2] * b[2];
    }

    // START AUFGABE_5_UNTERWASSERSZENE

    // Meeresboden: eine flache Scheibe
    function bodenErstellen() {
        const segmente = 48;
        const mitte = [0, -0.12, 0];

        for (let i = 0; i < segmente; i++) {
            const winkelA = 2 * Math.PI * i / segmente;
            const winkelB = 2 * Math.PI * (i + 1) / segmente;

            const a = [
                3.2 * Math.cos(winkelA),
                -0.12,
                3.2 * Math.sin(winkelA)
            ];

            const b = [
                3.2 * Math.cos(winkelB),
                -0.12,
                3.2 * Math.sin(winkelB)
            ];

            const innen = [0.89, 0.80, 0.64];
            const aussen = [0.70, 0.67, 0.58];

            dreieck(mitte, b, a, innen, aussen, aussen);
        }
    }

    // Muschel: gewölbte Form mit Rippen
    function muschelErstellen() {
        const laengengrade = 32;
        const breitengrade = 16;

        function punkt(u, v) {
            const rippen = 1 + 0.075 * Math.cos(12 * u);

            return [
                -1.05
                    + 0.78
                    * rippen
                    * Math.sin(v)
                    * Math.cos(u),

                0.49 + 0.47 * Math.cos(v),

                0.12
                    + 0.55
                    * rippen
                    * Math.sin(v)
                    * Math.sin(u)
            ];
        }

        for (let j = 0; j < breitengrade; j++) {
            const v0 = Math.PI * j / breitengrade;
            const v1 = Math.PI * (j + 1) / breitengrade;

            for (let i = 0; i < laengengrade; i++) {
                const u0 = 2 * Math.PI * i / laengengrade;
                const u1 = 2 * Math.PI * (i + 1) / laengengrade;

                const a = punkt(u0, v0);
                const b = punkt(u1, v0);
                const c = punkt(u1, v1);
                const d = punkt(u0, v1);

                const hell = [0.98, 0.73, 0.65];
                const dunkel = [0.85, 0.46, 0.51];

                const rippe = i % 3 === 0 ? dunkel : hell;

                viereck(a, b, c, d, rippe, hell);
            }
        }
    }

    // Ein Korallenarm verbindet zwei Punkte im Raum.
    function korallenarm(start, ende, radiusUnten, radiusOben) {
        const richtung = normieren(subtrahieren(ende, start));

        const hilfsachse =
            Math.abs(richtung[1]) < 0.9
                ? [0, 1, 0]
                : [1, 0, 0];

        const seite = normieren(
            kreuzprodukt(richtung, hilfsachse)
        );

        const vorne = normieren(
            kreuzprodukt(richtung, seite)
        );

        const segmente = 10;

        function ringpunkt(mitte, radius, winkel) {
            return [
                mitte[0]
                    + radius * (
                        Math.cos(winkel) * seite[0]
                        + Math.sin(winkel) * vorne[0]
                    ),

                mitte[1]
                    + radius * (
                        Math.cos(winkel) * seite[1]
                        + Math.sin(winkel) * vorne[1]
                    ),

                mitte[2]
                    + radius * (
                        Math.cos(winkel) * seite[2]
                        + Math.sin(winkel) * vorne[2]
                    )
            ];
        }

        for (let i = 0; i < segmente; i++) {
            const winkelA = 2 * Math.PI * i / segmente;
            const winkelB = 2 * Math.PI * (i + 1) / segmente;

            const untenA = ringpunkt(
                start,
                radiusUnten,
                winkelA
            );

            const untenB = ringpunkt(
                start,
                radiusUnten,
                winkelB
            );

            const obenA = ringpunkt(
                ende,
                radiusOben,
                winkelA
            );

            const obenB = ringpunkt(
                ende,
                radiusOben,
                winkelB
            );

            const korallrot = [0.91, 0.35, 0.47];
            const korallhell = [1.0, 0.58, 0.51];

            viereck(
                untenA,
                untenB,
                obenB,
                obenA,
                korallrot,
                korallhell
            );
        }
    }

    function koralleErstellen() {
        const fuss = [1.12, -0.08, -0.25];
        const mitte = [1.10, 0.76, -0.25];
        const spitze = [1.12, 1.55, -0.25];

        korallenarm(fuss, mitte, 0.17, 0.11);
        korallenarm(mitte, spitze, 0.11, 0.035);

        korallenarm(
            [1.11, 0.52, -0.25],
            [0.65, 0.91, -0.08],
            0.095,
            0.065
        );

        korallenarm(
            [0.65, 0.91, -0.08],
            [0.43, 1.34, 0.02],
            0.065,
            0.025
        );

        korallenarm(
            [1.10, 0.79, -0.25],
            [1.58, 1.12, -0.18],
            0.10,
            0.065
        );

        korallenarm(
            [1.58, 1.12, -0.18],
            [1.80, 1.53, -0.10],
            0.065,
            0.025
        );

        korallenarm(
            [1.10, 1.05, -0.25],
            [0.81, 1.50, -0.43],
            0.075,
            0.022
        );

        korallenarm(
            [1.12, 1.16, -0.25],
            [1.42, 1.68, -0.42],
            0.075,
            0.022
        );
    }

    // END AUFGABE_5_UNTERWASSERSZENE

    // START AUFGABE_5_REKURSIVE_KUGEL

    // Die Perle wird aus einem Oktaeder rekursiv zur Kugel verfeinert.
    function mittelpunktAufKugel(a, b) {
        const mittelpunkt = [
            (a[0] + b[0]) / 2,
            (a[1] + b[1]) / 2,
            (a[2] + b[2]) / 2
        ];

        return normieren(mittelpunkt);
    }

    function perlenpunkt(punkt) {
        const radius = 0.38;

        return [
            0.05 + radius * punkt[0],
            0.47 + radius * punkt[1],
            0.85 + radius * punkt[2]
        ];
    }

    function perlenfarbe(punkt) {
        const licht = 0.78 + 0.22 * punkt[1];

        return [
            Math.min(1, 0.80 * licht + 0.13),
            Math.min(1, 0.92 * licht + 0.07),
            Math.min(1, 0.94 * licht + 0.06)
        ];
    }

    function linieHinzufuegen(a, b) {
        linienPositionen.push(...a, ...b);

        const linienfarbe = [0.17, 0.36, 0.48];

        linienFarben.push(
            ...linienfarbe,
            ...linienfarbe
        );
    }

    function perlenDreieckZeichnen(a, b, c) {
        const punktA = perlenpunkt(a);
        const punktB = perlenpunkt(b);
        const punktC = perlenpunkt(c);

        dreieck(
            punktA,
            punktB,
            punktC,
            perlenfarbe(a),
            perlenfarbe(b),
            perlenfarbe(c)
        );

        // Die Kanten bleiben als eigener Liniensatz erhalten.
        linieHinzufuegen(punktA, punktB);
        linieHinzufuegen(punktB, punktC);
        linieHinzufuegen(punktC, punktA);
    }

    function dreieckTeilen(a, b, c, tiefe) {
        if (tiefe === 0) {
            perlenDreieckZeichnen(a, b, c);
            return;
        }

        const ab = mittelpunktAufKugel(a, b);
        const bc = mittelpunktAufKugel(b, c);
        const ca = mittelpunktAufKugel(c, a);

        dreieckTeilen(a, ab, ca, tiefe - 1);
        dreieckTeilen(ab, b, bc, tiefe - 1);
        dreieckTeilen(ca, bc, c, tiefe - 1);
        dreieckTeilen(ab, bc, ca, tiefe - 1);
    }

    function perleErstellen() {
        const oben = [0, 1, 0];
        const unten = [0, -1, 0];

        const rechts = [1, 0, 0];
        const links = [-1, 0, 0];

        const vorne = [0, 0, 1];
        const hinten = [0, 0, -1];

        // Acht Dreiecke bilden den ursprünglichen Oktaeder.
        const grunddreiecke = [
            [oben, vorne, rechts],
            [oben, links, vorne],
            [oben, hinten, links],
            [oben, rechts, hinten],

            [unten, rechts, vorne],
            [unten, vorne, links],
            [unten, links, hinten],
            [unten, hinten, rechts]
        ];

        for (const [a, b, c] of grunddreiecke) {
            dreieckTeilen(a, b, c, rekursionstiefe);
        }
    }

    // END AUFGABE_5_REKURSIVE_KUGEL

    // Daten eines Arrays in einen WebGL-Puffer laden
    function pufferFuellen(puffer, daten) {
        gl.bindBuffer(gl.ARRAY_BUFFER, puffer);

        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array(daten),
            gl.DYNAMIC_DRAW
        );
    }

    function geometrieNeuAufbauen() {
        positionen.length = 0;
        farben.length = 0;

        linienPositionen.length = 0;
        linienFarben.length = 0;

        bodenErstellen();
        muschelErstellen();
        koralleErstellen();
        perleErstellen();

        pufferFuellen(positionPuffer, positionen);
        pufferFuellen(farbePuffer, farben);

        pufferFuellen(
            linienPositionPuffer,
            linienPositionen
        );

        pufferFuellen(
            linienFarbePuffer,
            linienFarben
        );

        tiefeAnzeige.textContent =
            "Stufe " + rekursionstiefe;

        tiefeMinus.disabled =
            rekursionstiefe === 0;

        tiefePlus.disabled =
            rekursionstiefe === maximaleTiefe;
    }

    function attributVerbinden(puffer, attribut) {
        gl.bindBuffer(gl.ARRAY_BUFFER, puffer);

        gl.vertexAttribPointer(
            attribut,
            3,
            gl.FLOAT,
            false,
            0,
            0
        );

        gl.enableVertexAttribArray(attribut);
    }

    // START AUFGABE_5_KAMERABERECHNUNG

    // Perspektive: Entferntes erscheint kleiner.
    function perspektive(sichtwinkel, seitenverhaeltnis, nah, fern) {
        const f = 1 / Math.tan(sichtwinkel / 2);

        return new Float32Array([
            f / seitenverhaeltnis, 0, 0, 0,
            0, f, 0, 0,
            0, 0, (fern + nah) / (nah - fern), -1,
            0, 0, 2 * fern * nah / (nah - fern), 0
        ]);
    }

    // Die Blickrichtung aus Eye, Ziel und Up berechnen
    function lookAt(eye, ziel, up) {
        const vorwaerts = normieren(
            subtrahieren(ziel, eye)
        );

        const rechts = normieren(
            kreuzprodukt(vorwaerts, up)
        );

        const oben = kreuzprodukt(rechts, vorwaerts);

        return new Float32Array([
            rechts[0], oben[0], -vorwaerts[0], 0,
            rechts[1], oben[1], -vorwaerts[1], 0,
            rechts[2], oben[2], -vorwaerts[2], 0,

            -skalarprodukt(rechts, eye),
            -skalarprodukt(oben, eye),
            skalarprodukt(vorwaerts, eye),
            1
        ]);
    }

    function zeichnen() {
        const projektion = perspektive(
            Math.PI / 3,
            canvas.width / canvas.height,
            0.1,
            30
        );

        const eye = [
            kamera.radius * Math.sin(kamera.winkel),
            kamera.hoehe,
            kamera.radius * Math.cos(kamera.winkel)
        ];

        const ansicht = lookAt(
            eye,
            [0, 0.65, 0],
            [0, 1, 0]
        );

        gl.viewport(0, 0, canvas.width, canvas.height);

        gl.clearColor(0.82, 0.93, 0.95, 1);

        gl.clear(
            gl.COLOR_BUFFER_BIT
            | gl.DEPTH_BUFFER_BIT
        );

        gl.uniformMatrix4fv(
            projektionUniform,
            false,
            projektion
        );

        gl.uniformMatrix4fv(
            ansichtUniform,
            false,
            ansicht
        );

        // Die Füllung leicht nach hinten versetzen, damit
        // die darüber gezeichneten Linien sichtbar bleiben.
        gl.enable(gl.POLYGON_OFFSET_FILL);
        gl.polygonOffset(1, 1);

        attributVerbinden(
            positionPuffer,
            positionAttribut
        );

        attributVerbinden(
            farbePuffer,
            farbeAttribut
        );

        gl.drawArrays(
            gl.TRIANGLES,
            0,
            positionen.length / 3
        );

        gl.disable(gl.POLYGON_OFFSET_FILL);

        if (linienSichtbar) {
            attributVerbinden(
                linienPositionPuffer,
                positionAttribut
            );

            attributVerbinden(
                linienFarbePuffer,
                farbeAttribut
            );

            gl.drawArrays(
                gl.LINES,
                0,
                linienPositionen.length / 3
            );
        }

        const grad = (
            kamera.winkel * 180 / Math.PI
        ) % 360;

        kameraAnzeige.textContent =
            "Winkel: "
            + Math.round((grad + 360) % 360)
            + "° · Abstand: "
            + kamera.radius.toFixed(1);
    }

    function kameraDrehen(richtung) {
        kamera.winkel += richtung * Math.PI / 18;
        zeichnen();
    }

    function abstandAendern(schritt) {
        kamera.radius = Math.min(
            maximumRadius,
            Math.max(
                minimumRadius,
                kamera.radius + schritt
            )
        );

        zeichnen();
    }

    // END AUFGABE_5_KAMERABERECHNUNG

    function tiefeAendern(schritt) {
        const neueTiefe = Math.min(
            maximaleTiefe,
            Math.max(
                0,
                rekursionstiefe + schritt
            )
        );

        if (neueTiefe === rekursionstiefe) {
            return;
        }

        rekursionstiefe = neueTiefe;

        geometrieNeuAufbauen();
        zeichnen();
    }

    function linienUmschalten() {
        linienSichtbar = !linienSichtbar;

        linienButton.textContent =
            linienSichtbar
                ? "Dreieckslinien ausblenden"
                : "Dreieckslinien einblenden";

        linienButton.setAttribute(
            "aria-pressed",
            String(linienSichtbar)
        );

        zeichnen();
    }

    // START AUFGABE_5_INTERAKTION

    // Buttons
    kameraLinks.addEventListener(
        "click",
        () => kameraDrehen(-1)
    );

    kameraRechts.addEventListener(
        "click",
        () => kameraDrehen(1)
    );

    kameraNaeher.addEventListener(
        "click",
        () => abstandAendern(-0.4)
    );

    kameraWeiter.addEventListener(
        "click",
        () => abstandAendern(0.4)
    );

    tiefeMinus.addEventListener(
        "click",
        () => tiefeAendern(-1)
    );

    tiefePlus.addEventListener(
        "click",
        () => tiefeAendern(1)
    );

    linienButton.addEventListener(
        "click",
        linienUmschalten
    );

    // Tastatur
    document.addEventListener("keydown", function (event) {
        const ziel = event.target;

        if (
            ziel instanceof HTMLElement
            && (
                ziel.isContentEditable
                || ["INPUT", "TEXTAREA", "SELECT"].includes(
                    ziel.tagName
                )
            )
        ) {
            return;
        }

        if (event.key === "ArrowLeft") {
            event.preventDefault();
            kameraDrehen(-1);
        }

        if (event.key === "ArrowRight") {
            event.preventDefault();
            kameraDrehen(1);
        }

        if (
            event.key.toLowerCase() === "n"
            && !event.repeat
        ) {
            abstandAendern(
                event.shiftKey ? 0.4 : -0.4
            );
        }
    });

    // END AUFGABE_5_INTERAKTION

    geometrieNeuAufbauen();
    zeichnen();

    statusanzeige.textContent =
        "Die Szene und die rekursive Perle wurden geladen.";
}

// END AUFGABE_5_KAMERABEWEGUNG_UND_REKURSIVE_KUGEL

// START EIGENE_ERWEITERUNG_SLIDESHOW

// Screenshots aus dem Entstehungsprozess
const fortschrittsbilder = [
    {
        datei: "fortschritt/schritt_01.png",
        alt: "Grundszene mit Meeresboden, Muschel und Koralle",
        beschreibung:
            "Zuerst habe ich den Meeresboden, die Muschel "
            + "und die Koralle aufgebaut und die Kamerafahrt getestet."
    },
    {
        datei: "fortschritt/schritt_02.png",
        alt: "Die Perle auf Stufe 0 mit acht Dreiecksflächen",
        beschreibung:
            "Die Perle beginnt als Oktaeder. Auf Stufe 0 "
            + "sind seine acht Dreiecksflächen noch gut zu erkennen."
    },
    {
        datei: "fortschritt/schritt_03.png",
        alt: "Die deutlich rundere Perle auf Rekursionsstufe 3",
        beschreibung:
            "Auf Stufe 3 wurden die Dreiecke mehrfach geteilt. "
            + "Dadurch sieht die Perle bereits deutlich runder aus."
    },
    {
        datei: "fortschritt/schritt_04.png",
        alt: "Fehlermeldungen sind nicht vorhanden",
        beschreibung:
            "Zum Abschluss habe ich alle Funktionen in Google Chrome "
            + "getestet. Die geöffnete Entwicklerkonsole zeigt, "
            + "dass dabei keine Fehlermeldungen aufgetreten sind."
    }
];

const schrittBild = document.getElementById("schrittBild");
const schrittZaehler = document.getElementById("schrittZaehler");
const schrittBeschreibung =
    document.getElementById("schrittBeschreibung");

const schrittpunkte =
    document.getElementById("schrittpunkte");

const schrittZurueck =
    document.getElementById("schrittZurueck");

const schrittWeiter =
    document.getElementById("schrittWeiter");

let aktuellerSchritt = 0;

function schrittAnzeigen(index) {
    aktuellerSchritt = index;

    const schritt = fortschrittsbilder[aktuellerSchritt];

    schrittBild.src = schritt.datei;
    schrittBild.alt = schritt.alt;

    schrittZaehler.textContent =
        "Bild "
        + (aktuellerSchritt + 1)
        + " von "
        + fortschrittsbilder.length;

    schrittBeschreibung.textContent =
        schritt.beschreibung;

    schrittZurueck.disabled =
        aktuellerSchritt === 0;

    schrittWeiter.disabled =
        aktuellerSchritt === fortschrittsbilder.length - 1;

    const punkte =
        schrittpunkte.querySelectorAll(".schrittpunkt");

    punkte.forEach(function (punkt, punktIndex) {
        if (punktIndex === aktuellerSchritt) {
            punkt.setAttribute("aria-current", "true");
        } else {
            punkt.removeAttribute("aria-current");
        }
    });
}

// Für jedes Bild einen anklickbaren Punkt erstellen
fortschrittsbilder.forEach(function (schritt, index) {
    const punkt = document.createElement("button");

    punkt.type = "button";
    punkt.className = "schrittpunkt";

    punkt.setAttribute(
        "aria-label",
        "Bild " + (index + 1) + " anzeigen"
    );

    punkt.addEventListener("click", function () {
        schrittAnzeigen(index);
    });

    schrittpunkte.appendChild(punkt);
});

schrittZurueck.addEventListener("click", function () {
    schrittAnzeigen(aktuellerSchritt - 1);
});

schrittWeiter.addEventListener("click", function () {
    schrittAnzeigen(aktuellerSchritt + 1);
});

schrittAnzeigen(0);

// END EIGENE_ERWEITERUNG_SLIDESHOW