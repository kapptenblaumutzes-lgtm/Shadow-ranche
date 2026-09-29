<!-- ========================= -->
<!-- BEWERBUNG -->
<!-- ========================= -->

<section id="bewerbung">

    <div class="card">

        <h2>📝 BEWERBUNG</h2>

        <p class="notice">
            Fülle die Bewerbung vollständig aus.
        </p>

        <form id="applicationForm">

            <label>IC-Name</label>

            <input
                type="text"
                id="icName"
                placeholder="Dein IC-Name"
                required
            >

            <label>OOC-Alter</label>

            <input
                type="number"
                id="oocAge"
                placeholder="Dein OOC-Alter"
                min="1"
                max="99"
                required
            >

            <button
                type="submit"
                class="btn primary"
            >
                📤 BEWERBUNG ABSENDEN
            </button>

        </form>

        <div
            id="applicationMessage"
            style="margin-top:15px;"
        ></div>

    </div>

</section>


<!-- ========================= -->
<!-- ADMIN -->
<!-- ========================= -->

<section id="admin">

    <div class="card">

        <h2>🔐 ADMIN PANEL</h2>

        <p class="notice">
            Admin-Code eingeben.
        </p>

        <input
            type="password"
            id="adminCode"
            placeholder="Admin-Code"
            autocomplete="off"
        >

        <button
            type="button"
            class="btn primary"
            onclick="loginAdmin()"
        >
            🔓 ADMIN ÖFFNEN
        </button>

        <div
            id="adminContent"
            style="display:none; margin-top:30px;"
        >

            <h3>📋 BEWERBUNGEN</h3>

            <div
                id="applicationsList"
            >

                <p class="notice">
                    Bewerbungen werden geladen...
                </p>

            </div>

        </div>

    </div>

</section>


<script>

/* ========================= */
/* ADMIN CODE */
/* ========================= */

const ADMIN_CODE = "2580";

let adminLoggedIn = false;


/* ========================= */
/* ADMIN LOGIN */
/* ========================= */

function loginAdmin(){

    const input =
        document.getElementById("adminCode");

    const content =
        document.getElementById("adminContent");


    const code =
        input.value.trim();


    if(code === ADMIN_CODE){

        adminLoggedIn = true;

        content.style.display = "block";

        input.value = "";

        alert("✅ Admin-Zugang erfolgreich!");

        loadApplications();

    }else{

        alert("❌ Falscher Admin-Code!");

        input.value = "";

        input.focus();

    }

}


/* ========================= */
/* BEWERBUNG ABSENDEN */
/* ========================= */

document
.getElementById("applicationForm")
.addEventListener(
    "submit",
    async function(event){

        event.preventDefault();


        const icName =
            document
            .getElementById("icName")
            .value
            .trim();


        const oocAge =
            document
            .getElementById("oocAge")
            .value
            .trim();


        if(!icName || !oocAge){

            alert(
                "❌ Bitte alle Felder ausfüllen."
            );

            return;

        }


        try{

            const response =
                await fetch(
                    "/api/applications",
                    {
                        method:"POST",

                        headers:{
                            "Content-Type":
                                "application/json"
                        },

                        body:JSON.stringify({

                            icName: icName,

                            oocAge: oocAge

                        })

                    }
                );


            const data =
                await response.json();


            if(response.ok){

                document
                .getElementById(
                    "applicationMessage"
                )
                .innerHTML = `
                    <div class="notice">
                        ✅ Bewerbung erfolgreich
                        abgeschickt!
                    </div>
                `;


                document
                .getElementById(
                    "applicationForm"
                )
                .reset();


            }else{

                alert(
                    data.error ||
                    "❌ Bewerbung konnte nicht gesendet werden."
                );

            }


        }catch(error){

            console.error(error);

            alert(
                "❌ Serverfehler beim Absenden."
            );

        }

    }
);


/* ========================= */
/* BEWERBUNGEN LADEN */
/* ========================= */

async function loadApplications(){

    const list =
        document
        .getElementById(
            "applicationsList"
        );


    if(!adminLoggedIn){

        return;

    }


    try{

        const response =
            await fetch(
                "/api/applications"
            );


        if(!response.ok){

            list.innerHTML = `
                <p class="notice">
                    ❌ Bewerbungen konnten
                    nicht geladen werden.
                </p>
            `;

            return;

        }


        const applications =
            await response.json();


        if(
            !applications ||
            applications.length === 0
        ){

            list.innerHTML = `
                <div class="card">
                    <p class="notice">
                        📭 Keine Bewerbungen
                        vorhanden.
                    </p>
                </div>
            `;

            return;

        }


        list.innerHTML =
            applications
            .map(
                application =>
                    createApplicationCard(
                        application
                    )
            )
            .join("");


    }catch(error){

        console.error(error);


        list.innerHTML = `
            <p class="notice">
                ❌ Fehler beim Laden
                der Bewerbungen.
            </p>
        `;

    }

}


/* ========================= */
/* BEWERBUNG KARTE */
/* ========================= */

