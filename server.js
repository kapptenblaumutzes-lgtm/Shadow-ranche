<section id="adminPanel" style="display:none;">

  <div class="card">
    <h2>🔐 SHADOW RANCH – ADMIN PANEL</h2>

    <p class="notice">
      Nur für berechtigte Mitglieder der Bruderschaft.
    </p>

    <div style="margin-top:20px;">
      <input
        id="adminCode"
        type="password"
        placeholder="Admin-Code eingeben"
        autocomplete="off"
        style="
          width:100%;
          padding:14px;
          box-sizing:border-box;
          margin-bottom:12px;
        "
      >

      <button
        class="btn primary"
        onclick="loginAdmin()"
        type="button"
      >
        🔓 ADMIN ÖFFNEN
      </button>
    </div>

    <div id="adminContent" style="display:none; margin-top:25px;">

      <h3>📋 Bewerbungen</h3>

      <div id="applicationsList">
        <p class="notice">Bewerbungen werden geladen...</p>
      </div>

    </div>
  </div>

</section>

<script>

const ADMIN_CODE = "2580";

function loginAdmin(){

    const input = document.getElementById("adminCode");
    const content = document.getElementById("adminContent");

    if(!input){
        alert("❌ Admin-Feld wurde nicht gefunden.");
        return;
    }

    const code = input.value.trim();

    if(code === ADMIN_CODE){

        alert("✅ Admin-Zugang erfolgreich!");

        content.style.display = "block";

        loadApplications();

    }else{

        alert("❌ Falscher Admin-Code!");

        input.value = "";
        input.focus();

    }
}


async function loadApplications(){

    const list = document.getElementById("applicationsList");

    if(!list) return;

    try{

        const response = await fetch("/api/applications");

        if(!response.ok){

            list.innerHTML = `
                <p class="notice">
                    ⚠️ Bewerbungen konnten nicht geladen werden.
                </p>
            `;

            return;
        }

        const applications = await response.json();

        if(!applications || applications.length === 0){

            list.innerHTML = `
                <p class="notice">
                    📭 Keine Bewerbungen vorhanden.
                </p>
            `;

            return;
        }

        list.innerHTML = applications.map(app => `

            <div class="card" style="margin-top:15px;">

                <h3>
                    👤 ${escapeHtml(app.name || "Unbekannt")}
                </h3>

                <p>
                    <b>OOC-Alter:</b>
                    ${escapeHtml(app.age || "-")}
                </p>

                <p>
                    <b>Status:</b>
                    ${escapeHtml(app.status || "Offen")}
                </p>

                <div style="margin-top:15px;">

                    <button
                        class="btn"
                        style="
                            background:#238636;
                            color:white;
                            border:none;
                        "
                        onclick="updateApplication('${app.id}','accepted')"
                    >
                        ✅ ANNEHMEN
                    </button>

                    <button
                        class="btn"
                        style="
                            background:#da3633;
                            color:white;
                            border:none;
                        "
                        onclick="updateApplication('${app.id}','rejected')"
                    >
                        ❌ ABLEHNEN
                    </button>

                    <button
                        class="btn"
                        onclick="deleteApplication('${app.id}')"
                    >
                        🗑️ LÖSCHEN
                    </button>

                </div>

            </div>

        `).join("");

    }catch(error){

        console.error(error);

        list.innerHTML = `
            <p class="notice">
                ❌ Fehler beim Laden der Bewerbungen.
            </p>
        `;
    }
}


async function updateApplication(id,status){

    try{

        const response = await fetch(
            "/api/applications/" + id,
            {
                method:"PUT",

                headers:{
                    "Content-Type":"application/json"
                },

                body:JSON.stringify({
                    status:status
                })
            }
        );

        if(response.ok){

            alert(
                status === "accepted"
                ? "✅ Bewerbung angenommen!"
                : "❌ Bewerbung abgelehnt!"
            );

            loadApplications();

        }else{

            alert("❌ Status konnte nicht geändert werden.");

        }

    }catch(error){

        console.error(error);

        alert("❌ Serverfehler.");
    }
}


async function deleteApplication(id){

    if(!confirm("Bewerbung wirklich löschen?")){
        return;
    }

    try{

        const response = await fetch(
            "/api/applications/" + id,
            {
                method:"DELETE"
            }
        );

        if(response.ok){

            alert("🗑️ Bewerbung gelöscht!");

            loadApplications();

        }else{

            alert("❌ Bewerbung konnte nicht gelöscht werden.");

        }

    }catch(error){

        console.error(error);

        alert("❌ Serverfehler.");
    }
}


function escapeHtml(value){

    return String(value)
        .replaceAll("&","&amp;")
        .replaceAll("<","&lt;")
        .replaceAll(">","&gt;")
        .replaceAll('"',"&quot;")
        .replaceAll("'","&#039;");

}

</script>