function createApplicationCard(application){

    let statusText =
        application.status ||
        "offen";


    let statusColor =
        "#d6a84f";


    if(statusText === "angenommen"){

        statusColor = "#238636";

    }


    if(statusText === "abgelehnt"){

        statusColor = "#da3633";

    }


    return `

        <div
            class="card"
            style="
                margin-top:20px;
                border:1px solid #2a241d;
            "
        >

            <h3>
                👤 Bewerbung
            </h3>


            <p>
                <b>IC-Name:</b><br>

                ${escapeHtml(
                    application.icName ||
                    application.name ||
                    "-"
                )}

            </p>


            <p>
                <b>OOC-Alter:</b><br>

                ${escapeHtml(
                    application.oocAge ||
                    application.age ||
                    "-"
                )}

            </p>


            <p>

                <b>Status:</b>

                <span
                    style="
                        color:${statusColor};
                        font-weight:bold;
                    "
                >

                    ${escapeHtml(
                        statusText
                    )}

                </span>

            </p>


            <div
                style="
                    display:flex;
                    gap:10px;
                    flex-wrap:wrap;
                    margin-top:20px;
                "
            >

                <!-- ANNEHMEN -->

                <button
                    type="button"
                    class="btn"
                    style="
                        background:#238636;
                        color:white;
                        border:none;
                    "
                    onclick="
                        updateApplication(
                            '${application.id}',
                            'angenommen'
                        )
                    "
                >
                    ✅ ANNEHMEN
                </button>


                <!-- ABLEHNEN -->

                <button
                    type="button"
                    class="btn"
                    style="
                        background:#da3633;
                        color:white;
                        border:none;
                    "
                    onclick="
                        updateApplication(
                            '${application.id}',
                            'abgelehnt'
                        )
                    "
                >
                    ❌ ABLEHNEN
                </button>


                <!-- BEARBEITEN -->

                <button
                    type="button"
                    class="btn"
                    onclick="
                        editApplication(
                            '${application.id}',
                            '${escapeAttribute(
                                application.icName ||
                                application.name ||
                                ""
                            )}',
                            '${escapeAttribute(
                                application.oocAge ||
                                application.age ||
                                ""
                            )}'
                        )
                    "
                >
                    ✏️ BEARBEITEN
                </button>


                <!-- LÖSCHEN -->

                <button
                    type="button"
                    class="btn"
                    style="
                        background:#555;
                        color:white;
                        border:none;
                    "
                    onclick="
                        deleteApplication(
                            '${application.id}'
                        )
                    "
                >
                    🗑️ LÖSCHEN
                </button>

            </div>

        </div>

    `;

}


/* ========================= */
/* STATUS ÄNDERN */
/* ========================= */

async function updateApplication(
    id,
    status
){

    if(!adminLoggedIn){

        alert(
            "❌ Kein Admin-Zugriff."
        );

        return;

    }


    try{

        const response =
            await fetch(
                "/api/applications/" + id,
                {
                    method:"PUT",

                    headers:{
                        "Content-Type":
                            "application/json"
                    },

                    body:JSON.stringify({

                        status:status

                    })

                }
            );


        if(response.ok){

            if(status === "angenommen"){

                alert(
                    "✅ Bewerbung angenommen!"
                );

            }else{

                alert(
                    "❌ Bewerbung abgelehnt!"
                );

            }


            loadApplications();

        }else{

            alert(
                "❌ Status konnte nicht geändert werden."
            );

        }


    }catch(error){

        console.error(error);

        alert(
            "❌ Serverfehler."
        );

    }

}


/* ========================= */
/* BEWERBUNG BEARBEITEN */
/* ========================= */

async function editApplication(
    id,
    oldName,
    oldAge
){

    if(!adminLoggedIn){

        alert(
            "❌ Kein Admin-Zugriff."
        );

        return;

    }


    const newName =
        prompt(
            "IC-Name bearbeiten:",
            oldName
        );


    if(newName === null){

        return;

    }


    const newAge =
        prompt(
            "OOC-Alter bearbeiten:",
            oldAge
        );


    if(newAge === null){

        return;

    }


    try{

        const response =
            await fetch(
                "/api/applications/" + id,
                {
                    method:"PUT",

                    headers:{
                        "Content-Type":
                            "application/json"
                    },

                    body:JSON.stringify({

                        icName:
                            newName.trim(),

                        oocAge:
                            newAge.trim()

                    })

                }
            );


        if(response.ok){

            alert(
                "✏️ Bewerbung wurde bearbeitet!"
            );

            loadApplications();

        }else{

            alert(
                "❌ Bearbeitung fehlgeschlagen."
            );

        }


    }catch(error){

        console.error(error);

        alert(
            "❌ Serverfehler."
        );

    }

}


/* ========================= */
/* BEWERBUNG LÖSCHEN */
/* ========================= */

async function deleteApplication(
    id
){

    if(!adminLoggedIn){

        alert(
            "❌ Kein Admin-Zugriff."
        );

        return;

    }


    const confirmDelete =
        confirm(
            "⚠️ Bewerbung wirklich löschen?"
        );


    if(!confirmDelete){

        return;

    }


    try{

        const response =
            await fetch(
                "/api/applications/" + id,
                {
                    method:"DELETE"
                }
            );


        if(response.ok){

            alert(
                "🗑️ Bewerbung gelöscht!"
            );

            loadApplications();

        }else{

            alert(
                "❌ Bewerbung konnte nicht gelöscht werden."
            );

        }


    }catch(error){

        console.error(error);

        alert(
            "❌ Serverfehler."
        );

    }

}


/* ========================= */
/* HTML SICHER MACHEN */
/* ========================= */

function escapeHtml(value){

    return String(value)

        .replaceAll(
            "&",
            "&amp;"
        )

        .replaceAll(
            "<",
            "&lt;"
        )

        .replaceAll(
            ">",
            "&gt;"
        )

        .replaceAll(
            '"',
            "&quot;"
        )

        .replaceAll(
            "'",
            "&#039;"
        );

}


function escapeAttribute(value){

    return String(value)

        .replaceAll(
            "\\",
            "\\\\"
        )

        .replaceAll(
            "'",
            "\\'"
        )

        .replaceAll(
            "\n",
            "\\n"
        )

        .replaceAll(
            "\r",
            ""
        );

}

</script>
